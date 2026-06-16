# 建立領域專家 Agent

> 本指南教你如何為自己的業務領域建立專屬 Claude Code agent。
> 從概念到實作，5 分鐘快速開始，或依 7 步驟完整打造。

---

## 什麼是領域 Agent？

本模板內建 8 個**通用 agent**（spec-writer、reviewer、qa、debugger 等），負責軟體開發流程中的通用任務。**領域 agent** 則不同——它是你業務領域的專家顧問。

### 通用 vs 領域專家

| 面向 | 通用 Agent | 領域 Agent |
|------|-----------|-----------|
| 角色 | 軟體工程師 | 業務顧問 |
| 知識 | 程式碼、測試、架構 | 法規、商業邏輯、產業規範 |
| 行為 | 直接修改程式碼 | **只提供建議**，不直接改 code |
| 範例 | @spec-writer、@qa | @labor-law、@medical、@finance |

### 何時需要領域 Agent？

回答以下問題，如果有 2 個以上是「是」，你就需要一個領域 agent：

- [ ] 你的應用涉及**特定法規或產業規範**？
- [ ] 團隊成員需要**頻繁查閱**同一類參考文件？
- [ ] 業務邏輯中有**容易犯錯的邊界條件**（例如加班費計算、藥品交互作用）？
- [ ] 你需要**審計追蹤**——記錄每次諮詢的問題與建議？
- [ ] 通用 agent（如 @best-practice）**無法回答**你的領域問題？

---

## 快速開始（5 分鐘）

### 1. 複製模板

```bash
cp .claude/agents/domain-expert.md.tmpl .claude/agents/my-domain.md
```

### 2. 修改 3 個必填欄位

打開 `.claude/agents/my-domain.md`，替換以下佔位符：

| 佔位符 | 替換為 | 範例 |
|--------|--------|------|
| `{{AGENT_NAME}}` | 你的 agent 名稱（與檔名一致） | `labor-law` |
| `{{DOMAIN_DESCRIPTION}}` | 一句話描述專業領域 | `勞動法規顧問，專精台灣勞基法` |
| `{{DOMAIN_PURPOSE}}` | 2-3 句話說明用途 | `協助開發者確保薪資計算、休假規則符合勞基法` |

同時替換其他 `{{...}}` 變數（`DOMAIN_KEYWORDS`、`DOMAIN_EXPERTISE`、`KNOWLEDGE_SOURCE`、`SOURCE_1`、`SOURCE_2`）。

### 3. 測試呼叫

在 Claude Code 中直接使用：

```
@my-domain 加班費超過 46 小時的計算方式是什麼？
```

Claude Code 會自動偵測 `.claude/agents/` 下的 `.md` 檔案，無需額外註冊。

---

## Agent 檔案結構

每個 agent 是一個 Markdown 檔案，包含 **YAML frontmatter** 和 **Markdown body**。

### YAML Frontmatter

```yaml
---
model: opus                    # 模型選擇：opus（強推理）或 sonnet（快速）
description: >                 # agent 描述——Claude Code 用此判斷何時呼叫
  勞動法規顧問。Use this agent when the user asks about
  overtime calculation, leave policies, or labor law compliance.
allowed-tools: Read, Grep, Glob, Bash   # 允許使用的工具
hooks:                         # （可選）自動化 hooks
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "./scripts/hooks/my-hook.sh"
---
```

**欄位說明**：

| 欄位 | 必填 | 說明 |
|------|------|------|
| `model` | 是 | `opus`（深度推理）或 `sonnet`（快速回應） |
| `description` | 是 | 觸發條件描述，Claude Code 據此決定是否自動派工 |
| `allowed-tools` | 是 | 該 agent 可使用的工具清單 |
| `hooks` | 否 | PostToolUse / PreToolUse 自動化 |

### Markdown Body

```markdown
# Agent: agent-name

## Designated Document
`docs/context/agent-name-log.md` — always read before starting.

## Purpose
（角色定位與專業範圍）

## Knowledge Sources
（參考文件、法規、資料來源）

## Workflow
（標準作業流程，通常 5 步）

## Write-Back Format
（寫回 Designated Document 的格式）

## Rules
（不可違反的行為規範）
```

### 命名慣例

- **檔名 = agent 名稱**：`labor-law.md` → 呼叫時用 `@labor-law`
- 使用 **kebab-case**：`my-domain.md`，不用底線或駝峰
- 檔案放在 `.claude/agents/` 目錄下

---

## 逐步建立指南

### Step 1 — 定義角色與知識範圍

先回答這 3 個問題：

1. **這個 agent 扮演什麼角色？** （例：資深勞動法顧問）
2. **它的知識邊界在哪？** （例：台灣勞基法、勞工退休金條例，不含外國法規）
3. **什麼問題該找它？** （例：加班費計算、特休天數、資遣費）

將答案寫成 `description` 欄位。**重要**：description 是 Claude Code 判斷是否自動呼叫此 agent 的依據，務必列出具體的觸發關鍵字。

### Step 2 — 選擇 Model 與 Tools

| 場景 | 推薦 Model | 推薦 Tools |
|------|-----------|------------|
| 法規解釋、複雜推理 | `opus` | `Read, Grep, Glob, Bash` |
| CRUD 業務邏輯諮詢 | `sonnet` | `Read, Grep, Glob` |
| 需要修改檔案的 agent | `opus` | `Read, Write, Edit, Grep, Glob, Bash` |

**原則**：領域 agent 通常**只讀不寫**（只提供建議），因此不需要 `Write` 和 `Edit`。

### Step 3 — 設計 Designated Document

每個 agent 有一個**專屬文件**用來記錄諮詢歷史：

```
docs/context/{agent-name}-log.md
```

建立時加入標題即可：

```markdown
# {Agent Name} — 諮詢紀錄

> 由 @{agent-name} 自動維護。記錄所有領域諮詢的問題、建議與參考來源。
```

### Step 4 — 撰寫 Workflow

標準的 5 步工作流程：

```markdown
## Workflow

1. **Read** designated document — 過去的諮詢紀錄
2. **Read** 領域相關原始碼（models, schemas, endpoints）
3. **Analyze** 使用者問題，對照領域知識
4. **Advise** 提供具體可行的建議 + 程式碼片段
5. **Write-back** 將本次諮詢寫入 designated document
```

### Step 5 — 定義安全規則（Rules）

每個領域 agent 至少需要這 4 條基本規則：

```markdown
## Rules
- NEVER modify production code directly — only advise
- ALWAYS cite knowledge sources for recommendations
- ALWAYS write-back consultations for audit trail
- Flag conflicts between domain rules and implementation
```

再依你的領域加入特定規則，例如：
- 金融：`金額計算必須使用 Decimal，禁止 float`
- 醫療：`涉及 PHI 的建議必須標記風險等級`
- 法規：`引用法條必須包含條號與修訂日期`

### Step 6 — 整合記憶系統（Write-Back）

定義寫回格式，確保諮詢紀錄結構一致：

```markdown
## Write-Back Format

\```markdown
### [timestamp] — [topic]
Question: {使用者問題摘要}
Recommendation: {建議內容}
References: {引用來源}
Status: resolved | needs-followup
\```
```

寫回機制讓：
- 同 agent 下次啟動時能讀取歷史，避免重複回答
- 提供審計追蹤（誰問了什麼、建議了什麼）
- `/athena:save` 可一次性 checkpoint 所有 agent 的狀態

### Step 7 — 測試與迭代

1. **基本測試**：呼叫 agent，確認它能正確回應
   ```
   @my-domain {你的測試問題}
   ```

2. **邊界測試**：問一個超出知識範圍的問題，確認它會說「不在我的專業範圍內」

3. **寫回驗證**：檢查 `docs/context/{agent-name}-log.md` 是否有新紀錄

4. **迭代改善**：
   - 如果觸發不準確 → 調整 `description` 中的關鍵字
   - 如果回答太淺 → 改用 `opus` model
   - 如果回答偏離 → 加強 `Rules` 限制

---

## 與 /athena:domain 整合

E23 的 domain generator（`/athena:domain`）支援 `--agent` 旗標，可在產生 CRUD 程式碼的同時自動建立對應的領域 agent。

```bash
/athena:domain inventory --agent
```

這會額外產生：
- `.claude/agents/inventory.md` — 領域 agent 定義
- `docs/context/inventory-log.md` — 空白諮詢紀錄檔

產生的 agent 使用 `sonnet` model（CRUD 業務邏輯足夠），你可以事後手動改為 `opus`。

---

## 範例：3 個領域 Agent

### @labor-law — 勞動法規顧問

```yaml
---
model: opus
description: >
  勞動法規顧問，專精台灣勞基法與相關子法。Use this agent when the user asks about
  overtime calculation, leave policies, severance pay, working hours,
  or any labor law compliance questions. Provides regulation-backed advice
  based on Taiwan's Labor Standards Act.
allowed-tools: Read, Grep, Glob, Bash
---
```

```markdown
# Agent: labor-law

## Designated Document
`docs/context/labor-law-log.md` — always read before starting.

## Purpose
台灣勞動法規顧問。協助開發者確保薪資計算、休假規則、加班費、資遣費等功能符合勞基法。在系統設計階段提供法規合規建議，避免上線後才發現違法。

## Knowledge Sources
- 勞動基準法（最新修訂版）
- 勞工退休金條例
- 性別工作平等法
- 勞動事件法（爭議處理）
- 公司內部人事規章（如有提供）

## Workflow

1. **Read** `docs/context/labor-law-log.md` — 過去的法規諮詢
2. **Identify** 問題涉及的法規條文
3. **Analyze** 現有程式碼中的計算邏輯（Grep/Glob）
4. **Advise** 提供法規依據 + 正確計算公式 + 邊界條件
5. **Write-back** 諮詢紀錄含法條引用

## Write-Back Format

\```markdown
### [timestamp] — [topic]
Question: {問題摘要}
Applicable Laws: {相關法條編號}
Recommendation: {建議與計算公式}
Edge Cases: {邊界條件提醒}
Status: resolved | needs-legal-review
\```

## Rules
- NEVER modify production code directly — only advise
- ALWAYS cite specific article numbers (e.g. 勞基法第 24 條)
- ALWAYS note the law revision date when citing
- Flag any implementation that contradicts current regulations
- Mark recommendations as "needs-legal-review" when interpretation is ambiguous
```

### @medical — 醫療法規顧問

```yaml
---
model: opus
description: >
  醫療法規與資料安全顧問。Use this agent when the user asks about
  patient data handling, HIPAA compliance, medical record access control,
  PHI protection, drug interaction checks, or healthcare regulatory requirements.
allowed-tools: Read, Grep, Glob, Bash
---
```

```markdown
# Agent: medical

## Designated Document
`docs/context/medical-log.md` — always read before starting.

## Purpose
醫療應用的法規與資料安全顧問。確保系統設計符合 HIPAA 規範、病歷存取權限正確、PHI（Protected Health Information）處理得當。

## Knowledge Sources
- HIPAA Privacy Rule & Security Rule
- FDA 電子紀錄指引（21 CFR Part 11）
- HL7 FHIR 資料標準
- 醫療機構資訊安全最佳實踐

## Workflow

1. **Read** `docs/context/medical-log.md` — 過去的合規諮詢
2. **Classify** 資料敏感等級（PHI / de-identified / public）
3. **Analyze** 存取控制與加密設計（Grep/Glob）
4. **Advise** 合規建議 + 風險等級 + 必要的技術控制措施
5. **Write-back** 諮詢紀錄含風險評估

## Write-Back Format

\```markdown
### [timestamp] — [topic]
Question: {問題摘要}
Data Classification: PHI | de-identified | public
Risk Level: HIGH | MEDIUM | LOW
Recommendation: {建議的技術控制措施}
Regulatory Reference: {HIPAA 條款或 FDA 指引}
Status: resolved | needs-compliance-review
\```

## Rules
- NEVER modify production code directly — only advise
- ALWAYS classify data sensitivity before advising
- ALWAYS tag PHI-related recommendations with risk level
- Recommend encryption-at-rest for any PHI storage
- Flag any endpoint that returns PHI without access control
```

### @finance — 金融合規顧問

```yaml
---
model: opus
description: >
  金融合規與資料完整性顧問。Use this agent when the user asks about
  transaction validation, anti-money laundering checks, financial reporting,
  decimal precision, audit trails, or regulatory compliance for financial data.
allowed-tools: Read, Grep, Glob, Bash
---
```

```markdown
# Agent: finance

## Designated Document
`docs/context/finance-log.md` — always read before starting.

## Purpose
金融應用的合規與資料完整性顧問。確保交易計算使用正確的精度、反洗錢規則到位、報表格式合規、審計追蹤完整。

## Knowledge Sources
- 金管會相關法規
- IFRS 國際財務報導準則
- 反洗錢（AML）與 KYC 規範
- PCI DSS 支付卡安全標準

## Workflow

1. **Read** `docs/context/finance-log.md` — 過去的合規諮詢
2. **Identify** 涉及的合規要求（AML、報表、精度）
3. **Analyze** 計算邏輯與資料型別（Grep: Float vs Decimal）
4. **Advise** 合規建議 + 正確的精度設定 + 審計需求
5. **Write-back** 諮詢紀錄含合規參考

## Write-Back Format

\```markdown
### [timestamp] — [topic]
Question: {問題摘要}
Compliance Area: AML | reporting | precision | audit
Recommendation: {建議}
Regulatory Reference: {法規或準則}
Status: resolved | needs-audit-review
\```

## Rules
- NEVER modify production code directly — only advise
- ALWAYS recommend Decimal for money — NEVER Float
- ALWAYS require audit trail for financial state changes
- Flag any transaction endpoint without idempotency protection
- Recommend double-entry patterns for balance-affecting operations
```

---

## 進階模式

### Agent 間協作（Task Tool 派工）

領域 agent 可以透過 Task tool 向其他 agent 求助：

```markdown
## Workflow
...
3. **Consult** @best-practice via Task tool for architecture review
4. **Consult** @qa via Task tool for test case recommendations
...
```

在 `allowed-tools` 中加入 `Task` 即可啟用派工能力。

### 自訂 Hooks（PostToolUse 自動驗證）

為領域 agent 加入自動化檢查：

```yaml
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "./scripts/hooks/domain-validation.sh"
```

例如，金融 agent 可以在每次程式碼修改後自動檢查是否有 `Float` 用於金額欄位。

### 與 /athena:qa 整合（領域規則檢查）

在 @qa agent 的 review checklist 中引用領域 agent 的規則：

```
如果 domain 涉及金融計算 → 呼叫 @finance 驗證精度
如果 domain 涉及個資 → 呼叫 @medical 驗證存取控制
```

---

## 常見問題 FAQ

### Q: Agent 檔案放哪裡？需要註冊嗎？

放在 `.claude/agents/` 目錄下，副檔名 `.md`。Claude Code 會自動偵測，不需要修改 `.claude/settings.json` 或其他設定檔。

### Q: `opus` 和 `sonnet` 怎麼選？

- **opus**：需要深度推理的場景（法規解釋、複雜計算、風險評估）
- **sonnet**：快速回應的場景（CRUD 業務邏輯、簡單查詢）

經驗法則：如果 agent 的回答品質直接影響合規性或安全性，用 `opus`。

### Q: 一個專案可以有幾個領域 agent？

沒有硬性限制，但建議控制在 **3-5 個**。太多 agent 會增加 Claude Code 的判斷負擔。每個 agent 的 `description` 要有明確的區分，避免觸發條件重疊。

### Q: 領域 agent 可以修改程式碼嗎？

可以，但**不建議**。領域 agent 的價值在於提供專業建議，而非直接修改程式碼。如果你確實需要，在 `allowed-tools` 中加入 `Write` 和 `Edit`，並在 `Rules` 中明確規範修改範圍。

### Q: 如何讓 agent 存取外部知識（法規文件、API 文件）？

將知識文件放在專案中（例如 `docs/knowledge/labor-law/`），然後在 `Knowledge Sources` 中引用路徑。Agent 可以透過 `Read` tool 讀取這些文件。

### Q: Designated Document 會越來越大怎麼辦？

定期整理：
1. 將已解決的諮詢移到 archive 區段
2. 保留最近 20 筆諮詢在主要區段
3. 用 `/athena:promote` 將可通用的經驗提升到 Tier 0 記憶

### Q: 如何用 /athena:domain 自動產生領域 agent？

在建立新 domain 時加上 `--agent` 旗標：

```bash
/athena:domain inventory --agent
```

這會在產生 CRUD 程式碼的同時，建立 `.claude/agents/inventory.md` 和 `docs/context/inventory-log.md`。產生的 agent 使用 `sonnet` model 和基本的 CRUD 諮詢 workflow。

---

## 下一步

- **[AI Agent 團隊指南](ai-agent-team-guide.md)** — 了解內建 Agent 團隊的序列與並行執行模式
- **[第一個 Epic 實戰](first-epic-walkthrough.md)** — 完整體驗 Epic Pipeline，包含 Agent 指令的使用
- **[學習路徑](learning-path.md)** — 查看所有指南的推薦閱讀順序
