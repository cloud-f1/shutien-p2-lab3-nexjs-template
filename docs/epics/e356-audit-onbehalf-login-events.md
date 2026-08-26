# E356 — 稽核：`onBehalf` 代操作旗標 + 登入事件（移植 fork E327 的通用半邊）

> Phase 86 · Size M · deps: E355 · 來源：fork `../ai-rc-engineer-pm` E327（commit `3a915a5`）
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**

## Problem

模板的 `audit_log` 目前只有 `actorId / action / targetType / targetId / metadata`。兩個缺口：

1. **無法查詢「代操作」** —— admin 代其他使用者執行動作時，稽核列看起來與當事人自己操作
   完全相同。目前只能靠 action 名稱的文字慣例事後猜，無法用 SQL 篩。
2. **完全沒有登入事件** —— 登入成功／失敗／被鎖定都不進稽核軌跡。安全事件調查時
   （「這個帳號是什麼時候被攻擊的？」）稽核日誌幫不上忙。

## 移植邊界：只取通用的一半

Fork 的 E327 有兩塊，**只有第一塊可移植**：

| Fork 內容 | 移植？ | 理由 |
|---|---|---|
| `onBehalf` boolean 欄位 | ✅ | 概念完全通用（任何有 admin 代操作的系統都需要） |
| 登入事件寫入稽核 | ✅ | 通用 |
| 「不為不存在的使用者寫事件」的政策 | ✅ | **這是最有價值的一條**，見下 |
| `rc-audit-utils.ts` CSV 匯出 | ❌ | 綁死 fork 領域：`actorBadge`（工牌）、繁中欄位標題、 |
| | | `beforeValue`/`afterValue`（模板的稽核表沒有這兩欄，只有 `metadata`） |

### 必須一併帶過來的安全政策

Fork 在實作時做了一個刻意決定，值得原文保留其理據：

> 對**不存在的**帳號的登入失敗**不寫**稽核事件。`audit_log.actor_id` 可為 null，
> 所以這是政策選擇而非 schema 限制：把登入事件歸屬到真實使用者列才能保持軌跡可查詢，
> 並且**避免把稽核日誌變成未驗證寫入面**（帳號列舉／log 灌爆）。

沒有這條，任何匿名者都能用不存在的 email 反覆嘗試來無限灌大稽核表。

## Solution

1. **schema** — `audit_log` 加 `onBehalf boolean not null default false` + migration。
2. **`lib/audit.ts`** — `logAudit()` 的參數加上可選的 `onBehalf?: boolean`（預設 false，
   既有呼叫端零改動）；`getAuditLog` / `getAuditLogForTarget` 的 select 帶出該欄。
3. **登入事件** — 在 E355 的接線點寫入三種事件，皆 fire-and-forget：
   - `auth.login` —— 成功
   - `auth.login_failed` —— 密碼錯（**僅限已解析到的真實使用者**）
   - `auth.locked` —— 觸發鎖定，或對已鎖帳號的再次嘗試
4. **代操作標記** — 標記模板中真正屬於「admin 代他人操作」的既有 action：
   `actions/admin.ts` 內改他人角色／狀態／重設他人密碼等。逐一檢視，**不臆測**：
   只在 actor ≠ target 且呼叫端確實是管理面板時標記。
5. **UI** — 稽核面板顯示代操作標記（沿用既有 `StatusBadge` 語彙，不新增設計語言）。

## Key Files

- `next-app/lib/schema/system.ts` + migration — `onBehalf` 欄
- `next-app/lib/audit.ts` — 參數 + select
- `next-app/lib/auth.ts` / `next-app/actions/auth.ts` — 登入事件（E355 的同一批接線點）
- `next-app/actions/admin.ts` — 代操作標記
- 稽核檢視元件 — 顯示旗標

## Acceptance Criteria

1. `audit_log.on_behalf` 欄位存在，預設 false，既有列不受影響。
2. `logAudit()` 未傳 `onBehalf` 時行為與現況完全相同（既有測試零改動全綠）。
3. 登入成功 → 寫入 `auth.login`；密碼錯 → `auth.login_failed`；觸發／撞上鎖定 → `auth.locked`。
4. **對不存在的 email 登入失敗 → 不寫入任何稽核列**（整合測試以計數斷言，紅綠證明）。
5. admin 代他人操作 → `on_behalf = true`；當事人自己操作同一動作 → `false`。
6. 稽核面板可看出代操作。
7. 既有 e2e 全綠。

## Out of Scope

- CSV 匯出欄位（fork 特有，模板的稽核表結構不同）。
- 稽核列不可竄改性／append-only 強制（那是 `@saas/audit-log` 模組的範疇）。
