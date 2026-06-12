# E178 — Layout Primitive Trio (Card + Tabs + Stack)

> Phase 44 — Design System Completion & Validation | Size: M (5 SP) | Deps: E167

## Problem

Three layout patterns appear repeatedly in the app but have no shared primitive:

| Pattern | Where it appears | Currently |
|---|---|---|
| **Card / Panel** | `OverviewView`, `ProjectsView`, `SystemHealthView`, every public-page section after E168 | `<div class="panel">` (legacy CSS) or `<div class="c-card">` (legacy `c-` prefix in `styles/common/cards.css`) |
| **Tabs** | `SettingsView` would benefit (Profile / Security / Billing / Notifications tabs); future detail views | Doesn't exist; SettingsView uses `settings-section` divs stacked vertically |
| **Stack / VStack / HStack** | Every page that places multiple elements with consistent gap | Inline Tailwind `flex flex-col gap-4` or `space-y-6` (works but verbose, not preset-aware) |

Plus a fourth, **`<Disclosure>` / `<Accordion>`** — the "show more" expandable section. Used today nowhere, but useful for the planned legal-page TOC and future help docs.

## Solution

Ship five layout primitives in `components/ui/`, all preset-driven.

### `<Card>` — replaces `.panel` and `.c-card`

```tsx
<Card variant="default" header={<CardHeader title="Recent activity" />} footer={<Button>View all</Button>}>
  {/* body */}
</Card>
```

- Variants: `default` | `glow` | `subtle`
- Composes with `<CardHeader>` (title + actions slot) and `<CardFooter>` (action row).

### `<Tabs>` — composable

```tsx
<Tabs defaultValue="profile" onValueChange={…}>
  <TabsList>
    <TabsTrigger value="profile">Profile</TabsTrigger>
    <TabsTrigger value="security">Security</TabsTrigger>
    <TabsTrigger value="billing">Billing</TabsTrigger>
  </TabsList>
  <TabsPanel value="profile"><ProfileForm /></TabsPanel>
  <TabsPanel value="security"><SecurityForm /></TabsPanel>
  <TabsPanel value="billing"><BillingForm /></TabsPanel>
</Tabs>
```

- Keyboard: arrow-left/right cycles tabs, Home/End jumps to first/last
- A11y: full `role="tablist"` / `role="tab"` / `role="tabpanel"` + `aria-controls` + `aria-selected`
- URL-sync optional via prop (`?tab=security`)

### `<Stack>` / `<HStack>` / `<VStack>`

```tsx
<Stack direction="column" gap="md" align="stretch">…</Stack>
<HStack gap="sm" justify="between">…</HStack>
<VStack gap="lg">…</VStack>
```

Thin wrappers over `<div class="flex …">`. The point isn't to save typing — it's to make spacing decisions Preset-controlled (`gap="md"` resolves to whatever the active preset says "md gap" means). Three sizes: `sm` / `md` / `lg`. Justify/align match Tailwind's flex semantics.

### `<Disclosure>` / `<Accordion>`

```tsx
<Accordion>
  <AccordionItem title="What is the refund policy?">
    Content.
  </AccordionItem>
  <AccordionItem title="How do I cancel?" defaultOpen>
    Content.
  </AccordionItem>
</Accordion>
```

- Single `<Disclosure>` for one collapsible block; `<Accordion>` allows multiple. `type="single" | "multiple"` controls whether opening one closes others.
- Keyboard: Space/Enter toggles; arrows navigate between triggers.

## Key Files

| File | Action |
|---|---|
| `client/src/components/ui/{Card,CardHeader,CardFooter,Tabs,Stack,Disclosure,Accordion}.tsx` | New — 7 primitives (Tabs is compound, exports 4 sub-components) |
| `client/src/components/ui/preset.ts` | Edit — 4 new Preset slots; both presets updated |
| `client/src/components/ui/index.ts` | Edit — barrel export |
| `client/src/components/ui/__tests__/*.test.tsx` | New — co-located test per primitive (especially Tabs: keyboard nav, ARIA correctness) |
| `client/src/pages/dashboard/views/SettingsView.tsx` | Edit — port `settings-section` divs to `<Tabs>` (4 tabs: Profile / Security / Notifications / Danger Zone) |
| `client/src/pages/dashboard/views/OverviewView.tsx` | Edit — port `<div class="panel">` to `<Card>` (proof-of-concept) |
| `docs/design/design.md` | Edit — § 4 prop tables; § 5 "Settings recipe with Tabs" |

## Implementation

1. Build `<Stack>` / `<HStack>` / `<VStack>` first (smallest API surface, used by every other primitive's tests).
2. Build `<Card>` + `<CardHeader>` + `<CardFooter>`. Replace `<div class="panel">` in `OverviewView` as proof.
3. Build `<Tabs>` compound — TabsList / TabsTrigger / TabsPanel. Implement keyboard model carefully (it's the trickiest part).
4. Migrate `SettingsView` to `<Tabs>`. Verify URL-sync optional behavior.
5. Build `<Disclosure>` + `<Accordion>` last (simpler than Tabs but useful for future docs/FAQ pages).
6. Update design.md.

## Acceptance Criteria

- [ ] 7 layout primitives shipped (Card + 2 sub, Tabs + 3 sub, Stack + 2 aliases, Disclosure, Accordion)
- [ ] `<Tabs>` keyboard model passes the WAI-ARIA APG tabs pattern (arrow keys, Home/End, type-ahead optional)
- [ ] `SettingsView` migrated to `<Tabs>` (4 tabs); existing form behavior unchanged
- [ ] `OverviewView` uses `<Card>` for at least one panel (proof-of-concept)
- [ ] Both presets updated for all 4 new Preset slots
- [ ] All client tests pass; build green
- [ ] design.md § 4 + § 5 documented
- [ ] No new hardcoded Tailwind class strings in primitives (audit grep passes)
- [ ] Stop-verifier clean

## Alignment / Cross-Epic Hooks

- **Hard-depends on E167** — uses Preset axis.
- **Soft-pairs with E175** — `<DropdownMenu>` (E175) and `<Tabs>` (E178) both implement keyboard nav patterns; share helpers.
- **Enables E170 cleanup** — `.panel` and `.c-card` rules become deletable once `<Card>` migration completes.
- **Enables future epics** — Tabs unlocks rich Settings/Profile pages; Accordion unlocks FAQ / docs pages.

## Out of Scope

- **Vertical tabs** — current `<Tabs>` is horizontal only. Vertical layout is a Preset slot decision and can be added later.
- **Tab badges / counts** — keep TabsTrigger flexible (accepts ReactNode children) so badges compose naturally without a dedicated prop.
- **Drag-to-reorder tabs** — out of scope.
- **Card with checkbox / selectable cards** — defer; not yet a real use case.
- **Carousel / Slider** — separate epic if needed.
- **Resizable split panes** — separate epic.
