// Vitest global setup — wires up @testing-library/jest-dom's custom matchers
// (toBeInTheDocument / toHaveClass / toBeDisabled …). Importing this in the node
// environment is harmless (it only extends `expect`); component tests opt into
// the DOM environment per-file via `// @vitest-environment jsdom`.
import "@testing-library/jest-dom/vitest"

import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

// jsdom doesn't implement matchMedia (E338 — `useIsMobile()` in
// `hooks/use-mobile.ts`, now also used by `<DataTable>`, subscribes to it via
// `useSyncExternalStore`). Guarded for the node-env (non-component) test
// files, where `window` doesn't exist at all.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

// This repo does NOT enable vitest's `test.globals`, so @testing-library/react's
// own auto-cleanup (which only registers if it finds a global `afterEach`) never
// fires — without this, jsdom nodes from one component test leak into the next,
// causing "found multiple elements" failures. `cleanup()` only touches the DOM
// when something was actually `render()`-ed, so this is a no-op for node-env
// (non-component) test files.
afterEach(() => {
  cleanup()
})
