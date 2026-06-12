import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { CACHE_TIERS } from "./cacheConfig";
import { initSentry } from "./observability/sentry";
import {
  setActivePreset,
  resetActivePreset,
  defaultPreset,
  compactPreset,
} from "./components/ui";
import "./i18n"; // i18n must be imported before App to ensure translations are ready
import "./styles/globals.css";

// Sentry first — initialise before React mounts so early render errors are captured (E159 Part 1c).
initSentry();

/* ─────────────────────────────────────────────────────────────────────────
 * E211 — VRT preset bridge (dev / e2e only).
 *
 * The preset axis (components/ui/preset.ts) is module-level singleton state
 * that Playwright cannot reach from the page context. Expose a tiny bridge on
 * `window` so the VRT matrix (e2e/helpers/theme-preset.ts) can flip default ↔
 * compact at runtime.
 *
 * GATED: only attaches under `import.meta.env.DEV` or an explicit `VITE_E2E`
 * flag — it is tree-shaken out of a production build so no test seam ships to
 * end users.
 * ───────────────────────────────────────────────────────────────────────── */
if (import.meta.env.DEV || import.meta.env.VITE_E2E) {
  const PRESETS = {
    default: defaultPreset,
    compact: compactPreset,
  } as const;

  (
    window as unknown as {
      __setActivePreset?: (name: keyof typeof PRESETS) => void;
    }
  ).__setActivePreset = (name) => {
    const next = PRESETS[name];
    if (next) {
      setActivePreset(next);
    } else {
      resetActivePreset();
    }
  };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: CACHE_TIERS.STANDARD.staleTime, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
