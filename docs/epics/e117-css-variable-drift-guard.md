# E117 — CSS Variable Drift Guard

> Phase 31 — Integration Integrity Shield | Size: S | Deps: none
> Learned from: ai-casino-shift E158/E160 (old theme vars compete with new; no detection)

## Problem

CSS variable drift — components reference variables not defined in current theme — causes visual regressions no test catches. Casino-shift E158 created a new theme but E160 was needed to clean up old vars still being referenced. There is no mechanism to detect when a component references a CSS variable that doesn't exist in the theme.

## Solution

Lightweight CSS variable consistency check script + stop verifier rule.

## Key Files

| File | Action |
|------|--------|
| `scripts/checks/css-var-check.sh` | New — extract definitions vs references |
| `scripts/hooks/stop-verifier.sh` | Add Rule 17 |

## Acceptance Criteria

1. Script extracts `--var` definitions from theme/global CSS, `var(--var)` references from component CSS
2. Reports undefined variable references (referenced but never defined)
3. Rule 17 (CSS Variable Drift): run check when .css files changed. Warning.
4. Completes in <2s (grep-based, no CSS parser)
5. `--migration` flag outputs old-var → suggested-replacement table for theme transitions
