# Visual Regression Snapshots — E171 Phase A

This directory holds Playwright screenshot baselines for the VRT smoke matrix.

## State

**Baselines NOT yet captured.** The infra (spec + helpers + config) landed in
E171 Phase A; baselines must be generated on a host that has the dev server +
backend running and a stable font / DPR profile.

## Populating baselines

```bash
# From repo root
make dev                                     # boots server + client
# in another shell
cd client && pnpm test:e2e --project=visual --update-snapshots
```

Commit the resulting `*.png` files alongside this README.

## Updating baselines after an intentional design change

```bash
cd client && pnpm test:e2e --project=visual --update-snapshots
git add e2e/__snapshots__
git commit -m "chore(vrt): refresh baselines after <change>"
```

Reviewer should diff the PNG diffs in the PR before approving.

## What's covered (Phase A)

14 routes × theme=`dark` × preset=`default` × viewport=1280×800 = **14 baselines**.

## What's deferred (Phase B / C)

- Full matrix: 6 themes × 2 presets × 2 viewports = 336 baselines.
- Stop-verifier rule for `[VRT-OK]` PR tag on baseline-update PRs.
- CI workflow: `.github/workflows/ci.yml` job for `pnpm test:e2e --project=visual`.

See `docs/epics/e171-playwright-visual-regression.md` for the long-form plan.
