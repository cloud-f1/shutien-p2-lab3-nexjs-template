# E351 — stop-verifier 規則：`"use server"` 匯出必須有守衛

> Phase 84 addendum · feature/guardrail · Cycle 38
> Status: ⬜ pending
> Depends: E346, E350

## Problem

一輪稽核在同一個 codebase 撈到**兩個同根因的安全問題**：

| Epic | 檔案 | 形狀 |
|---|---|---|
| E346 | `actions/usage.ts` `recordUsage` | 可選 `userId` 參數讓呼叫端**繞過**守衛 |
| E350 | `actions/sales-pages.ts` `listSalesPages` | **根本沒有**守衛 |

根因相同：**內部用途的函式住在 `"use server"` 檔案裡**。開發者的心智模型是「這是給
Server Component 用的 helper」，但 `"use server"` 讓每個匯出都成為任何客戶端可 POST 的
端點 —— 可達性不由意圖決定。

兩個都是人工稽核才發現的。第三個、第四個會在下一次稽核前存在多久，沒有人知道。

`security-audit` skill 已經寫著「Server Actions 是公開 POST 端點」，但那是**散文**，
需要有人記得讀、記得檢查。E341 的經驗：散文無法被強制執行。

## Solution

新增 stop-verifier 規則（比照 E345 的 Rule 24 形狀），在 commit 前檢查：
**每個 `"use server"` 檔案的匯出函式，都必須命中一個已知的守衛。**

1. **偵測**：掃 `next-app/actions/*.ts`（及任何含 `"use server"` 的檔案）的 `export async function` /
   `export const ... = defineAction(...)`。對每個匯出，判斷是否命中：
   - `requireAuth()` / `requireEditor()` / `requireAdmin()`（`lib/permissions.ts`）
   - `defineAction({ allow / authorize })`（`lib/define-action.ts`）
   - **明確標記的 public action**：`// stop-verifier:public-action`（既有慣例，
     `actions/checkout.ts` 已在用）
2. **未命中即擋下**，訊息指出檔案:行與該匯出名，並列出三種合規做法（加守衛 / 標記 public /
   移到 `lib/` 作為內部函式）。
3. **必須有豁免路徑但要留痕**：`// stop-verifier:public-action` 已是既有機制，沿用它 ——
   不另創第二套。標記本身就是紀錄。
4. **測試**：比照 `test-rule-24-gate-ledger-guard.sh` 的形狀。案例必須包含：
   有守衛 → 通過 · 無守衛 → 擋下 · 標記 public → 通過 · `defineAction` 包裝 → 通過 ·
   **E346/E350 的真實歷史形狀 → 擋下**（用 fixture 重現，證明這條規則當初抓得到）。

## 這條規則的判準

**不追求靜態分析的完備性** —— 它是 grep 級的啟發式，會有偽陰性（例如守衛藏在深層呼叫裡）。
目標是攔住**最常見的那個形狀**：新加一個 action，忘了加守衛。

偽陽性必須可用既有的 public-action 標記解除，且解除要留在程式碼裡被 review 看見。
一條會誤擋又難以解除的規則，會被關掉 —— 那比沒有規則更糟（E345 的教訓）。

## Key Files
- `scripts/hooks/stop-verifier.sh`（新規則）
- `scripts/hooks/tests/test-rule-use-server-guard.sh`（新）
- `scripts/hooks/CLAUDE.md`（規則表）
- `.claude/skills/security-audit/SKILL.md`（把散文檢查項指向這條可執行規則）

## Acceptance Criteria
- [ ] 規則落地並納入 `make hook-test`（目前 21 檔全綠，不得破壞）
- [ ] 測試涵蓋：有守衛 / 無守衛 / public 標記 / `defineAction` 包裝 / **E346 與 E350 的歷史形狀**
- [ ] **回歸實證**：以 E346、E350 修正前的程式碼為 fixture，規則必須擋下（附實際輸出）——
      證明它當初抓得到，而不只是現在看起來合理
- [ ] 對現行 `main` 的所有 `"use server"` 檔案跑一次：**零偽陽性**，或每個偽陽性都有正當的
      public 標記（附掃描結果）
- [ ] 擋下訊息列出三種合規做法，不只是說「不合規」
- [ ] `security-audit` skill 的對應檢查項指向這條規則
- [ ] 規則表（`scripts/hooks/CLAUDE.md`）與實作一致（`/athena:audit` Step 6a 會比對）

## Cross-Epic
- E346 · E350 — 兩個實證案例，也是回歸 fixture 的來源
- E345 Rule 24 — 規則形狀與測試形狀的參考
- E341 — 同屬「把散文變成可執行檢查」的系列

## Out of Scope
- 完整的資料流靜態分析（過度工程；grep 級啟發式 + 明確豁免already 夠用）
- 對 Route Handler 做同樣檢查（不同的可達性模型，另議）
