# AI App Template — Session Summary
> **Tier 1 Project Memory** · Load this to resume any session without re-explaining context.

---

## Latest Session — 2026-09-12 (Phases 89 + 90 shipped — 產品程式碼稽核 + 其連鎖發現)
`main` @ `5eb2230`. 由一次 `/code-review` 指向 `next-app/` 產品程式碼開始，滾出兩個完整 phase。

### Phase 89 — 產品程式碼稽核修補 (E367–E371, PR #190–#194)
Review 出 10 個 finding，**逐一查證、無虛報**，但我更正了其中三處描述：F2 非永久鎖死而是
15 分鐘窗口（因此不需 admin 解鎖）· F7 的 `createCheckoutSession` 並非 public（第一件事就是
`requireAuth()`）· 「UI 會跳成功 toast」不成立（呼叫端全是 `void action(...)`，成功失敗都無回饋）。

- **E367 (HIGH，實際外洩)** — `/p/[slug]` 命中 E333 custom registry 就無條件渲染、不讀 `status`；
  而 `canServeSalesPageRow` 對 custom 直接回 false 讓位給 registry。**兩側都以為對方在管。**
  admin 按下取消發佈：動作回成功、寫稽核、revalidate，頁面照樣公開。
- **E368** — 五處 owner-scoped 寫入不看影響列數卻無條件寫稽核 → 任何登入者可偽造稽核紀錄。
  **不逐案補 if，而是固化成 stop-verifier Rule 26** —— 規則一能跑就找到 review 沒報的另外 4 處
  （report 4 / 實際 8）。
- **E369** — 影子驗證器歸零。`sanitizeEvents` 不是拒絕而是**靜默改寫成 `["*"]`**：打錯一個事件名，
  「訂閱一個」變成「訂閱全部」。
- **E370** — 唯一免登入的 action 沒有限流（工廠層 public 路徑也沒有）+ 重導 URL 改 server 端組。
- **E371** — 訪客結帳為未證實 email 預蓋 `emailVerified` · resetPassword 不清鎖定 ·
  resendVerificationEmail 洩漏帳號存在 · 2FA 沒接上 E355 的持久化欄位。

### Phase 90 — 稽核的產物 (E372–E375, PR #196/#198/#199/#200)
- **E372** — E370 無條件呼叫 `headers()` 打掛 checkout.int 訪客路徑，**通過五道全綠閘門**。
  已把 `test:int` 接進 `pre-merge-check.sh`（Gate 5b）。
- **E373** — e2e 種子狀態隔離。三道防線 + 每輪專屬帳號。
- **E374** — VRT 契約落地 + **AUTH_URL 陷阱**（見下）。
- **E375** — 限流可觀測性（只發 scope 不發 key）· 結帳門檻 30/min 單一來源 · 修掉一句假宣稱。

### 三個值得記住的診斷
1. **新測試的 mock 會遮住它要涵蓋的脆弱性。** E370 的新測試 mock 了 `next/headers`；
   既有的 `checkout.int.test.ts` 沒 mock，才是照出問題的那一個。**既有測試沒有這個偏誤。**
2. **2FA 殘留其實是兩個問題。** DB 殘留（已知）+ **行程內記憶體限流器**（`2fa:login` 的桶在
   `lib/rate-limit.ts` 的 Map，暖 server 跨輪帶著走，`db:e2e-setup` 清不到 —— 它不是一列資料）。
   前兩次都誤判成前者。
3. **`AUTH_URL` 會讓 e2e 測到別的 app。** `.env.local` 釘在 `:3000`，Auth.js 用它解析登入導向。
   在其他 port 跑時，若**姊妹 fork** 佔著 `:3000`（共用路由與繁中文案），已登入的 spec 會對
   那個 app 斷言**並通過**。實測本日 `:3600` 的綠色結果，在 `data-clarity-portal` 停止的瞬間轉紅。
   E357 攔不到 —— 它只驗一次 base URL，這個導向是測試中途離開 origin 的。

### 貫穿兩個 phase 的主軸
**個案修補未推及同類；而把樣式固化成規則，規則一寫出來就證明了這件事。**
E368 的 Rule 26 找到 review 沒報的一半；E369 是 E348/E352 只修 items 的延續。

### 我自己犯的同類錯（都已修成結構性保證）
- `seed-state.ts` 初版整段 `catch` 回報 "unreachable"，卻藏著壞查詢 —— helper 從頭沒運作過，
  **還用令人安心的語氣說明自己的故障**。改為只有 `select 1` 探測能回 `null`。
- Rule 26 掃描器第一版用單行 `db.update(` 而 drizzle 跨行鏈式 → 對八個已知壞函式全報「乾淨」。

---

## Earlier phases

`docs/context/epic-progress.md` is the SSOT for every phase (77 complete as of 2026-09-12) —
each row carries the full account, so this file no longer duplicates them. Previous sessions
covered here before being compressed: Phase 75 planning (2026-07-08), Phases 63–68 hardening
(2026-06-16), Phases 58–62 + v0.2.0 (2026-06-15).

---

## Stack quick reference (Next.js)
```
Stack: Next.js 16 (App Router) + React 19 + TS + Tailwind v4 + shadcn/ui + Drizzle/Postgres + Auth.js v5 (JWT)
Pipeline: spec → implement → qa → commit → merge (QA before commit)
Auth: Credentials REQUIRES JWT sessions (DrizzleAdapter DB-sessions break login); RBAC guards re-read role from DB
Path alias: @/* → next-app/ root. Default Server Components; "use server" actions; pure logic → *-utils.ts (db-free, unit-tested)
DB: drizzle/migrations/*.sql + meta/_journal.json; `pnpm db:test-migrate` verifies fresh-DB apply; seed is dev-only (refuses prod)
Billing: PaymentProvider abstraction — BILLING_PROVIDER=stripe|ecpay; @saas/billing-{stripe,ecpay} modules
Gates: scripts/smoke.sh [--vrt] · scripts/pre-merge-check.sh [--e2e]
Skills: nextjs-saas-patterns (stack gotchas) · athena-loop-speedups (orchestration)
Constraints: agent can't push to main / merge PRs / push tags — user does those; user-facing copy in 繁體中文
```
