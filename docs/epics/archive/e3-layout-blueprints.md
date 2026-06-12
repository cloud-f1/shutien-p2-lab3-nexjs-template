# E3: Layout + Blueprints — Spec

> **Goal**: Extract a reusable `DashboardLayout` from the monolithic DashboardPage, create standalone UI components, and provide HTML blueprints for AI-assisted page generation.

## Current State

- `DashboardPage.tsx`: 1,549 lines — layout + 7 views + 5 inline helpers in one file
- `Dashboard.css`: 1,100+ lines — layout CSS mixed with view-specific CSS
- No reusable layout component — sidebar/topbar baked into the page
- No `docs/blueprints/` directory
- Inline helpers: StatCard, ProjectRow, ActivityRow, MemFile, PromoteItem

## No OpenAPI Changes

E3 is client-only refactoring — no API endpoints affected.

## Implementation Plan

### 1. DashboardLayout Component

**New file**: `client/src/components/DashboardLayout.tsx`

```typescript
interface DashboardLayoutProps {
  children: React.ReactNode;
  sidebar: {
    sections: SidebarSection[];
    activeItem: string;
    onItemClick: (id: string) => void;
  };
  topbar?: {
    breadcrumb: string[];
    actions?: React.ReactNode;
  };
  user?: { displayName: string; email: string };
  onLogout?: () => void;
}
```

Extracts from DashboardPage:
- Sidebar (240px fixed, nav sections, user dropdown)
- Topbar (56px sticky, breadcrumb, status)
- Content wrapper (flex: 1, scrollable, padding)
- Scrollbar styling

### 2. Extract Inline Components

**New directory**: `client/src/components/dashboard/`

| Component | Source Lines | Props |
|-----------|-------------|-------|
| `StatCard.tsx` | ~30 lines | label, value, delta, deltaType |
| `PageHeader.tsx` | ~15 lines | eyebrow, title, subtitle |

Keep other helpers (ProjectRow, ActivityRow, etc.) inline in DashboardPage for now — they're view-specific, not reusable patterns.

### 3. CSS Separation

**New file**: `client/src/components/DashboardLayout.css`
- Layout classes: `.dashboard`, `.sidebar`, `.main`, `.topbar`, `.content`
- Sidebar classes: `.sidebar-*`, `.nav-*`, `.logo-*`, `.user-*`, `.dropdown-*`
- Scrollbar styling

**Keep in** `Dashboard.css`:
- View content classes: `.stats-row`, `.panel`, `.grid-*`, `.activity-*`, `.settings-*`, etc.

### 4. HTML Blueprints

**New directory**: `docs/blueprints/`

| Blueprint | Purpose | Source |
|-----------|---------|--------|
| `admin-dashboard.html` | Admin panel pattern (stats + panels + lists) | Extract from docs/design/dashboard.html |
| `data-list.html` | CRUD list with filters + table + pagination | New (for E7 Places) |
| `detail-view.html` | Single record detail with tabs | New (for E7 Place detail) |
| `settings.html` | Settings form with sections | Extract from dashboard Settings view |

Each blueprint is standalone HTML with:
- Inline CSS using theme variables
- Comments marking customization points
- AI-friendly structure (paste into Claude/GPT to generate React)

### 5. Headless UI Base Styles (DEFERRED)

`headless-ui.css` deferred to when we actually add Headless UI as a dependency. No point styling components we don't use yet.

## Refactoring Strategy

1. Extract layout CSS first (new file, no behavior change)
2. Create DashboardLayout component
3. Refactor DashboardPage to use DashboardLayout
4. Extract StatCard + PageHeader
5. Create blueprints from existing HTML designs
6. Run all tests — must pass with no changes to test files

## Test Plan

- All existing 121+ client tests still pass (zero test file changes)
- DashboardPage renders correctly with extracted layout
- StatCard renders label, value, delta
- PageHeader renders eyebrow, title, subtitle

## Acceptance Criteria

- [ ] `DashboardLayout.tsx` — generic sidebar + topbar + content shell
- [ ] `DashboardLayout.css` — layout-only styles extracted
- [ ] `StatCard.tsx` + `PageHeader.tsx` — standalone components
- [ ] `Dashboard.css` — only view-specific styles remain
- [ ] `DashboardPage.tsx` — uses DashboardLayout, significantly shorter
- [ ] `docs/blueprints/` — 4 HTML wireframes
- [ ] All existing tests pass unchanged
