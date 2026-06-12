# E173 — Form Primitives Expansion

> Phase 44 — Design System Completion & Validation | Size: M (5 SP) | Deps: E167

## Problem

The framework currently has two form primitives: `<FormField>` (label + input wrapper) and `<Button>`. Real forms in the app need more.

| Surface | Hand-rolled control | Should be |
|---|---|---|
| `SettingsView` (theme picker) | `<select>` with `.settings-input` CSS | `<Select>` primitive |
| `SettingsView` (language picker) | `<select>` with `.settings-input` | `<Select>` |
| `SettingsView` (delete-account confirmation) | bespoke `<input>` with manual error state | `<TextInput>` primitive |
| `SettingsView` (notifications toggle, when added) | `.form-toggle` legacy CSS class | `<Toggle>` primitive |
| Future profile bio field | `<textarea>` with custom CSS | `<TextArea>` primitive |
| Future "agree to terms" checkbox | bespoke `<input type="checkbox">` | `<Checkbox>` |
| Future plan picker (Free / Pro / Enterprise) | bespoke radios | `<RadioGroup>` |

Today these all need custom CSS in the consuming page. The Preset axis can't reach them, so a `setActivePreset(brand)` call doesn't restyle them.

## Solution

Ship seven form primitives in `components/ui/`, all preset-driven, all react-hook-form compatible (forwardRef + standard HTML input semantics).

| Primitive | Wraps | Notes |
|---|---|---|
| `<TextInput>` | `<input type="text" / email / url / tel / search>` | The canonical text input. `<FormField>` already wraps any input, but this primitive owns the input element styling so `setActivePreset` can restyle it. |
| `<TextArea>` | `<textarea>` | Auto-resizing optional via `autosize` prop. |
| `<NumberInput>` | `<input type="number">` | Min/max/step support; preset controls increment-button styling. |
| `<Select>` | `<select>` | Richer than `<FilterSelect>` — separate component because filter use case has a label-row layout. |
| `<Checkbox>` | `<input type="checkbox">` | Standalone label support; play nice with `<FormField>` for error state. |
| `<RadioGroup>` + `<Radio>` | `<input type="radio">` group | Compound component pattern; one error per group. |
| `<Toggle>` | switch UI mapped to `<input type="checkbox">` | Replaces the legacy `.form-toggle` CSS class with a proper component. |

All six get Preset slots, types, tests, and design.md § 4 entries.

## Key Files

| File | Action |
|---|---|
| `client/src/components/ui/{TextInput,TextArea,NumberInput,Select,Checkbox,RadioGroup,Toggle}.tsx` | New — 7 primitive files |
| `client/src/components/ui/preset.ts` | Edit — 7 new Preset slots; both `defaultPreset` + `compactPreset` |
| `client/src/components/ui/index.ts` | Edit — barrel export |
| `client/src/components/ui/__tests__/*.test.tsx` | New — co-located test per primitive (registration + change handler + react-hook-form integration) |
| `client/src/pages/dashboard/views/SettingsView.tsx` | Edit — port `theme picker` and `language picker` to `<Select>`; port `delete-account confirm` to `<TextInput>` (uses `<Modal>` from E174 for the wrapper) |
| `docs/design/design.md` | Edit — § 4 prop tables for 7 new primitives; § 5 expanded "Form recipe" with multi-field example using register |

## Implementation

1. Build `<TextInput>` first (smallest API surface). Verify forwardRef + react-hook-form `register("name")` works.
2. Build `<TextArea>` (variant of TextInput). Add optional autosize.
3. Build `<NumberInput>` (TextInput with type=number + min/max/step props).
4. Build `<Select>` — distinct from `<FilterSelect>` to keep the latter's toolbar-row layout untouched.
5. Build `<Checkbox>` and `<RadioGroup>` + `<Radio>` (compound). Test focus-visible behavior.
6. Build `<Toggle>` last — port the visual from `styles/common/forms.css` `.form-toggle` rule, then delete that rule (gated on E170 cleanup).
7. Migrate `SettingsView` theme/language pickers to `<Select>`. Manual visual check across 6 themes.
8. Update design.md § 4 prop tables; add § 5 form recipe example with all 7 primitives composed.

## Acceptance Criteria

- [ ] 7 new primitives shipped, each with Preset slot + co-located test
- [ ] Each primitive forwards refs and works with `react-hook-form` `register("name")`
- [ ] `SettingsView` theme + language pickers migrated to `<Select>`
- [ ] All client tests pass; build green
- [ ] `defaultPreset` and `compactPreset` both updated for all 7 slots
- [ ] No new hardcoded Tailwind class strings in the new primitives (audit grep passes)
- [ ] design.md § 4 lists all 7 with prop tables; § 5 has a complete-form recipe
- [ ] Stop-verifier clean

## Alignment / Cross-Epic Hooks

- **Hard-depends on E167** — uses Preset axis + `<FormField>` wrapper.
- **Pairs with E174** — `<Modal>` wraps the delete-account confirmation that uses `<TextInput>` from this epic.
- **Enables E170 cleanup** — once `<Toggle>` ships, the legacy `.form-toggle` rule in `styles/common/forms.css` becomes deletable.
- **Pairs with E172** — error messages from these primitives can use `ui.json` keys.

## Out of Scope

- **Date / time pickers** — calendar widget is a complex build; defer until a feature actually needs it.
- **File upload** — depends on backend pre-signed URL endpoint; separate epic.
- **Combobox / autocomplete** — could use `<TextInput>` + dropdown but the search+select interaction is complex; defer.
- **Phone-number input with country code** — defer until needed.
- **Color picker** — defer; ThemeProvider doesn't expose it.
- **Form-level helpers** like `<FormSection>`, `<FieldRow>`, `<FormActions>` — fold into E178 layout primitives.
