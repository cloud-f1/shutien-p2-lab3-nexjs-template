# E30 — Domain Agent Pattern 指南

> **Size**: S (~0.5 session) | **Dependencies**: 無
> **Status**: spec

---

## 問題陳述

本模板已有 7 個通用 agent（spec-writer、qa、debugger 等），但缺乏**領域專家 agent** 的建立指引。在 ai-clock-work 專案中，`@labor-law` agent 作為勞動法規顧問，能在開發過程中即時提供法規合規建議——這種「領域專家」模式對垂直應用極為重要，卻沒有文件教使用者如何複製。

**痛點**：
- 使用者不知道如何為自己的業務領域建立專屬 agent
- 沒有 agent 模板，每次從零開始容易遺漏 YAML frontmatter 結構
- E23 domain generator 能產生 CRUD 程式碼，卻不能產生對應的領域專家 agent
- 通用 agent（如 @best-practice）無法取代需要深度領域知識的顧問角色

## 解決方案

1. **指南文件** `docs/guides/custom-agents.md` — 從概念到實作的完整教學
2. **Agent 模板** `.claude/agents/domain-expert.md.tmpl` — 可直接複製修改的起手式
3. **E23 整合** — `/athena:domain` 新增 `--agent` 旗標，可選產生領域 agent
4. **範例集** — 3 個具體領域 agent 範例（法規、醫療、金融）

---

## 範圍界定

### 在範圍內

| 交付物 | 路徑 | 說明 |
|--------|------|------|
| 自訂 Agent 指南 | `docs/guides/custom-agents.md` | 完整教學文件（繁中） |
| Agent 模板 | `.claude/agents/domain-expert.md.tmpl` | YAML frontmatter + 指令模板 |
| Domain 指令更新 | `.claude/commands/athena/domain.md` | 新增 `--agent` 旗標說明 |
| Agent 模板設定 | `docs/templates/domain/agent.md.tmpl` | 搭配 E23 generator 使用的模板 |

### 不在範圍內

- 修改現有 7 個 agent（不動 spec-writer、qa 等）
- 建立實際的領域 agent 實例（指南只教怎麼建，不替使用者建）
- 修改 `.claude/settings.json` agent 註冊（Claude Code 自動發現 `.claude/agents/` 下的 .md 檔）

---

## 設計規格

### 1. 指南結構 — `docs/guides/custom-agents.md`

```
# 建立領域專家 Agent

## 什麼是領域 Agent？
  - 與通用 agent 的區別（通用 vs 領域專家）
  - 何時需要領域 agent（決策樹）

## 快速開始（5 分鐘）
  1. 複製模板
  2. 修改 3 個必填欄位
  3. 測試呼叫

## Agent 檔案結構
  - YAML frontmatter 詳解（model、description、allowed-tools、hooks）
  - Markdown body 詳解（Purpose、Designated Document、Workflow、Rules）
  - 命名慣例：檔名 = agent 名稱（`labor-law.md` → `@labor-law`）

## 逐步建立指南
  ### Step 1 — 定義角色與知識範圍
  ### Step 2 — 選擇 model 與 tools
  ### Step 3 — 設計 Designated Document
  ### Step 4 — 撰寫 Workflow
  ### Step 5 — 定義安全規則（Rules）
  ### Step 6 — 整合記憶系統（Write-Back）
  ### Step 7 — 測試與迭代

## 與 /athena:domain 整合
  - `--agent` 旗標自動產生

## 範例：3 個領域 Agent
  ### @labor-law — 勞動法規顧問
  ### @medical — 醫療法規顧問
  ### @finance — 金融合規顧問

## 進階模式
  - Agent 間協作（Task tool 派工）
  - 自訂 hooks（PostToolUse 自動驗證）
  - 與 /athena:qa 整合（領域規則檢查）

## 常見問題 FAQ
```

### 2. Agent 模板 — `.claude/agents/domain-expert.md.tmpl`

```markdown
---
model: opus
description: >
  {{DOMAIN_DESCRIPTION}}。Use this agent when the user asks about
  {{DOMAIN_KEYWORDS}}, or needs {{DOMAIN_EXPERTISE}} guidance.
  Provides domain-specific advice based on {{KNOWLEDGE_SOURCE}}.
allowed-tools: Read, Grep, Glob, Bash
---

# Agent: {{AGENT_NAME}}

## Designated Document
`docs/context/{{AGENT_NAME}}-log.md` — always read before starting.

## Purpose
{{DOMAIN_PURPOSE}}

## Knowledge Sources
- {{SOURCE_1}}
- {{SOURCE_2}}

## Workflow

1. **Read** `docs/context/{{AGENT_NAME}}-log.md` — prior consultations
2. **Analyze** the user's question against domain knowledge
3. **Research** codebase for relevant patterns (Grep/Glob)
4. **Advise** with specific, actionable recommendations
5. **Write-back** → `docs/context/{{AGENT_NAME}}-log.md`

## Write-Back Format

\```markdown
### [timestamp] — [topic]
Question: {user question summary}
Recommendation: {advice given}
References: {sources cited}
Status: resolved | needs-followup
\```

## Rules
- NEVER modify production code directly — only advise
- ALWAYS cite knowledge sources for recommendations
- ALWAYS write-back consultations for audit trail
- Flag conflicts between domain rules and implementation
```

### 3. E23 整合 — `--agent` 旗標

在 `/athena:domain` 指令的 Step 10 後新增可選步驟：

```
### Step 11（可選）— 產生領域 Agent

If --agent flag is provided:
1. Read `docs/templates/domain/agent.md.tmpl`
2. Replace variables:
   - {{AGENT_NAME}} → input name (e.g. "inventory")
   - {{DOMAIN_DESCRIPTION}} → "{{PASCAL}} domain expert"
   - {{DOMAIN_KEYWORDS}} → "{{SNAKE_PLURAL}}, {{SNAKE}} management"
   - {{DOMAIN_EXPERTISE}} → "{{PASCAL}} CRUD and business logic"
   - {{DOMAIN_PURPOSE}} → "Domain expert for {{PASCAL_PLURAL}} — advises on business rules, data modeling, and validation logic"
   - {{KNOWLEDGE_SOURCE}} → "the {{SNAKE_PLURAL}} domain package"
   - {{SOURCE_1}} → "server/app/domains/{{SNAKE_PLURAL}}/ — models, schemas, endpoints"
   - {{SOURCE_2}} → "docs/openapi/schemas/{{SNAKE}}.yaml — API contract"
3. Write to `.claude/agents/{{SNAKE}}.md`
4. Create empty `docs/context/{{SNAKE}}-log.md` with header
5. Report: "Created @{{SNAKE}} domain agent"
```

### 4. Domain Agent 模板 — `docs/templates/domain/agent.md.tmpl`

此模板供 E23 generator 使用，變數與 domain.config.yaml 一致：

```markdown
---
model: sonnet
description: >
  {{PASCAL}} 領域專家。Use this agent when the user asks about
  {{SNAKE_PLURAL}} management, {{SNAKE}} business rules, or needs
  guidance on {{PASCAL}} data modeling and validation.
allowed-tools: Read, Grep, Glob
---

# Agent: {{SNAKE}}

## Designated Document
`docs/context/{{SNAKE}}-log.md` — always read before starting.

## Purpose
Domain expert for {{PASCAL_PLURAL}} — advises on business rules,
data validation, query optimization, and domain-specific patterns.

## Knowledge Sources
- `server/app/domains/{{SNAKE_PLURAL}}/` — models, schemas, endpoints
- `docs/openapi/schemas/{{SNAKE}}.yaml` — API contract
- `docs/openapi/paths/{{SNAKE_PLURAL}}.yaml` — endpoint definitions

## Workflow

1. **Read** designated document for prior consultations
2. **Read** domain source files (models, schemas, endpoints)
3. **Analyze** user question against domain knowledge
4. **Advise** with actionable recommendations + code snippets
5. **Write-back** consultation to designated document

## Rules
- NEVER modify code directly — only advise and review
- ALWAYS reference the OpenAPI spec as source of truth
- Flag data integrity risks (missing validations, unsafe defaults)
- Recommend test cases for domain-specific edge cases
```

### 5. 範例：3 個領域 Agent

指南中提供完整範例（不實際建立檔案，僅作教學用途）：

#### @labor-law — 勞動法規顧問
- **觸發條件**：加班計算、休假規則、薪資結構、離職流程
- **知識來源**：勞基法條文、公司內規文件
- **Designated Doc**：`docs/context/labor-law-log.md`
- **特殊規則**：法規變更需標記日期、強制引用法條編號

#### @medical — 醫療法規顧問
- **觸發條件**：病歷存取權限、HIPAA 合規、藥品交互作用
- **知識來源**：HIPAA 規範、FDA 指引
- **Designated Doc**：`docs/context/medical-log.md`
- **特殊規則**：PHI（Protected Health Information）處理建議必須標記風險等級

#### @finance — 金融合規顧問
- **觸發條件**：交易驗證規則、反洗錢檢查、報表格式
- **知識來源**：金管會法規、IFRS 準則
- **Designated Doc**：`docs/context/finance-log.md`
- **特殊規則**：金額計算必須使用 Decimal、審計追蹤建議

---

## 實作計畫

### Step 1 — 建立 Agent 模板檔

1. 建立 `.claude/agents/domain-expert.md.tmpl`（通用模板，供手動複製）
2. 建立 `docs/templates/domain/agent.md.tmpl`（E23 generator 專用模板）

### Step 2 — 撰寫指南

建立 `docs/guides/custom-agents.md`，內容依上述指南結構撰寫。包含：
- 概念說明（領域 agent vs 通用 agent）
- 快速開始 5 分鐘教學
- 逐步建立指南（7 步驟）
- 3 個完整範例
- 進階模式
- FAQ

### Step 3 — 更新 `/athena:domain` 指令

修改 `.claude/commands/athena/domain.md`：
- 在 "Parse the user's input" 段落新增 `--agent` 旗標說明
- 新增 Step 11（可選）— 產生領域 Agent
- 新增 `agent.md.tmpl` 到 Important Rules 提醒

### Step 4 — 更新 domain.config.yaml

在 `docs/templates/domain/domain.config.yaml` 的 `output_files` 區塊新增：

```yaml
  # Domain agent (optional, --agent flag)
  - template: agent.md.tmpl
    output: ".claude/agents/{{SNAKE}}.md"
    optional: true
```

### Step 5 — 驗證

- [ ] `.claude/agents/domain-expert.md.tmpl` 存在且 YAML frontmatter 合法
- [ ] `docs/templates/domain/agent.md.tmpl` 存在且變數與 domain.config.yaml 一致
- [ ] `docs/guides/custom-agents.md` 完整可讀
- [ ] `/athena:domain note --agent` 能產生 `.claude/agents/note.md`
- [ ] 產生的 agent 可被 Claude Code 正確辨識（`@note` 可用）
- [ ] 指南中的 3 個範例格式正確、資訊完整

---

## 驗收標準

| # | 標準 | 驗證方式 |
|---|------|---------|
| AC-1 | `docs/guides/custom-agents.md` 包含完整教學（概念→快速開始→逐步指南→範例→FAQ） | 文件審閱 |
| AC-2 | `.claude/agents/domain-expert.md.tmpl` 可直接複製、修改 3 欄位後使用 | 手動測試：複製→修改→呼叫 |
| AC-3 | `docs/templates/domain/agent.md.tmpl` 變數與 E23 naming convention 一致 | 比對 domain.config.yaml |
| AC-4 | `/athena:domain` 指令文件包含 `--agent` 旗標說明與 Step 11 | 文件審閱 |
| AC-5 | `domain.config.yaml` 包含 optional agent 輸出項目 | 文件審閱 |
| AC-6 | 指南包含至少 3 個具體領域 agent 範例 | 文件審閱 |
| AC-7 | 所有使用者文件使用繁體中文 | 文件審閱 |

---

## 風險與決策

| 決策 | 理由 |
|------|------|
| 通用模板用 `opus`，E23 模板用 `sonnet` | 手動建立的領域 agent 需要更強推理；自動產生的 CRUD agent 用 sonnet 足夠 |
| Agent 模板不含 hooks | 進階用戶可自行添加；避免新手被複雜設定嚇退 |
| `--agent` 旗標為可選 | 不是每個 domain 都需要專屬 agent，避免產生冗餘檔案 |
| 範例只放在指南中，不建立實際檔案 | 保持模板乾淨，領域 agent 應由使用者按需建立 |

---

## 檔案變更清單

| 操作 | 檔案 |
|------|------|
| 新增 | `docs/guides/custom-agents.md` |
| 新增 | `.claude/agents/domain-expert.md.tmpl` |
| 新增 | `docs/templates/domain/agent.md.tmpl` |
| 修改 | `.claude/commands/athena/domain.md` |
| 修改 | `docs/templates/domain/domain.config.yaml` |
