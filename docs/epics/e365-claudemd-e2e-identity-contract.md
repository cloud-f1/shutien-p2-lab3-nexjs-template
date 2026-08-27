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

---

## 實作結果（2026-08-28）

新增一段 blockquote 至 `CLAUDE.md`，落在**第 51–58 行** —— **與 spec 寫的「第 30–53 行」不符**。
E363 先前改過 Memory System 段，加上本次插入，行號又位移一次。派工時已提醒「先讀活檔、
不要信 spec 行號」，implement 照做。

**這是本 phase 第二次行號腐化**（E364 是第一次）。兩次都因事先提醒而未改錯地方。

## 逐項比對 `global-setup.ts` / `app-identity.ts` 的結果

| 文件敘述 | 程式碼佐證 |
|---|---|
| 「Before any test runs」 | `globalSetup` 由 Playwright 在任何 spec 前執行；此處 throw 會在測試檔載入前中止 |
| 「calls `/api/health`」 | `probeHealth()` → `HEALTH_PATH = "/api/health"` |
| 「against this checkout's own id」 | 第 161 行 `resolve(dirname(fileURLToPath(import.meta.url)), "..")` —— **自身檔案位置，不是 cwd** |
| 「mismatch aborts the whole run」 | 五條失敗路徑（unreachable／bad-status／not-json／缺 appInstanceId／id 不符）全部走 `abort()` → `throw` |

### 三個環境變數的實際語意（已逐一驗證）

| 變數 | 生效端 | 作用 | 預設 |
|---|---|---|---|
| `APP_INSTANCE_ID` | **server** | 覆寫 `/api/health` 自報的 id（容器／standalone build 中路徑無意義時用） | 未設 → 由 `process.cwd()` 雜湊推導 |
| `E2E_EXPECTED_APP_INSTANCE_ID` | **runner** | 覆寫**期望值**，不從 checkout 路徑計算 | 未設 → 由 `global-setup.ts` 自身位置推導 |
| `E2E_SKIP_TARGET_CHECK` | **runner** | `"1"` 完全跳過檢查（印警告後提前返回） | 未設 → 檢查照跑 |

**orchestrator 查證**：`APP_INSTANCE_ID` 在 `global-setup.ts` 出現三次 —— 兩次在 **abort 訊息文字**中
（指導使用者去設什麼）、一次是 `E2E_EXPECTED_` 這個不同的變數。**裸 `APP_INSTANCE_ID` 從未被 runner 讀取。**
agent 的「server-side only」措辭精確。

### 一個值得記下的 fail-safe 設計

`app-identity.ts:39` 的註解說明：若 server 端從 `process.cwd()` 推導而該路徑與 checkout 不同，
結果是「a *false mismatch*, i.e. a loud abort, **never** a [false pass]」。

**這道閘門的失效方向是安全的** —— 它可能誤報不符而中止，但不會誤判相符而放行去測錯的 app。
這正是 E357 存在的理由，文件敘述與此一致。

## 沒有發現新的 spec 錯誤

implement 明確回報：epic 檔對**行為**的描述與程式碼一致，唯一不準的是行號範圍，
而那正是 spec 自己標記為可疑、要求實作者查證的部分。

本 phase 統計：E362／E363／E364 各抓到一項我的 spec 錯誤（兩項未查證的斷言 + 一組過時行號），
E366 與 E365 無。差別在於後兩者的 spec 給的是**程序**（「去看 X，然後依結果決定」／
「以程式碼為準，不符就明講」），前三者給的是**對既有機制的斷言**。
