# E18 — Domain UI: Places & Portfolio Pages

> **Size**: L (2-3 sessions) | **Depends on**: E17 (Decimal types)
> **Status**: spec
> **Suggested split**: E18a (Places UI, ~10 SP) + E18b (Portfolio + Charts, ~11 SP)

---

## Goal

Build interactive CRUD pages for Places and Portfolios that consume the existing service factories (`placesService`, `portfoliosService`), replacing the static dashboard placeholders with live data views. Integrate Recharts for portfolio analytics visualisation.

## Problem Statement

The backend API for Places (E7) and Portfolios (E8) is fully implemented with CRUD endpoints, pagination, sub-resource management (portfolio places), and analytics. The client has service factories (`placesService`, `portfoliosService`), Zod schemas, and MSW test handlers — all ready to consume. However, there are **no UI pages** that use them. The current DashboardPage renders only static placeholder content.

Key constraints:
- **E17 changed monetary fields to `string` (Decimal)** — the UI must parse/format string values for display (e.g., `"1200000.00"` -> `$1,200,000.00`) and submit string values in forms. Never use `parseFloat` for display; use `Intl.NumberFormat` or a formatting utility.
- **Existing service layer is complete** — `placesService.list()`, `portfoliosService.list()`, `getPortfolioDetail()`, `getPortfolioAnalytics()`, `portfolioPlacesApi.*` are all implemented with Zod validation.
- **Existing MSW handlers are complete** — `placeHandlers` and `portfolioHandlers` with full fixtures are ready for testing.

---

## Phase Split Strategy

### E18a — Places UI (~10 SP)

| Deliverable | Description |
|-------------|-------------|
| PlacesPage (list) | Paginated table/card list of user's places |
| PlaceDetailView | Single place view with all fields |
| PlaceFormModal | Create/edit form with Zod validation |
| Delete confirmation | Modal or inline confirm for place deletion |
| Navigation | Sidebar nav item under "Workspace" section |
| CSS | `Places.css` using common/ primitives |
| Tests | 8-12 component tests with MSW |

### E18b — Portfolio + Charts (~11 SP)

| Deliverable | Description |
|-------------|-------------|
| PortfoliosPage (list) | Paginated card list with summary stats |
| PortfolioDetailView | Detail view with embedded places table |
| PortfolioFormModal | Create/edit form |
| Portfolio place management | Add/remove/update places in portfolio |
| Analytics panel | Stats cards + Recharts charts |
| Recharts integration | PieChart (allocation), BarChart (top performers) |
| Navigation | Sidebar nav item under "Workspace" section |
| CSS | `Portfolios.css` using common/ primitives |
| Tests | 10-14 component tests with MSW |

---

## OpenAPI Changes

**None.** All endpoints and schemas already exist:
- Places: `GET/POST /places`, `GET/PATCH/DELETE /places/{id}`, `GET /places/nearby`
- Portfolios: `GET/POST /portfolios`, `GET/PATCH/DELETE /portfolios/{id}`
- Portfolio places: `GET/POST /portfolios/{id}/places`, `PATCH/DELETE /portfolios/{id}/places/{place_id}`
- Analytics: `GET /portfolios/{id}/analytics`

---

## Client Implementation

### New Dependency

```bash
pnpm --filter client add recharts
```

Recharts is a composable charting library built on D3 + React. It provides `PieChart`, `BarChart`, `LineChart` as declarative React components. Tree-shakeable — only import what's used.

### File Organisation

```
client/src/
  pages/
    places/
      PlacesPage.tsx            Main page (list + detail + form)
      PlacesPage.test.tsx       Component tests
      Places.css                Page-specific styles
      components/
        PlacesList.tsx           Table/card list with pagination
        PlaceDetail.tsx          Single place detail view
        PlaceFormModal.tsx       Create/edit modal form
        PlaceDeleteConfirm.tsx   Delete confirmation dialog
    portfolios/
      PortfoliosPage.tsx         Main page (list + detail + analytics)
      PortfoliosPage.test.tsx    Component tests
      Portfolios.css             Page-specific styles
      components/
        PortfoliosList.tsx        Card list with summary stats
        PortfolioDetail.tsx       Detail view with places table
        PortfolioFormModal.tsx    Create/edit modal form
        PortfolioPlaceManager.tsx Add/remove/update places
        AnalyticsPanel.tsx        Stats + charts panel
        AllocationChart.tsx       PieChart wrapper
        PerformanceChart.tsx      BarChart wrapper
  hooks/
    usePlaces.ts                 Domain-specific hook wrappers
    usePortfolios.ts             Domain-specific hook wrappers
  utils/
    formatCurrency.ts            Decimal string → display format
    formatCurrency.test.ts       Unit tests for formatter
```

### Navigation Changes

Update `DashboardPage.tsx` `NAV_SECTIONS` to add Places and Portfolios:

```typescript
const NAV_SECTIONS: NavSection[] = [
  {
    section: "Workspace",
    items: [
      { id: "overview", label: "Overview", icon: "\u2B21" },
      { id: "places", label: "Places", icon: "\u{1F4CD}" },        // NEW
      { id: "portfolios", label: "Portfolios", icon: "\u{1F4CA}" }, // NEW
      { id: "projects", label: "Projects", icon: "\u25EB", badge: "3" },
    ],
  },
  // ... rest unchanged
];
```

**Routing approach**: Keep the existing `activeView` state pattern in `DashboardPage.tsx`. Add `"places"` and `"portfolios"` to the `View` union type. Each domain page is a top-level component rendered inside the `<DashboardLayout>` content area based on `activeView`.

### Currency Formatting Utility

```typescript
// src/utils/formatCurrency.ts

/**
 * Formats a decimal string (from API) into a display-friendly currency string.
 * Uses Intl.NumberFormat — no floating-point rounding.
 *
 * "1200000.00" → "$1,200,000.00"
 * "0.00"       → "$0.00"
 * null/""      → "$0.00"
 */
export function formatCurrency(
  value: string | null | undefined,
  currency = "USD",
  locale = "en-US",
): string {
  const num = Number(value ?? "0");
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats a decimal percentage string for display.
 * "6.67" → "+6.67%"
 * "-3.50" → "-3.50%"
 * null → "—"
 */
export function formatPercent(value: string | null | undefined): string {
  if (value == null) return "\u2014";
  const num = Number(value);
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

/**
 * Determines gain/loss direction for styling.
 */
export function gainDirection(value: string | null | undefined): "up" | "down" | "flat" {
  if (value == null) return "flat";
  const num = Number(value);
  if (num > 0) return "up";
  if (num < 0) return "down";
  return "flat";
}
```

Note: `Number()` is acceptable here for **display formatting only** — the source value is a server-side Decimal string with exactly 2 decimal places, and `Intl.NumberFormat` handles the display rounding. Form submissions always send the raw string, never a converted float.

### Domain Hooks

```typescript
// src/hooks/usePlaces.ts
import { useServiceQuery, useServiceMutation } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import { placesService } from "../api/services/places";
import type { PaginationParams } from "../schemas/common";
import type { PlaceCreate, PlaceUpdate } from "../schemas/place";

export function usePlacesList(params?: PaginationParams) {
  return useServiceQuery(
    ["places", params],
    () => placesService.list(params),
    CACHE_TIERS.STANDARD,
  );
}

export function usePlaceDetail(id: string) {
  return useServiceQuery(
    ["places", id],
    () => placesService.getById(id),
    CACHE_TIERS.STANDARD,
    { enabled: !!id },
  );
}

export function usePlaceCreate() {
  return useServiceMutation(
    (data: PlaceCreate) => placesService.create(data as Record<string, unknown>),
    { invalidateKeys: [["places"]] },
  );
}

export function usePlaceUpdate() {
  return useServiceMutation(
    ({ id, data }: { id: string; data: PlaceUpdate }) =>
      placesService.update(id, data as Record<string, unknown>),
    { invalidateKeys: [["places"]] },
  );
}

export function usePlaceDelete() {
  return useServiceMutation(
    (id: string) => placesService.remove(id),
    { invalidateKeys: [["places"]] },
  );
}
```

Portfolio hooks follow the same pattern, plus additional hooks for:
- `usePortfolioDetail(id)` — calls `getPortfolioDetail()`
- `usePortfolioAnalytics(id)` — calls `getPortfolioAnalytics()`
- `usePortfolioPlaces(portfolioId)` — calls `portfolioPlacesApi.list()`
- `useAddPlaceToPortfolio()` — calls `portfolioPlacesApi.add()`
- `useUpdatePortfolioPlace()` — calls `portfolioPlacesApi.update()`
- `useRemovePlaceFromPortfolio()` — calls `portfolioPlacesApi.remove()`

### Component Specifications

#### PlacesPage (E18a)

**PlacesList** — Table layout inside a `c-panel`:
- Columns: Name, Category, Address, Coordinates, Created
- Pagination controls (prev/next) using `PaginatedResponse.pages`
- Empty state: illustration + "No places yet" + create CTA
- Each row clickable to open PlaceDetail
- "Add Place" button in panel header

**PlaceDetail** — Slide-in or inline detail view:
- Displays all PlaceRead fields
- Edit button opens PlaceFormModal in edit mode
- Delete button opens PlaceDeleteConfirm
- Back button returns to list

**PlaceFormModal** — Modal dialog:
- Form fields: name (required), address, description (textarea), latitude, longitude, category (select or free text)
- Uses `react-hook-form` + `zodResolver(placeCreateSchema)` or `zodResolver(placeUpdateSchema)`
- Submit calls `usePlaceCreate()` or `usePlaceUpdate()`
- Displays form-level errors via `form-banner`

**PlaceDeleteConfirm** — Simple confirmation modal:
- Shows place name
- Confirm button calls `usePlaceDelete()`
- Cancel returns to detail view

#### PortfoliosPage (E18b)

**PortfoliosList** — Card grid layout:
- Each card shows: name, description preview, place_count, total_value (formatted)
- Card click navigates to PortfolioDetail
- "Create Portfolio" button in header
- Empty state with CTA

**PortfolioDetail** — Full detail view with tabs or sections:
- **Header**: Portfolio name, description, edit/delete actions
- **Summary stats row**: StatCards for total_value, total_purchase, gain_loss, gain_loss_pct
- **Places table**: Embedded `PortfolioPlaceManager`
- **Analytics tab/section**: `AnalyticsPanel`

**PortfolioPlaceManager** — Table of places in portfolio:
- Columns: Place Name, Purchase Price, Current Value, Gain/Loss, Notes, Actions
- All monetary columns use `formatCurrency()`
- Gain/loss cell colour-coded: green for positive, red for negative
- "Add Place" button opens a place picker (select from user's places not yet in portfolio)
- Inline edit for purchase_price / current_value (decimal string inputs)
- Remove button with confirmation

**AnalyticsPanel** — Charts + stats:
- Uses `usePortfolioAnalytics(portfolioId)`
- Layout: stats row at top, charts below in 2-column grid

**AllocationChart** — Recharts `PieChart`:
```tsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// Transform category_allocation data:
// { category: "residential", percentage: "75.00", value: "1200000.00" }
// → { name: "residential", value: 75.0 }
```
- Colour palette uses theme CSS variables (converted to hex at render time, or a fixed palette that works across all 4 themes)
- Custom tooltip showing category name + value (formatted) + percentage
- Legend below chart

**PerformanceChart** — Recharts `BarChart`:
```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Transform top_performers data:
// { place_name: "Test Place A", gain_loss: "200000.00", gain_loss_pct: "20.00" }
// → { name: "Test Place A", gainLoss: 200000, pct: 20.0 }
```
- Bars coloured by gain/loss direction (green/red)
- X-axis: place names (truncated if long)
- Y-axis: gain/loss amount
- Tooltip: place name + formatted gain/loss + percentage

### CSS Approach

Both `Places.css` and `Portfolios.css` follow existing patterns:

1. **Use common/ primitives**: `c-card`, `c-panel`, `c-panel-header`, `c-panel-title`, `c-badge-*`, `c-stat-*`, `btn btn-primary`, `form-field`, `form-input`, `form-label`, `form-error`, `form-banner`
2. **Theme tokens only**: All colours via `var(--text-primary)`, `var(--surface)`, `var(--border)`, `var(--success)`, `var(--danger)`, etc.
3. **Page-specific only**: CSS files contain only layout and composition rules unique to the page — no re-declaring shared primitives
4. **Responsive**: CSS Grid with `auto-fill` / `minmax()` for card layouts; table scrolls horizontally on mobile
5. **Recharts theming**: Charts use a fixed colour palette that's readable across all 4 themes (dark/indigo/navy/sage). Consider an array of 6-8 colours that contrast well on dark backgrounds.

Example structure for `Places.css`:
```css
/* Places page layout */
.places-page { /* ... */ }
.places-table { /* ... */ }
.places-table th { /* ... */ }
.places-table td { /* ... */ }
.places-empty { /* ... */ }
.places-pagination { /* ... */ }

/* Place detail */
.place-detail { /* ... */ }
.place-detail-field { /* ... */ }

/* Place form modal overlay */
.place-modal-overlay { /* ... */ }
.place-modal { /* ... */ }
```

### Decimal String Form Handling

Forms for monetary fields (`purchase_price`, `current_value`) must:

1. **Accept string input** — standard `<input type="text">` with `pattern` attribute for decimal validation
2. **Validate via Zod** — `portfolioPlaceCreateSchema` already has `decimalString` regex validation
3. **Submit as string** — never convert to float before sending to API
4. **Display as string** — pre-populate edit forms with raw string values from API
5. **Format for display only** — use `formatCurrency()` in read-only contexts (tables, stat cards)

```tsx
// In form: raw string in, raw string out
<input
  type="text"
  inputMode="decimal"
  placeholder="0.00"
  {...register("purchase_price")}
/>

// In table: formatted display
<td>{formatCurrency(place.current_value)}</td>
```

---

## Test Plan

### Unit Tests — `formatCurrency.test.ts`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | `formatCurrency("1200000.00")` | `"$1,200,000.00"` |
| 2 | `formatCurrency("0.00")` | `"$0.00"` |
| 3 | `formatCurrency(null)` | `"$0.00"` |
| 4 | `formatCurrency("1234.56", "TWD", "zh-TW")` | locale-formatted TWD |
| 5 | `formatPercent("6.67")` | `"+6.67%"` |
| 6 | `formatPercent("-3.50")` | `"-3.50%"` |
| 7 | `formatPercent(null)` | `"\u2014"` |
| 8 | `gainDirection("200000.00")` | `"up"` |
| 9 | `gainDirection("-500.00")` | `"down"` |
| 10 | `gainDirection("0.00")` | `"flat"` |

### Component Tests — `PlacesPage.test.tsx` (E18a)

| # | Test Case | Asserts |
|---|-----------|---------|
| 1 | Renders places list | Table shows place names from MSW fixtures |
| 2 | Empty state | Shows "No places yet" when API returns empty list |
| 3 | Create place | Opens form, submits, success toast/banner |
| 4 | Edit place | Opens form pre-filled, submits PATCH, list refreshes |
| 5 | Delete place | Confirm dialog, submits DELETE, list refreshes |
| 6 | Pagination | Next/prev buttons update page param |
| 7 | Place detail view | Clicking a row shows detail with all fields |
| 8 | Form validation | Empty name shows error, invalid lat/lng shows error |
| 9 | Loading state | Shows skeleton/spinner while fetching |
| 10 | Error state | Shows error banner on API failure |

### Component Tests — `PortfoliosPage.test.tsx` (E18b)

| # | Test Case | Asserts |
|---|-----------|---------|
| 1 | Renders portfolio list | Cards show portfolio names + total_value formatted |
| 2 | Empty state | Shows "No portfolios yet" when API returns empty |
| 3 | Create portfolio | Opens form, submits, card appears |
| 4 | Portfolio detail | Shows summary stats, places table, analytics |
| 5 | Summary stats | StatCards show formatted total_value, gain_loss, pct |
| 6 | Places table | Shows embedded places with formatted monetary values |
| 7 | Add place to portfolio | Place picker, decimal inputs, submits |
| 8 | Remove place from portfolio | Confirm, removes from table |
| 9 | Allocation chart renders | PieChart SVG present with category data |
| 10 | Performance chart renders | BarChart SVG present with performer data |
| 11 | Gain/loss colouring | Positive = green badge, negative = red badge |
| 12 | Decimal form validation | Invalid decimal string shows Zod error |

### MSW Handlers

Existing handlers are sufficient:
- `placeHandlers` in `src/tests/handlers/places.ts` — full CRUD fixtures
- `portfolioHandlers` in `src/tests/handlers/portfolios.ts` — CRUD + sub-resources + analytics

Additional handlers needed:
- **Override for GET `/portfolios/:id`** — return `PortfolioDetail` (with embedded places) instead of `PortfolioRead` (the current `getById` handler returns the summary shape). Add a `portfolioDetailHandler` to return the full detail fixture.
- **Empty state handlers** — runtime overrides per test using `server.use()` to return empty arrays.

---

## Acceptance Criteria

### E18a — Places UI
- [ ] `PlacesPage` renders inside DashboardLayout when "Places" nav item is clicked
- [ ] User can list, create, view, edit, and delete places
- [ ] Pagination works (prev/next with page number display)
- [ ] Forms use `react-hook-form` + `zodResolver` with `placeCreateSchema` / `placeUpdateSchema`
- [ ] Empty and error states are handled gracefully
- [ ] All tests pass with >= 80% coverage for new files
- [ ] No new CSS duplicates shared primitives from `common/`

### E18b — Portfolio + Charts
- [ ] `PortfoliosPage` renders inside DashboardLayout when "Portfolios" nav item is clicked
- [ ] User can list, create, view detail (with places + analytics), edit, and delete portfolios
- [ ] All monetary values display as formatted currency (not raw decimal strings)
- [ ] Decimal form inputs send string values to API (never float-converted)
- [ ] Recharts PieChart shows category allocation
- [ ] Recharts BarChart shows top performers with colour-coded gain/loss
- [ ] Charts are responsive (use `ResponsiveContainer`)
- [ ] All tests pass with >= 80% coverage for new files
- [ ] `recharts` added to `package.json` dependencies
- [ ] No new CSS duplicates shared primitives from `common/`

### Cross-cutting
- [ ] No modifications to `openapi.yaml` or backend code
- [ ] All existing tests continue to pass
- [ ] Works across all 4 themes (dark/indigo/navy/sage)

---

## Implementation Notes

1. **Start with E18a** — Places is simpler (no sub-resources, no charts), validates the pattern
2. **Recharts tree-shaking** — import only used components: `{ PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend }`
3. **Chart colour palette** — suggest a fixed array like `["#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#6366F1"]` that reads well on dark backgrounds
4. **LineChart placeholder** — the epic index mentions LineChart; defer to a future epic (historical data requires a time-series endpoint that doesn't exist yet)
5. **No React Router changes** — Places and Portfolios are views within DashboardPage (same `activeView` state pattern), not separate routes
6. **Modal implementation** — use a simple `<dialog>` element or a `div` with portal + backdrop, not a library. Keep it consistent with existing patterns.
