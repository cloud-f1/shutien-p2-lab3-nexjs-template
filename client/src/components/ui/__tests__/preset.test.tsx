import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { Button } from "../Button";
import {
  defaultPreset,
  getActivePreset,
  resetActivePreset,
  setActivePreset,
  type Preset,
} from "../preset";
import { compactPreset } from "../presets/compact";

describe("Preset system", () => {
  afterEach(() => {
    resetActivePreset();
  });

  it("starts with the default preset", () => {
    expect(getActivePreset().name).toBe("default");
  });

  it("setActivePreset swaps the active preset", () => {
    setActivePreset(compactPreset);
    expect(getActivePreset().name).toBe("compact");
  });

  it("resetActivePreset restores the default", () => {
    setActivePreset(compactPreset);
    resetActivePreset();
    expect(getActivePreset().name).toBe("default");
  });

  it("Button uses default preset sizes by default", () => {
    render(<Button size="md">Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    // Default md size has px-6 py-3
    expect(btn.className).toContain("px-6");
    expect(btn.className).toContain("py-3");
  });

  it("Button picks up the compact preset after swap", () => {
    setActivePreset(compactPreset);
    render(<Button size="md">Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    // Compact md size has px-4 py-2 (smaller than default)
    expect(btn.className).toContain("px-4");
    expect(btn.className).toContain("py-2");
    expect(btn.className).not.toContain("px-6");
  });

  it("supports slot-level overrides via spread", () => {
    const branded: Preset = {
      ...defaultPreset,
      name: "branded",
      breadcrumb: {
        ...defaultPreset.breadcrumb,
        separatorGlyph: "›",
      },
    };
    setActivePreset(branded);
    expect(getActivePreset().breadcrumb.separatorGlyph).toBe("›");
    // Other slots remain at default
    expect(getActivePreset().button).toBe(defaultPreset.button);
  });
});
