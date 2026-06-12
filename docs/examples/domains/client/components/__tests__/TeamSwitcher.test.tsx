import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamSwitcher } from "../TeamSwitcher";
import { server } from "../../tests/setup";
import { teamHandlers, TEAM_FIXTURES } from "../../tests/handlers/teams";
import { createWrapper } from "../../tests/helpers/createWrapper";

describe("TeamSwitcher", () => {
  beforeEach(() => {
    server.use(...teamHandlers);
    sessionStorage.clear();
  });

  it("renders loading state initially", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <TeamSwitcher />
      </Wrapper>,
    );
    expect(screen.getByText("Loading teams...")).toBeInTheDocument();
  });

  it("renders team options after loading", async () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <TeamSwitcher />
      </Wrapper>,
    );

    const select = await screen.findByLabelText("Select active team");
    expect(select).toBeInTheDocument();

    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(TEAM_FIXTURES.length);
    expect(options[0].textContent).toContain("Alpha Team");
    expect(options[1].textContent).toContain("Beta Team");
  });

  it("shows role in each option", async () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <TeamSwitcher />
      </Wrapper>,
    );

    const select = await screen.findByLabelText("Select active team");
    const options = select.querySelectorAll("option");
    expect(options[0].textContent).toContain("owner");
    expect(options[1].textContent).toContain("editor");
  });

  it("stores selection in sessionStorage on change", async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <TeamSwitcher />
      </Wrapper>,
    );

    const select = await screen.findByLabelText("Select active team");
    await user.selectOptions(select, TEAM_FIXTURES[1].id);

    expect(sessionStorage.getItem("active-team-id")).toBe(
      TEAM_FIXTURES[1].id,
    );
  });

  it("shows empty state when no teams", async () => {
    const { http, HttpResponse } = await import("msw");
    server.use(
      http.get("http://localhost:8080/teams", () =>
        HttpResponse.json([]),
      ),
    );

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <TeamSwitcher />
      </Wrapper>,
    );

    expect(
      await screen.findByTestId("team-switcher-empty"),
    ).toBeInTheDocument();
    expect(screen.getByText("No teams")).toBeInTheDocument();
  });

  it("has correct ARIA attributes", async () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <TeamSwitcher />
      </Wrapper>,
    );

    const select = await screen.findByLabelText("Select active team");
    expect(select.tagName).toBe("SELECT");
    expect(select).toHaveAttribute("id", "team-select");
  });
});
