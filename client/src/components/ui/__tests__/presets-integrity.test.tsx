import { describe, it, expect, afterEach } from "vitest";
import {
  defaultPreset,
  getActivePreset,
  setActivePreset,
  resetActivePreset,
  type Preset,
} from "../preset";
import { compactPreset } from "../presets/compact";
import { editorialPreset } from "../presets/editorial";
import { densePreset } from "../presets/dense";

/**
 * E179 — Brand Preset Starter Pack integrity tests.
 *
 * These tests guard the contract that every shipped preset must:
 *   1. Cover every key declared on the `Preset` interface (TypeScript already
 *      enforces this at compile time via `: Preset`, but a runtime check
 *      catches accidental `as Preset` casts that could ship an incomplete
 *      preset).
 *   2. Inherit one-directionally — editorial spreads default, dense spreads
 *      compact. We enforce by checking that overlapping leaf slots use the
 *      ancestor object reference where they were not deliberately overridden.
 *   3. Round-trip through `setActivePreset` / `getActivePreset` without
 *      mutation.
 */
describe("Brand presets (E179) — integrity", () => {
  afterEach(() => {
    resetActivePreset();
  });

  // The full key list every preset must contain. Mirrors the `Preset`
  // interface in preset.ts. If a new top-level slot is added to the
  // interface, this list MUST be updated and every shipped preset MUST
  // cover the new slot (the test will fail on any preset missing it).
  const REQUIRED_PRESET_KEYS: Array<keyof Preset> = [
    "name",
    "button",
    "table",
    "pagination",
    "breadcrumb",
    "searchInput",
    "filterSelect",
    "formField",
    "pageContainer",
    "publicLayout",
    "navBar",
    "footer",
    "heroSection",
    "featureGrid",
    "section",
    "ctaBanner",
    "prose",
    "emptyState",
    "authLayout",
    "authCard",
    "dividerLabel",
    "banner",
    "textInput",
    "textArea",
    "numberInput",
    "select",
    "checkbox",
    "radioGroup",
    "toggle",
    "modal",
    "drawer",
    "toast",
    "dropdownMenu",
    "navItem",
    "card",
    "tabs",
    "stack",
    "disclosure",
    "accordion",
  ];

  const SHIPPED_PRESETS: Array<{ name: string; preset: Preset }> = [
    { name: "default", preset: defaultPreset },
    { name: "compact", preset: compactPreset },
    { name: "editorial", preset: editorialPreset },
    { name: "dense", preset: densePreset },
  ];

  it.each(SHIPPED_PRESETS)(
    "$name preset has every required slot defined",
    ({ preset }) => {
      for (const key of REQUIRED_PRESET_KEYS) {
        expect(preset[key], `missing slot: ${String(key)}`).toBeDefined();
      }
    },
  );

  it("editorialPreset inherits from defaultPreset (one-direction spread)", () => {
    // Slots editorialPreset deliberately does NOT override should be the
    // exact same object reference as defaultPreset.
    expect(editorialPreset.publicLayout).toBe(defaultPreset.publicLayout);
    expect(editorialPreset.formField).toBe(defaultPreset.formField);
    expect(editorialPreset.searchInput).toBe(defaultPreset.searchInput);

    // Slots editorialPreset DOES override should differ.
    expect(editorialPreset.button).not.toBe(defaultPreset.button);
    expect(editorialPreset.heroSection).not.toBe(defaultPreset.heroSection);
    expect(editorialPreset.featureGrid).not.toBe(defaultPreset.featureGrid);
    expect(editorialPreset.card).not.toBe(defaultPreset.card);
    expect(editorialPreset.prose).not.toBe(defaultPreset.prose);
    expect(editorialPreset.breadcrumb.separatorGlyph).toBe("›");
  });

  it("densePreset inherits from compactPreset (one-direction spread)", () => {
    // Slots dense doesn't override fall through to compact.
    expect(densePreset.checkbox).toBe(compactPreset.checkbox);
    expect(densePreset.radioGroup).toBe(compactPreset.radioGroup);
    expect(densePreset.toggle).toBe(compactPreset.toggle);

    // Slots dense overrides differ from compact AND default.
    expect(densePreset.button).not.toBe(compactPreset.button);
    expect(densePreset.button).not.toBe(defaultPreset.button);
    expect(densePreset.table).not.toBe(compactPreset.table);
    expect(densePreset.card).not.toBe(compactPreset.card);

    // Sanity-check density is actually denser — dense table padding < compact.
    expect(densePreset.table.td).toContain("py-1");
    expect(densePreset.table.th).toContain("py-1");
  });

  it("setActivePreset(editorialPreset) round-trips through getActivePreset", () => {
    setActivePreset(editorialPreset);
    expect(getActivePreset()).toBe(editorialPreset);
    expect(getActivePreset().name).toBe("editorial");

    setActivePreset(densePreset);
    expect(getActivePreset()).toBe(densePreset);
    expect(getActivePreset().name).toBe("dense");
  });

  it("each shipped preset has a distinct, non-empty name", () => {
    const names = SHIPPED_PRESETS.map(({ preset }) => preset.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
    for (const n of names) {
      expect(n).toBeTruthy();
    }
  });
});
