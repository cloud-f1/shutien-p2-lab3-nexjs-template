import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { server } from "../../tests/setup";
import { contactHandlers, CONTACT_FIXTURES } from "../../tests/handlers/contacts";
import ContactsPage from "./ContactsPage";

const BASE = "http://localhost:8080";

function renderContacts() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ContactsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ContactsPage", () => {
  beforeEach(() => {
    server.use(...contactHandlers);
  });

  it("renders contacts list with data from fixtures", async () => {
    renderContacts();

    expect(await screen.findByText("Contacts (2)")).toBeInTheDocument();
  });

  it("shows empty state when API returns empty list", async () => {
    server.use(
      http.get(`${BASE}/contacts`, () =>
        HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 20,
          pages: 0,
        }),
      ),
    );

    renderContacts();

    expect(await screen.findByText("No contacts yet")).toBeInTheDocument();
  });

  it("shows loading state while fetching", () => {
    server.use(
      http.get(`${BASE}/contacts`, async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json({
          items: CONTACT_FIXTURES,
          total: 2,
          page: 1,
          page_size: 20,
          pages: 1,
        });
      }),
    );

    renderContacts();
    expect(screen.getByText("Loading contacts...")).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    server.use(
      http.get(`${BASE}/contacts`, () =>
        HttpResponse.json({ detail: "Server Error" }, { status: 500 }),
      ),
    );

    renderContacts();

    expect(
      await screen.findByText("Failed to load contacts. Please try again."),
    ).toBeInTheDocument();
  });

  it("opens create form when Add button is clicked", async () => {
    const user = userEvent.setup();
    renderContacts();

    const addBtn = await screen.findByText("+ Add Contact");
    await user.click(addBtn);

    expect(screen.getByText("Add Contact")).toBeInTheDocument();
  });
});
