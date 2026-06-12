# E175 — DashboardLayout Decomposition into Primitives

> Phase 44 — Design System Completion & Validation | Size: M (5 SP) | Deps: E167

## Problem

The dashboard chrome (sidebar, topbar, user menu, nav items) is implemented as a single 237-line `DashboardLayout.tsx` plus a 400+ line co-located `DashboardLayout.css`. None of it is in `components/ui/`. Three concrete consequences:

1. **A fork that wants a different sidebar layout has to fork the whole `DashboardLayout` file.** The "framework everywhere" promise has a hole — Phase 43 migrated every *page* to primitives, but not the *chrome around the pages*.
2. **Preset axis can't reach the chrome.** `setActivePreset(compactPreset)` makes table rows denser but the sidebar nav padding stays the same. Inconsistent.
3. **The user-menu dropdown is duplicated logic** if any other surface ever needs a dropdown — there's no shared `<DropdownMenu>` primitive.

## Solution

Decompose `DashboardLayout` into composable primitives. Keep `DashboardLayout` itself as the *composition* (similar to how `<PageContainer>` composes `<Breadcrumb>` + header).

### New primitives in `components/ui/`

| Primitive | Purpose |
|---|---|
| `<AppShell>` | Outer flex container (sidebar + main) — used by `DashboardLayout`, also reusable by future admin/staff layouts |
| `<Sidebar>` | Sidebar shell with logo slot, nav slot, footer-user slot |
| `<SidebarLogo>` | Logo + version text |
| `<NavSection>` | Grouped nav items with section label |
| `<NavItem>` | Single nav row — icon + label + optional badge, active state via `<NavLink>` integration |
| `<NavBadge>` | The colored count badge (e.g. "24" in purple, "5" in green) |
| `<TopBar>` | Topbar shell with left/right slots |
| `<TopBarBreadcrumb>` | The "Overview / Sessions" breadcrumb-like indicator (separate from page-level `<Breadcrumb>` because this is chrome) |
| `<UserMenu>` + `<UserMenuItem>` | Avatar + dropdown with profile/settings/sign-out items. Use `<DropdownMenu>` internally |
| `<DropdownMenu>` + `<DropdownMenuItem>` | Generic dropdown built on Modal-like portal + click-outside dismiss + keyboard nav |

### Refactored DashboardLayout

```tsx
// Before: 237 lines of bespoke markup
// After: ~60 lines of composition

export default function DashboardLayout() {
  return (
    <AppShell>
      <Sidebar
        logo={<SidebarLogo title="AGENT TEMPLATE" version="v2.0.0" />}
        footer={<UserMenu …profile menu items… />}
      >
        {navSections.map(section => (
          <NavSection key={section.id} label={t(section.labelKey)}>
            {section.items.map(item => (
              <NavItem key={item.id} to={`/dashboard/${item.path}`} icon={item.icon} badge={item.badge ? <NavBadge variant={item.badgeClass}>{item.badge}</NavBadge> : null}>
                {t(item.labelKey, item.label)}
              </NavItem>
            ))}
          </NavSection>
        ))}
      </Sidebar>
      <TopBar
        left={<TopBarBreadcrumb root="Overview" current={t(activeEntry.labelKey)} />}
        right={<TopBarActions />}
      />
      <Outlet />
    </AppShell>
  );
}
```

## Key Files

| File | Action |
|---|---|
| `client/src/components/ui/{AppShell,Sidebar,SidebarLogo,NavSection,NavItem,NavBadge,TopBar,TopBarBreadcrumb,UserMenu,DropdownMenu}.tsx` | New — 10 primitives |
| `client/src/components/ui/preset.ts` | Edit — 8 new Preset slots (`appShell`, `sidebar`, `nav`, `topBar`, `dropdownMenu`, etc.); both presets updated |
| `client/src/components/ui/index.ts` | Edit — barrel export |
| `client/src/components/ui/__tests__/*.test.tsx` | New — co-located test per primitive (especially DropdownMenu: keyboard nav, click-outside, focus management) |
| `client/src/components/DashboardLayout.tsx` | **Rewrite** — pure composition, ~60 lines |
| `client/src/components/DashboardLayout.css` | **Trim or delete** — most rules superseded by primitive Preset slots |
| `docs/design/design.md` | Edit — § 4 prop tables; § 5 "App-shell recipe"; update § 7 migration status |

## Implementation

1. Build `<DropdownMenu>` first (used by `<UserMenu>`). Reuses portal + click-outside patterns from E174's `<Modal>`. Co-design the two so they share an internal hook.
2. Build `<AppShell>` + `<Sidebar>` + `<SidebarLogo>` (structural). Test that `<DashboardLayout>` composition still renders the same DOM as before.
3. Build `<NavSection>` + `<NavItem>` + `<NavBadge>`. Wire `aria-current="page"` correctly via `react-router-dom` `useMatch`.
4. Build `<TopBar>` + `<TopBarBreadcrumb>`.
5. Build `<UserMenu>` + `<UserMenuItem>` (composes `<DropdownMenu>`).
6. Refactor `DashboardLayout.tsx` into the composition shown above.
7. Trim `DashboardLayout.css` — keep only what's not in Preset slots (e.g. `view-enter` animation). Verify no class is referenced by something outside DashboardLayout.
8. Run full test suite + manual visual sweep across 6 themes.

## Acceptance Criteria

- [ ] 10 chrome primitives shipped with full test coverage
- [ ] `<DashboardLayout>` rewritten as a thin composition (≤ 80 lines)
- [ ] `DashboardLayout.css` either trimmed (only `view-enter` + dashboard-specific overrides) or deleted entirely
- [ ] User menu keyboard nav works: arrow-up/down, Enter to select, ESC to close
- [ ] `aria-current="page"` correctly applied to active nav item (existing accessibility behavior preserved)
- [ ] `compactPreset` swaps the sidebar/topbar/user-menu density too (no more skin gap)
- [ ] All existing tests pass; new tests cover DropdownMenu keyboard model
- [ ] design.md § 7 migration status — DashboardLayout chrome ✅ Migrated
- [ ] Bundle-size budget: CSS net change ≤ ±5 kB (we delete `DashboardLayout.css` rules, gain Tailwind utilities — net should be small)
- [ ] Stop-verifier clean

## Alignment / Cross-Epic Hooks

- **Hard-depends on E167** — uses Preset axis, theme tokens.
- **Shares portal/dismiss logic with E174** (Modal/Drawer) — coordinate the internal hook design before both ship.
- **Enables future "staff admin" or "tenant impersonation" layouts** — `<AppShell>` + `<Sidebar>` are reusable for any sidebar-based admin UI.
- **Closes the "framework everywhere" loop** opened by E167 — chrome was the last surface owning bespoke CSS.

## Out of Scope

- **Mobile responsive sidebar** (collapse to hamburger) — separate epic; current dashboard is desktop-first.
- **Sidebar resize / collapse toggle** — defer until users ask.
- **Multi-tenant logo / branding per-workspace** — out of scope; `<SidebarLogo>` accepts a `<ReactNode>`, branding is consumer-controlled.
- **Command palette (Cmd+K) integration** — separate epic; would slot into `<TopBar>` right side.
- **Notification bell in topbar** — depends on E174 toasts being persistent + a notifications endpoint; separate epic.
