# E372 — public action 的 `headers()` scope 安全化 + `test:int` 進發布閘門

> Phase 90 · bug/infra · 🟢 **APPROVED — 2026-09-09（Phase 89 稽核的直接產物）**

## Problem

E370 在 `lib/define-action.ts` 的 public 分支加了 per-client 限流，並用
`clientIpKey(await headers())` 當 key。`headers()` 在**沒有 Next request scope**
的地方會拋 `called outside a request scope` —— 整合測試、腳本、背景工作都是。

訪客路徑正是會走到它的那條（無 session ⇒ `actorId` 為 null ⇒ `??` 右側被求值），
於是 `test/int/checkout.int.test.ts` 的每個訪客案例都爆掉：

```
× IS callable with no session (guest checkout) — order created with user_id null
× SECURITY: amount/currency are server-owned — a forged client amount/currency is ignored
× an inactive/nonexistent product is refused before any order is written
```

**它通過了五道全綠閘門。** 兩個獨立原因疊在一起：

1. **`pre-merge-check.sh` 不跑 `test:int`** —— 它跑的是 `pnpm test`（unit）。
   `test:int` 只存在於 `make verify`，而發布路徑從不呼叫 `make verify`。
2. **E370 自己新寫的測試 mock 了 `next/headers`** —— 那個 mock 遮住了它本該涵蓋的
   脆弱性。既有的 `checkout.int.test.ts` 沒 mock，才是照出問題的那一個。

第 2 點是本 epic 最該記住的形狀：**為新程式碼寫的新測試，其 mock 往往正好對齊新
程式碼的假設，因此無法證偽它。** 既有測試沒有這個偏誤。

## Solution

1. `headers()` 包在 try/catch 內；取不到時退回**單一共用桶**（`"no-request-scope"`），
   而非放行 —— 否則「從沒有 headers 的情境呼叫」就成了繞過限流的方法。
2. **把 `test:int` 加進 `pre-merge-check.sh`**（Gate 5b，unit 與 e2e 之間）。
   無條件執行是安全的：`test/int/harness.ts` 會探測 Postgres，各 spec 以
   `describe.skipIf(!reachable)` 跳過，沒有 DB 時等同通過而非擋下發布。
3. 回歸測試放在**不 mock `next/headers`** 的 `checkout.int.test.ts` 裡，並在註解
   寫明為什麼不能放到有 mock 的那個檔案。

## Acceptance Criteria

1. 無 request scope 時呼叫任一 public action **不拋錯**（`checkout.int.test.ts` 全綠）。
2. 取不到 headers 時仍受限流管轄（共用桶），非無限放行。
3. `pre-merge-check.sh` 輸出含 `Integration tests (vitest, int)` 閘門，且
   `emit_gate int pass|fail` 有進帳本。
4. 沒有 Postgres 的機器上，該閘門通過而非失敗（優雅跳過）。
5. 紅綠重現：還原 `define-action.ts` → `checkout.int.test.ts` 4 紅。

## Status

**實作已完成**（本 session），待 commit/merge。
