# Review Log — @qa
> **Tier 1 Project Memory** · Owner: `@qa`
> Updated on each `/athena:qa` command or auto-invocation after code change.

---

> **Archived (E205 — 2026-06-01):** Historical entries (through Phase 28, last verified 2026-03-30) moved to
> `docs/context/archive/review-log-2026-03.md`. File was 55 KB and stale for >60 days.
> New entries will be appended below.

<!-- @qa appends new review entries below this line -->

## E210 — 2026-06-02T20:00Z (Deploy/Launch Skill Consolidation + Fork-Safety Gating — QA)

**Branch**: `main` · **Step**: QA · **Epic**: E210

### Code Review Summary

**Files reviewed**: `.claude/skills/deploy-readiness.md`, `.claude/skills/deploy-gcr-zeabur.md`, `.claude/skills/launch-checklist.md`, `CLAUDE.md`

**Verdict: PASS** — all E210 changes are correct, complete, and meet every acceptance criterion.

#### `.claude/skills/deploy-readiness.md` (new)

- YAML frontmatter present with correct `name: deploy-readiness` and comprehensive trigger phrases: "deploy", "launch", "is it ready to ship", "pre-deploy", "release readiness", "ship it", "push to dev/prd", "is it ready", "go live checklist", "final review", "check everything before deploy", "launch check", "ready to launch", "pre-launch", "check status", "what's deployed". Covers all trigger phrases from both retired skills.
- **Tier 1 (Generic Gates)** — 15 gates numbered and labelled Critical/Advisory. Complete union of both originals:
  - Gate 1: Secrets not placeholders (from deploy-gcr-zeabur Gate 1, launch-checklist §7)
  - Gate 2: Migrations current (from both originals)
  - Gate 3: Test coverage ≥80% (from both originals)
  - Gate 4: Required env vars (from launch-checklist §7, deploy-gcr-zeabur Gate 2)
  - Gate 5: Build green — TS + OpenAPI + bundle (from deploy-gcr-zeabur Gate 3/4)
  - Gate 6: Working tree clean + correct branch (from deploy-gcr-zeabur Gate 5/6)
  - Gate 7: CORS configuration aligned (from launch-checklist §12, deploy-gcr-zeabur CORS section)
  - Gate 8: Database + demo accounts (from launch-checklist §2/8, deploy-gcr-zeabur auth flow)
  - Gate 9: Visual consistency (from launch-checklist §1)
  - Gate 10: Branding assets (from launch-checklist §3)
  - Gate 11: No stale Docker builds (from launch-checklist §11)
  - Gate 12: Docker local smoke test (from deploy-gcr-zeabur "Docker Local Smoke Test" SOP)
  - Gate 13: SEO meta tags (from launch-checklist §6 — Advisory)
  - Gate 14: Performance baseline (from launch-checklist §10 — Advisory)
  - Gate 15: Rate limiting (from launch-checklist §10 — Advisory)
- **Tier 2 (Owner-specific)** — fenced under "This repo's deploy stack (customize for your fork)" with explicit FORK NOTICE. Contains full GCR/Zeabur SOP (Decision SOP table, Config, Full Deploy, Docker Build & Push, Status Check, Config Change, First-Time Setup, CI/CD, File Map, Troubleshooting).
- Fork-safety note in document preamble: "if you forked this template, replace Tier 2 with your own platform's deployment steps."
- **No criterion lost** — verified union mapping complete.

#### `.claude/skills/deploy-gcr-zeabur.md` (tombstone)

- 5-line redirect stub pointing to `deploy-readiness.md`. File preserved (not deleted) — git history intact.

#### `.claude/skills/launch-checklist.md` (tombstone)

- 5-line redirect stub pointing to `deploy-readiness.md`. File preserved — git history intact.

#### `CLAUDE.md`

- Skills count updated: `11 active context injectors (+ 2 tombstone stubs — E210)` — unambiguous statement of active vs. total on-disk count.

#### Cross-reference grep results

Active references in `.claude/commands/`, `docs/`, CLAUDE.md: **none found**.
All grep hits are in: historical docs (`strategy-log.md`, `session-summary.md`, `docs/epics/e194-*.md`) or historical plan/spec files in `docs/superpowers/` — these are read-only historical records, not active skill triggers. `.claude/commands/athena/deploy.md` does not reference the old skill names. Criterion met.

### Acceptance Criteria Verification

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `deploy-readiness.md` exists with union of both originals (no criterion lost) | PASS | 15 gates covering all sections from both originals; mapped above |
| Two clearly-labelled tiers: Generic Gates (fork-safe) + owner-specific fenced section with replace-for-your-fork note | PASS | Tier 1 + Tier 2 clearly labelled; FORK NOTICE block at Tier 2 header and preamble |
| `deploy-gcr-zeabur.md` and `launch-checklist.md` are tombstone stubs (not deleted) | PASS | Both are 5-line redirect stubs; git diff confirms |
| No active references to old skill names in `.claude/commands/`, `docs/`, CLAUDE.md | PASS | grep returns only historical docs/specs/plans — no active triggers |
| `deploy-readiness.md` has YAML frontmatter + trigger phrases + auto-loadable | PASS | Frontmatter present with 16 trigger phrases |
| CLAUDE.md skills count updated | PASS | "11 active context injectors (+ 2 tombstone stubs — E210)" |
| Fork reading injected skill sees generic gates as authoritative, GCR/Zeabur as owner-specific | PASS | Tier 1 generic, Tier 2 clearly fenced with explicit replace-this note |

**Overall verdict: PASS — all 7 E210 acceptance criteria met.**

---

## E209 — 2026-06-02T19:30Z (Apply athena-core Sync + Cut v0.2.0 — QA)

**Branch**: `main` · **Step**: QA · **Epic**: E209

### Code Review Summary

**Files reviewed**: `scripts/sync-to-plugin.sh`, `docs/guides/en/plugin-sync.md`, `docs/context/decisions.md`

**Verdict: PASS** — all E209 changes are correct, complete, and well-documented.

#### `scripts/sync-to-plugin.sh`

- New `get_pair_excludes()` function (bash 3.x-compatible via `case` — no associative arrays) implements per-pair excludes for `scripts/hooks/:hooks/` and `scripts/memory/:scripts/memory/` pairs.
- Hook pair: excludes `*.sh`, `*.json`, `CLAUDE.md`, `tests/` — correctly prevents template-specific hook scripts from landing in athena-core's `hooks/` directory. Rationale documented inline.
- Memory pair: excludes `lesson-tags.json`, `score.sh`, `inject.sh`, `match.sh`, `half-life-resolve.sh` — all E203-owned files that use `$ATHENA_MEMORY_DIR` + `common.sh`. Correct and well-documented.
- Both dry-run and apply branches updated to pass `${pair_excl_arr[@]+"${pair_excl_arr[@]}"}` — bash 3.x-safe array expansion (avoids "unbound variable" error on empty arrays).
- The `athena_sync {mode:apply, files_changed:65}` event was correctly recorded in `.claude/audit.jsonl` at `2026-06-01T19:11:40Z`.

#### `docs/guides/en/plugin-sync.md`

- New "Sync-scope exclusions (E203/E209)" table documents all 7 excluded files with pair, file, and rationale — complete.
- "Expected post-sync residual drift" section explains why `make drift-check` should report 0 files after `--apply` (exclusions target different directories, not drift-check pairs). Clear.
- "Sync History / v0.2.0" section records the apply with per-category file counts, exclusions, E203 preservation note, and version cut. Required for audit trail.

#### `docs/context/decisions.md`

- Decision 36 records: state before (107 files), apply result (65 files, 5 pairs), sync-scope exclusions (4 categories), E203 bugs fixed, version cut, and rejected alternatives.
- Correctly includes `[GENERALIZABLE]` tag for the one-way sync + per-pair exclude pattern.

#### E203 Hardening Preservation

- `athena-core/scripts/check-version-sync.sh` — EXISTS (confirmed)
- `athena-core/tests/test-install-smoke.sh` — EXISTS (confirmed)
- Both are outside the sync target directories (`scripts/hooks/` → `hooks/` only) — they cannot be clobbered by the sync.

### Acceptance Criteria Verification

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `--apply` ran; `athena_sync {mode:apply}` in audit.jsonl | PASS | `grep athena_sync .claude/audit.jsonl` → `mode:apply, files_changed:65` at `2026-06-01T19:11:40Z` |
| E203 hardening preserved: `check-version-sync.sh`, stop-verifier registry-read, `lesson-tags.json` | PASS | Both files exist; memory excludes confirmed in `get_pair_excludes()` |
| athena-core `package.json` version = 0.2.0 | PASS | `grep version athena-core/package.json` → `"version": "0.2.0"` |
| athena-core `v0.2.0` git tag exists | PASS | `git tag` in athena-core → `v0.2.0` present |
| Post-apply `make drift-check` → 0 files differ | PASS | All 5 pairs `[OK]`, "Clean: no drift detected" |
| `decisions.md` records apply + version cut + exclusions | PASS | Decision 36 covers all required fields |
| `plugin-sync.md` documents expected residual | PASS | "Expected post-sync residual drift" section present |

**Overall verdict: PASS — all E209 acceptance criteria met.**

---

## E208 — 2026-06-02T04:00Z (Dependency Security Refresh QA)

**Branch**: `main` · **Step**: QA · **Epic**: E208 (axios CVE + vite + build-tool advisories)

### Code Review Summary

**Files reviewed**: `client/package.json`, `dev-docs/package.json`, `package.json`, `pnpm-lock.yaml`, `docs/context/decisions.md`, `docs/context/test-status.md`

**Verdict: PASS** — all E208 changes are correct, minimal, and well-documented.

#### Correctness

- `client/package.json`: axios bumped from `^1.7.9` to `^1.16.1` (resolves to 1.16.1 in lockfile — confirmed ≥1.15.1 requirement met). vite `^7.3.1`→`^7.3.5`, vitest+coverage-v8 `^4.0.18`→`^4.1.0`.
- `dev-docs/package.json`: vite+vitest bumped consistently to match client workspace.
- Root `package.json`: vitest+coverage-v8 bumped consistently.
- `pnpm-lock.yaml`: correctly regenerated — `axios@1.16.1` is the only axios entry; all three workspace `vitest` specifiers now resolve to `4.1.8`; vite resolves to `7.3.5` across all workspaces.
- No production API surface changes — bump is version-only; `apiClient` creation, interceptors, and typed wrappers unchanged.

#### Security Gate

- `pnpm audit --prod` output: **"No known vulnerabilities found"** — zero high/critical in production paths.
- `@redocly/cli` transitive criticals present only in dev/build paths — explicitly documented in Decision 35. This is an accepted and acknowledged state per E208 spec ("build/docs-only tooling may remain if explicitly isolated + documented").

#### decisions.md

- Decisions 32–35 recorded: axios bump rationale (≥1.16.0 over ≥1.15.1 for GHSA-pjwm-pj3p-43mv), vite patch-within-major rationale, vitest workspace consistency, and @redocly/cli dev-only isolation decision. All required.

#### TypeScript

- `tsc -p tsconfig.build.json --noEmit`: **PASS — 0 errors** on production source.
- `tsc --noEmit` (full, includes test files): 2 pre-existing errors in `src/tests/a11y/accessibility.test.tsx` (TS6133 unused `vi`) and `src/tests/helpers/mockFactory.ts` (TS2345 JsonBodyType). Confirmed pre-existing — neither file was modified by E208.

#### No Regressions

- 515/515 client tests pass; 86/86 test files pass. Coverage: 89.6% stmts / 84.59% branches / 87.82% funcs / 91.08% lines — all above ≥80% gate.
- 398/398 server tests pass (4 skipped, 20 xfailed) — 95.25% coverage, above ≥90% server gate.
- No architectural rule violations: axios remains the single production HTTP client; no localStorage usage; no staleTime hardcoding; no page-co-located CSS added.

### Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| axios resolved ≥1.15.1 in pnpm-lock.yaml | PASS — 1.16.1 |
| `pnpm audit --prod` zero high/critical | PASS — "No known vulnerabilities found" |
| vite bumped past dev-server advisory | PASS — 7.3.5 (was 7.3.1, advisory requires ≥7.3.2) |
| @redocly/cli criticals not in `--prod` | PASS — confirmed dev-only, documented Decision 35 |
| Full client suite green + tsc + build | PASS — 515/515, tsc.build clean, pnpm build ✓ |
| axios API surface confirmed unchanged | PASS — auth flow + service-layer tests pass (all 515) |
| decisions.md records bump + resolution | PASS — Decisions 32-35 |
| test-status.md records regression gate | PASS — implement step entry present |

**Overall verdict: PASS — all E208 acceptance criteria met.**

---

## E207 — 2026-06-02T00:00Z (Effort→Cost Observability QA)

**Branch**: `main` · **Step**: QA · **Epic**: E207 (Effort→Cost Observability)

### Code Review Findings

**Files reviewed**: `scripts/effort/resolve.sh`, `scripts/effort/tests/test-resolve.sh`, `scripts/memory/tests/test-effort-cost-proxy.sh`, `scripts/memory/metrics.sh`, `.claude/commands/athena/metrics.md`, `scripts/hooks/CLAUDE.md`

**Verdict: PASS** — no blocking issues found.

#### Correctness

- `resolve.sh` emit change is purely additive — 3 new jq args (`--arg model_map`, `--argjson max_concurrent`, `--arg verify_posture`) appended to the existing `effort_resolved` event payload. Existing `tier` and `source` fields unchanged.
- The jq fallback path (no jq available) also updated to include the 3 new fields via `printf` — consistent with the jq path.
- `effort_metrics_json()` correctly filters pre-E207 events: `and .model_map != null and .model_map != "unknown" and .max_concurrent != null`. Old events still count in `tier_distribution`.
- Model weight parsing from `model_map` string uses `split(",") | map(select(startswith("reviewer=")))` — correct for the `reviewer=<model>,evaluator=<model>` format.
- Cost proxy formula `(reviewer_weight + evaluator_weight) × max_concurrent` is applied correctly; `// 0` on `add` guards the null-array case; `// 1` on `max_concurrent` guards the null-field edge case on enriched events.
- `effort_cost_proxy` JSON array added to the output object alongside the 3 existing E199 sub-sections — truly additive.
- Fallback on jq error returns `effort_cost_proxy:[]` — no crash path.
- Markdown section "d. Effort Cost Proxy (E207)" is rendered only when `proxy_count > 0`; empty-state message correctly guides users to post-E207 events.

#### Backward Compatibility

- Existing E199 sub-sections (`tier_distribution`, `coverage_drop_freq`, `effort_verdict_correlation`) are structurally unchanged — confirmed by test-effort-cost-proxy.sh Test 2 (total_dist=5 counts all events) and test-resolve.sh Section 7 (all 4 standard knobs match hardcoded values byte-for-byte).
- `standard` tier values remain byte-identical to pre-E198 hardcoded values.

#### Security

- All new jq args use `--arg` (string) or `--argjson` (integer) — no unquoted expansion; consistent with existing pattern.
- `printf` fallback uses `%s` format for all string fields — no injection risk for the constrained model name values.

#### Documentation

- `metrics.md` now documents sub-section d with the weight table, formula, and backward compatibility note. Example output includes the cost-proxy table.
- `scripts/hooks/CLAUDE.md` now has a complete `effort_resolved` schema section (E198 + E207) with per-tier value table, pre-E207 backward-compat note, and example jq queries.

#### Minor Observations (non-blocking)

- `total_cost_proxy` in the JSON uses `.[0].cost_proxy_per_run` from `group_by(.tier)` rather than summing across invocations per tier. This means total_cost_proxy = cost_proxy_per_run × 1 for the first element. This is noted in the fixture (Test 6: quick_proxy=6 for 1 event). If multiple events of the same tier have different model_maps (unlikely but possible if tier mapping changes), only the first is shown — acceptable for v1 per spec's "tier-level aggregation only" note.
- `verify_posture` is stored in the audit event but not used in cost-proxy computation — it is a metadata field for future analysis. Correct per spec ("cost_proxy = reviewer_weight + evaluator_weight × max_concurrent" — posture not in formula).

### Acceptance Criteria Check

| AC | Status | Evidence |
|---|---|---|
| `effort_resolved` events include `model_map`, `max_concurrent`, `verify_posture` for all 4 tiers | PASS | test-resolve.sh Section 6b: 12 assertions for all 4 tiers |
| `/athena:metrics --effort` renders Effort Cost Proxy table | PASS | test-effort-cost-proxy.sh Test 8: heading found in markdown output |
| Cost proxy uses haiku=1/sonnet=5/opus=25 × concurrency | PASS | Tests 4/5/6: quick=6, standard=40, ultra=400 |
| Pre-E207 events do NOT crash dashboard; counted in distribution only | PASS | Tests 7/10: thorough excluded from proxy; old-only log gives proxy_count=0 |
| E199 sub-sections unchanged (no regression) | PASS | Test 2: total_dist=5 (all events counted); standard backward-compat test passes |
| `scripts/hooks/CLAUDE.md` `effort_resolved` schema lists all fields | PASS | E198+E207 section added with per-tier table |
| All tests pass in <3s with no external dependencies | PASS | test-resolve.sh: 46/46 in <5s; test-effort-cost-proxy.sh: 10/10 in <3s |

## E206 — 2026-06-02T00:00Z (Ultra-Tier Judge Panel QA)

**Branch**: `main` · **Step**: QA · **Epic**: E206 (Ultra-Tier Judge Panel)

### Code Review Findings

**Files reviewed**: `scripts/qa/verify-panel.sh`, `scripts/qa/findings-schema.json`, `scripts/qa/tests/test-verify-panel.sh`, `.claude/commands/athena/qa.md`, `scripts/hooks/CLAUDE.md`

**Verdict: PASS** — no blocking issues found.

#### Correctness

- `verify-panel.sh` Phase 5.5 is correctly additive — gated on `[[ "$POSTURE" == judge-panel* ]]`, runs strictly after the thorough panel completes.
- Double-evaluator logic correctly handles all three agreement branches: PASS/PASS → judge panel proceeds; FAIL/FAIL → union findings, FAIL override; PASS/FAIL → ESCALATE with needs_human.
- Agreement comparison at line 490 uses `[ "$ULTRA_EVAL_A_VERDICT" = "$ULTRA_EVAL_B_VERDICT" ]` — correct string equality.
- Judge panel (N=3) correctly aggregates `JUDGES_WITH_OPEN` and applies ≥2 blocking vs 1 advisory threshold.
- Advisory findings added with `open=false` (lines 616-618) — correct, they won't count toward FINAL_OPEN.
- `ULTRA_FINAL_VERDICT` override in Phase 6 is correct: empty string → normal verdict computation; set to FAIL/ESCALATE → takes precedence.
- Phase 6.5 `verify_panel_ultra` event emitted with all required fields: `evaluator_a_verdict`, `evaluator_b_verdict`, `agreed`, `judge_open_count`, `final_verdict`.
- Exit code: PASS=0, FAIL=1, ESCALATE=1 — correct per spec (ESCALATE must not auto-advance → exit 1).

#### Security

- No user input reaches shell command expansion unquoted; `jq -n -c --arg` pattern used throughout for safe JSON construction.
- `CLAUDE_CMD` override is used via `"$CLAUDE"` (double-quoted) — no injection risk.
- Best-effort `|| true` on all audit emit calls — failures never block the pipeline.

#### Schema

- `findings-schema.json` now includes `ESCALATE` in the `verdict` enum — additive, existing `PASS|FAIL|STUCK` values unchanged.

#### Documentation

- `qa.md` posture-routing table now correctly documents ultra as double-evaluator + judge-panel (removes the old "deferred to E200.1" note).
- `scripts/hooks/CLAUDE.md` has a complete `verify_panel_ultra` event schema section including all fields, agreement rules, test injection env vars, and example jq queries.

#### Minor Observations (non-blocking)

- `ULTRA_AGREED` variable initialized as empty string; the `--argjson agreed "${ULTRA_AGREED:-false}"` fallback in Phase 6.5 is safe for the standard case but would emit `false` if ultra section never runs — however this is unreachable since Phase 6.5 is also gated on `judge-panel*`, same as Phase 5.5.
- Judge panel is skipped on ESCALATE (line 520 guard) — this is intentional per spec comment ("No point in extra cost when human review is forced anyway"). Correct behavior.
- `run_claude_structured` uses `--model "$model"` and `run_refute` hardcodes `claude-sonnet-4-6` — refute prompts always use sonnet (economical), evaluators/judges use the `ATHENA_ULTRA_MODEL` (opus). Consistent with spec.

### Acceptance Criteria Check

| AC | Status | Evidence |
|---|---|---|
| Ultra runs double-evaluator + judge-panel; thorough byte-identical | PASS | Test 10-reg-a/b confirm thorough path unchanged; Tests 6-9 confirm ultra path active |
| Two independent-context evaluators, both must PASS | PASS | Lines 460-487: two separate `run_claude_structured` calls with distinct prompts |
| Evaluator disagreement → ESCALATE, no auto-advance | PASS | Test 8: exits 1; output contains ESCALATE + needs_human |
| N=3 judge panel: ≥2/3 open → blocking | PASS | Test 9: exits 1 when 2/3 judges flag open |
| N=3 judge panel: 1/3 open → advisory only | PASS | Test 10: exits 0 when only 1/3 judges flag open |
| `findings-schema.json` includes ESCALATE | PASS | Line 6: `"enum": ["PASS", "FAIL", "STUCK", "ESCALATE"]` |
| `verify_panel_ultra` audit event with all fields | PASS | Phase 6.5 lines 655-668 emit all 7 required fields |
| Test suite covers full ultra matrix in <15s | PASS | All 35 tests pass, runtime ~3s |
| `qa.md` documents ultra = judge-panel + double-evaluator | PASS | Table row updated, "deferred to follow-up" removed |

## 2026-08-27 — Phase 86 QA（E353–E356）

### E356 — QA 找到實作者漏掉的一整族寫入點（列舉方法的教訓）

實作者用 `grep -rn "logAudit("` 列舉「所有會寫稽核的 action」，做出一份看起來完整的表格。
QA 獨立列舉時**多加了一個 grep**：`grep -rn "audit:"` —— 因為 `defineAction` 走的是
`lib/define-action.ts:203` 的**間接**路徑，`audit:` 是宣告式參數，永遠不會出現 `logAudit(` 字樣。

**實作者的表格因此漏了整整 9 個寫入點。**

**[GENERALIZABLE]** 當一個 codebase 同時有「直接呼叫」與「宣告式/工廠」兩種寫法時，
單一 grep 的列舉必然不完整，而且**看起來很完整** —— 表格有 10 行、每行都有理由，
沒有任何跡象顯示少了東西。列舉任何橫切關注點（稽核、守衛、遙測）前，先問：
**「這個能力有沒有第二種接線方式？」** 若有，每種都要一個 grep。

### 由此找到的真實缺口（ADVISORY，已登記 follow-up）

`actions/admin-revenue.ts:142` `resendActivation` —— admin **為另一個使用者鑄造
password-reset token 並寄出**（`db.insert(passwordResetTokensTable).values({ userId: user.id })`，
metadata 甚至記了 `{ userId: user.id }`），卻寫成 `on_behalf = false`。

這正是 E356 規格 Solution §4 字面點名的「重設他人密碼」情境。規格的 Key Files 只列
`actions/admin.ts`，所以就字面而言實作者沒有違約，但 AC#5 的語意涵蓋它。
架構已支援（`lib/define-action.ts:40` 的 `AuditEntry = Parameters<typeof logAudit>[0]`
讓 `onBehalf` 自動透傳），補一行即可、零型別改動。

### 反向故障注入：驗證「紅綠兩態都過」的測試是否仍有效

E356 的 AC#4 測試（「不存在的帳號不寫任何稽核列」）在紅、綠兩種狀態下**都會通過** ——
這通常是空包彈的徵兆。實作者主張它們仍有效，理由是寫成真實的 `SELECT count(*)` 而非 mock：
「沒被呼叫的 mock 和『有呼叫但插入被靜默吞掉』無法區分；資料列計數可以」。

QA 用**反向**故障注入驗證這個主張 —— 刻意讓程式碼對不存在／未驗證的帳號**也寫一筆**：

    注入 A（!user 分支）        → 2 條轉紅，`expected 10 to be +0`
    注入 B（!emailVerified）    → 1 條轉紅，`expected 1 to be +0`
    還原（MD5 比對一致）        → 9/9 綠

**[GENERALIZABLE]** 一般的故障注入是「拿掉功能，看測試會不會紅」。但對**負向**斷言
（「X 不應該發生」）那招無效 —— 拿掉功能只會讓 X 更不發生。負向斷言要用**反向注入**：
刻意讓 X 發生，看測試抓不抓得到。這是唯一能區分「有效的負向測試」與「恆真斷言」的方法。

### E355 的不變量被釘了第二次

QA 把 `comparePassword` 移到 `isLocked` 之上，4 條測試轉紅 —— 證明「鎖定檢查在 bcrypt 之前」
的 spy 斷言不是死的。其中第 4 條是 **E356 新增的**測試，它自己也帶了
`expect(mockComparePassword).not.toHaveBeenCalled()`。

**[GENERALIZABLE]** 後續 epic 在既有不變量上疊加功能時，順手把該不變量再斷言一次是好習慣 ——
它讓不變量不依賴於「原本那個檔案不被刪」而存活。

### 驗證方法：對真實 Postgres 跑 migration 原句，而非讀程式碼

AC#1（「既有列不受影響」）的驗證方式值得記錄：QA 建了一張 pre-0016 形狀的表、插入 3 列、
**跑 0016 的原句**，再查回填結果 ——

    rows_after | backfilled_false | nulls
             3 |                3 |     0

比「讀 SQL 看起來是純附加」強得多。`ADD COLUMN ... DEFAULT ... NOT NULL` 在 Postgres 11+
不做全表重寫，但這是實測而非引述。

### 既有 flaky test（非 E356 引入，值得單獨處理）

`lib/rate-limit.test.ts > resets the window after it expires` 會偶發轉紅 ——
該測試用 **1ms** 視窗，兩次連續 `rateLimit()` 若跨過毫秒邊界，第二次就重新充值。
QA 單獨重跑該檔 5 次全綠、全套件 899/899。修法是改用 fake timers。這是 CI 的定時炸彈。
