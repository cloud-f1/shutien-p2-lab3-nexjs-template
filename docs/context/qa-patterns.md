# QA Patterns — Recurring Findings

> **Owner**: @qa (appends) + @spec-writer (reads)
> **Purpose**: Break the repeat-finding cycle — specs address known issues upfront.

## Checklist — Spec Must Address

### TypeScript / Zod
- [ ] `satisfies z.ZodType<ApiType>` on every new Zod schema
- [ ] Explicit return types on exported functions

### CSS / Layout
- [ ] DashboardLayout comment block preserved when adding views
- [ ] New CSS selectors use design-system tokens (never raw hex)

### Accessibility (WCAG 2.1 AA)
- [ ] All interactive elements: keyboard handler + ARIA attrs
- [ ] Images / icon-only buttons: `aria-label` or `aria-hidden`
- [ ] New pages: skip-nav target, landmark roles

### Testing
- [ ] MSW handler for every new endpoint
- [ ] `userEvent` (not `fireEvent`) in all client tests
- [ ] Coverage >= 80% per module

## Pattern — doc↔code 契約測試 (E341)

`next-app/lib/doc-contract.test.ts` pins constants that are stated in code AND restated as
prose elsewhere (a markdown doc, a skill, a comment block) — effort tiers (`CLAUDE.md` §
Effort Tiers vs `scripts/effort/resolve.sh`), the RBAC capability matrix
(`docs/qa/manual-test-plan/README.md` § 4 vs `lib/team-utils.ts`), the marketing pricing
page's wiring to `PRICING_TIERS` (genuine doc↔code contract) plus the usage-limits
UNLIMITED-by-default convention (`lib/usage-utils.ts` docstring), and status tones
(`.claude/skills/design-system/SKILL.md` vs `components/status-badge.tsx`). It runs as part of
`pnpm test` (no extra wiring), so `make verify` / `pre-merge-check.sh` cover it for free, and
`/athena:audit` Step 6a runs it first before falling back to manual doc↔code comparison.

**Pricing has no independent prose source (checked 2026-08-22):** searched `README.md`,
`docs/**`, `dev-docs/**` (incl. the `@saas/landing` module docs), and `lib/sales/**` (a
different domain — the E326/E332 custom `/p/[slug]` sales-page builder) for anywhere the
`free`/`pro`/`scale` slugs, `$29`/`$99` prices, or `"usd"` currency are restated in
independent, human-maintained prose. None exists — `config/pricing.json`'s own `$comment`
states a policy, not a value, and `PRICING_TIERS` is a near-identity pass-through of the same
file. Per 判準 #1 below, that value pair does NOT qualify as a doc↔code contract; the test
file labels it a plain "regression pin" instead so it isn't mistaken for one. If a real prose
restatement of the pricing table ever appears (a pricing FAQ, a rebrand doc, a sales page),
re-home this as a genuine contract against that source.

**判準 — when to add a new contract to this file:**
1. The value is stated **in prose** somewhere (doc / skill / comment) — a value that lives
   ONLY in code with no separate prose restatement doesn't qualify (nothing can "drift" from
   itself).
2. Changing the code constant would **not already turn some other test red** — if an existing
   unit/integration/e2e test already locks the value, a doc-contract entry is redundant; add
   the doc citation as a comment on that existing test instead.
3. The doc source is stable enough to cite by file + section in an inline comment — if the
   prose doesn't clearly say a value (only implies it), fix the prose first, then pin it.
4. Prefer pinning against the REAL code path (subprocess the actual script, import the actual
   exported constant, or source-parse when the constant is intentionally not exported) over
   re-implementing the logic in the test — a re-implementation can drift right alongside the
   doc and give false confidence.

Out of scope: don't try to cover every constant — only the ones that would actually rot
silently. See `docs/epics/e341-doc-code-contract-test.md` § Out of Scope.

## Log — Findings Added by @qa

<!-- @qa appends entries here. Pre-E156 batch learnings are condensed below; every [GENERALIZABLE] lesson lives in ~/.claude/template-memory/ (Tier 0), full detail in git history. Compressed 2026-06-04 to hold the ~200-line budget. -->

### Archived Batch Learnings (E57–E111, Mar–Apr 2026) — promoted to Tier 0

- **Migrations/DB**: two-layer UUID (TypeDecorator `GUID` + `sa.Uuid()`); test migrations on PostgreSQL (SQLite masks schema bugs); migration linter as a 0.02s pytest. (E62/E63/E65)
- **Integrations**: provider/strategy + factory-singleton for swappable email/SMS/storage; zero-domain core must build+test; cascade config through env/deploy/compose in dependency order. (E66–E70)
- **Template hygiene**: post-clone reset script (safety-guarded, idempotent); separate framework from examples + an installer to add them back. (E69–E71)
- **Observability/orchestration**: hook-only webhook + JSONL audit (zero app code, env-gated); dependency graph as a standalone script (Kahn → waves); orchestrator agent that CANNOT write code; stop-verifier as append-only rule blocks. (E82–E86)
- **Prod-readiness**: superuser admin endpoints (`current_superuser`); fail-fast `validate_production_config()` in lifespan; `make verify` / `doctor-production` two-tier gates; SHA-pin all GitHub Actions. (E61/E104–E106)
- **Docker**: dev/prod compose split (source mounts vs built images); named volumes for `node_modules`; `${VAR:-default}` for prod env; Make targets as thin compose wrappers. (E107–E111)
- **Docs**: bilingual EN+ZH-TW three-file pattern (guide + README + CLAUDE.md); periodic context-doc hygiene sweeps (drift caught: 28→259 tests). (E86/E102)

### Schemathesis Conformance Pattern (E156) — active enforcement

- [GENERALIZABLE] In-process spec↔server conformance: `schemathesis.openapi.from_asgi("/openapi.json", app)` in a pytest fixture + `@schema.parametrize()` over every op (no network; fuzzes bodies/queries via hypothesis). Complements curated contract tests — catches drift they don't target.
- [GENERALIZABLE] `xfail` list, not spec freeze: keep `KNOWN_DRIFT_OPS` at module top, `pytest.xfail()` each offender, treat the set as a KPI to shrink. Never disable the check.
- [GENERALIZABLE] Exclude framework-level checks (e.g. `unsupported_method` expecting a 405 `Allow` header on stock Starlette) via `excluded_checks=` so the signal stays on the contract you own.
- **Enforcement**: runs as `@qa` Phase 2.5 (blocks Phase 3 coverage on fail, no `--skip-contract`); Stop-verifier Rule #20 (openapi.yaml changed ⇒ green `qa_contract` audit event required); `pre-deploy-guard.sh` Gate 7 re-runs as defense-in-depth.
- _Initial landing: 16/23 ops flagged for under-declared 4xx (auth endpoints returning undocumented 400/401/403/422). Tracked in `KNOWN_DRIFT_OPS`; fix = add the missing 4xx to `docs/openapi.yaml` reusing `ErrorResponse`, then drop the op — Phase-40 cleanup follow-up._

### Iterative Review Convergence Pattern (E162) — active

- [GENERALIZABLE] Loop the same reviewer on the same artifact up to N rounds (`scripts/reviewer-loop.sh`): CONVERGED (0 open `- [ ]`) / STUCK (round-body sha256 identical) / MAX_REACHED (≥ `MAX_ITERATIONS`) / BUDGET (≥ `REVIEW_LOOP_BUDGET`, **informational only**). Single-pass review misses regressions the fix itself introduces.
- [GENERALIZABLE] Idempotent reviewer (one call = one appended `## Round N`) + debugger "round mode" (fix ONLY current-round items, no opportunistic refactors — scope creep defeats convergence).
- [GENERALIZABLE] Stuck detection via content hash, not item count (count can hold at 1 while the finding changes = progress, not stuck).
- **Enforcement**: `/athena:qa --review-only` drives the loop; plain `/athena:qa` Phase 1 single-passes; STUCK (exit 2) surfaces a ⚠️ block; the `review_loop` audit event feeds the E164 autopilot confidence scorer.

### Phase 45 — Memory Pipeline + Batch Hardening (E180–E186, PRs #155–#167) — promoted to Tier 0

- [GENERALIZABLE] **Two-layer worktree-isolation probe**: shell `git worktree add` working ≠ the Agent-tool wrapper honoring isolation (it can silently degrade → agents land in the main worktree and intermingle files). Probe BOTH (shell smoke + a read-only Agent reporting `worktreePath`); on failure silently auto-fallback to `--max-concurrent 1` (no abort, no manual override). (PR #161)
- [GENERALIZABLE] **Inline orchestrator steps don't fire TaskCompleted hooks** — call `task-completed.sh` explicitly in inline commit/merge blocks, gated by `NOTIFY_LEVEL=boundaries`, or every webhook silently misses real epic boundaries. (PR #155/#159)
- [GENERALIZABLE] **`gh pr merge --auto` "not possible to fast-forward" is cosmetic** — the server-side squash already succeeded; it's gh's LOCAL post-merge sync failing on a divergent local main. Verify `gh pr view <n> --json state,mergedAt`; don't retry. (PR #159) — _re-confirmed this session during the E216 merge._
- [GENERALIZABLE] **SHA256-snapshot a "read-only" target dir** before/after a test suite (`shasum -a 256` of `~/.claude/` etc.) to catch a forgotten `mv`/`>`; pair with `mktemp -d` fixtures + env-var path injection. (PR #165/#166)

### Memory Retrieval During Design (E189)

`@strategist` reads Tier 0 at the start of every `/athena:plan brainstorm` via `scripts/memory/brainstorm-retrieve.sh <keywords>` (scores with `match.sh`, returns top-5, emits `tier0_loaded`); matched lessons get a `+0.15` reinforce; `evergreen: true` skips the 0.4 min-strength filter.

### Brainstorm-First Planning (E187, Phase 46)

`/athena:plan brainstorm "idea"` runs `@strategist` in dialogue (≤7 Qs, 2–3 approaches, section-by-section review) → JSON spec → `brainstorm-emit.sh` appends to strategy-log; `approve E{n}` renders the epic file with Implementation Phases / Per-Phase Checkpoints / Test Strategy. Additive — epics without these sections still validate.

## Batch Learning — 2026-05-19 / 2026-06-04 (E188–E192, E216) — compressed

Their `[GENERALIZABLE]` entries were promoted to Tier 0 (`~/.claude/template-memory/`) and are
no longer duplicated here. Headline lessons, kept as pointers:

- Verification discipline (E188 → stop-verifier Rule 23): a completion claim needs a
  `verification_check` event, not a recollection.
- Memory decay + retrieval scoring (E181/E190): a lesson nobody retrieves is not wisdom, it is
  sediment — hence half-life + consolidation detection.
- E216: doc examples drift from the code they describe unless something executes them.

## Batch Learning — 2026-08-27 (E352–E356)

### Testing
- [GENERALIZABLE] **負向斷言需要「反向」故障注入。** 一般故障注入是「拿掉功能，看測試會不會紅」，但對「X 不應該發生」的斷言那招無效 —— 拿掉功能只會讓 X 更不發生。要驗證負向測試不是恆真斷言，必須**刻意讓 X 發生**。E356 的三條「不存在帳號不寫稽核列」測試紅綠兩態都過（空包彈的典型徵兆），QA 注入「對不存在／未驗證帳號也寫一筆」後兩輪都轉紅，才證明保護為真。(E356)
- [GENERALIZABLE] **測試 helper 若重新實作產品的計算方式，驗證的是「兩邊一致」而非「行為正確」。** `lib/totp-utils.test.ts` 的 helper 抄了產品同一個 ms/秒單位錯誤，22 條斷言全綠地掩護了一個在正式環境完全失效的 2FA。協定型程式碼（TOTP/HMAC/簽章/編碼）至少要有一條斷言的期望值來自**外部來源**：函式庫預設路徑、RFC 測試向量、或另一個獨立實作。(Phase 86 前置修復)
- [GENERALIZABLE] **對 mock 過重的測試做故障注入，是判斷它是否為空包彈的唯一方法。** E354 的新測試把 `@/lib/db` 整個 mock 掉；把判定函式改成恆 `false` 與恆 `true` 兩次，各自打紅不同的斷言，才確認它真能分辨產品的分支邏輯。(E354)
- **`SELECT count(*)` 勝過 mock 的呼叫次數。** 沒被呼叫的 mock，與「有呼叫但插入被靜默吞掉」無法區分；真實資料列計數可以。(E356)
- **後續 epic 在既有不變量上疊功能時，順手把該不變量再斷言一次** —— E356 新增的測試也帶了 `expect(comparePassword).not.toHaveBeenCalled()`，讓 E355 的「鎖定檢查在 bcrypt 之前」不再只依賴原檔存活。(E356)

### Architecture
- [GENERALIZABLE] **移植上游功能時，下游多出來的路徑才是風險所在。** fork 的登入鎖定只有一條密碼路徑，模板有兩條（2FA 使用者的密碼在 `loginAction` 驗、非 2FA 在 `authorize()` 驗）—— 照抄會讓 2FA 帳號的密碼暴力破解**完全不觸發**鎖定。移植前先列出「同一語意在下游有幾個入口」。(E355)
- [GENERALIZABLE] **逃生口旗標必須真的能逃。** `ENABLE_LOGIN_LOCKOUT=false` 時 `isLocked()` 對**既有的** `lockedUntil` 也回 false（欄位保留不清除）—— 操作者關這個旗標多半正因為有人被鎖在外面，仍尊重既存鎖定就不成其為逃生口。用 Postgres `xmin`（任何 UPDATE 都會改的 txid）驗證「零個 UPDATE 發出」，比斷言「值未變」強一級。(E355)
- **先確認「要蓋的東西是否已經存在」。** E353 原本被提議為「建立結構化共享狀態」，查下去發現 E196 的 SSOT 鏈（`epic-progress.md` → `render-index.sh` → `EPIC_INDEX.md`）與 `check-drift.sh` 都已存在且正確 —— 缺口純粹是 drift 偵測器沒接到任何閘門。改為只補執行力，範圍從「新系統」縮成三個檔案。(E353)
- **搬移函式若無受益者就是 YAGNI；有脆弱呼叫點才成立。** `isUniqueViolation` 泛化的價值不在搬檔案，而在修掉 `actions/sales-pages.ts` 兩處以**錯誤訊息字串**判定唯一鍵衝突（綁死 Drizzle 自動產生的約束名）。(E354)

### DX
- [GENERALIZABLE] **橫切關注點的列舉：有幾種接線方式就要幾個 grep。** E356 的實作者用 `grep "logAudit("` 列出「所有寫稽核的 action」，表格看起來完整（10 行、每行都有理由），實則漏了 `defineAction` 宣告式路徑的 9 個寫入點 —— 那族永遠不會出現 `logAudit(` 字樣。QA 多加 `grep "audit:"` 才發現，並由此找到一個真實漏標。列舉守衛／稽核／遙測前先問：「這個能力有沒有第二種接線方式？」(E356)
- [GENERALIZABLE] **`cmd | tail` 之後的 `$?` 是 `tail` 的退出碼。** 本 session 踩到三次（含誤判 `check-drift.sh` 為 exit 0）。取真值用 `cmd > file 2>&1; echo $?` 或 `PIPESTATUS`。同類：`awk` 無論有無輸出退出碼皆為 0，不可用 `&&` 判斷其結果。(全 phase)
- **`gh pr merge` 會把「合併」與「刪除本地分支」的退出碼混在一起** —— 分支被 worktree 佔用時回報 `MERGE FAILED`，但 PR 其實已合併。以 `gh pr view N --json state` 確認，勿採信退出碼。(Phase 86)

### Security
- [GENERALIZABLE] **不為不存在的帳號寫稽核事件** —— `actor_id` 可為 null 是 schema 允許，但把登入失敗歸屬到真實使用者列才能保持軌跡可查詢，並**避免把稽核日誌變成未驗證寫入面**（帳號列舉／log 灌爆）。這是政策選擇，需有測試守著。(E356)
- **同一個功能可能有第三個「完成點」。** 2FA 使用者的 session 實際在 `authorizeCredentials` 的 **nonce 交換**處建立，不在 `loginAction` 的 2FA 分支 —— 把 `auth.login` 寫在後者會為「只過密碼、可能永遠過不了 TOTP」的人記下登入成功。判準：`issueNonce()` 只在 TOTP／備用碼驗證成功後才被呼叫，所以 nonce 的存在本身就是憑證。(E356)

## Batch Learning — 2026-08-28 (E362–E366)

### Architecture
- [GENERALIZABLE] **迴圈跑的是登錄表／範例碼，不是實際狀態 —— 未登錄者靜默消失、不報錯。** `batch.md` 的 publish 範例碼漏掉 canonical block 第一步，per-epic 閘門於是 Phase 83–87 從未執行；三支記憶腳本用 `jq '.defaults|keys[]'` 迭代登錄表而非掃描目錄，未登錄的檔案永遠不衰減、不被封存。**判準：迭代來源是「宣告」還是「實際狀態」？** (E362, E363)

### Testing
- [GENERALIZABLE] **故障注入前必須確認注入物不在任何豁免清單／規則內** —— 否則是「注入本身沒有注入」。canary 命名為 `_` 開頭時被 `/^_/` 規則結構性豁免，「注入後沒紅」會被誤讀成注入失敗甚至「偵測器壞了」。比空包彈更上一層：不是測試沒驗到東西，而是驗證機制對測試對象是盲的。(E366)
- [GENERALIZABLE] **「同檔已使用」若用全文比對判定，註解提及也算數。** `selfHits = text.match(/\bname\b/g).length > 1` 讓任何在自己 JSDoc 裡被提及的匯出豁免於死碼偵測 —— **寫了文件的程式碼反而不受檢查**。量化時要區分「被豁免總數」與「誤豁免數」：實測 40 vs 抽驗 3/3 皆正當。(E366)
- [GENERALIZABLE] **測試隔離的正確形狀**：`mktemp -d` + `trap ... EXIT` + **每一條**外部路徑都以環境變數注入 temp。以 md5sum 前後比對正式資料佐證。同一 session 中前兩次未做而污染了真實帳本與 Tier 0。(E363)

### DX
- [GENERALIZABLE] **worktree 是時間點快照，會以三種方式漂移**：(1) 帶著自己的 `.claude/audit.jsonl`，事件隨 worktree 移除而消失 (2) spec 停在建立時版本，QA 可能讀到過期要求 (3) 佔用分支使主 repo `git checkout` 失敗。**對策**：閘門前先驗 `git branch --show-current`、明確傳 `AUDIT_LOG_PATH`。(E362, E364, E365)
- [GENERALIZABLE] **`cmd && cmd` 的短路會製造「在錯的樹上跑出來的綠」。** `git checkout` 因分支被 worktree 佔用而失敗 → `&&` 短路 → 閘門跑在 `main` 上回綠，對目標 epic 毫無意義。腳本副本放在別的目錄執行也同理（相對路徑解析不到，掃到零個檔案卻回報「乾淨」）。(E362, E366)
- [GENERALIZABLE] **把 `git reset --hard` 用 `;` 接在可能失敗的 commit 之後 = 自製資料遺失。** 本次 batch learning 第一次撰寫即因 pre-commit hook 崩潰（`NODE_OPTIONS` 陳舊 preload）而 commit 失敗，後續以 `;` 串接的 `reset --hard` 照跑，沖掉未提交的 19 行。**破壞性步驟必須條件式串接，或先驗證前一步的退出碼。** (E362–E366 收尾)

### Documentation
- [GENERALIZABLE] **spec 給「程序」比給「對既有機制的斷言」耐久。** 本 phase 統計：給斷言的 3 個 epic 各被 implement 抓到一項錯誤（「X 已支援 Y」「條件 Z 會觸發」）；給程序的 2 個（「去看 X 再決定」「以程式碼為準，不符就明講」）零錯誤。**斷言會腐化，程序不會。** (E362–E366)
- [GENERALIZABLE] **spec 裡的行號在多個 epic 連續改同一檔案時必然腐化** —— 本 phase 兩次（115→138、30→51）。引用**函式名或語法特徵**（「四個 `bad` 分支」）比行號耐久；派工時明確提醒「先讀活檔」兩次都成功攔下。(E364, E365)
- [GENERALIZABLE] **文件裡的錨點要驗證存在 —— 死連結是文件最常見的謊言**（每個字都對，讀者跟過去撲空）。純文件變更沒有測試可跑時，驗收標準只能是逐句對著原始碼事實查核。(E365)

## Batch Learning — 2026-09-12 (E367–E375, Phases 89–90)

### Testing
- [GENERALIZABLE] **為新程式碼寫的新測試，其 mock 往往正好對齊新程式碼的假設，因此無法證偽它。**
  E370 的新測試 mock 了 `next/headers`，遮住了它本該涵蓋的脆弱性；既有的 `checkout.int.test.ts`
  沒 mock，才是照出問題的那一個。**既有測試沒有這個偏誤 —— 改動後先看它們紅了什麼，比看新測試綠了什麼有用。** (E372)
- [GENERALIZABLE] **斷言只看回傳值的測試，抓不到副作用類的缺陷。** E368 每個測試都同時斷言
  「回傳 error」**與**「`audit_log` 增加 0 列」；只有後者能抓到稽核偽造。回傳值對了不代表沒多寫東西。 (E368)
- [GENERALIZABLE] **紅綠重現要逐 epic 做，而且要能指出「紅的正好是哪幾個」。** 本兩階段五個 epic
  各做一次：停用閘門→2 紅、還原五處→5 紅、移除限流→2 紅。若還原修正後測試仍全綠，那個測試沒有價值。 (Phase 89)
- [GENERALIZABLE] **一個測試在「修正未套用」時也會綠，就是空包彈。** E370 的 AC2 初版只斷言
  「另一個 IP 沒被擋」—— 在完全沒有限流時當然成立。補上「第一個 client 確實被擋」才成為真實斷言。 (E370)

### Architecture
- [GENERALIZABLE] **兩個守衛互相讓位＝沒有守衛。** `/p/[slug]` 讓位給 registry、
  `canServeSalesPageRow` 對 custom 回 false 讓位給路由 —— 雙方都以為對方在管，草稿頁因此公開。
  **看到「這個 case 由別處負責」的註解時，去確認那個別處真的做了。** (E367)
- [GENERALIZABLE] **把個案修補固化成規則，規則本身會告訴你這一類還有幾處。** E368 的 Rule 26
  一能跑就找到 review 沒報的 4 處（報 4 / 實際 8）。**寫規則的成本，經常低於「確認沒有第三處」的成本。** (E368)
- [GENERALIZABLE] **靜默改寫比拒絕危險。** `sanitizeEvents` 把無效事件清單改寫成 `["*"]`：
  打錯一個字，「訂閱一個」變成「訂閱全部」。**驗證失敗時要回錯誤，不要回一個「合理的預設」。** (E369)
- [GENERALIZABLE] **註解描述的意圖，未必是程式碼實作的東西。** `emailVerified` 的註解寫
  「ownership is proven by receiving the activation mail」，但章是在建立當下蓋的。
  同一 phase 另有兩例（`orders.ts` 的 forgot-password 宣稱、VRT 的 "committed baselines"）。
  **稽核時把每句宣稱當成待驗證的斷言。** (E371, E374, E375)

### DX
- [GENERALIZABLE] **會替自己的故障編出無害理由的守衛，比沒有守衛更糟 —— 它讓人不再查看。**
  `seed-state.ts` 初版整段 `catch` 回報 "database unreachable"，卻藏著壞查詢，從頭沒運作過。
  **修法不是加分類器再測它，而是讓誤判結構上不可能**（只有專門的 `select 1` 探測能回 null）。 (E373)
- [GENERALIZABLE] **掃描器要先對「已知壞」的輸入驗證會紅。** Rule 26 第一版用單行
  `db.update(` 而 drizzle 是跨行鏈式，對八個已知壞函式全報「乾淨」。**能給假安全感的工具，
  價值低於沒有工具。** fixture 因此刻意用跨行形式釘住。 (E368)
- [GENERALIZABLE] **偽陽性和漏報一樣致命 —— 吵雜的規則會被關掉。** Rule 26 要認得
  「先 SELECT 證實存在再寫入」這個正確樣式（含藏在 helper 後面的），最終 8 真實 0 偽陽性。 (E368)
- [GENERALIZABLE] **清得掉的狀態不只在資料庫裡。** e2e 的 2FA 殘留其實是兩個問題：DB 列
  （`db:e2e-setup` 清得掉）+ **行程內記憶體限流器**（暖 server 跨輪帶著走，drop DB 清不到）。
  前兩次都只診斷出前者。**「重建 DB 還是壞」時，下一個要問的是「有什麼活在行程裡」。** (E373)
- [GENERALIZABLE] **測試綠，不代表測的是你的 app。** `AUTH_URL` 釘在 `:3000` 而 server 跑在
  其他 port 時，登入會把瀏覽器送出本 origin；若姊妹 fork 佔著該 port（共用路由與文案），
  已登入的 spec 會對那個 app 斷言並通過。**一次性的目標檢查（E357）擋不住測試中途的 origin 轉移。** (E374)

### Documentation
- [GENERALIZABLE] **基準線不受版控的視覺回歸套件，不是回歸套件** —— 它只跟你自己上次拍的比，
  新 clone 第一次跑會把當下畫面（含既存回歸）記成「正確」。這對模板是合理取捨（fork 會改品牌），
  **但必須明說，並讓陳舊變成可見訊號**，否則它會安靜地腐爛三個月。 (E374)
