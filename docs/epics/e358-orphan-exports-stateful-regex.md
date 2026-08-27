# E358 — `check-orphan-exports.mjs` 的有狀態 regex 假陽性

> Phase 87 · Size S · 2 SP · P1
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**
> 來源：Phase 86 執行過程的實地發現（Cycle 41）

## Problem

`scripts/check-orphan-exports.mjs:98` 把 regex 建在迴圈**外**，在迴圈**內**反覆 `.test()`：

```js
const ref = new RegExp(`\\b${name}\\b`, "g")   // ← g 旗標
for (const [f, t] of fileText) {
  if (f === file) continue
  if (!ref.test(t)) continue                    // ← 反覆呼叫
```

帶 `g` 旗標的 regex，`.test()` 會推進 `lastIndex`，**連續呼叫在不同字串上交替回 true/false**。

### 已實測重現

```
call1: true   call2: false   call3: true      （三個字串都含該符號）
```

同一字串連呼三次也一樣：`true false true`。

### 後果

E355 的 `nextFailedState` 被誤報為孤兒匯出 —— 它實際接在 `lib/auth.ts:79` 與
`actions/auth.ts:165`。`make verify` 裡 `check:orphans` 是非嚴格的（`|| true`），所以不會擋 CI，
但**會誤導審閱者**：一份寫著「這個新函式沒有呼叫端」的報告，正好出現在審查新程式碼的時候。

## Solution

`.test()` 用的 regex 拿掉 `g` 旗標。若他處需要全域版本供 `.match()` 使用，另建一個實例
（不要共用同一個物件）。

## Key Files

- `scripts/check-orphan-exports.mjs` — 第 98 行附近
- 新增回歸測試（位置比照 `scripts/hooks/tests/test-*.sh` 慣例，`make hook-test` 會自動撿）

## Acceptance Criteria

1. 同一符號出現在**三個以上**檔案時，三次判定**全部**為 true（現況為 true/false/true）。
2. 回歸測試以 fixture 目錄驗證，**不得**讀寫 repo 的真實檔案
   （比照 E353 的測試：以環境變數注入 `mktemp -d` 副本）。
3. 對 `main` 現況跑 `pnpm --dir next-app check:orphans`，`nextFailedState` **不再**出現在孤兒清單。
4. 若修正後浮現**真正的**孤兒匯出，如實列出並在 PR 中說明（不要為了讓清單變空而加 allowlist）。

## Out of Scope

- 修正修好後才浮現的真實孤兒 —— 那是另一個 epic 的事，本 epic 只負責讓偵測器說實話。
