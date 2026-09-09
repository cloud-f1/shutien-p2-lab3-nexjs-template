# E369 — 影子驗證器歸零：手刻檢查收斂到 Zod 契約

> Phase 89 · correctness · 🟢 **APPROVED — 使用者於 2026-09-09 依 code-review 結果核准**
> 來源：2026-09-09 `next-app/` 產品程式碼審查 F9

## Problem

E348／E352 刪掉了 `validateItemTitle()`，理由是**手刻檢查會與 schema 悄悄分歧**。
那次修正只套用到 items。同一個構造在其他每個 mutation 入口都還在：

| 位置 | 影子驗證 | 與 Zod 契約的分歧 |
|---|---|---|
| `actions/api-keys.ts:24` | `name?.trim()` + `length > 100` | 無對應 schema，長度上限只存在於此 |
| `actions/webhooks.ts:31` | `isHttpsUrl()` + 2048 上限 | 手刻 `new URL()` 判 protocol |
| `actions/webhooks.ts:26` | `sanitizeEvents()` | **見下** |
| `actions/team.ts:17,34` | `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` | 與全專案通用的 `z.string().email()` 不一致 |

`sanitizeEvents` 是其中最該優先處理的一個，它比「分歧」更糟 —— **它不拒絕，它靜默改寫**：

```ts
function sanitizeEvents(events: string[]): string[] {
  const set = new Set(events.filter((e) => (VALID_EVENTS as readonly string[]).includes(e)))
  return set.size ? [...set] : ["*"]
}
```

使用者送出一個打錯字的事件名 → 全被 filter 掉 → `set.size === 0` → **回傳 `["*"]`**。
本來只想訂閱一個事件，換來的是訂閱**全部**事件，而且沒有任何錯誤訊息。對一個會把資料
外送到第三方 URL 的 webhook 來說，這是靜默的範圍擴大。

`EMAIL_RE` 的分歧則是典型的手刻 regex 問題：它接受 `a@b.c`，而 `z.string().email()` 不接受。
同一個系統對「什麼是有效 email」有兩套答案，取決於你走哪個入口。

## Solution

1. **每個 mutation 建立具名的 Zod schema**，放在 `lib/validations/` 下（與 items 同慣例）：
   `createApiKeySchema` · `createWebhookSchema` · `inviteMemberSchema`。
2. **`sanitizeEvents` 改為拒絕而非改寫** —— 以 `z.array(z.enum(VALID_EVENTS)).min(1)` 表達；
   無效事件名回明確錯誤。若確實需要「訂閱全部」，必須由呼叫端**顯式**送出 `["*"]`，
   且 `"*"` 須是 `VALID_EVENTS` 的成員。
3. **URL 驗證**改用 `z.string().url()` + `.refine(https)` + `.max(2048)`。
4. **刪除** `EMAIL_RE`，改用專案通用的 email schema。
5. 動作內**不得**再有手寫的 `if (!x) return { error }` 型別／長度／格式檢查 —— 全部由
   schema 解析產生。

## Key Files

- `next-app/lib/validations/`（新增 3 支 schema）
- `next-app/actions/api-keys.ts`
- `next-app/actions/webhooks.ts`
- `next-app/actions/team.ts`

## Acceptance Criteria

1. `createWebhook` 收到含無效事件名的陣列 → **回錯誤**，且不建立任何 webhook 列。
   （紅綠重現：修正前同一輸入會建立一個 `events: ["*"]` 的列 —— 測試須先證明舊行為存在。）
2. `createWebhook` 收到 `[]` → 回錯誤（不再靜默變 `["*"]`）。
3. `inviteMember("a@b.c")` 與 `z.string().email().safeParse("a@b.c")` 給出**相同**判定。
4. `createApiKey` 的長度上限由 schema 表達，且該 schema 被前端表單共用（單一來源）。
5. 三個檔案中 `grep -c 'return { error: "請輸入\|無效'` 的手刻分支數降為 0。
6. 既有測試全綠；覆蓋率不低於現況。

## Cross-Epic

- **依賴 E368** —— 兩者改同一批檔案（`api-keys.ts` / `webhooks.ts` / `team.ts`）。
  E368 先合併，本 epic 在其之上開分支。

## Out of Scope

- 不改 `VALID_EVENTS` 的內容（只改它如何被驗證）。
- 不處理 `registry/` 下的 fork 範例模組。
