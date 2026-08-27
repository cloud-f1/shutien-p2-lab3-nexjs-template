# E365 — CLAUDE.md 補上 E357 的 e2e 目標身分驗證契約

> Phase 88 · Size S · 2 SP · **P2**
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**

## Problem

E357 改變了 e2e 的**啟動前提**：`globalSetup` 會驗證測試打到的伺服器確實是本專案的實例
（以專案絕對路徑的 sha256 摘要當識別），目標不符就整套中止。相關環境變數：
`APP_INSTANCE_ID` / `E2E_EXPECTED_APP_INSTANCE_ID` / `E2E_SKIP_TARGET_CHECK`。

CLAUDE.md 第 30–53 行的 e2e 段落**只講資料庫隔離**（`saas_dev_e2e`、`db:e2e-setup`），
對這個新前提隻字未提。而 CLAUDE.md 是每個 session 自動載入的**唯一入口** —— 讀者在這裡查不到，
就只能等 e2e 中止時才第一次知道有這回事。

E357 的價值正是「不再靜默測錯 app」；如果沒人知道這道閘門存在，第一次遇到中止的人很可能
直接去找 `E2E_SKIP_TARGET_CHECK` 把它關掉。

## Solution

在 CLAUDE.md 的 e2e 區塊補 2–3 行：說明身分驗證的存在、三個環境變數、以及
「目標不符即整套中止」的行為；並指向 `docs/context/test-status.md` 的 Standing precondition 段落取得完整說明。

順帶檢查同段落其他敘述是否仍與現況相符。

## Key Files

- `CLAUDE.md`（第 30–53 行 Development Commands 的 e2e 區塊）
- `docs/context/test-status.md`（Standing precondition，**已存在**，作為指向目標）
- `next-app/e2e/global-setup.ts` · `next-app/lib/app-identity.ts`（敘述來源）

## Acceptance Criteria

1. CLAUDE.md 的 e2e 段落提到身分驗證、三個環境變數、與中止行為。
2. 有指向 `docs/context/test-status.md` 的連結。
3. 敘述與 `global-setup.ts` 的實際行為一致 —— 逐項比對，不是照抄提案。
4. 不與既有的資料庫隔離敘述重複或矛盾。

## Out of Scope

- 不改 e2e 的行為本身。
- 不處理 `E2E_SKIP_TARGET_CHECK` 的警告文字位置（已列入 Deferred）。
