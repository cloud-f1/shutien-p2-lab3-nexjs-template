import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.mock is hoisted above imports — use vi.hoisted() so the spy survives that hoist.
const { initSpy } = vi.hoisted(() => ({ initSpy: vi.fn() }));

vi.mock("@sentry/react", () => ({
  init: initSpy,
  browserTracingIntegration: () => ({ name: "BrowserTracing" }),
}));

import { initSentry } from "../sentry";

describe("initSentry", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  // Snapshot the env so each test can mutate freely without leaking state.
  const originalEnv = { ...import.meta.env } as Record<string, unknown>;

  beforeEach(() => {
    initSpy.mockReset();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    // Restore any env mutations.
    for (const key of Object.keys(import.meta.env)) {
      if (!(key in originalEnv)) {
        delete (import.meta.env as Record<string, unknown>)[key];
      }
    }
    Object.assign(import.meta.env, originalEnv);
  });

  it("is a no-op when DSN is empty in development", () => {
    (import.meta.env as Record<string, unknown>).VITE_SENTRY_DSN = "";
    (import.meta.env as Record<string, unknown>).PROD = false;
    (import.meta.env as Record<string, unknown>).MODE = "development";

    initSentry();

    expect(initSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns (does NOT throw) when DSN is empty in production", () => {
    (import.meta.env as Record<string, unknown>).VITE_SENTRY_DSN = "";
    (import.meta.env as Record<string, unknown>).PROD = true;
    (import.meta.env as Record<string, unknown>).MODE = "production";

    expect(() => initSentry()).not.toThrow();
    expect(initSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
    const warnArg = warnSpy.mock.calls[0][0] as string;
    expect(warnArg).toContain("VITE_SENTRY_DSN");
  });

  it("initialises Sentry with release + sample rates when DSN is present", () => {
    (import.meta.env as Record<string, unknown>).VITE_SENTRY_DSN =
      "https://example@o0.ingest.sentry.io/0";
    (import.meta.env as Record<string, unknown>).VITE_GIT_SHA = "abc1234";
    (import.meta.env as Record<string, unknown>).PROD = true;
    (import.meta.env as Record<string, unknown>).MODE = "production";

    initSentry();

    expect(initSpy).toHaveBeenCalledOnce();
    const call = initSpy.mock.calls[0][0];
    expect(call.dsn).toBe("https://example@o0.ingest.sentry.io/0");
    expect(call.release).toBe("abc1234");
    expect(call.environment).toBe("production");
    expect(call.tracesSampleRate).toBe(0.1);
    expect(call.sendDefaultPii).toBe(false);
  });

  it("falls back to release='unknown' when VITE_GIT_SHA is missing", () => {
    (import.meta.env as Record<string, unknown>).VITE_SENTRY_DSN =
      "https://example@o0.ingest.sentry.io/0";
    delete (import.meta.env as Record<string, unknown>).VITE_GIT_SHA;
    (import.meta.env as Record<string, unknown>).PROD = false;
    (import.meta.env as Record<string, unknown>).MODE = "development";

    initSentry();

    expect(initSpy).toHaveBeenCalledOnce();
    const call = initSpy.mock.calls[0][0];
    expect(call.release).toBe("unknown");
    expect(call.tracesSampleRate).toBe(1.0);
  });
});
