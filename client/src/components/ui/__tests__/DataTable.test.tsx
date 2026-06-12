import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DataTable, type Column } from "../DataTable";

interface Project {
  id: string;
  name: string;
  status: "active" | "archived";
  owner: string;
}

const PROJECTS: Project[] = [
  { id: "p1", name: "Alpha", status: "active", owner: "alice" },
  { id: "p2", name: "Bravo", status: "active", owner: "bob" },
  { id: "p3", name: "Charlie", status: "archived", owner: "carol" },
];

const COLUMNS: Column<Project>[] = [
  { id: "name", header: "Name", accessor: (p) => p.name },
  { id: "owner", header: "Owner", accessor: (p) => p.owner },
  { id: "status", header: "Status", accessor: (p) => p.status },
];

describe("DataTable", () => {
  it("renders column headers and rows", () => {
    render(
      <DataTable
        data={PROJECTS}
        columns={COLUMNS}
        getRowId={(p) => p.id}
        ariaLabel="Projects"
      />,
    );

    const table = screen.getByRole("table", { name: /projects/i });
    expect(within(table).getByText("Name")).toBeInTheDocument();
    expect(within(table).getByText("Alpha")).toBeInTheDocument();
    expect(within(table).getByText("Bravo")).toBeInTheDocument();
    expect(within(table).getByText("Charlie")).toBeInTheDocument();
  });

  it("filters rows via the search input", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        data={PROJECTS}
        columns={COLUMNS}
        getRowId={(p) => p.id}
        searchable
        searchPlaceholder="Search projects"
        searchKeys={["name", "owner"]}
        ariaLabel="Projects"
      />,
    );

    await user.type(screen.getByPlaceholderText(/search projects/i), "alic");

    const table = screen.getByRole("table", { name: /projects/i });
    expect(within(table).getByText("Alpha")).toBeInTheDocument();
    expect(within(table).queryByText("Bravo")).toBeNull();
    expect(within(table).queryByText("Charlie")).toBeNull();
  });

  it("filters rows via a filter select", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        data={PROJECTS}
        columns={COLUMNS}
        getRowId={(p) => p.id}
        filters={[
          {
            id: "status",
            label: "Status",
            options: [
              { value: "", label: "All" },
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
        ariaLabel="Projects"
      />,
    );

    await user.selectOptions(screen.getByLabelText(/status/i), "archived");

    const table = screen.getByRole("table", { name: /projects/i });
    expect(within(table).getByText("Charlie")).toBeInTheDocument();
    expect(within(table).queryByText("Alpha")).toBeNull();
  });

  it("renders row actions and forwards row id on click", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <DataTable
        data={PROJECTS}
        columns={COLUMNS}
        getRowId={(p) => p.id}
        rowActions={(p) => [
          {
            label: "Delete",
            ariaLabel: `Delete ${p.name}`,
            variant: "danger",
            onClick: () => onDelete(p.id),
          },
        ]}
        ariaLabel="Projects"
      />,
    );

    await user.click(screen.getByRole("button", { name: /delete bravo/i }));
    expect(onDelete).toHaveBeenCalledWith("p2");
  });

  it("paginates when data exceeds pageSize", async () => {
    const user = userEvent.setup();
    const many: Project[] = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Project ${i + 1}`,
      status: "active",
      owner: "owner",
    }));
    render(
      <DataTable
        data={many}
        columns={COLUMNS}
        getRowId={(p) => p.id}
        pageSize={5}
        ariaLabel="Projects"
      />,
    );

    const table = screen.getByRole("table", { name: /projects/i });
    expect(within(table).getByText("Project 1")).toBeInTheDocument();
    expect(within(table).queryByText("Project 6")).toBeNull();

    await user.click(screen.getByRole("button", { name: /next page/i }));

    expect(within(table).getByText("Project 6")).toBeInTheDocument();
    expect(within(table).queryByText("Project 1")).toBeNull();
  });

  it("renders the loading state", () => {
    render(
      <DataTable
        data={[]}
        columns={COLUMNS}
        getRowId={(p) => p.id}
        isLoading
        ariaLabel="Projects"
      />,
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders the error state with role=alert", () => {
    render(
      <DataTable
        data={[]}
        columns={COLUMNS}
        getRowId={(p) => p.id}
        isError
        errorMessage="Boom"
        ariaLabel="Projects"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
  });

  it("renders the empty state", () => {
    render(
      <DataTable
        data={[]}
        columns={COLUMNS}
        getRowId={(p) => p.id}
        emptyMessage="No projects yet."
        ariaLabel="Projects"
      />,
    );
    expect(screen.getByText("No projects yet.")).toBeInTheDocument();
  });
});
