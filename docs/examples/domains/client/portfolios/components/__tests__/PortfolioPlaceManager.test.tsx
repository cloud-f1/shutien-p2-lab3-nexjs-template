import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import PortfolioPlaceManager from "../PortfolioPlaceManager";
import { PP_FIXTURE, PLACE_FIXTURES } from "../../../../tests/handlers/portfolios";
import { PLACE_FIXTURES as PLACE_SOURCE } from "../../../../tests/handlers/places";
import type { PortfolioPlaceRead } from "../../../../schemas/portfolio";
import type { PlaceRead } from "../../../../schemas/place";

const places = [PP_FIXTURE] as unknown as PortfolioPlaceRead[];
const availablePlaces = PLACE_SOURCE as unknown as PlaceRead[];
const emptyAvailable: PlaceRead[] = [];

describe("PortfolioPlaceManager", () => {
  it("shows empty state when no places in portfolio", () => {
    render(
      <PortfolioPlaceManager
        places={[]}
        availablePlaces={availablePlaces}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        isAdding={false}
        isRemoving={false}
      />,
    );

    expect(screen.getByText("No places in this portfolio yet.")).toBeInTheDocument();
    expect(screen.getByText("Places in Portfolio (0)")).toBeInTheDocument();
  });

  it("renders places table with formatted values", () => {
    render(
      <PortfolioPlaceManager
        places={places}
        availablePlaces={availablePlaces}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        isAdding={false}
        isRemoving={false}
      />,
    );

    expect(screen.getByText("Places in Portfolio (1)")).toBeInTheDocument();
    expect(screen.getByText("Test Place A")).toBeInTheDocument();
    expect(screen.getByText("$1,000,000.00")).toBeInTheDocument();
    expect(screen.getByText("$1,200,000.00")).toBeInTheDocument();
  });

  it("shows gain/loss with correct class", () => {
    render(
      <PortfolioPlaceManager
        places={places}
        availablePlaces={availablePlaces}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        isAdding={false}
        isRemoving={false}
      />,
    );

    const gainCell = screen.getByText("$200,000.00");
    expect(gainCell.className).toContain("gain-up");
  });

  it("shows Add Place button when selectable places exist", () => {
    // Use available places that are NOT already in the portfolio
    const unlinkedPlaces = [
      {
        ...PLACE_SOURCE[1],
        id: "99999999-9999-9999-9999-999999999999",
      },
    ] as unknown as PlaceRead[];

    render(
      <PortfolioPlaceManager
        places={places}
        availablePlaces={unlinkedPlaces}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        isAdding={false}
        isRemoving={false}
      />,
    );

    expect(screen.getByText("+ Add Place")).toBeInTheDocument();
  });

  it("toggles add form when Add Place is clicked", async () => {
    const user = userEvent.setup();
    const unlinkedPlaces = [
      {
        ...PLACE_SOURCE[1],
        id: "99999999-9999-9999-9999-999999999999",
      },
    ] as unknown as PlaceRead[];

    render(
      <PortfolioPlaceManager
        places={places}
        availablePlaces={unlinkedPlaces}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        isAdding={false}
        isRemoving={false}
      />,
    );

    await user.click(screen.getByText("+ Add Place"));
    expect(screen.getByLabelText("Place *")).toBeInTheDocument();
    expect(screen.getByLabelText("Purchase Price")).toBeInTheDocument();

    // Click the form's Cancel button (type="button") to close the form
    const cancelButtons = screen.getAllByText("Cancel");
    // The second one is the form's cancel button (type=button, btn-secondary)
    const formCancel = cancelButtons.find((btn) =>
      btn.classList.contains("btn-secondary"),
    )!;
    await user.click(formCancel);
    expect(screen.queryByLabelText("Place *")).not.toBeInTheDocument();
  });

  it("calls onRemove when Remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(
      <PortfolioPlaceManager
        places={places}
        availablePlaces={availablePlaces}
        onAdd={vi.fn()}
        onRemove={onRemove}
        isAdding={false}
        isRemoving={false}
      />,
    );

    await user.click(screen.getByText("Remove"));
    expect(onRemove).toHaveBeenCalledWith(PP_FIXTURE.place_id);
  });

  it("hides Add Place button when no selectable places", () => {
    render(
      <PortfolioPlaceManager
        places={places}
        availablePlaces={places.map((p) => p.place) as unknown as PlaceRead[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        isAdding={false}
        isRemoving={false}
      />,
    );

    // No places to add = no button
    expect(screen.queryByText("+ Add Place")).not.toBeInTheDocument();
  });

  it("shows em dash for null notes", () => {
    render(
      <PortfolioPlaceManager
        places={places}
        availablePlaces={availablePlaces}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        isAdding={false}
        isRemoving={false}
      />,
    );

    // PP_FIXTURE has null notes
    expect(screen.getByText("\u2014")).toBeInTheDocument();
  });
});
