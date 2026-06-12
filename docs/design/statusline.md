# Claude Code Status Line — 設計文件

> 本文件記錄 Claude Code 狀態列的設計思維、資料來源與擴充方式。

---

## 概覽

狀態列由 `~/.claude/statusline.sh` 驅動，Claude Code 每次渲染時自動執行。
腳本依據 `$cwd` 判斷是否在本專案目錄內，啟用專案面板。

### 顯示結構

```
┌─ Line 1: 通用資訊 ─────────────────────────────────────────────────────┐
│  03/15 00:12 │ Opus 4.6 │ ✍️ 45% │ client (main*) │ ⏱ 12m │ ◑ default│
├─ Line 2: 專案面板（自動偵測，僅在 epic pipeline 專案內顯示）──────────┤
│  ◆ ai-coding-template │ Ph16/16 │ E39 ✅ (40/40) │ Phase 14 — DONE    │
├─ Line 3-5: 速率限制 ───────────────────────────────────────────────┤
│  current ●●●●●○○○○○  45% ⟳ 3:20pm                                │
│  weekly  ●●○○○○○○○○  22% ⟳ mar 18, 12:00am                       │
│  extra   ●○○○○○○○○○ $2.50/$50.00                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Line 1 — 通用資訊

| 欄位 | 資料來源 | 說明 |
|------|----------|------|
| 日期時間 | `date +"%m/%d %H:%M"` | 本地日期+時間，即時更新 |
| Model 名稱 | `input.model.display_name` | Claude 模型版本 |
| Context 使用率 | `input.context_window.*` | input + cache_create + cache_read 佔總窗口比例 |
| 目錄 + 分支 | `$cwd` + `git symbolic-ref` | 當前目錄名、Git 分支、`*` 標記未提交變更 |
| Session 時長 | `input.session.start_time` | 自動計算經過時間（s/m/h） |
| Thinking 等級 | `~/.claude/settings.json → effortLevel` | 控制推理深度 |

### Thinking 等級顏色

| 等級 | 顏色 | 符號 |
|------|------|------|
| high | 紫色 (magenta) | `● high` |
| medium | 青色 (cyan) | `◑ medium` |
| low | 橘色 (orange) | `◔ low` |
| default | 白色 (white) | `◑ default` |

### Context 使用率顏色

- 🟢 綠色 `<50%`：安全
- 🟠 橘色 `50-69%`：注意
- 🟡 黃色 `70-89%`：警告
- 🔴 紅色 `≥90%`：危險

---

## Line 2 — 專案面板（Athena）

**觸發條件**：從 `$cwd` 向上搜尋，找到包含 `docs/context/epic-progress.md` 的目錄即為專案根目錄。任何使用 epic pipeline 的專案皆自動啟用。

| 欄位 | 資料來源 | 解析方式 |
|------|----------|----------|
| `◆ {project}` | `basename $project_root` | 自動偵測的專案目錄名 |
| Phase 進度 | `epic-progress.md` Phase Status 表格 | 計算 `Complete` 行數 / 總行數 |
| Pipeline 狀態 | `epic-progress.md` Epic Step Matrix | 最新 epic + 完成比例 |
| Epic 備註 | `epic-progress.md` Notes 欄位 | 白色顯示，截取前 40 字元 |

### Pipeline 狀態邏輯

```
if 任何 epic 有 🔄 → 黃色 "Exx 🔄"
if 任何 epic 有 ❌ → 紅色 "Exx ❌"
if 全部 epic 皆完成（無 ⬜/🔄/❌） → 綠色 "Exx ✅ (done/total)"
otherwise → 橘色 "Exx (done/total)"
```

> **完成判定**：epic 的所有步驟為 ✅ 或 ⏭️（跳過），無 ⬜（待處理）/ 🔄（進行中）/ ❌（失敗）。

### 資料流

```
epic-progress.md ──grep──→ phase 計數（Phase N / Phase PN / Infra 行）
                 ──grep──→ epic 行篩選（含 ✅/⬜/🔄/⏭️/❌ 的資料行）
                 ──grep──→ 🔄 / ❌ 偵測
                 ──grep──→ 最新 epic（step matrix 最後一行）
                 ──grep──→ epic 備註（Notes 欄位）
```

---

## Line 3-5 — 速率限制

| 欄位 | 資料來源 | 更新頻率 |
|------|----------|----------|
| Current (5hr) | Anthropic OAuth API `/api/oauth/usage` | 60 秒快取 |
| Weekly (7day) | 同上 | 同上 |
| Extra usage | 同上（`extra_usage.is_enabled`） | 同上 |

- 快取路徑：`/tmp/claude/statusline-usage-cache.json`
- OAuth token 解析順序：`$CLAUDE_CODE_OAUTH_TOKEN` → macOS Keychain → `~/.claude/.credentials.json` → Linux secret-tool
- 進度條使用 `●/○` 字元，寬度固定 10 格

---

## 擴充指南

### 新增專案面板欄位

在 `statusline.sh` 的 `# ── Project: AI-Coding-Template` 區段內：

```bash
# 範例：新增 agent 數量
agent_count=$(ls -1 "${project_root}/.claude/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')
project_line+="${sep}${white}${agent_count} agents${reset}"
```

### 多專案支援

已自動偵測——任何含 `docs/context/epic-progress.md` 的專案皆會顯示面板。
專案名稱取自目錄名（`basename`），無需手動設定。

### 可擴充的 Epic 資訊

| 想顯示的資訊 | 解析方式 |
|-------------|----------|
| 當前執行中 epic 名稱 | `grep '🔄' epic-progress.md` 取 Notes 欄位 |
| 覆蓋率指標 | 讀取 `client/coverage/coverage-summary.json` |
| 上次 commit 時間 | `git log -1 --format=%cr` |
| PR 狀態 | `gh pr list --json state` |

---

## 設定位置

```
~/.claude/settings.json
  └─ "statusLine": "bash \"$HOME/.claude/statusline.sh\""

~/.claude/statusline.sh
  └─ 主腳本（全域 + 專案面板）
```

### 效能考量

- 腳本應在 < 500ms 內完成（避免 UI 卡頓）
- API 呼叫使用 60 秒快取
- `grep` 解析 epic-progress.md 非常快（< 5ms）
- 避免在腳本中執行耗時指令（如 `npm test`、`pytest`）
