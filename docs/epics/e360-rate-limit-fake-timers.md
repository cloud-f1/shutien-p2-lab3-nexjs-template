# E360 — `rate-limit` 測試的 1ms 視窗 flake

> Phase 87 · Size S · 2 SP · P2
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**
> 來源：Phase 86 執行過程的實地發現（Cycle 41）

## Problem

`next-app/lib/rate-limit.test.ts` 的「resets the window after it expires」用 **1ms** 視窗：

```ts
expect(rateLimit(key, 1, 1).ok).toBe(true)
expect(rateLimit(key, 1, 1).ok).toBe(false)
// Window of 1ms — after a tick the bucket is expired and refills.
return new Promise<void>((resolve) => {
  setTimeout(() => {
    expect(rateLimit(key, 1, 1).ok).toBe(true)
```

兩次連續呼叫之間若**跨過毫秒邊界**，第二次的 bucket 就已過期並重新充值 →
`expected true to be false`。

它同時還用**真實** `setTimeout` + Promise，讓測試的執行時間受排程影響。

### 影響

Phase 86 期間至少兩個 agent 各撞到一次（E354 的實作、E356 的 QA），單獨重跑 5 次全綠。

真正的成本不只是「偶爾要重跑」——**它讓每個撞到的 agent 都得花力氣確認「這不是我弄壞的」**。
E356 的 QA 花了篇幅論證它與該 epic 無關（`git status | grep -c rate-limit` → `0`）。
這是持續性的注意力稅，也是 CI 的定時炸彈。

## Solution

改用 fake timers：`vi.useFakeTimers()` + `vi.advanceTimersByTime()`，視窗改成有意義的長度
（例如 `MINUTE_MS`，與同檔其他測試一致）。時間推進變成確定性的，不再依賴排程。

注意 `vi.useFakeTimers()` 的作用域 —— 在 `afterEach` 還原（`vi.useRealTimers()`），
避免污染同檔或同 worker 的其他測試。

## Key Files

- `next-app/lib/rate-limit.test.ts`

## Acceptance Criteria

1. 該測試改用 fake timers，**不再**使用 1ms 視窗或真實 `setTimeout`。
2. 連續跑該檔 **20 次全綠**（現況偶發轉紅）。在 PR 中附上實際指令與輸出。
3. 測試的語意不變 —— 仍在驗證「視窗過期後 bucket 重新充值」，不是把斷言放寬。
4. `lib/rate-limit.ts` **不得**修改（產品程式碼沒有問題，問題在測試）。
5. 同檔其他測試不受 fake timers 污染（`afterEach` 還原）。

## Out of Scope

- `lib/rate-limit.ts` 本身的行為變更。
- 其他檔案的 flaky 測試 —— 若掃描時發現，記錄但不在本 epic 修。
