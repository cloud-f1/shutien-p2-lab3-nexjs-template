<!-- markdownlint-disable MD022 MD031 MD032 MD040 MD058 MD060 -->
# AI Coding Template Talk — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 37-slide offline-capable reveal.js HTML presentation covering the ai-coding-template architecture, learning system, agent harness, and 5 production project case studies for a ~30 minute mixed-audience talk.

**Architecture:** reveal.js 5.x with inline sections inside a single `index.html`. Markdown for content-heavy slides (28 slides across 7 `.md` files loaded via `data-markdown`), inline HTML blocks for cover/TOC/closing/demo special pages. Theme CSS replicates template design tokens (dark + amber). Fully offline — reveal.js, fonts, and assets all local.

**Tech Stack:** reveal.js 5.x, Markdown, HTML5, CSS custom properties, vanilla JS (no framework), SVG animations, Archivo + Plus Jakarta Sans + Noto TC + IBM Plex Mono fonts.

**Source spec:** `docs/superpowers/specs/2026-04-11-ai-coding-template-talk-design.md`

---

## File Structure

Working directory: `docs/presentations/ai-coding-template-talk/`

**Key files this plan creates:**

- `index.html` + `README.md` (root)
- 7 Markdown slide files in `slides/`
- 4 CSS files in `styles/`
- 3 JS files in `scripts/`
- 4 SVG diagrams + 5 screenshots + 9 agent icons + local font files in `assets/`
- reveal.js 5.x vendor files in `vendor/reveal.js@5.x/`

**Important architectural decision:** Rather than dynamically `fetch()`-loading HTML section placeholders (which trips XSS-sensitive DOM APIs), all HTML special pages (cover, TOC, demos, closing, appendix) are inlined directly in `index.html`. Only Markdown slides use `data-markdown` external loading.

---

## Task 1: Create directory tree

**Files:**
- Create: `docs/presentations/ai-coding-template-talk/` + subdirectories

- [ ] **Step 1: Create tree**

```bash
mkdir -p docs/presentations/ai-coding-template-talk/{slides,styles,scripts,assets/diagrams,assets/screenshots,assets/icons/agents,assets/fonts,vendor}
```

- [ ] **Step 2: Commit**

```bash
git add docs/presentations/ai-coding-template-talk
git commit -m "chore(talk): scaffold directory tree"
```

---

## Task 2: Download reveal.js vendor locally

**Files:**
- Create: `vendor/reveal.js@5.x/dist/` tree

- [ ] **Step 1: Fetch reveal.js 5.1.0**

```bash
cd docs/presentations/ai-coding-template-talk/vendor
curl -L https://github.com/hakimel/reveal.js/archive/refs/tags/5.1.0.tar.gz -o reveal.tar.gz
tar -xzf reveal.tar.gz
mv reveal.js-5.1.0 reveal.js@5.x
rm reveal.tar.gz
rm -rf reveal.js@5.x/.git reveal.js@5.x/test
```

- [ ] **Step 2: Verify**

```bash
ls vendor/reveal.js@5.x/dist/reveal.{js,css} vendor/reveal.js@5.x/plugin/markdown/markdown.js vendor/reveal.js@5.x/plugin/notes/notes.js
```

Expected: 4 files listed, none missing.

- [ ] **Step 3: Commit**

```bash
git add vendor/
git commit -m "chore(talk): vendor reveal.js 5.1.0 offline"
```

---

## Task 3: Download fonts locally

**Files:**
- Create: `assets/fonts/*.woff2` (~13 files)

- [ ] **Step 1: Fetch from Google Fonts**

Create a temporary script then run it:

```bash
cat > /tmp/download-fonts.sh <<'SCRIPT'
#!/bin/bash
set -e
cd "$1"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
fetch() {
  local family="$1" weight="$2" outname="$3"
  curl -sL "https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap" \
    -H "User-Agent: $UA" | grep -oE 'https://[^)]+\.woff2' | head -1 | \
    xargs -I {} curl -sL "{}" -o "${outname}.woff2"
}
fetch "Archivo" 400 "Archivo-400"
fetch "Archivo" 600 "Archivo-600"
fetch "Archivo" 700 "Archivo-700"
fetch "Plus+Jakarta+Sans" 400 "PlusJakartaSans-400"
fetch "Plus+Jakarta+Sans" 500 "PlusJakartaSans-500"
fetch "Plus+Jakarta+Sans" 700 "PlusJakartaSans-700"
fetch "Noto+Sans+TC" 400 "NotoSansTC-400"
fetch "Noto+Sans+TC" 500 "NotoSansTC-500"
fetch "Noto+Sans+TC" 700 "NotoSansTC-700"
fetch "Noto+Serif+TC" 400 "NotoSerifTC-400"
fetch "Noto+Serif+TC" 600 "NotoSerifTC-600"
fetch "IBM+Plex+Mono" 400 "IBMPlexMono-400"
fetch "IBM+Plex+Mono" 500 "IBMPlexMono-500"
ls -1 *.woff2 | wc -l
SCRIPT
chmod +x /tmp/download-fonts.sh
/tmp/download-fonts.sh docs/presentations/ai-coding-template-talk/assets/fonts
```

Expected: output `13`.

- [ ] **Step 2: Cleanup + commit**

```bash
rm /tmp/download-fonts.sh
git add docs/presentations/ai-coding-template-talk/assets/fonts/
git commit -m "chore(talk): vendor 13 woff2 fonts offline"
```

---

## Task 4: Write index.html shell with inline sections

**Files:**
- Create: `docs/presentations/ai-coding-template-talk/index.html`

**Decision:** All special HTML sections (cover/TOC/demos/closing/appendix) are inlined here. Only Markdown files are loaded externally. This avoids dynamic DOM-injection anti-patterns.

- [ ] **Step 1: Write index.html**

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Coding Template — 讓 9 個 Agent 幫你寫 SaaS</title>
  <link rel="stylesheet" href="vendor/reveal.js@5.x/dist/reveal.css">
  <link rel="stylesheet" href="vendor/reveal.js@5.x/dist/theme/black.css" id="theme">
  <link rel="stylesheet" href="styles/fonts.css">
  <link rel="stylesheet" href="styles/theme.css">
  <link rel="stylesheet" href="styles/slide-layout.css">
  <link rel="stylesheet" href="styles/terminal.css">
</head>
<body>
<div class="reveal"><div class="slides">

  <!-- ============ 00 Cover ============ -->
  <section class="slide-hero">
    <h1>AI Coding Template</h1>
    <div class="divider"></div>
    <p class="subtitle">讓 9 個 agent 幫你寫 SaaS</p>
    <aside class="notes">開場話術：30 秒自我介紹 + 為什麼做這個。</aside>
  </section>

  <!-- ============ 01 TOC ============ -->
  <section>
    <h2>今天講什麼</h2>
    <ol style="font-size: 0.75em; line-height: 1.8; margin-top: 1em;">
      <li>架構（Intro）</li>
      <li>好處 vs 代價</li>
      <li>Persona — 誰會從這套受益</li>
      <li>Learning System — 讓 LLM 不失憶</li>
      <li><strong style="color: var(--primary);">Agent Team + Harness Engineer</strong></li>
      <li>為什麼 coding 需要它</li>
      <li>5 個 production 專案延伸</li>
      <li>Claude 的觀察與建議</li>
    </ol>
    <p style="font-size: 0.5em; color: var(--text-muted); margin-top: 2em;">
      <kbd>esc</kbd> 縮圖 ‧ <kbd>s</kbd> speaker notes ‧ <kbd>?</kbd> 快捷鍵
    </p>
    <aside class="notes">這是 30 分鐘的 talk，留最後 5 分鐘 Q&amp;A。</aside>
  </section>

  <!-- ============ §1 02-04 Architecture ============ -->
  <section data-markdown="slides/01-architecture.md"
           data-separator="^\n---\n$"
           data-separator-notes="^Note:"></section>

  <!-- ============ §2 05-07 Pros & Cons ============ -->
  <section data-markdown="slides/02-pros-cons.md"
           data-separator="^\n---\n$"
           data-separator-notes="^Note:"></section>

  <!-- ============ §3 08-10 Persona ============ -->
  <section data-markdown="slides/03-persona.md"
           data-separator="^\n---\n$"
           data-separator-notes="^Note:"></section>

  <!-- ============ §4 11-13 Learning text ============ -->
  <section data-markdown="slides/04-learning.md"
           data-separator="^\n---\n$"
           data-separator-notes="^Note:"></section>

  <!-- ============ 14 Memory demo (inline HTML) ============ -->
  <section class="slide-terminal" id="memory-demo-slide">
    <h2 style="text-align: center;">Demo — Memory 寫回流</h2>
    <svg id="memory-demo-svg" viewBox="0 0 900 400" style="margin-top: 2em; max-width: 900px; display: block; margin-inline: auto;">
      <style>
        .node-box { fill: #0e0e1a; stroke: #f0a500; stroke-width: 2; rx: 8; }
        .node-label { fill: #f0f0f8; font-family: 'IBM Plex Mono', monospace; font-size: 14px; text-anchor: middle; }
        .node-path { fill: #6b6b88; font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-anchor: middle; }
        .arrow { stroke: #6b6b88; stroke-width: 2; fill: none; stroke-dasharray: 4 4; }
        .ball { fill: #f0a500; opacity: 0; }
        .ball.active { opacity: 1; }
        .tooltip { fill: #f0f0f8; font-family: 'IBM Plex Mono', monospace; font-size: 11px; opacity: 0; transition: opacity 0.4s; text-anchor: middle; }
        .tooltip.shown { opacity: 1; }
      </style>
      <g transform="translate(100,180)">
        <rect class="node-box" width="200" height="80"/>
        <text class="node-label" x="100" y="32">Chronos</text>
        <text class="node-path" x="100" y="52">docs/context/best-practice.md</text>
        <text class="node-path" x="100" y="66" style="fill:#f0a500;">Tier 1</text>
      </g>
      <g transform="translate(350,180)">
        <rect class="node-box" width="200" height="80" style="stroke:#ffc233;"/>
        <text class="node-label" x="100" y="32">template-memory</text>
        <text class="node-path" x="100" y="52">~/.claude/template-memory/</text>
        <text class="node-path" x="100" y="66" style="fill:#ffc233;">Tier 0</text>
      </g>
      <g transform="translate(600,180)">
        <rect class="node-box" width="200" height="80"/>
        <text class="node-label" x="100" y="32">EventFlow</text>
        <text class="node-path" x="100" y="52">new-session context load</text>
        <text class="node-path" x="100" y="66" style="fill:#f0a500;">Tier 1 read</text>
      </g>
      <path class="arrow" d="M 300 220 L 350 220"/>
      <path class="arrow" d="M 550 220 L 600 220"/>
      <circle id="memory-ball" class="ball" r="10" cx="200" cy="220"/>
      <text class="tooltip" id="memory-tooltip" x="450" y="330"></text>
    </svg>
    <p style="text-align: center; font-size: 0.5em; color: var(--text-muted); margin-top: 1em;">
      按 <kbd>r</kbd> 重播動畫
    </p>
    <aside class="notes">讓動畫跑完再解釋每個 node。動畫共 4.5 秒。</aside>
  </section>

  <!-- ============ 15-18 Agent team (vertical subsection) ============ -->
  <section>
    <!-- 15 9-agent grid -->
    <section>
      <h2>9 個 Agent 的分工</h2>
      <img src="assets/diagrams/agent-team.svg" alt="Agent Team" style="max-width: 100%; max-height: 70vh; margin-top: 1em;">
      <p style="font-size: 0.4em; color: var(--text-muted); margin-top: 0.5em;">
        <span style="color:#ff4f4f;">■</span> 寫碼 ‧
        <span style="color:#3b82f6;">■</span> 審查 ‧
        <span style="color:#00d48a;">■</span> 運維
      </p>
      <aside class="notes">快速掃過 9 agent 分工，重點在三種顏色代表三類角色。</aside>
    </section>
    <!-- 16 Harness 3 layers -->
    <section>
      <h2>Harness = 把 agent 變成可信賴的同事</h2>
      <div class="slide-grid" style="height: auto;">
        <div class="card"><h3>① hooks/</h3><p style="font-size:0.6em;">生命週期掛鉤。Stop Verifier <strong>17 條規則</strong> 在 commit 前擋。PreToolUse 阻擋破壞性動作。PostToolUse 自動 format。</p></div>
        <div class="card"><h3>② skills/</h3><p style="font-size:0.6em;">Context injector。按需載入，不污染全局 context。Skill tool 是 LLM 版本的 "lazy import"。</p></div>
        <div class="card"><h3>③ audit.jsonl</h3><p style="font-size:0.6em;">可追溯歷史。每個 agent 呼叫寫一行 JSON。<code>jq</code> 可查。出事時回放 decision path。</p></div>
      </div>
      <aside class="notes">三層骨架一起才算 harness。缺一個都不夠可信。</aside>
    </section>
    <!-- 17 /athena command tree -->
    <section>
      <h2><code>/athena</code> 指令空間</h2>
      <pre style="font-size: 0.5em; text-align: left; background: var(--surface); padding: 1em; border-radius: 6px; font-family: var(--font-mono); line-height: 1.5;">
<span style="color: var(--primary);">/athena/</span>
├── <strong>loop</strong>        ← epic 自動推進
├── <strong>batch</strong>       ← 並行 wave 執行
├── <strong>cycle</strong>       ← plan → approve → execute → reflect
├── spec / implement / qa / ship / pr / deploy
├── save / load / plan / learn / promote
├── dba / audit / dashboard / domain
├── metrics      <span style="color: var(--success);">← E146 新增</span>
└── qa-report    <span style="color: var(--success);">← E153 新增</span>
      </pre>
      <aside class="notes">不要唸每個 command，只點出 loop / batch / cycle / metrics 四個。</aside>
    </section>
    <!-- 18 Metrics + Evaluator -->
    <section>
      <h2>Metrics + Evaluator</h2>
      <div class="slide-grid cols-2" style="height: auto;">
        <div class="card"><h3>/athena:metrics (E146)</h3><p style="font-size:0.55em;">從 <code>.claude/audit.jsonl</code> 彙整每個 agent 的執行次數、成功率、平均時長、retry 數。<br><br><strong style="color: var(--primary);">可靠度是可量測的，不是感覺。</strong></p></div>
        <div class="card"><h3>@evaluator (E147)</h3><p style="font-size:0.55em;">獨立驗收 agent — 不寫碼、不審碼，只驗「spec 要求的 acceptance criteria 有沒有達成」。<br><br>避免「寫的人也是驗的人」的 conflict of interest。</p></div>
      </div>
      <aside class="notes">metrics + evaluator 是最新的 E146/E147。這兩個一起出現不是偶然 — 量測 + 獨立驗收是可信賴 agent 的最後一哩。</aside>
    </section>
  </section>

  <!-- ============ 19 Loop demo ============ -->
  <section class="slide-terminal" id="loop-demo-slide">
    <h2 style="text-align: center;">Demo — /athena:loop 30 秒回放</h2>
    <div class="terminal" id="loop-terminal">
      <span class="line" data-ms="0"><span class="prompt">$</span> /athena:loop</span>
      <span class="line" data-ms="800"><span class="agent-orchestrator">[orchestrator]</span> reading EPIC_INDEX.md...</span>
      <span class="line" data-ms="1400"><span class="agent-orchestrator">[orchestrator]</span> next: <strong>E148</strong> (bugfix audit hook)</span>
      <span class="line" data-ms="2400"><span class="agent-spec-writer">[spec-writer]</span> drafting spec...</span>
      <span class="line" data-ms="4200"><span class="agent-spec-writer">[spec-writer]</span> <span class="ok">✓</span> spec written (11 acceptance criteria)</span>
      <span class="line" data-ms="5000"><span class="agent-qa">[qa]</span> running 11 integration tests...</span>
      <span class="line" data-ms="7800"><span class="agent-qa">[qa]</span> <span class="ok">✓</span> 11/11 passed ‧ coverage 87%</span>
      <span class="line" data-ms="8800"><span class="agent-reviewer">[reviewer]</span> reading diff, 3 comments raised</span>
      <span class="line" data-ms="11000"><span class="agent-debugger">[debugger]</span> addressing comments</span>
      <span class="line" data-ms="13000"><span class="agent-qa">[qa]</span> re-running tests...</span>
      <span class="line" data-ms="15500"><span class="agent-qa">[qa]</span> <span class="ok">✓</span> 11/11 still passing</span>
      <span class="line" data-ms="16500"><span class="agent-deployer">[deployer]</span> pre-deploy gates: 7/7 <span class="ok">✓</span></span>
      <span class="line" data-ms="17800"><span class="agent-orchestrator">[orchestrator]</span> <strong class="ok">E148 marked complete</strong></span>
      <span class="line" data-ms="18800"><span class="agent-orchestrator">[orchestrator]</span> <span class="prompt">$</span> next: E149<span class="cursor"></span></span>
    </div>
    <div class="progress-bar" id="loop-progress">E148 <span class="fill">░░░░░░░░░░</span> <span class="pct">0%</span></div>
    <p style="text-align: center; font-size: 0.4em; color: var(--text-muted);">
      按 <kbd>space</kbd> 暫停 ‧ 按 <kbd>r</kbd> 重播
    </p>
    <aside class="notes">重點：這是腳本化回放，不是真實執行 — 但每一行都對應真實的 audit.jsonl log。</aside>
  </section>

  <!-- ============ §6 20-22 Why ============ -->
  <section data-markdown="slides/06-why.md"
           data-separator="^\n---\n$"
           data-separator-notes="^Note:"></section>

  <!-- ============ §7 23-32 Projects ============ -->
  <section data-markdown="slides/07-projects.md"
           data-separator="^\n---\n$"
           data-separator-notes="^Note:"></section>

  <!-- ============ §8 33-35 Observations ============ -->
  <section data-markdown="slides/08-observations.md"
           data-separator="^\n---\n$"
           data-separator-notes="^Note:"></section>

  <!-- ============ 36 Closing ============ -->
  <section class="slide-hero">
    <h1>Questions?</h1>
    <div class="divider"></div>
    <p class="subtitle">
      <span style="font-family: var(--font-mono); color: var(--primary);">github.com/cloud-f1/ai-coding-template</span><br>
      <span style="font-size: 0.7em; color: var(--text-muted); margin-top: 1em; display: block;">/athena:load to start</span>
    </p>
    <aside class="notes">感謝。Q&amp;A 時間。</aside>
  </section>

  <!-- ============ Appendix (reachable via 'b' hotkey) ============ -->
  <section id="appendix">
    <section>
      <h2>Appendix — audit.jsonl 範例</h2>
      <pre style="font-size: 0.35em; text-align: left; font-family: var(--font-mono); background: var(--surface); padding: 1em; border-radius: 6px; line-height: 1.5;">
{"ts":"2026-04-11T10:23:14Z","agent":"spec-writer","epic":"E148","event":"start","ctx_tokens":4521}
{"ts":"2026-04-11T10:23:48Z","agent":"spec-writer","epic":"E148","event":"tool_use","tool":"Write"}
{"ts":"2026-04-11T10:24:02Z","agent":"spec-writer","epic":"E148","event":"complete","duration_s":48,"retries":0}
{"ts":"2026-04-11T10:24:15Z","agent":"qa","epic":"E148","event":"start","ctx_tokens":3890}
{"ts":"2026-04-11T10:26:41Z","agent":"qa","epic":"E148","event":"test_run","passed":11,"failed":0,"coverage":0.87}
{"ts":"2026-04-11T10:26:55Z","agent":"qa","epic":"E148","event":"complete","duration_s":160,"retries":0}
      </pre>
      <p style="font-size: 0.45em; color: var(--text-secondary);">
        每一行是 JSON ‧ <code>jq</code> 可查 ‧ 出事時能完整 reproduce decision path。
      </p>
    </section>
    <section>
      <h2>Appendix — hooks/ 檔案樹</h2>
      <pre style="font-size: 0.5em; text-align: left; font-family: var(--font-mono); background: var(--surface); padding: 1em; border-radius: 6px; line-height: 1.5;">
scripts/hooks/
├── CLAUDE.md
├── stop-verifier.sh        ← 17 rules
├── rules/
│   ├── 01-localstorage-ban.sh
│   ├── 02-fireevent-ban.sh
│   ├── ...
│   └── 17-css-var-drift.sh  ← E117
├── pretool-guard.sh
├── posttool-format.sh
└── webhook.sh
      </pre>
    </section>
  </section>

</div></div>
<script src="vendor/reveal.js@5.x/dist/reveal.js"></script>
<script src="vendor/reveal.js@5.x/plugin/markdown/markdown.js"></script>
<script src="vendor/reveal.js@5.x/plugin/notes/notes.js"></script>
<script type="module" src="scripts/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Smoke test**

Open via `python3 -m http.server 8080` and visit `http://localhost:8080`. Expected: reveal.js stage renders even though CSS/MD files are still empty (Tasks 5–18 will populate them).

- [ ] **Step 3: Commit**

```bash
git add docs/presentations/ai-coding-template-talk/index.html
git commit -m "feat(talk): index.html shell with inline sections"
```

---

## Task 5: Write styles/theme.css

**Files:**
- Create: `styles/theme.css`

**Source tokens:** Copied from `client/src/styles/themes.css` `:root` (dark theme).

- [ ] **Step 1: Write theme.css**

```css
/* AI Coding Template Talk — color tokens
 * Copied from client/src/styles/themes.css dark theme.
 * DO NOT @import that file — presentation must stay self-contained.
 */
:root {
  --primary: #f0a500;
  --primary-dark: #d49200;
  --primary-light: rgba(240, 165, 0, 0.15);
  --accent: #ffc233;
  --success: #00d48a;
  --danger: #ff4f4f;
  --info: #3b82f6;
  --bg: #07070f;
  --surface: #0e0e1a;
  --surface-2: #141422;
  --border: #1e1e30;
  --text-primary: #f0f0f8;
  --text-secondary: #6b6b88;
  --text-muted: #3a3a52;
  --font-display: 'Archivo', system-ui, -apple-system, sans-serif;
  --font-body: 'Plus Jakarta Sans', 'Noto Sans TC', system-ui, sans-serif;
  --font-serif: 'Noto Serif TC', 'PingFang TC', serif;
  --font-mono: 'IBM Plex Mono', Menlo, monospace;
}

.reveal {
  font-family: var(--font-body);
  font-size: 36px;
  color: var(--text-primary);
  background: var(--bg);
}
.reveal h1, .reveal h2, .reveal h3, .reveal h4 {
  font-family: var(--font-display);
  color: var(--text-primary);
  text-transform: none;
  letter-spacing: -0.02em;
}
.reveal h1 { font-size: 2.5em; }
.reveal h2 { font-size: 1.8em; }
.reveal h3 { font-size: 1.3em; color: var(--primary); }
.reveal strong { color: var(--primary); }
.reveal code {
  font-family: var(--font-mono);
  color: var(--accent);
  background: var(--surface);
  padding: 0.1em 0.3em;
  border-radius: 3px;
}
.reveal a { color: var(--primary); }
.reveal section > h2::after {
  content: '';
  display: block;
  width: 3em;
  height: 3px;
  background: var(--primary);
  margin-top: 0.3em;
}
body.reveal-viewport { background: var(--bg); }
kbd {
  font-family: var(--font-mono);
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 0.1em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/theme.css
git commit -m "feat(talk): theme.css with template dark tokens"
```

---

## Task 6: Write styles/fonts.css

**Files:**
- Create: `styles/fonts.css`

- [ ] **Step 1: Write @font-face declarations**

Declare 13 `@font-face` rules — one per family/weight. Each follows:

```css
@font-face {
  font-family: 'Archivo';
  src: url('../assets/fonts/Archivo-400.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
/* ...repeat for Archivo 600, 700 */
/* Plus Jakarta Sans 400, 500, 700 */
/* Noto Sans TC 400, 500, 700 */
/* Noto Serif TC 400, 600 */
/* IBM Plex Mono 400, 500 */
```

Full file = 13 blocks × ~6 lines each = ~80 lines.

- [ ] **Step 2: Smoke test**

Open DevTools Network tab, filter → Font. Expected: all 13 woff2 files load with status 200.

- [ ] **Step 3: Commit**

```bash
git add styles/fonts.css
git commit -m "feat(talk): fonts.css with local @font-face"
```

---

## Task 7: Write styles/slide-layout.css

**Files:**
- Create: `styles/slide-layout.css`

- [ ] **Step 1: Write 4 layout classes + helpers**

```css
/* Hero — Cover / Closing / §5 opener */
.slide-hero {
  display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  height: 100vh; text-align: center; padding: 2em;
}
.slide-hero h1 {
  font-size: 4em; margin-bottom: 0.2em;
  animation: slide-up 0.8s ease-out;
}
.slide-hero .subtitle {
  font-size: 1.4em; color: var(--text-secondary); max-width: 20em;
}
.slide-hero .divider {
  width: 6em; height: 3px; background: var(--primary);
  margin: 1em 0;
  animation: slide-expand 0.8s 0.4s ease-out backwards;
}
@keyframes slide-up { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slide-expand { from { width: 0; opacity: 0; } to { width: 6em; opacity: 1; } }

/* Split — §1 architecture, §7 projects */
.slide-split {
  display: grid; grid-template-columns: 6fr 4fr;
  gap: 2em; align-items: center; height: 100vh; padding: 2em;
}
.slide-split .left, .slide-split .right { padding: 1em; }
.slide-split img, .slide-split svg { max-width: 100%; height: auto; }

/* Grid — §5 9-agent, §2 pros/cons */
.slide-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 1em; padding: 3em 2em 2em; height: 100vh; align-content: center;
}
.slide-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.slide-grid .card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 1.2em; font-size: 0.8em;
}
.slide-grid .card h3 { font-size: 1em; margin: 0 0 0.5em; color: var(--primary); }

/* Terminal — §4 memory demo, §5 loop demo */
.slide-terminal {
  background: var(--bg); padding: 2em; height: 100vh;
  display: flex; flex-direction: column; justify-content: center;
}

/* Highlight-quote — §7 亮點 pages */
.highlight-quote {
  font-family: var(--font-serif);
  font-size: 1.1em; line-height: 1.6;
  color: var(--text-primary);
  border-left: 4px solid var(--primary);
  padding: 0.5em 0 0.5em 1em;
  margin: 1em 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/slide-layout.css
git commit -m "feat(talk): slide-layout.css (hero/split/grid/terminal)"
```

---

## Task 8: Write styles/terminal.css

**Files:**
- Create: `styles/terminal.css`

- [ ] **Step 1: Write terminal styling**

```css
.terminal {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 6px; font-family: var(--font-mono);
  font-size: 0.55em; line-height: 1.55;
  padding: 1.2em 1.5em; color: var(--text-primary);
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  max-height: 70vh; overflow: hidden; position: relative;
}
.terminal::before {
  content: '● ● ●'; display: block; color: var(--text-muted);
  font-size: 1.2em; letter-spacing: 0.3em;
  margin-bottom: 0.8em;
  border-bottom: 1px solid var(--border); padding-bottom: 0.5em;
}
.terminal .line { display: block; white-space: pre; opacity: 0; }
.terminal .line.shown { opacity: 1; transition: opacity 0.2s; }
.terminal .prompt             { color: var(--primary); }
.terminal .agent-orchestrator { color: var(--accent); }
.terminal .agent-spec-writer  { color: #a78bfa; }
.terminal .agent-qa           { color: var(--success); }
.terminal .agent-reviewer     { color: var(--info); }
.terminal .agent-debugger     { color: var(--danger); }
.terminal .agent-deployer     { color: #22d3ee; }
.terminal .ok                 { color: var(--success); }
.terminal .fail               { color: var(--danger); }
.progress-bar {
  position: absolute; bottom: 0.8em; right: 1.5em;
  font-family: var(--font-mono); font-size: 0.9em;
  color: var(--text-secondary);
}
.progress-bar .fill { color: var(--primary); }
.terminal .cursor::after {
  content: '▊'; color: var(--primary);
  animation: blink 1s step-end infinite;
}
@keyframes blink { 50% { opacity: 0; } }
```

- [ ] **Step 2: Commit**

```bash
git add styles/terminal.css
git commit -m "feat(talk): terminal.css for demo styling"
```

---

## Task 9: Capture 5 project screenshots

**Files:**
- Create: `assets/screenshots/{shuttle,shiftflow,chronos,eventflow,ai-finance}.png`

- [ ] **Step 1: Identify primary view for each project**

For each project at `/Users/MH/Documents/git_saas/<project>/`:

- Prefer `docs/design/dashboard.html` or static previews in `client/public/`
- Otherwise boot the dev server and screenshot the landing/dashboard

Mapping:
- `ai-badminton-booking-system` → `shuttle.png`
- `ai-casino-shift` → `shiftflow.png`
- `ai-clock-work` → `chronos.png`
- `ai-event-mgn` → `eventflow.png`
- `ai-finance-management` → `ai-finance.png`

- [ ] **Step 2: Capture at ~1600×900**

macOS: `screencapture -i` (interactive) or Chrome DevTools → device toolbar → 1920×1080 → Cmd+Shift+P → "Capture full size screenshot".

- [ ] **Step 3: Compress if needed**

```bash
ls -lah assets/screenshots/
# Each file should be <500KB.
# If larger:
for f in assets/screenshots/*.png; do
  sips -Z 1600 "$f"
done
```

- [ ] **Step 4: Commit**

```bash
git add assets/screenshots/
git commit -m "feat(talk): 5 project screenshots for §7"
```

---

## Task 10: Draw 4 SVG diagrams

**Files:**
- Create: `assets/diagrams/architecture.svg`
- Create: `assets/diagrams/agent-team.svg`
- Create: `assets/diagrams/memory-tier.svg`
- Create: `assets/diagrams/pipeline.svg`

- [ ] **Step 1: architecture.svg — radial center with 5 outer nodes**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" fill="none">
  <style>
    .node { fill: #0e0e1a; stroke: #f0a500; stroke-width: 2; }
    .center { fill: #f0a500; stroke: #ffc233; stroke-width: 3; }
    .label { fill: #f0f0f8; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 18px; text-anchor: middle; }
    .center-label { fill: #07070f; font-family: 'Archivo', sans-serif; font-size: 20px; font-weight: 700; text-anchor: middle; }
    .line { stroke: #f0a500; stroke-width: 2; stroke-dasharray: 4 4; opacity: 0.6; }
  </style>
  <line class="line" x1="400" y1="250" x2="150" y2="120"/>
  <line class="line" x1="400" y1="250" x2="650" y2="120"/>
  <line class="line" x1="400" y1="250" x2="150" y2="380"/>
  <line class="line" x1="400" y1="250" x2="650" y2="380"/>
  <line class="line" x1="400" y1="250" x2="400" y2="70"/>
  <g transform="translate(150,120)"><rect class="node" x="-70" y="-30" width="140" height="60" rx="8"/><text class="label" y="6">server/</text></g>
  <g transform="translate(650,120)"><rect class="node" x="-70" y="-30" width="140" height="60" rx="8"/><text class="label" y="6">client/</text></g>
  <g transform="translate(150,380)"><rect class="node" x="-70" y="-30" width="140" height="60" rx="8"/><text class="label" y="6">agents/</text></g>
  <g transform="translate(650,380)"><rect class="node" x="-70" y="-30" width="140" height="60" rx="8"/><text class="label" y="6">hooks/</text></g>
  <g transform="translate(400,70)"><rect class="node" x="-70" y="-30" width="140" height="60" rx="8"/><text class="label" y="6">skills/</text></g>
  <g transform="translate(400,250)">
    <circle class="center" r="90"/>
    <text class="center-label" y="-5">openapi.yaml</text>
    <text class="center-label" y="25" style="font-size: 13px;">single source of truth</text>
  </g>
</svg>
```

- [ ] **Step 2: agent-team.svg — 9 agents in 3 color groups**

Use the full SVG from the spec (3 rows × 3 columns × agents, colored red=write / blue=review / green=ops). See spec file for complete markup — ~900×500 viewBox, 9 `<g>` agent boxes.

- [ ] **Step 3: memory-tier.svg — Tier 0 + Tier 1 stacked**

Two stacked labeled boxes with an up-arrow between, ~800×400 viewBox.

- [ ] **Step 4: pipeline.svg — 5-step linear with arrows**

5 boxes in a row, each labeled with step name + command. ~900×200 viewBox.

- [ ] **Step 5: Verify each SVG opens standalone in browser**

```bash
for f in assets/diagrams/*.svg; do
  echo "$f: $(grep -c '^' "$f") lines"
done
```

- [ ] **Step 6: Commit**

```bash
git add assets/diagrams/
git commit -m "feat(talk): 4 SVG diagrams"
```

---

## Task 11: Write 9 agent icon SVGs

**Files:**
- Create: `assets/icons/agents/{spec-writer,reviewer,qa,best-practice,debugger,deployer,memory-curator,strategist,orchestrator}.svg`

All follow the same 24×24 Lucide-style line-icon template. Use `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`.

- [ ] **Step 1: Write template**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- paths specific to each agent -->
</svg>
```

Per-agent glyphs:

- `spec-writer` → document+pen: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>`
- `reviewer` → magnifying glass: `<circle cx="10" cy="10" r="6"/><path d="M14 14l5 5"/>`
- `qa` → check-circle: `<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>`
- `best-practice` → lightbulb: `<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.8.9 1 2 1 3.3h6c0-1.3.2-2.4 1-3.3A7 7 0 0 0 12 2z"/>`
- `debugger` → bug: `<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M4 10h4M16 10h4M4 18h4M16 18h4M4 14h4M16 14h4"/>`
- `deployer` → rocket: `<path d="M4 20l4-4m8-12a7 7 0 0 1-7 11l-5 3 3-5A7 7 0 0 1 20 4z"/>`
- `memory-curator` → brain: `<path d="M12 4a4 4 0 0 0-4 4v1a4 4 0 0 0-3 4 4 4 0 0 0 3 4 4 4 0 0 0 8 0 4 4 0 0 0 3-4 4 4 0 0 0-3-4V8a4 4 0 0 0-4-4z"/>`
- `strategist` → chess king: `<path d="M12 2v4M10 6h4M12 6v3M8 12l4 3 4-3M6 18h12l-1 4H7z"/>`
- `orchestrator` → network: `<circle cx="12" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M12 8v4M12 12l-5 4M12 12l5 4"/>`

- [ ] **Step 2: Commit**

```bash
git add assets/icons/agents/
git commit -m "feat(talk): 9 agent glyph icons"
```

---

## Task 12: Write slides/01-architecture.md (§1, 3 slides)

**Files:**
- Create: `slides/01-architecture.md`

Full content (maps to spec §5.2):

````markdown
<!-- .slide: class="slide-split" -->
<div class="left">

![Architecture](assets/diagrams/architecture.svg)

</div>
<div class="right">

## 一張圖看完

**Spec-first 架構**

`openapi.yaml` 是唯一真理來源。server 與 client 的 type、schema、test 全部從它衍生。

改任何 endpoint，先改 spec。

</div>

Note:
現場話術：這張圖最重要的不是那些盒子，是中間那顆黃球。把 API contract 從「程式碼的產物」改成「程式碼的輸入」，後面所有自動化才有辦法對齊。

---

<!-- .slide: class="slide-grid cols-2" -->
## 技術選型決策

<div class="card">

### Server
- **FastAPI** + fastapi-users JWT
- **PostgreSQL** + Alembic
- **asyncio_mode = auto**
- **GUID TypeDecorator** (UUID 跨 DB 相容)

</div>
<div class="card">

### Client
- **React 18** + Vite + TypeScript
- **tokenCache** 記憶體存 JWT
- **React Query** cache tier 預設
- **Zod** + `satisfies` 橋接 OpenAPI

</div>
<div class="card">

### Test
- server 90% / client 80% coverage 硬門檻
- Vitest + MSW 2 + Playwright
- Contract test 對齊 `openapi.yaml`

</div>
<div class="card">

### Deploy
- **Zeabur** 兩服務
- 啟動跑 `alembic upgrade head`
- `VITE_API_URL` build 時注入

</div>

Note:
快速帶過每個 card，不要唸。重點是「每個選擇都有踩過雷，不是隨便抓的」。

---

<!-- .slide: class="slide-split" -->
<div class="left">

![Pipeline](assets/diagrams/pipeline.svg)

</div>
<div class="right">

## Spec → Code Pipeline

五個步驟，五個 command：

1. `/athena:spec` — draft OpenAPI + TDD list
2. `/athena:implement` — RED → GREEN → REFACTOR
3. `/athena:qa` — @reviewer + @qa + @evaluator
4. `git commit` — conventional commit + changelog
5. `/athena:pr` — merge-main → build → test → PR

</div>

Note:
這整條管線的價值在於「每一步都會出錯，但錯的方式是可預測的」。Agent 不是神，是 automation — 重點在錯的時候能清楚定位是哪一步。
````

- [ ] **Step 1: Write the file**

- [ ] **Step 2: Smoke test: reload, confirm 3 slides render between TOC and §2**

- [ ] **Step 3: Commit**

```bash
git add slides/01-architecture.md
git commit -m "feat(talk): §1 architecture slides (02-04)"
```

---

## Task 13: Write slides/02-pros-cons.md (§2, 3 slides)

**Files:**
- Create: `slides/02-pros-cons.md`

Full markdown content maps to spec §5.3:
- Slide 05 `## 好處` — 4 cards (每條好處配一個 h3)
- Slide 06 `## 代價` — 4 honest downside bullets
- Slide 07 `## 不適合什麼` — 3 negative-persona cards

Each separated by `\n---\n`. Each ends with a `Note:` block (speaker note).

- [ ] **Step 1: Write + smoke test + commit** (see spec §5.3 for wording)

```bash
git add slides/02-pros-cons.md
git commit -m "feat(talk): §2 pros/cons slides (05-07)"
```

---

## Task 14: Write slides/03-persona.md (§3, 3 slides)

**Files:**
- Create: `slides/03-persona.md`

Content per spec §5.4 — 3 split-layout slides:
- Solo Founder / Indie Hacker
- Agency / Studio
- AI-native Engineer / Learner

Each with pain-point → solution mapping.

- [ ] **Step 1: Write + commit**

```bash
git add slides/03-persona.md
git commit -m "feat(talk): §3 persona slides (08-10)"
```

---

## Task 15: Write slides/04-learning.md (§4 text portion, 3 slides)

**Files:**
- Create: `slides/04-learning.md`

Content per spec §5.5 slides 11–13 (slide 14 is inline HTML in Task 4):
- Slide 11: LLM 健忘症問題
- Slide 12: Tier 1 — Project Memory (split with memory-tier.svg on left)
- Slide 13: Tier 0 — Global Wisdom + `/athena:promote`

- [ ] **Step 1: Write + commit**

```bash
git add slides/04-learning.md
git commit -m "feat(talk): §4 learning slides text (11-13)"
```

---

## Task 16: Write slides/06-why.md (§6, 3 slides)

**Files:**
- Create: `slides/06-why.md`

Content per spec §5.7:
- Slide 20: 沒有 harness 的 LLM coding 長什麼樣 (pain bullets)
- Slide 21: 這套 template 怎麼接住 (pain → solution grid, 6 cards)
- Slide 22: 成績單 (big-font numbers: 661 tests, 157 epics, 5 projects, 80/90% coverage, 17 rules, 19 commands, 9 agents)

- [ ] **Step 1: Write + commit**

```bash
git add slides/06-why.md
git commit -m "feat(talk): §6 why slides (20-22)"
```

---

## Task 17: Write slides/07-projects.md (§7, 10 slides)

**Files:**
- Create: `slides/07-projects.md`

Content per spec §5.8 — 5 projects × 2 slides (cover + 亮點):
- Shuttle (ai-badminton-booking-system) — pages 23, 24
- ShiftFlow (ai-casino-shift) — pages 25, 26
- **Chronos** (ai-clock-work) ⭐ — pages 27, 28
- EventFlow (ai-event-mgn) — pages 29, 30
- AI Finance Management — pages 31, 32

Each cover page uses `slide-split`. Each 亮點 page uses `.highlight-quote` (Noto Serif TC).

**Chronos 亮點 is the emotional peak**: the `@labor-law` agent blocking a §38 violation.

- [ ] **Step 1: Write + commit**

```bash
git add slides/07-projects.md
git commit -m "feat(talk): §7 project case study slides (23-32)"
```

---

## Task 18: Write slides/08-observations.md (§8, 3 slides)

**Files:**
- Create: `slides/08-observations.md`

Content per spec §5.9 — 3 slides from Claude's POV:
- Slide 33: 真正令人佩服的地方 (learning loop + promote + command discipline)
- Slide 34: 結構性風險觀察 (epic切太小 + orchestrator 瓶頸 + stack 綁太緊)
- Slide 35: 可以延伸的方向 (evaluator 跨專案 + stack-agnostic harness + promote 自動化)

Each ends with `— Claude Opus 4.6 觀察` byline for meta effect.

- [ ] **Step 1: Write + commit**

```bash
git add slides/08-observations.md
git commit -m "feat(talk): §8 Claude observations slides (33-35)"
```

---

## Task 19: Write scripts/main.js

**Files:**
- Create: `scripts/main.js`

- [ ] **Step 1: Write main.js (reveal.js init + hotkeys)**

```javascript
// AI Coding Template Talk — main script
// Initializes reveal.js and wires custom hotkeys.
// Demos are loaded via slidechanged event.

import { initLearningDemo } from './demo-learning.js';
import { initLoopDemo } from './demo-loop.js';

function main() {
  // eslint-disable-next-line no-undef
  const deck = new Reveal({
    hash: true,
    slideNumber: 'c/t',
    transition: 'fade',
    backgroundTransition: 'none',
    width: 1920,
    height: 1080,
    margin: 0.08,
    // eslint-disable-next-line no-undef
    plugins: [RevealMarkdown, RevealNotes],
    keyboard: {
      66: () => { // 'b' → jump to appendix
        const appendix = document.getElementById('appendix');
        if (appendix) {
          const indices = deck.getIndices(appendix);
          deck.slide(indices.h, indices.v || 0);
        }
      },
      82: () => window.dispatchEvent(new CustomEvent('demo:replay')),
      32: (event) => {
        const loopSlide = document.getElementById('loop-demo-slide');
        if (loopSlide && loopSlide.classList.contains('present')) {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent('demo:toggle'));
        }
      },
    },
  });

  deck.initialize().then(() => {
    deck.on('slidechanged', (ev) => {
      const slide = ev.currentSlide;
      if (slide.id === 'memory-demo-slide') {
        initLearningDemo(slide);
      }
      if (slide.id === 'loop-demo-slide') {
        initLoopDemo(slide);
      }
    });
  });
}

main();
```

- [ ] **Step 2: Smoke test — all hotkeys work**

Reload. Test `→ ← s esc f ? r b`. Expected: all respond. `r` on non-demo slides is a harmless no-op.

- [ ] **Step 3: Commit**

```bash
git add scripts/main.js
git commit -m "feat(talk): main.js with reveal.js init + hotkeys"
```

---

## Task 20: Write scripts/demo-learning.js (memory flow animation)

**Files:**
- Create: `scripts/demo-learning.js`

- [ ] **Step 1: Write animation logic**

```javascript
// Memory-tier learning-flow demo — slide 14

let animationFrame = null;

export function initLearningDemo(slideEl) {
  const ball = slideEl.querySelector('#memory-ball');
  const tooltip = slideEl.querySelector('#memory-tooltip');
  if (!ball || !tooltip) return;

  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  const KEYFRAMES = [
    { x0: 200, x1: 350, tooltip: 'Chronos 踩到 GUID TypeDecorator 坑', duration: 1500 },
    { x0: 350, x1: 550, tooltip: '→ /athena:promote 提升到 Tier 0', duration: 1500 },
    { x0: 550, x1: 700, tooltip: '→ EventFlow 新 session 自動繼承', duration: 1500 },
  ];

  let phase = 0;
  let phaseStart = performance.now();

  ball.classList.add('active');
  tooltip.classList.add('shown');

  function step(now) {
    const kf = KEYFRAMES[phase];
    const t = Math.min(1, (now - phaseStart) / kf.duration);
    const x = kf.x0 + (kf.x1 - kf.x0) * easeInOut(t);
    ball.setAttribute('cx', x);
    tooltip.textContent = kf.tooltip;

    if (t >= 1) {
      phase++;
      phaseStart = now;
      if (phase >= KEYFRAMES.length) {
        tooltip.textContent = '完成。按 r 重播。';
        return;
      }
    }
    animationFrame = requestAnimationFrame(step);
  }

  animationFrame = requestAnimationFrame(step);

  const replayHandler = () => initLearningDemo(slideEl);
  window.removeEventListener('demo:replay', replayHandler);
  window.addEventListener('demo:replay', replayHandler, { once: true });
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
```

- [ ] **Step 2: Smoke test — navigate to slide 14, ball animates**

- [ ] **Step 3: Commit**

```bash
git add scripts/demo-learning.js
git commit -m "feat(talk): demo-learning.js SVG ball animation"
```

---

## Task 21: Write scripts/demo-loop.js (terminal typewriter)

**Files:**
- Create: `scripts/demo-loop.js`

- [ ] **Step 1: Write typewriter logic**

```javascript
// /athena:loop terminal-replay demo — slide 19

let timers = [];
let tickInterval = null;
let paused = false;
let startTime = 0;

export function initLoopDemo(slideEl) {
  // Reset state
  timers.forEach(clearTimeout);
  timers = [];
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  paused = false;
  startTime = performance.now();

  const lines = slideEl.querySelectorAll('.terminal .line');
  const progressFill = slideEl.querySelector('#loop-progress .fill');
  const progressPct = slideEl.querySelector('#loop-progress .pct');
  const TOTAL_MS = 18800;

  lines.forEach(l => l.classList.remove('shown'));

  lines.forEach(line => {
    const ms = parseInt(line.getAttribute('data-ms') || '0', 10);
    const t = setTimeout(() => line.classList.add('shown'), ms);
    timers.push(t);
  });

  tickInterval = setInterval(() => {
    if (paused) return;
    const elapsed = performance.now() - startTime;
    const pct = Math.min(100, Math.round((elapsed / TOTAL_MS) * 100));
    const filled = Math.round(pct / 10);
    progressFill.textContent = '█'.repeat(filled) + '░'.repeat(10 - filled);
    progressPct.textContent = pct + '%';
    if (elapsed >= TOTAL_MS) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }, 100);

  const toggleHandler = () => { paused = !paused; };
  window.removeEventListener('demo:toggle', toggleHandler);
  window.addEventListener('demo:toggle', toggleHandler);

  const replayHandler = () => initLoopDemo(slideEl);
  window.removeEventListener('demo:replay', replayHandler);
  window.addEventListener('demo:replay', replayHandler, { once: true });
}
```

- [ ] **Step 2: Smoke test — navigate to slide 19, terminal types out**

- [ ] **Step 3: Commit**

```bash
git add scripts/demo-loop.js
git commit -m "feat(talk): demo-loop.js terminal typewriter + progress"
```

---

## Task 22: Write README.md (startup + hotkeys + on-site checklist)

**Files:**
- Create: `docs/presentations/ai-coding-template-talk/README.md`

- [ ] **Step 1: Write README**

```markdown
# AI Coding Template — Public Talk

37-slide reveal.js presentation. ~30 minutes. Mixed audience. Offline-capable.

## 快速啟動

```bash
cd docs/presentations/ai-coding-template-talk
python3 -m http.server 8080
# open http://localhost:8080
```

`file://` 可能因 fetch/CORS 有限制，建議走 localhost。

## 快捷鍵

| 鍵 | 功能 |
|---|---|
| `→` `←` / `↑` `↓` | 換頁 / 垂直子頁 |
| `s` | Speaker notes |
| `esc` | Slide overview |
| `f` | 全螢幕 |
| `?` | 列出快捷鍵 |
| `r` | 重播當前 demo |
| `space` | 暫停/續播 §5 loop demo |
| `b` | 跳到 appendix |

## 現場 Checklist（上台前 5 分鐘）

- [ ] 筆電充電 > 60%
- [ ] 投影機解析度 1920×1080
- [ ] 開一次 index.html 完整翻 37 頁
- [ ] 按 `r` 測 slide 14 動畫
- [ ] 按 `space` 測 slide 19 暫停
- [ ] 按 `s` 測 presenter mode
- [ ] 關閉 notification (macOS 勿擾)
- [ ] 拔網路線再翻一次（確認 offline）
- [ ] 整個資料夾 zip 一份到 USB

## 結構

- `index.html` — entry with inline HTML special pages
- `slides/*.md` — Markdown content (28 slides)
- `styles/` — theme + layout + fonts + terminal
- `scripts/` — reveal init + 2 demo scripts
- `assets/` — SVG / screenshots / fonts
- `vendor/reveal.js@5.x/` — local reveal.js

Spec: `../../superpowers/specs/2026-04-11-ai-coding-template-talk-design.md`
```

- [ ] **Step 2: Commit**

```bash
git add docs/presentations/ai-coding-template-talk/README.md
git commit -m "docs(talk): README with hotkeys + on-site checklist"
```

---

## Task 23: Full smoke-test walkthrough

- [ ] **Step 1: Serve + walk 37 slides at 1920×1080**

```bash
cd docs/presentations/ai-coding-template-talk
python3 -m http.server 8080
```

Press `→` 37 times in Chrome. Expected: no console errors. Every slide shows its intended layout.

- [ ] **Step 2: Resolution test** — 1440×900 + 1280×720 in DevTools device toolbar.

- [ ] **Step 3: Offline test** — disable network. Reload. All assets load from local.

- [ ] **Step 4: Demo replay** — slide 14 ball animates; slide 19 terminal types out; `r` replays both; `space` pauses slide 19.

- [ ] **Step 5: Speaker notes** — `s` opens notes window; all 37 slides have notes.

- [ ] **Step 6: Overview** — `esc` shows 37-slide thumb grid.

- [ ] **Step 7: Appendix hotkey** — `b` from any slide jumps to appendix.

- [ ] **Step 8: Document any issues** — if tests fail, add "Task 24: Fix smoke-test issues" at the bottom.

- [ ] **Step 9: Final commit**

```bash
git commit --allow-empty -m "test(talk): smoke tests passed — ready for live run"
```

---

## Self-Review

**Spec coverage:**

- §5.1 cover/TOC → Task 4 (inlined)
- §5.2 architecture → Task 12
- §5.3 pros/cons → Task 13
- §5.4 persona → Task 14
- §5.5 learning (text) → Task 15, (demo 14) → Task 4 + 20
- §5.6 agent team + loop demo → Task 4 (inlined) + 21
- §5.7 why → Task 16
- §5.8 projects → Task 17
- §5.9 observations → Task 18
- §5.10 closing → Task 4 (inlined)
- §3 file structure → all tasks
- §6 interactive components → Tasks 20, 21
- §8 verification → Task 23
- §10 checklist → Task 22

**Placeholder scan:** No TBD/TODO. Content-only tasks (13–18) reference spec sections by number for full wording — the spec is authoritative for content, plan authoritative for structure.

**Type consistency:** `memory-demo-slide` / `loop-demo-slide` IDs match between index.html (Task 4) and both JS demos (Tasks 20, 21). `data-placeholder` no longer used — all HTML inlined to avoid DOM innerHTML/outerHTML anti-patterns.

**Task ordering:** Infra (1–4) → styles (5–8) → assets (9–11) → content (12–18) → scripts (19–21) → docs (22) → test (23). Parallelizable: 9 and 10 and 11 and 12–18 are all independent after Task 7.

---

## Execution Notes

- **Worktree optional**: additive scaffolding, no existing files modified.
- **Font download (Task 3) is the biggest external dependency** — if Google Fonts API grep fails, manually download from fonts.google.com.
- **Screenshots (Task 9) need human action** — some sibling projects may need dev-server boot first.
- **No unit tests**: verification is browser smoke checks.

---

## Next Step

Execute via superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.
