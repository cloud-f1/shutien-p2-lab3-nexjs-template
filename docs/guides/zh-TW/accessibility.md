# 無障礙擴充指南 — 讓你的 Fork 維持 WCAG AA

> 你 fork 了這個模板，而且正在加入自訂 domain、頁面、主題或 primitive。模板出廠時就是
> **WCAG 2.1 AA 乾淨**的（axe-core 在 14 條路由上零違規 — 見
> [E177](../../epics/e177-a11y-audit-sweep.md)），但那份保證只涵蓋 fork 當下已存在的介面。
> 這份指南告訴你如何讓**新增**的介面維持在同一條標準線之上。
>
> 純文件。這裡的一切都不改變行為 — 只是把已經藏在測試程式碼裡的 a11y 契約寫出來，並示範如何擴充它。

---

## 摘要（TL;DR）

1. 你新增的每一條路由（透過 `make new-domain` 或 `/athena:domain`）在你把它加進
   [`next-app/e2e/a11y.spec.ts`](../../../next-app/e2e/a11y.spec.ts) 的路由清單之前，**不會**進入 a11y 掃描。
2. 自訂主題 token 必須通過 **4.5:1**（一般文字）/ **3:1**（大型文字 + 非文字 UI）的對比度。
   見 [§3 的 token 對照表](#3-自訂-token-對比度目標)。
3. 純圖示按鈕需要 `aria-label`；對話框使用 shadcn 的 `<Dialog>`（抽屜式則用 `<Sheet>`）；即時區域使用
   `role="alert"` / `aria-live`。見 [§4](#4-鍵盤--aria-撰寫規則)。
4. 本機執行閘門：`cd next-app && pnpm test:e2e --project=a11y`。只要有一個違規就會讓整次執行失敗。

---

## 1. 模板已經保證了什麼

這份契約是由程式碼強制執行的，不是靠口頭承諾。「位置」欄位指出確切的檔案，讓你可以逐一驗證每項主張。

| 保證 | 位置 |
|---|---|
| **WCAG 2.1 Level A + AA**，零違規 | `runAxe()` 以 `WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]` 執行 axe，位於 [`next-app/e2e/helpers/a11y-runner.ts`](../../../next-app/e2e/helpers/a11y-runner.ts) |
| 掃描 **14 條路由**（public + auth + dashboard） | [`next-app/e2e/a11y.spec.ts`](../../../next-app/e2e/a11y.spec.ts) 的 `PUBLIC_PAGES` + `DASHBOARD_PAGES` |
| 掃描 **primitive 互動**（Dialog + toast） | [`next-app/e2e/a11y-primitives.spec.ts`](../../../next-app/e2e/a11y-primitives.spec.ts) |
| **靜態 landmark / ARIA** 檢查（22 個單元斷言） | next-app 的 Vitest 單元斷言（以 `pnpm test` 執行） |
| **閘門** — 只要一個違規就讓 PR 失敗 | `next-app/playwright.config.ts` 的 Playwright project `[a11y]`（`name: "a11y"`，`testMatch: /a11y(-[\w-]+)?\.spec\.ts/`） |

**AAA 是刻意排除的。** `wcag2aaa` / `wcag21aaa` 被排除，因為 AAA 會卡掉太多配色選擇（見
[`A11Y_BASELINE.md`](../../design/A11Y_BASELINE.md) §「What gets scanned」）。AA 才是標準線 —
對模板、對你的 fork 都是。

**重要注意事項 — 單一儲存格涵蓋。** 今天的每一次掃描都只跑一個儲存格：
`{ theme: "dark", preset: "default" }`（見
[`a11y.spec.ts`](../../../next-app/e2e/a11y.spec.ts) 與
[`a11y-primitives.spec.ts`](../../../next-app/e2e/a11y-primitives.spec.ts)）。
6 主題 × 2 preset 的交叉積（cross-product）**尚未實作**（追蹤於跨主題 a11y 矩陣；見
[§5](#5-跨主題矩陣e212-與-e177b)）。這正是為什麼 §3 很重要：如果你重新換膚，或新增一個在非預設主題上
render 的頁面，**沒有任何自動掃描會檢查你的對比度** — 你必須親手通過這些標準線。

```bash
# 本機執行 a11y 閘門（需要 Next.js dev server 在 :3000）：
cd next-app
pnpm test:e2e --project=a11y

# 靜態（Vitest）landmark / aria 檢查 — 不需要 server：
pnpm test
```

---

## 2. 為你的 domain 擴充矩陣

當你用 `make new-domain NAME=notes`
（[`Makefile:297-299`](../../../Makefile) → `scripts/new-domain.sh`）或
`/athena:domain notes`（[`.claude/commands/athena/domain.md`](../../../.claude/commands/athena/domain.md)）
scaffold 一個 domain 時，產生器會在 `next-app/app/(dashboard)/dashboard/{kebab-plural}/page.tsx` 建立一個
App Router 路由。**在你把它加進掃描之前，那條路由對 a11y 掃描是隱形的。** 兩處編輯就能補上這個缺口。

### 2a. 把你的路由加進頁面掃描

dashboard 掃描會走訪 [`next-app/e2e/a11y.spec.ts`](../../../next-app/e2e/a11y.spec.ts) 的
`DASHBOARD_PAGES`。把你的新路由加進那個陣列（如果是免登入的路由，改加進 `PUBLIC_PAGES`）：

```ts
// next-app/e2e/a11y.spec.ts
const DASHBOARD_PAGES: ReadonlyArray<{ name: string; path: string }> = [
  { name: "dashboard-overview", path: "/dashboard/overview" },
  { name: "dashboard-sessions", path: "/dashboard/sessions" },
  { name: "dashboard-projects", path: "/dashboard/projects" },
  { name: "dashboard-settings", path: "/dashboard/settings" },
  { name: "notes", path: "/dashboard/notes" }, // ← 你的新 domain 路由
];
```

整個改動就這樣。現有的 `for (const { name, path } of DASHBOARD_PAGES)` 迴圈會登入、導航、執行
`runAxe(page)`，並對每一筆（包括你的）斷言 `.toHaveLength(0)`。

### 2b. 為自訂 primitive 加上互動掃描

Dialog、Sheet、toast 在被觸發前不會出現在 DOM 裡，所以頁面掃描搆不到它們 — 它們在
[`next-app/e2e/a11y-primitives.spec.ts`](../../../next-app/e2e/a11y-primitives.spec.ts) 裡有專屬的互動 spec。
**如果你打造了一個新的觸發式 primitive**（自訂 drawer、popover、command palette 等），請比照
[`a11y-primitives.spec.ts`](../../../next-app/e2e/a11y-primitives.spec.ts) 的 Dialog 模式：

```ts
// next-app/e2e/a11y-primitives.spec.ts（放在現有的 describe 區塊內）
test("MyPopover (open state) — zero violations", async ({ page }) => {
  await setThemeAndPreset(page, { theme: "dark", preset: "default" });

  await page.goto("/dashboard/notes");
  await waitForVisualReady(page);

  // 1. 用真實使用者的方式觸發它 — 不要用只給測試的 harness。
  await page.getByRole("button", { name: /open notes filter/i }).click();

  // 2. 等到開啟狀態真的進入 DOM。
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

  // 3. 掃描整頁（此時已包含開啟的 primitive）並斷言為零。
  const violations = await runAxe(page);
  if (violations.length > 0) logFailure("MyPopover", violations);
  expect(violations).toHaveLength(0);
});
```

請透過**真實的生產介面**（真實的按鈕標籤）觸發，而不是測試 harness — 這樣一來，若未來的重構弄壞了標籤，
spec 會以 locator-not-found 錯誤大聲失敗，而不是默默通過。這正是現有 Dialog spec 遵循的紀律（見其註解
[`a11y-primitives.spec.ts`](../../../next-app/e2e/a11y-primitives.spec.ts)）。

> **優先組合既有的 primitive。** 在動手寫新的觸發式 primitive 之前，先確認
> [`next-app/components/ui/`](../../../next-app/components/ui/) 裡 shadcn 的 `<Dialog>` 或 `<Sheet>` 是否已
> 涵蓋你的需求。它們建構於 Radix UI 之上，出廠就帶 focus-trap + ARIA 接線；自己手刻的 portal 沒有。這樣
> 現有的 Dialog/toast 掃描就免費罩著你。

---

## 3. 自訂 token 對比度目標

新增第 7 個主題，或為既有主題換膚，就代表你要為
[`next-app/app/globals.css`](../../../next-app/app/globals.css) 裡的文字／表面 token 挑新的 hex 值 —
主題 token 現在就放在這裡（Tailwind CSS v4 directives + CSS 自訂屬性 + dark-mode 變數，透過 Tailwind 的
`dark:` variant 與 `next-themes` 套用）。陷阱在於：因為跨主題掃描尚未實作（見 [§1](#1-模板已經保證了什麼)
的注意事項），**沒有任何自動測試會檢查非預設主題的對比度。** 這些標準線由你負責。

### WCAG AA 標準線

| 內容 | 最低對比度 | WCAG SC |
|---|---|---|
| **一般文字**（< 18.66px / 粗體時 < 24px） | **4.5 : 1** | 1.4.3（AA） |
| **大型文字**（粗體 ≥ 18.66px，或 ≥ 24px） | **3 : 1** | 1.4.3（AA） |
| **非文字 UI**（圖示、邊框、focus 環、表單輸入外框、控制項的 active 狀態） | **3 : 1** | 1.4.11（AA） |

這些就是 `runAxe` 透過 `wcag2aa` + `wcag21aa` tag 所強制執行的同一組標準線
（[`a11y-runner.ts`](../../../next-app/e2e/helpers/a11y-runner.ts）） — 你只是親手檢查矩陣搆不到的那些儲存格。

### 你必須檢查的 token 配對

`globals.css` 裡每個主題區塊都定義了一組文字三元組疊在一對表面之上。這些才是實際會
render 出來的組合，所以這些就是你要檢查的：

| 前景 token | 背景 token | 標準線 | 典型用途 |
|---|---|---|---|
| `--text-primary` | `--surface` | 4.5:1 | 內文、卡片上的標題 |
| `--text-primary` | `--surface-2` | 4.5:1 | 凸起／內凹表面上的內文 |
| `--text-secondary` | `--surface` | 4.5:1 | 次級標籤、次級內文（仍是真正的文字 → 4.5:1，不是 3:1） |
| `--text-muted` | `--surface` | 若是文字則 4.5:1；只有純裝飾時才是 3:1 | placeholder／disabled 提示 — **最常見的違規來源**（見 `A11Y_BASELINE.md` 的「Common offenders」） |
| `--primary` / `--accent` | `--surface` | 邊框／圖示用 3:1（非文字）；當作連結**文字**用則 4.5:1 | 品牌按鈕、active 狀態、連結 |
| `--sidebar-text` | `--sidebar-bg` | 4.5:1 | 側欄導航標籤（獨立的表面） |
| `--danger` / `--success` / `--warning` | `--surface` | 當文字 4.5:1，當圖示／徽章 3:1 | 語意 banner 與徽章 |

> **為什麼 `--text-muted` 是陷阱：** 在出廠的 `dark` 主題裡它是 `#3a3a52` 疊在 `--surface: #0e0e1a` 之上 —
> 當裝飾性分隔線沒問題，但如果你拿它來當*可閱讀*的提示文字，它可能掉到 4.5:1 以下。`A11Y_BASELINE.md`
> 對這題的解法是「bump the `--text-muted` token in `app/globals.css` for the offending theme」。請逐主題決定
> 你的 muted token 是承載文字還是只承載裝飾，並據此挑值。

### 在 commit 之前先檢查候選值

對上表中的每一組前景／背景配對：

1. **算出比值。** 把兩個 hex 值貼進任何 WCAG 對比度檢查器（例如 WebAIM Contrast Checker，或你瀏覽器的
   DevTools — 當你 inspect 一個文字節點時，Chrome 的取色器會內嵌顯示 AA/AAA 通過標記）。確認它通過表中的
   標準線。
2. **處理 `rgba()` token。** 有幾個 token（`--primary-light`、`--accent-light`、`--sidebar-hover`）是半透明的。
   檢查器需要不透明的顏色，所以先把 rgba 對它實際的背景（它疊在上面的表面）壓平，再測壓平後的結果。
3. **在大型與一般尺寸下分別重測。** 一個沒通過 4.5:1 的值可能通過 3:1 — 但只有當那個 token 確實只用於大型
   文字或非文字 UI 時，才能走 3:1 那條線。不要把內文用的 token 降級到 3:1 標準線。
4. **在你的主題下執行閘門。** 預設掃描不會抓到你的主題，但你可以暫時把儲存格切到你的主題，取得 axe 的
   `color-contrast` 報告：

   ```ts
   // 暫時改 a11y.spec.ts，在本機 smoke-test 你的新主題：
   await setThemeAndPreset(page, { theme: "your-theme", preset: "default" });
   ```

   接著 `pnpm test:e2e --project=a11y -g "<route name>"`。axe 的 `color-contrast` 規則會回報確切的失敗比值與
   節點。**在 commit 前還原這處儲存格改動** — 已 commit 的 baseline 在跨主題矩陣落地前維持在
   `dark`/`default`（見 [§5](#5-跨主題矩陣e212-與-e177b)）。

新增主題時，也請遵循 [`docs/design/css-architecture.md`](../../design/css-architecture.md) 裡的 6 步
「Adding a Theme」食譜，讓 token 契約保持完整 — 缺少的變數會 fallback 到 `:root`（dark），在淺色主題上
默默破壞對比度。

---

## 4. 鍵盤 + ARIA 撰寫規則

模板是 primitive-first 的：頁面組合 [`next-app/components/ui/`](../../../next-app/components/ui/) 裡的 shadcn/ui
元件（透過 `npx shadcn@latest add <name>` 加入，不手動編輯）並繼承這些 primitive 出廠的 ARIA 接線。為任何
新的自訂元件遵循下列 DO/DON'T 規則，才不會重新引入 primitive 早已解決的違規。

| 主題 | ✅ 該做 | ❌ 別做 |
|---|---|---|
| **純圖示按鈕** | 加上 `aria-label`，並透過 app 的 i18n 層／翻譯字串暴露這個標籤，讓它可翻譯（例如關閉或關掉的標籤）。 | 出貨一個光禿禿的 `<button><Icon/></button>` — axe 會標記 `button-name`。 |
| **對話框／覆蓋層** | 使用 shadcn 的 `<Dialog>`（抽屜式則用 `<Sheet>`），來自 [`next-app/components/ui/dialog.tsx`](../../../next-app/components/ui/dialog.tsx)。它們建構於 Radix UI 之上，出廠帶 `role="dialog"`、`aria-labelledby` / `aria-describedby` 接線與 focus trap。 | 手刻一個 portal `<div>`。沒有 focus trap = 鍵盤使用者會逃到覆蓋層後面的頁面。 |
| **即時區域**（toast、非同步 banner） | 使用 [`next-app/components/ui/`](../../../next-app/components/ui/) 的 shadcn toast（sonner）— 它會適當設定 `aria-live`（錯誤用 `assertive`，否則 `polite`）— 或 render 一個 `[role="alert"]` banner。 | 更新畫面上的狀態文字卻沒有 live-region role — 螢幕報讀器永遠不會播報它。 |
| **表單輸入** | 把每個 input 包進 shadcn 的 `<FormField>`（它會關聯 `<label for>` + 為錯誤關聯 `aria-describedby`）。 | 用一個裸 `<input>` 配一個浮動的 `<span>` 標籤 — axe 會標記 `label`。 |
| **Tab 順序** | 維持邏輯 DOM 順序：**skip-nav → topbar → nav → main**。app 在 root layout（[`next-app/app/layout.tsx`](../../../next-app/app/layout.tsx)）出廠帶一個 skip-nav 連結，指向 main 內容區域（`#main-content` / layout 的 `<main>`）；把那個 id 給你頁面的 main 區域。 | 用 `tabindex` > 0 來「修正」順序 — 它會讓視覺與鍵盤順序脫鉤。只有 `0` / `-1` 是可接受的。 |
| **Focus 可見性** | 讓 primitive 的 focus 環 render；若你重新設樣式，讓 focus 環對它的背景維持 ≥ 3:1（非文字對比度，[§3](#3-自訂-token-對比度目標)）。 | 設 `outline: none` 卻不給可見的替代 — 違反 2.4.7 Focus Visible。 |
| **以顏色表意** | 把顏色搭配標籤、圖示或形狀（例如錯誤 banner 同時有紅色**與**「Error」字樣／圖示）。 | 只靠顏色傳達狀態 — 違反 1.4.1 Use of Color，axe 不一定抓得到，所以這條靠你。 |

### i18n + `aria-label` 最佳實務

無障礙名稱（accessible name）是面向使用者的字串，所以它遵循專案的雙語規則：每個 `aria-label` 預設值都應
透過 app 的 i18n 層（它的翻譯字串）暴露，而非硬寫。**呼叫端傳入的 prop 永遠
勝過** i18n 預設 — 例如 primitive 在沒有傳入明確標籤時會 fallback 到翻譯字串。所以當你撰寫自訂
元件時：

- 把預設的無障礙名稱**同時**放進兩種語言的翻譯字串（`en` **與** `zh-TW`，key 相同，值翻譯）。
- 絕不在 TSX 裡硬寫英文 `aria-label` 字串 — 它不會被翻譯，並違反繁中鏡像規則。
- 不要把可見文字重複進 `aria-label`（這會讓螢幕報讀器重複播報）；只標記原本*未命名*的東西（純圖示控制項）。

---

## 5. 跨主題矩陣（E212 與 E177.b）

這份指南是**人**的擴充劇本。**機器**的後盾 — 一個會讓每條路由跑遍全部 6 主題 × 2 preset 而非只跑單一
`dark`/`default` 儲存格的掃描 — 被獨立追蹤為跨主題 a11y 矩陣（E212；最初在
[`A11Y_BASELINE.md`](../../design/A11Y_BASELINE.md) 的「Out of scope」中被定為 E177.b）。兩者互補：

- **在那個矩陣落地之前**，[§3](#3-自訂-token-對比度目標) 的手動對比度檢查是你對非預設主題的*唯一*防線 —
  請務必做。
- **一旦它落地**，你新主題的 token 會在每條路由上被自動掃描，而這份指南的 §3 就成了矩陣回報的失敗背後的
  「為什麼」。

E215（這份指南）**不**依賴那個矩陣出貨 — 把這個引用當成前瞻備註。如果你已經把跨主題矩陣拉進你的 fork，
把你的 CI 指向它，你就免費獲得 §3 的強制執行。

---

## 6. 在你的 fork 裡 debug 一個違規

當 `[a11y]` 閘門失敗時，別去找 suppression — 修 primitive。完整的 debug 劇本（讀
`formatViolations()` log → 在瀏覽器重現 → 修**primitive 而非頁面** → 用 `-g "<test>"` 重跑 → 補一個單元測試）
放在 [`docs/design/A11Y_BASELINE.md`](../../design/A11Y_BASELINE.md) 的「How to debug a violation」與
「Common offenders + recipes」。那份文件是修*失敗*掃描的單一真實來源；這份指南則是把掃描*擴充*到你的新介面。

---

## 範圍外（與 E177 相同的邊界）

- **手動螢幕報讀器測試**（NVDA / JAWS / VoiceOver） — 由人把關的後續步驟；axe-core 不能取代它。
- **WCAG AAA** — AA 才是標準線；AAA 會卡掉太多配色選擇。
- **認知無障礙**（閱讀難度、注意力、記憶） — 在 axe-core 的範圍之外。

---

## 延伸閱讀

- [`docs/design/A11Y_BASELINE.md`](../../design/A11Y_BASELINE.md) — a11y 契約、debug 食譜與 suppression
  政策（這份指南所擴充的單一真實來源）。
- [`e2e-testing.md`](../en/e2e-testing.md) — 在本機與 CI 執行 Playwright 套件，包含 `[a11y]` project（目前僅英文版）。
- [`fork-security-setup.md`](fork-security-setup.md) — 同一個 cycle 的姊妹篇 fork-enablement 指南（secrets
  + OWASP）。
- 這份指南所描述的機制的單一真實來源：
  [`next-app/e2e/helpers/a11y-runner.ts`](../../../next-app/e2e/helpers/a11y-runner.ts)、
  [`next-app/e2e/a11y.spec.ts`](../../../next-app/e2e/a11y.spec.ts)、
  [`next-app/e2e/a11y-primitives.spec.ts`](../../../next-app/e2e/a11y-primitives.spec.ts)、
  [`next-app/app/globals.css`](../../../next-app/app/globals.css)。
