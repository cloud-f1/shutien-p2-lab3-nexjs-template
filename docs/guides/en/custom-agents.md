# Building Domain Expert Agents

> This guide teaches you how to build custom Claude Code agents for your business domain.
> From concept to implementation: 5 minutes for a quick start, or follow the 7-step guide for a complete build.

---

## What is a Domain Agent?

This template includes 8 **general-purpose agents** (spec-writer, reviewer, qa, debugger, etc.) that handle common tasks in the software development workflow. **Domain agents** are different — they are expert consultants for your specific business domain.

### General vs Domain Expert

| Aspect | General Agent | Domain Agent |
|--------|--------------|--------------|
| Role | Software engineer | Business consultant |
| Knowledge | Code, tests, architecture | Regulations, business logic, industry standards |
| Behaviour | Directly modifies code | **Only provides advice**, does not directly change code |
| Examples | @spec-writer, @qa | @labor-law, @medical, @finance |

### When Do You Need a Domain Agent?

Answer the following questions. If 2 or more are "yes", you need a domain agent:

- [ ] Does your application involve **specific regulations or industry standards**?
- [ ] Do team members need to **frequently consult** the same type of reference documents?
- [ ] Are there **error-prone edge cases** in your business logic (e.g. overtime pay calculations, drug interactions)?
- [ ] Do you need an **audit trail** — logging every consultation's questions and recommendations?
- [ ] Can the general agents (like @best-practice) **not answer** your domain-specific questions?

---

## Quick Start (5 Minutes)

### 1. Copy the Template

```bash
cp .claude/agents/domain-expert.md.tmpl .claude/agents/my-domain.md
```

### 2. Fill in 3 Required Fields

Open `.claude/agents/my-domain.md` and replace the following placeholders:

| Placeholder | Replace With | Example |
|-------------|-------------|---------|
| `{{AGENT_NAME}}` | Your agent name (matches filename) | `labor-law` |
| `{{DOMAIN_DESCRIPTION}}` | One-sentence domain description | `Labor law consultant, specialising in Taiwan's Labor Standards Act` |
| `{{DOMAIN_PURPOSE}}` | 2-3 sentences describing the purpose | `Helps developers ensure payroll calculations and leave policies comply with labor law` |

Also replace the other `{{...}}` variables (`DOMAIN_KEYWORDS`, `DOMAIN_EXPERTISE`, `KNOWLEDGE_SOURCE`, `SOURCE_1`, `SOURCE_2`).

### 3. Test It

Use it directly in Claude Code:

```
@my-domain What is the overtime calculation for hours exceeding 46?
```

Claude Code automatically detects `.md` files under `.claude/agents/` — no additional registration needed.

---

## Agent File Structure

Each agent is a Markdown file containing **YAML frontmatter** and a **Markdown body**.

### YAML Frontmatter

```yaml
---
model: opus                    # Model selection: opus (strong reasoning) or sonnet (fast)
description: >                 # Agent description — Claude Code uses this to decide when to invoke
  Labor law consultant. Use this agent when the user asks about
  overtime calculation, leave policies, or labor law compliance.
allowed-tools: Read, Grep, Glob, Bash   # Allowed tools
hooks:                         # (Optional) automation hooks
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "./scripts/hooks/my-hook.sh"
---
```

**Field Descriptions**:

| Field | Required | Description |
|-------|----------|-------------|
| `model` | Yes | `opus` (deep reasoning) or `sonnet` (fast responses) |
| `description` | Yes | Trigger condition description; Claude Code uses this to decide whether to auto-dispatch |
| `allowed-tools` | Yes | List of tools the agent can use |
| `hooks` | No | PostToolUse / PreToolUse automation |

### Markdown Body

```markdown
# Agent: agent-name

## Designated Document
`docs/context/agent-name-log.md` — always read before starting.

## Purpose
(Role definition and area of expertise)

## Knowledge Sources
(Reference documents, regulations, data sources)

## Workflow
(Standard operating procedure, typically 5 steps)

## Write-Back Format
(Format for writing to the Designated Document)

## Rules
(Inviolable behavioral rules)
```

### Naming Conventions

- **Filename = agent name**: `labor-law.md` -> invoke with `@labor-law`
- Use **kebab-case**: `my-domain.md`, not underscores or camelCase
- Files go in the `.claude/agents/` directory

---

## Step-by-Step Guide

### Step 1 — Define Role and Knowledge Scope

Answer these 3 questions first:

1. **What role does this agent play?** (e.g.: Senior labor law consultant)
2. **What are its knowledge boundaries?** (e.g.: Taiwan's Labor Standards Act, Labor Pension Act; excludes foreign regulations)
3. **What questions should be directed to it?** (e.g.: Overtime pay calculations, annual leave days, severance pay)

Write the answers as the `description` field. **Important**: The description is what Claude Code uses to determine whether to automatically invoke this agent — be sure to list specific trigger keywords.

### Step 2 — Choose Model and Tools

| Scenario | Recommended Model | Recommended Tools |
|----------|------------------|-------------------|
| Legal interpretation, complex reasoning | `opus` | `Read, Grep, Glob, Bash` |
| CRUD business logic consulting | `sonnet` | `Read, Grep, Glob` |
| Agent that needs to modify files | `opus` | `Read, Write, Edit, Grep, Glob, Bash` |

**Principle**: Domain agents typically **read-only** (only provide advice), so they don't need `Write` and `Edit`.

### Step 3 — Design the Designated Document

Each agent has a **dedicated file** for recording consultation history:

```
docs/context/{agent-name}-log.md
```

Create it with just a heading:

```markdown
# {Agent Name} — Consultation Log

> Maintained automatically by @{agent-name}. Records all domain consultations: questions, recommendations, and reference sources.
```

### Step 4 — Write the Workflow

Standard 5-step workflow:

```markdown
## Workflow

1. **Read** designated document — past consultation records
2. **Read** domain-related source code (models, schemas, endpoints)
3. **Analyze** the user's question against domain knowledge
4. **Advise** with specific, actionable recommendations + code snippets
5. **Write-back** record the consultation in the designated document
```

### Step 5 — Define Safety Rules

Every domain agent needs at least these 4 basic rules:

```markdown
## Rules
- NEVER modify production code directly — only advise
- ALWAYS cite knowledge sources for recommendations
- ALWAYS write-back consultations for audit trail
- Flag conflicts between domain rules and implementation
```

Then add domain-specific rules, for example:
- Finance: `Monetary calculations must use Decimal, never Float`
- Medical: `PHI-related recommendations must include risk level tags`
- Legal: `Law citations must include article numbers and revision dates`

### Step 6 — Integrate with Memory System (Write-Back)

Define the write-back format to ensure consistent consultation records:

```markdown
## Write-Back Format

\```markdown
### [timestamp] — [topic]
Question: {question summary}
Recommendation: {recommendation content}
References: {citation sources}
Status: resolved | needs-followup
\```
```

The write-back mechanism allows:
- The same agent to read history on next startup, avoiding repeated answers
- An audit trail (who asked what, what was recommended)
- `/athena:save` to checkpoint all agent states at once

### Step 7 — Test and Iterate

1. **Basic test**: Invoke the agent and confirm it responds correctly
   ```
   @my-domain {your test question}
   ```

2. **Boundary test**: Ask a question outside its knowledge scope; confirm it says "outside my area of expertise"

3. **Write-back verification**: Check that `docs/context/{agent-name}-log.md` has new records

4. **Iterative improvement**:
   - If triggering is inaccurate -> adjust keywords in `description`
   - If answers are too shallow -> switch to `opus` model
   - If answers drift off-topic -> strengthen `Rules` constraints

---

## Integration with /athena:domain

The E23 domain generator (`/athena:domain`) supports the `--agent` flag, which can automatically create a corresponding domain agent while generating CRUD code.

```bash
/athena:domain inventory --agent
```

This additionally generates:
- `.claude/agents/inventory.md` — Domain agent definition
- `docs/context/inventory-log.md` — Empty consultation log file

The generated agent uses the `sonnet` model (sufficient for CRUD business logic). You can manually change it to `opus` afterwards.

---

## Examples: 3 Domain Agents

### @labor-law — Labor Law Consultant

```yaml
---
model: opus
description: >
  Labor law consultant specialising in Taiwan's Labor Standards Act and related regulations.
  Use this agent when the user asks about overtime calculation, leave policies, severance pay,
  working hours, or any labor law compliance questions. Provides regulation-backed advice
  based on Taiwan's Labor Standards Act.
allowed-tools: Read, Grep, Glob, Bash
---
```

```markdown
# Agent: labor-law

## Designated Document
`docs/context/labor-law-log.md` — always read before starting.

## Purpose
Taiwan labor law consultant. Helps developers ensure that payroll calculations, leave rules,
overtime pay, severance pay, and other features comply with the Labor Standards Act.
Provides regulatory compliance advice during system design to avoid discovering violations after launch.

## Knowledge Sources
- Labor Standards Act (latest revision)
- Labor Pension Act
- Gender Equality in Employment Act
- Labor Incident Act (dispute resolution)
- Company internal HR policies (if provided)

## Workflow

1. **Read** `docs/context/labor-law-log.md` — past regulatory consultations
2. **Identify** relevant regulatory articles
3. **Analyze** existing calculation logic in the codebase (Grep/Glob)
4. **Advise** with regulatory basis + correct calculation formulas + edge cases
5. **Write-back** consultation record with law citations

## Write-Back Format

\```markdown
### [timestamp] — [topic]
Question: {question summary}
Applicable Laws: {relevant article numbers}
Recommendation: {advice and calculation formulas}
Edge Cases: {edge case warnings}
Status: resolved | needs-legal-review
\```

## Rules
- NEVER modify production code directly — only advise
- ALWAYS cite specific article numbers (e.g. Labor Standards Act Article 24)
- ALWAYS note the law revision date when citing
- Flag any implementation that contradicts current regulations
- Mark recommendations as "needs-legal-review" when interpretation is ambiguous
```

### @medical — Medical Regulatory Consultant

```yaml
---
model: opus
description: >
  Medical regulatory and data security consultant. Use this agent when the user asks about
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
Medical application regulatory and data security consultant. Ensures system design
complies with HIPAA regulations, medical record access permissions are correct,
and PHI (Protected Health Information) is handled properly.

## Knowledge Sources
- HIPAA Privacy Rule & Security Rule
- FDA Electronic Records Guidelines (21 CFR Part 11)
- HL7 FHIR Data Standards
- Healthcare IT security best practices

## Workflow

1. **Read** `docs/context/medical-log.md` — past compliance consultations
2. **Classify** data sensitivity level (PHI / de-identified / public)
3. **Analyze** access control and encryption design (Grep/Glob)
4. **Advise** compliance recommendations + risk level + required technical controls
5. **Write-back** consultation record with risk assessment

## Write-Back Format

\```markdown
### [timestamp] — [topic]
Question: {question summary}
Data Classification: PHI | de-identified | public
Risk Level: HIGH | MEDIUM | LOW
Recommendation: {recommended technical controls}
Regulatory Reference: {HIPAA provision or FDA guideline}
Status: resolved | needs-compliance-review
\```

## Rules
- NEVER modify production code directly — only advise
- ALWAYS classify data sensitivity before advising
- ALWAYS tag PHI-related recommendations with risk level
- Recommend encryption-at-rest for any PHI storage
- Flag any endpoint that returns PHI without access control
```

### @finance — Financial Compliance Consultant

```yaml
---
model: opus
description: >
  Financial compliance and data integrity consultant. Use this agent when the user asks about
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
Financial application compliance and data integrity consultant. Ensures transaction
calculations use correct precision, anti-money laundering rules are in place,
reporting formats are compliant, and audit trails are complete.

## Knowledge Sources
- Relevant financial regulatory body regulations
- IFRS International Financial Reporting Standards
- Anti-Money Laundering (AML) and KYC requirements
- PCI DSS Payment Card Industry Data Security Standards

## Workflow

1. **Read** `docs/context/finance-log.md` — past compliance consultations
2. **Identify** applicable compliance requirements (AML, reporting, precision)
3. **Analyze** calculation logic and data types (Grep: Float vs Decimal)
4. **Advise** compliance recommendations + correct precision settings + audit requirements
5. **Write-back** consultation record with compliance references

## Write-Back Format

\```markdown
### [timestamp] — [topic]
Question: {question summary}
Compliance Area: AML | reporting | precision | audit
Recommendation: {advice}
Regulatory Reference: {regulation or standard}
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

## Advanced Patterns

### Inter-Agent Collaboration (Task Tool Dispatch)

Domain agents can request help from other agents via the Task tool:

```markdown
## Workflow
...
3. **Consult** @best-practice via Task tool for architecture review
4. **Consult** @qa via Task tool for test case recommendations
...
```

Add `Task` to `allowed-tools` to enable dispatch capability.

### Custom Hooks (PostToolUse Auto-Validation)

Add automated checks for domain agents:

```yaml
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "./scripts/hooks/domain-validation.sh"
```

For example, a finance agent could automatically check after every code modification whether `Float` is used for monetary fields.

### Integration with /athena:qa (Domain Rule Checks)

Reference domain agent rules in the @qa agent's review checklist:

```
If the domain involves financial calculations -> invoke @finance to verify precision
If the domain involves personal data -> invoke @medical to verify access control
```

---

## FAQ

### Q: Where do agent files go? Do they need to be registered?

Place them in the `.claude/agents/` directory with a `.md` extension. Claude Code auto-detects them — no need to modify `.claude/settings.json` or any other configuration files.

### Q: How do I choose between `opus` and `sonnet`?

- **opus**: Scenarios requiring deep reasoning (legal interpretation, complex calculations, risk assessment)
- **sonnet**: Scenarios requiring fast responses (CRUD business logic, simple queries)

Rule of thumb: If the agent's answer quality directly impacts compliance or security, use `opus`.

### Q: How many domain agents can a project have?

No hard limit, but we recommend keeping it to **3-5**. Too many agents increase Claude Code's decision-making burden. Each agent's `description` should have clear differentiation to avoid overlapping trigger conditions.

### Q: Can domain agents modify code?

Yes, but it's **not recommended**. The value of domain agents lies in providing expert advice, not directly modifying code. If you truly need this, add `Write` and `Edit` to `allowed-tools` and explicitly define the modification scope in `Rules`.

### Q: How can I give an agent access to external knowledge (legal documents, API docs)?

Place knowledge files in the project (e.g. `docs/knowledge/labor-law/`), then reference the path in `Knowledge Sources`. The agent can read these files via the `Read` tool.

### Q: What if the Designated Document keeps growing?

Regular maintenance:
1. Move resolved consultations to an archive section
2. Keep only the most recent 20 consultations in the main section
3. Use `/athena:promote` to promote reusable insights to Tier 0 memory

### Q: How do I auto-generate a domain agent with /athena:domain?

Add the `--agent` flag when creating a new domain:

```bash
/athena:domain inventory --agent
```

This creates `.claude/agents/inventory.md` and `docs/context/inventory-log.md` alongside the CRUD code. The generated agent uses the `sonnet` model with a basic CRUD consultation workflow.

---

## Next Steps

- **[AI Agent Team Guide](ai-agent-team-guide.md)** — Learn how the built-in agent team works in serial and parallel modes
- **[First Epic Walkthrough](first-epic-walkthrough.md)** — See the full Epic pipeline in action, including agent commands
- **[OpenAPI Design Patterns](openapi-patterns.md)** — Understand the API patterns your domain agents will be consulting on
- **[Learning Path](learning-path.md)** — See the full recommended reading order for all guides
