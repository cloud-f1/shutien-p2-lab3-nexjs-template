# E300 — Dashboard Onboarding Checklist

> Phase 70 · developer experience · empty state
> Status: ⬜ pending

## Problem

A first-time user who signs up and reaches the dashboard sees a zero-data KPI grid with no guidance on what to do next. There is no onboarding flow, no Getting Started card, and no empty-state content anywhere in the dashboard.

Fork teams rebranding this template for their own SaaS product need a customizable onboarding checklist as a starting point. Modern SaaS products (Linear, Vercel, Stripe) all show a "Getting Started" checklist on first login until the user completes the initial setup steps.

## Solution

Add a "Getting Started" card to the dashboard home page that:
1. Shows only when not all steps are complete (auto-dismisses when all checked)
2. Has 4 default steps: Invite a team member · Create an API key · Configure a webhook · Choose a plan
3. Tracks completion via `localStorage` (client-side, no DB migration required for MVP)
4. Includes a "Dismiss" button to hide it permanently (stored in localStorage)
5. Is fully customizable — fork teams change the step list in one place

## Key Files

- `next-app/components/onboarding-checklist.tsx` (NEW) — client component
- `next-app/hooks/use-onboarding.ts` (NEW) — localStorage-backed completion state hook
- `next-app/app/(dashboard)/dashboard/page.tsx` — import + render above the KPI grid

## Implementation

### Phase 1 — Hook + component
- `useOnboarding(steps: OnboardingStep[])` hook: reads/writes `localStorage["onboarding_v1"]`
  - Returns `{ steps, markDone, dismiss, allDone }`
  - `markDone(stepId)` — marks one step complete
  - `dismiss()` — sets `dismissed: true` in localStorage

- `<OnboardingChecklist>` component:
  - Renders a `<Card>` with title + step list
  - Each step: checkbox icon (checked if done) + label + optional CTA link
  - "Dismiss" button (top-right, small)
  - Animates out when `allDone` becomes true (fade-out via Tailwind transition)
  - Hidden entirely when `dismissed` is true

### Phase 2 — Dashboard integration
- Import into `dashboard/page.tsx`, render above the KPI metric cards
- Default steps (繁體中文 labels, per CLAUDE.md user-facing copy rule):
  - "邀請團隊成員" → `/dashboard/system?tab=team`
  - "建立 API 金鑰" → `/dashboard/system?tab=api-keys`
  - "設定 Webhook" → `/dashboard/system?tab=webhooks`
  - "選擇方案" → `/dashboard/settings?tab=billing`
- Render `"use client"` at component level only (dashboard page stays RSC)

### Phase 3 — Fork customization docs
- Add a comment block at the top of `onboarding-checklist.tsx` explaining how to customize steps
- Add an entry in `docs/zh-tw/getting-started.md` about customizing the onboarding checklist

## Acceptance Criteria

- [ ] "Getting Started" card appears on a fresh-login dashboard
- [ ] Each step links to the correct dashboard sub-page
- [ ] Checking all steps causes the card to disappear
- [ ] "Dismiss" button hides the card permanently (survives page refresh)
- [ ] No DB migration required
- [ ] `pnpm typecheck` + `pnpm build` pass
- [ ] Playwright e2e: card visible on first login → dismiss → gone after refresh

## Out of Scope

- Server-side onboarding persistence (localStorage is sufficient for MVP)
- Analytics tracking of step completion
- Admin-configurable step list
- Multi-step wizard flow
