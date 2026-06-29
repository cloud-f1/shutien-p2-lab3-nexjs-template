<!-- markdownlint-disable MD022 MD032 MD040 MD058 MD060 -->
# AI Coding Template — 公開 Talk HTML 簡報設計

> **Status**: Draft — pending user review
> **Date**: 2026-04-11
> **Author**: Brainstormed with Claude Opus 4.6
> **Output**: `docs/presentations/ai-coding-template-talk/`

---

## 1. 目標與範圍

### 1.1 目標
產出一份可在 meetup / 內部分享 / 公開 talk 場合使用的 HTML 簡報，完整介紹 `ai-coding-template` 的架構、學習系統、agent harness 設計，並透過 5 個 production 專案佐證其可擴展性。

### 1.2 聽眾定位
**混合聽眾 / 公開 talk**：同場包含工程師、技術主管、非技術決策者。論述角度需要在「技術細節」與「價值主張」之間平衡，不可過度偏向任一端。

### 1.3 基本設定
| 項目 | 決定 |
|---|---|
| 語言 | 繁體中文為主（技術名詞保留英文：agent, TDD, OpenAPI, hook 等） |
| 長度 | ~30 分鐘 |
| 頁數 | 37 slides（含緩衝，現場可跳過 3–5 張） |
| 格式 | reveal.js hybrid（內容頁 Markdown + 特殊頁 HTML） |
| 視覺 | 沿用 template 設計系統（dark + amber）+ §5/§6 加 terminal 元素 |
| 離線 | 必須完全離線可用（meetup 現場 WiFi 不可靠） |

### 1.4 不在範圍內
- 真實 live demo（太容易翻車；以腳本化回放替代）
- 英文版本（先做繁中版，未來可複製 `slides/` → `slides-en/`）
- PDF 版本（可用 `pandoc` 事後導出，不在這次交付）
- 線上 host（本次只交付本地 `file://` 可執行檔案樹）

---

## 2. 技術選型決策

### 2.1 Slide 框架：reveal.js 5.x
**選擇原因**：
- 原生支援 speaker notes + presenter mode（`s` 鍵開啟）
- 原生支援 Markdown slides（`<section data-markdown>`）
- 可混用 Markdown 與內嵌 HTML/JS，適合 hybrid 內容
- Slide overview mode（`esc` 鍵）方便現場跳頁
- 成熟穩定，離線部署簡單

**淘汰選項**：
- **Slidev**：需要 Node runtime，離線部署較複雜
- **純 CSS scroll-snap**：沒有 presenter mode，Q&A 跳頁麻煩
- **自刻**：兩天工時只換來簡報框架，不值得

### 2.2 內容格式：Markdown + HTML hybrid
| Slide 類型 | 格式 | 放置位置 |
|---|---|---|
| 純文字章節（§1, §2, §3, §6, §8）| Markdown | `slides/*.md` |
| 含圖表章節（§4, §7 文字部分）| Markdown + 外嵌圖 | `slides/*.md` + `assets/diagrams/` |
| 互動 demo（§4 memory flow, §5 terminal 回放）| HTML + JS | `sections/*.html` |
| Cover / TOC / Closing | HTML | `sections/*.html` |

**分配原則**：凡是「能用 bullet 表達」的都走 Markdown；只有真正需要客製排版或動畫的才走 HTML。

### 2.3 離線策略
- `vendor/reveal.js@5.x/` — 整包 local，**不走 CDN**
- `assets/fonts/*.woff2` — 字體本地化，**不走 Google Fonts CDN**
- 所有圖片相對路徑，確認 `file://` 協議可載入
- `theme.css` 內含 system font fallback chain

---

## 3. 檔案結構

```
docs/presentations/ai-coding-template-talk/
├── index.html                    ← 入口，reveal.js 初始化
├── README.md                     ← 啟動方式、快捷鍵、現場 checklist
├── slides/                       ← Markdown 內容頁
│   ├── 01-architecture.md        [3 slides]
│   ├── 02-pros-cons.md           [3 slides]
│   ├── 03-persona.md             [3 slides]
│   ├── 04-learning.md            [3 slides，不含 demo 頁 14]
│   ├── 06-why.md                 [3 slides]
│   ├── 07-projects.md            [10 slides]
│   └── 08-observations.md        [3 slides]
├── sections/                     ← HTML 特殊頁
│   ├── cover.html                [slide 00]
│   ├── toc.html                  [slide 01]
│   ├── memory-demo.html          [slide 14]
│   ├── agent-team.html           [slides 15–18]
│   ├── loop-demo.html            [slide 19]
│   ├── closing.html              [slide 36]
│   └── appendix.html             ← 備援 slide（audit.jsonl + hooks 檔案樹）
├── styles/
│   ├── theme.css                 ← 複製 template 的 CSS token（非 @import）
│   ├── slide-layout.css          ← 4 種版型：hero / split / grid / terminal
│   ├── terminal.css              ← §5 terminal 樣式
│   └── fonts.css                 ← Archivo + Plus Jakarta + Noto TC + IBM Plex Mono（local）
├── scripts/
│   ├── main.js                   ← reveal.js init + hotkey 註冊
│   ├── demo-learning.js          ← §4 memory flow 動畫
│   └── demo-loop.js              ← §5 terminal 回放腳本
├── assets/
│   ├── diagrams/
│   │   ├── architecture.svg      ← §1 中心圖（openapi.yaml 放射狀）
│   │   ├── agent-team.svg        ← §5 9-agent 分工
│   │   ├── memory-tier.svg       ← §4 Tier 0/1 圖
│   │   └── pipeline.svg          ← §1 spec→code pipeline
│   ├── screenshots/
│   │   ├── shuttle.png
│   │   ├── shiftflow.png
│   │   ├── chronos.png           ← ⭐ 主打案例
│   │   ├── eventflow.png
│   │   └── ai-finance.png
│   ├── icons/agents/*.svg        ← 9 個 agent 頭像
│   └── fonts/*.woff2             ← 本地字體
└── vendor/
    └── reveal.js@5.x/            ← 整包下載
```

---

## 4. 視覺系統

### 4.1 色彩 Token（沿用 template dark 主題）

| Token | 值 | 用途 |
|---|---|---|
| `--bg` | `#0b0b0d` | slide 底色 |
| `--surface` | `#15151a` | 卡片、terminal 背景 |
| `--primary` | `#f59e0b` (amber) | 強調色、章節標題底線 |
| `--text` | `#ededed` | 內文 |
| `--muted` | `#8a8a93` | 副標、註腳 |
| `--accent-green` | `#22c55e` | agent success 狀態 |
| `--accent-red` | `#ef4444` | agent fail、warning |
| `--accent-blue` | `#3b82f6` | learning flow 動畫 |

### 4.2 字體

| 用途 | 字體 | Fallback |
|---|---|---|
| 標題 | Archivo | system-ui, sans-serif |
| 內文 | Plus Jakarta Sans | system-ui, sans-serif |
| 中文（一般）| Noto Sans TC | "PingFang TC", "微軟正黑體", sans-serif |
| 中文（§7 亮點引用）| Noto Serif TC | "宋體", serif |
| Code / Terminal | IBM Plex Mono | "Menlo", monospace |

**§7 亮點頁用襯線中文字體**，與其他頁的 sans-serif 形成對比，讓 5 個專案的「這一刻」引言成為 talk 的情感記憶點。

### 4.3 版型（4 種）

設計稿尺寸 `1920×1080`（16:9）。

1. **Hero** — Cover, §5 開場, Closing。大字置中、副標在下、裝飾線動畫
2. **Split** — §1 架構、§7 案例封面。左 60% 圖 / 右 40% 文字
3. **Grid** — §5 9-agent、§2 對照表。2×3 或 3×3 卡片陣列
4. **Terminal** — §5 demo、§4 memory 動畫。全屏暗底、monospace

### 4.4 進場動畫策略
**刻意節制**。只在三處使用動畫，其他全 `fade`：
1. Cover 大字標題（slide-in from bottom）
2. §5 terminal typewriter
3. §4 memory flow 球體移動

**禁止**：fly-in、zoom、rotate、flip（搶戲且廉價）。

---

## 5. 內容骨架（37 Slides）

### 5.1 Cover + TOC（slides 00–01）
| # | 標題 | 內容 |
|---|---|---|
| 00 | Cover | `AI Coding Template：讓 9 個 agent 幫你寫 SaaS` + 講者名 + 日期 |
| 01 | TOC | 8 章節目錄，hover 亮起對應章節顏色 |

### 5.2 §1 Intro — 架構（slides 02–04）
**敘事目標**：30 秒內讓聽眾看懂「這是什麼形狀的東西」。

| # | 標題 | 內容 |
|---|---|---|
| 02 | 一張圖看完 | 大 SVG：`openapi.yaml` 中心 → 放射狀連到 `server/` `client/` `agents/` `hooks/` `skills/`。強調 spec-first |
| 03 | 技術選型決策 | FastAPI + fastapi-users JWT ‧ React + tokenCache 記憶體 ‧ Postgres + Alembic ‧ React Query 分 tier ‧ Zeabur 部署 |
| 04 | Spec → Code pipeline | 5 步驟流程：`spec → implement → qa → commit → merge`，對應 `/athena:*` command |

### 5.3 §2 Pros & Cons（slides 05–07）
**敘事目標**：不造神。誠實講代價才有信任感。

| # | 標題 | 內容 |
|---|---|---|
| 05 | 好處 | ① 0 到可部署 SaaS < 1 天 ② Stop Verifier 17 條守品質 ③ 5 production 專案共享基底 ④ client 80% / server 90% coverage 出生就有 |
| 06 | 代價 | ① 學習曲線陡（9 agent + 19 command）② Claude Code 綁定 ③ Chronos 157 epics 顯示「過度切分」傾向 ④ 單 orchestrator 瓶頸 |
| 07 | 不適合什麼 | 一人 weekend hack（overkill）‧ 非 FastAPI/React 技術棧 ‧ Agent 輔助排斥派 |

### 5.4 §3 Persona（slides 08–10）
**敘事目標**：幫每個聽眾找到自己的座位。

| # | Persona | 痛點 → 解法 |
|---|---|---|
| 08 | Solo Founder / Indie Hacker | 想做 SaaS 但 auth/billing/test 要自寫 → `make go` 一鍵 + 直接寫 domain |
| 09 | Agency / Studio | 每個客戶案重新搭基底 → fork + domain-first agent → 2 週 MVP |
| 10 | AI-native Engineer | 想學 LLM harness 設計 → 這個 repo 本身就是教材 |

### 5.5 §4 Learning System（slides 11–14）
**敘事目標**：解釋為什麼這套不會「用著用著 LLM 就失憶」。

| # | 標題 | 內容 |
|---|---|---|
| 11 | LLM 健忘症問題 | 一般用法每次開新 chat 要重 paste context；人性上沒人會每次都做 |
| 12 | Tier 1 — Project Memory | `docs/context/` 8 檔案，每 agent 有自己的寫回檔，`/athena:save` 一鍵 checkpoint |
| 13 | Tier 0 — Global Wisdom | `~/.claude/template-memory/` 跨專案記憶，`/athena:promote` 提升 `[GENERALIZABLE]` lesson |
| 14 | **Demo：memory 寫回動畫** | SVG 動畫：Chronos (Tier 1) → template-memory (Tier 0) → EventFlow (Tier 1 read) |

### 5.6 §5 Agent Team + Harness（slides 15–19）★ **核心章節**
**敘事目標**：整場 talk 的高潮。讓聽眾「哇」一次。

| # | 標題 | 內容 |
|---|---|---|
| 15 | 9 個 Agent 的分工 | 大圖：`@spec-writer @reviewer @qa @best-practice @debugger @deployer @memory-curator @strategist @orchestrator`。標色：紅＝寫碼、藍＝審查、綠＝運維 |
| 16 | Harness = 把 agent 變成可信賴的同事 | 三層骨架：① `hooks/` 生命週期（17 條 Stop Verifier）② `skills/` context injector ③ `audit.jsonl` 可追溯歷史 |
| 17 | `/athena` 指令空間 | 19 command tree 圖。特別點：`loop`（epic 推進）‧ `batch`（並行 wave）‧ `cycle`（全 DevOps）‧ `metrics`（E146 agent 可靠度）|
| 18 | Metrics + Evaluator | `audit.jsonl → /athena:metrics` 表格（per-agent run/success/duration/retries）+ E147 `@evaluator` 獨立驗收 |
| 19 | **Demo：`/athena:loop` 30 秒回放** | Terminal 腳本化回放一次 E148 bugfix audit hook 的完整流程 |

### 5.7 §6 Why you need it for coding（slides 20–22）
**敘事目標**：收束成「所以你該動手」。

| # | 標題 | 內容 |
|---|---|---|
| 20 | 沒有 harness 的 LLM coding 長什麼樣 | 痛點：context 丟失、mock 漂移、測試沒跑完就 commit、每人 prompt 不同產出不穩 |
| 21 | 這套 template 怎麼接住 | 對照表：每痛點對應一 harness 解法（memory tier / stop verifier / MSW factory / agent role lock）|
| 22 | 成績單 | 硬數字：template 661 tests ‧ Chronos 157 epics ‧ 5 production 專案 ‧ 80%/90% coverage。註腳 `as of 2026-04-11` |

### 5.8 §7 5 Production 專案案例（slides 23–32）
**敘事目標**：證明「這不是玩具，不是 demo」。每專案 2 頁（封面 + 亮點）。

| # | 專案 | 封面頁 | 亮點頁 |
|---|---|---|---|
| 23–24 | **Shuttle** (ai-badminton-booking-system) | 羽球場地預訂 SaaS + dashboard 截圖 | 場地/時段 domain；OpenAPI-first 讓前後端同步開工 |
| 25–26 | **ShiftFlow** (ai-casino-shift) | 企業排班 + Lark 原生核准 | Lark integration；排班週期 26→25 日業務規則被 agent 正確處理 |
| 27–28 | **Chronos** (ai-clock-work) ⭐ | 台灣中小企業 HR SaaS（打卡/薪資/勞基法）| **`@labor-law` agent**：PR review 擋下違反 §38 的未休代金算法，引用具體條文 |
| 29–30 | **EventFlow** (ai-event-mgn) | 活動管理（票務 + 報名）| event / ticket / attendee domain；同基底 2 週從 0 上線 |
| 31–32 | **AI Finance Management** | 個人/中小企業財務 | **`@compliance-checker` agent**：會計準則守門員；agent 作 domain expert 的範例 |

### 5.9 §8 Claude 的觀察與建議（slides 33–35）★ meta
**敘事目標**：給聽眾一個「這份 talk 是 AI 幫忙設計的」的驚喜收尾。

| # | 標題 | 內容 |
|---|---|---|
| 33 | 真正令人佩服 | ① Learning loop 有牙齒（stop verifier + memory tier 閉環）② Promote 讓單專案教訓回饋所有未來專案 ③ 19 command 命名紀律 |
| 34 | 結構性風險觀察 | ① 157 epics 可能是「epic 切太小」的症狀 ② `@orchestrator` 單點瓶頸 ③ Harness 與 FastAPI/React 綁太緊 |
| 35 | 可延伸方向 | ① `@evaluator` 擴成跨專案驗收 ② harness 抽成 stack-agnostic layer ③ Tier 0 promote 自動化（目前手動） |

### 5.10 Closing（slide 36）
| # | 標題 | 內容 |
|---|---|---|
| 36 | Q&A | GitHub repo QR ‧ MEMORY.md 路徑 ‧ 「Questions?」大字 |

---

## 6. 互動元件規格

### 6.1 Demo A — §4 Learning Flow（slide 14）
- **時長**：3–5 秒自動播放，可按 `r` 重播
- **技術**：SVG + JS（不需 canvas）
- **內容**：
  - 三個 node：`Chronos (Tier 1)` → `template-memory (Tier 0)` → `EventFlow (Tier 1 read)`
  - 發光球體沿路徑移動，代表 `GUID TypeDecorator` 這條 lesson
  - 每個 node 彈出 tooltip 顯示實際檔案路徑
- **觸發**：reveal.js `slidechanged` event
- **Fallback**：`?static=1` query 參數顯示靜態圖版

### 6.2 Demo B — §5 `/athena:loop` Terminal 回放（slide 19）
- **時長**：30 秒腳本化回放，可按 `space` 暫停
- **技術**：純 CSS + JS 模擬（**非**真 shell）
- **腳本內容**（推進 E148 bugfix audit hook）：
  ```
  $ /athena:loop
  [orchestrator] reading EPIC_INDEX.md... next: E148
  [spec-writer]  drafting spec for bugfix audit hook...
  [qa]           running 11 integration tests...
  [qa]           ✓ 11/11 passed, coverage 87%
  [reviewer]     reading diff, 3 comments raised
  [debugger]     fix applied, re-running tests...
  [qa]           ✓ 11/11 passed
  [deployer]     pre-deploy gates: 7/7 ✓
  [orchestrator] E148 marked complete
  ```
- **視覺**：每 agent 前綴用 `--accent-*` 上色；右下角進度條 `E148 ▓▓▓▓▓▓▓▓░░ 80%`
- **Fallback**：`?static=1` 顯示完整 log 靜態版

### 6.3 快捷鍵

| 鍵 | 功能 | 來源 |
|---|---|---|
| `→` `←` | 換頁 | reveal.js 原生 |
| `s` | 開 speaker notes 視窗 | reveal.js 原生 |
| `esc` | slide overview | reveal.js 原生 |
| `f` | 全螢幕 | reveal.js 原生 |
| `?` | 顯示所有快捷鍵 | reveal.js 原生 |
| `r` | Demo 頁重播動畫 | 自訂 |
| `space` | Slide 19 terminal 暫停 | 自訂 |
| `b` | 跳到 appendix（備援 slide）| 自訂 |

---

## 7. 工作分解（writing-plans 會展開）

僅順序與依賴，**不談時程估算**。

| Phase | 模組 | 可平行 | 依賴 |
|---|---|---|---|
| P1 | 骨架：下載 reveal.js、`index.html` 外殼、load `theme.css` + `fonts.css` | ❌ | — |
| P2 | 4 種版型 CSS（hero / split / grid / terminal）| ❌ | P1 |
| P3 | 素材：5 個專案截圖、4 張 SVG 圖、字體 woff2、agent icon | ✅ 可平行 | — |
| P4a | 文字章節：§1–§3, §4（slides 11–13）, §6, §8 的 `.md`（15 slides）| ✅ 6 檔可平行 | P2 |
| P4b | HTML 特殊頁：cover、toc、closing | ✅ 可平行 P4a | P2 |
| P5 | §5 Agent team 4 張靜態 slide（15–18）| ❌ | P2, P3 |
| P6 | §4 Learning demo SVG 動畫（slide 14）| ❌ | P2 |
| P7 | §5 Terminal demo 腳本化回放（slide 19）| ❌ | P2 |
| P8 | §7 Project 10 頁 | ❌ | P2, P3 |
| P9 | Speaker notes 補齊（**所有 slide 完成後最後補**）| ❌ | P4–P8 |
| P10 | 煙霧測試 + 微調 | ❌ | P9 |

---

## 8. 驗收標準

| 測試類型 | 做法 | 通過條件 |
|---|---|---|
| 視覺煙霧測試 | `live-server` 打開，手動翻 37 頁 | 無破版、圖片載入、字體載入 |
| 解析度測試 | Chrome DevTools 測 1920×1080 / 1440×900 / 1280×720 | 版面不跑位 |
| Speaker notes 檢查 | 按 `s` 開 presenter mode | 37 張都有 Note（不能空）|
| 快捷鍵測試 | `→ ← s esc f ?` 原生鍵 + `r space b` 自訂鍵 | 都可用 |
| Demo 播放 | Slide 14 + Slide 19 完整 loop | 動畫不卡 |
| 截圖載入 | 相對路徑在 `file://` 協議可載入 | 10 張圖都顯示 |
| **離線可用** | 拔網路線翻一次 | 字體 / 圖示 fallback 安全 |

**離線可用是最關鍵的驗收**：meetup 現場 WiFi 不可靠，任何外部 CDN 依賴都是地雷。

---

## 9. 風險與 Fallback

| 風險 | Fallback |
|---|---|
| Slide 14 動畫在投影機卡 | `?static=1` query 參數走靜態版本 |
| 字體在 `file://` 不載入 | `theme.css` 內含 system font fallback chain |
| 投影機只支援 4:3 | reveal.js config `width/height` 改即可 |
| Chrome 在舊投影機 lag | `?backgroundTransition=none` 關所有動畫 |
| Q&A 問到技術細節 | 備 `sections/appendix.html`（audit.jsonl 範例 + hooks 檔案樹）按 `b` 進入 |

---

## 10. 現場 Checklist（寫入 `README.md`）

```
□ 筆電充電 > 60%
□ 投影機解析度確認 1920×1080（或調 slide-layout.css 的 --slide-w）
□ 用 file:// 開一次 index.html，完整翻 37 頁
□ 按 r 測 slide 14 動畫
□ 按 space 測 slide 19 動畫
□ 按 s 測 presenter mode 是否能在延伸螢幕顯示
□ 關閉 notification（macOS: 勿擾模式）
□ 調 terminal 字體大小（preview 在 slide 19 看到才知道）
□ 網路線拔掉再翻一次（確認 offline 可用）
□ 備份：把整個資料夾 zip 一份到 USB
```

---

## 11. 後續

本 spec 通過 review 後，交由 `writing-plans` skill 展開為詳細實作計畫（每個 Phase 的具體任務、檔案、順序）。實作階段交由 `frontend-design` 或 subagent 執行。
