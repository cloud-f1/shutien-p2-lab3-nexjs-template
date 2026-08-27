# E357 — e2e 目標 app 身分驗證

> Phase 87 · Size M · 8 SP · P0
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**
> 來源：Phase 86 執行過程的實地發現（Cycle 41）

## Problem

`next-app/playwright.config.ts:11` 的 baseURL 預設 `http://localhost:3000`，`:42` 設
`reuseExistingServer: true`。若同一台機器上**另一個 app** 佔著 3000，`pnpm test:e2e`
會直接接上去，**靜默地測錯對象**，然後回報一堆看似合理的失敗。

### 現場證據（非推測）

Phase 86 期間 port 3000 被 `/Users/cloud-f1/Documents/git_saas/data-clarity-portal` 佔用 ——
**本模板的另一個 fork**。實測兩者的回應：

```
curl :3000            → <title>Next.js SaaS 起手式 · AI-Ready Modular Template</title>
curl :3000/api/health → {"status":"ok","timestamp":"..."}
```

**與本專案位元組相同。** `<title>` 和 `/api/health` 都無法辨識。

E355 的實作 agent 因此拿到 **10 failed / 36 passed**。它沒有假設是自己的錯 —— 把整個 epic
`git stash` 掉、在乾淨樹上重跑，得到**一模一樣的 10 個失敗**，才從 Playwright 的 error-context
看到別的 app 的內容而確定根因。

整個 Phase 86 的每一次 e2e（整合閘門、E356 implement/qa、E356 publish）都必須改用專屬 port
並以 `lsof -a -p PID -d cwd -Fn` 驗證，才敢採信結果。

### 為什麼是 P0

這不是「不方便」。**閘門會在錯誤的對象上回報結果** —— 失敗看起來像真的回歸，而通過更危險
（在錯的 app 上綠燈）。中招的人不會知道自己中了，除非像 E355 的 agent 那樣做 stash 重跑。

## Solution（方向，細節由 spec 階段定案）

核心約束有三個，設計必須同時滿足：

1. **識別必須在「fork 尚未改名」時仍然有效。** 任何繼承自 config 的識別
   （`NEXT_PUBLIC_APP_NAME`、`package.json` 的 `name`）在剛 fork 出來時與上游相同 —— 會撞。
   候選方向：建置／啟動期注入的 repo 識別（git remote URL、或工作目錄絕對路徑的雜湊）。
2. **必須保留 `reuseExistingServer` 的暖機效益。** loop 協定明文推薦暖伺服器定向測試
   （單一測試 ~5s vs 冷啟全套 2–4min）。不可用「一律關掉 reuse」來解決。
3. **失敗必須是明確中止，不是一堆測試紅。** 目標不符時要在 globalSetup 就停下並指出真正原因。

`next-app/app/api/health/route.ts` 已存在（目前只回 `{status, timestamp}`），是加識別欄位的天然落點。

## Key Files

- `next-app/app/api/health/route.ts` — 加識別欄位
- `next-app/playwright.config.ts` — `globalSetup` 掛載驗證
- 新增 globalSetup 檔（位置由 spec 決定）
- `docs/context/test-status.md` — 更新 e2e 執行前提的說明

## Acceptance Criteria

1. 在 port 3000 被**另一個 fork**佔用的情況下跑 `pnpm test:e2e` → **明確中止**並在訊息中
   指出真正原因（目標 app 不符），而非跑出一堆測試失敗。
2. 目標正確時 → 照常執行，且 `reuseExistingServer` 的暖機行為不變。
3. **識別在 fork 尚未改名時仍有效** —— 以「複製一份本 repo 到另一個路徑、不改任何 config、
   同時啟動」的情境驗證，兩者必須可區分。
4. `PLAYWRIGHT_BASE_URL` 指向自建 server 的既有用法不受影響（Phase 86 全程依賴它）。
5. 既有 51 條 e2e 全綠。

## Out of Scope

- 自動選 port／自動殺掉佔用者 —— 只做偵測與明確報錯，不動別人的 process。
- CI 環境的設定（`webServer` 在 `process.env.CI` 下走不同分支）。
