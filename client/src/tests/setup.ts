import { beforeAll, afterAll, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { setupServer } from "msw/node";
import { handlers } from "./handlers/auth";
import { adminHandlers } from "./handlers/admin";
import { sessionHandlers, resetSessionFixtures } from "./handlers/sessions";
import "../i18n"; // Initialize i18n for all tests

export const server = setupServer(
  ...handlers,
  ...adminHandlers,
  ...sessionHandlers,
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetSessionFixtures();
});
afterAll(() => server.close());
