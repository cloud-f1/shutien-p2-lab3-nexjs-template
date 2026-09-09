# E374 — VRT 基準線決策：4 個快照紅了三個月，而且沒人會知道

> Phase 90 · test/infra · 🟢 **APPROVED — 2026-09-09**

## Problem

`next-app/e2e/vrt/design-fidelity.spec.ts` 有 4 個視覺回歸測試持續失敗：

```
[vrt] › VRT — public surfaces › login
[vrt] › VRT — public surfaces › register
[vrt] › VRT — authenticated shell › settings
[vrt] › VRT — authenticated shell › components
```

快照檔的時間戳是 **2026-06-15**（Phase 62 引入）。今天是 2026-09-09。

**為什麼三個月沒人發現**：`package.json` 的 `test:e2e` 是
`playwright test --project=chromium` —— **`vrt` project 不在裡面**。因此
`pre-merge-check.sh --e2e` 從不執行它，`make verify` 也不會。它只在有人手動跑
`npx playwright test`（全部 project）時才浮現，而那不是任何 SOP 的一部分。

已在乾淨的 `main`（`b578cfb`）上重現，確認與 Phase 89 的變更無關。

這是本模板 Phase 88 主軸的又一個實例：**跑的是宣告，不是實際狀態；不符者靜默
消失。** 一個存在於 repo、寫得很認真、卻永遠不會被執行的測試套件。

## 這個 epic 需要人決定，不能自動化

三個月的 UI 演進（Phase 62 之後經歷了 shadcn blue preset、i18n、E337 widget kit、
E338 responsive list、E339 detail pattern…）意味著差異**極可能是預期中的**。
但「極可能」不是「確定」，而重產快照會把任何真實的視覺回歸一併固化成新基準。

因此本 epic 的第一步是**人看圖**，不是改程式碼。

## Solution

1. 產出 4 組 diff 圖（`test-results/**/**-diff.png`），交人判斷。
2. 依判斷結果擇一：
   - **全部是預期演進** → 重產快照，並在 spec 檔頭記錄「基準線更新於 2026-09-XX，
     對應 Phase 89 之後的 UI」。
   - **含真實回歸** → 先修 UI，再重產。
3. **無論哪一種，都必須決定 VRT 的歸屬**（這才是讓它不再腐爛的部分）：
   - 納入 `test:e2e` → 每次發布都跑，但 VRT 對字型/OS 敏感，跨機器易假紅；
   - 或維持獨立，但**加進 `make verify`** 並在 CONTRIBUTING 的 ship discipline 明列；
   - 或明確標記為「本機開發者工具、不入閘門」，並在 spec 檔頭寫清楚 ——
     **選這個也可以，但必須是明說的決定，而不是像現在這樣靠沒人跑而默默存在。**

## Acceptance Criteria

1. 4 組 diff 圖已產出並經人判讀，判讀結論寫進 epic 或 spec 檔頭。
2. VRT 套件全綠。
3. VRT 的執行歸屬有**明文**決定（三個選項擇一），並反映在對應的
   `package.json` script / Makefile / CONTRIBUTING.md。
4. 若選擇「不入閘門」，`design-fidelity.spec.ts` 檔頭須說明原因與重產指令。

## Out of Scope

- 不為了讓快照通過而修改產品 UI（除非 (2) 判定為真實回歸）。
