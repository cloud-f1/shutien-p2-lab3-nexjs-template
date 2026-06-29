<!-- markdownlint-disable -->
<!-- .slide: class="slide-split" -->
<div class="left">

# 🚀

### Solo Founder
### Indie Hacker

</div>
<div class="right">

## Persona 1

**痛點**：想做 SaaS，但 auth / billing / test / CI 樣樣都要自己寫。時間都花在 scaffolding。

**解法**：

- `make go` 一鍵啟動 — 10 分鐘看到 dashboard
- `make new-domain NAME=x` 產出完整 domain
- 不寫基建，直接寫 business logic

</div>

Note:
這個 persona 是最好說服的 — 他們真的沒時間。

---

<!-- .slide: class="slide-split" -->
<div class="left">

# 🏢

### Agency
### Studio

</div>
<div class="right">

## Persona 2

**痛點**：每個客戶案都從 0 搭基底。第 3 個客戶還在寫同一套 auth 表單。

**解法**：

- Fork template → 加 domain-specific agent → 2 週交付 MVP
- 多個專案共享 Tier 0 memory
- 前一案的教訓自動進後一案

</div>

Note:
Agency 最痛的是「每次從 0」— 把這件事講具體。

---

<!-- .slide: class="slide-split" -->
<div class="left">

# 🧠

### AI-native
### Engineer

</div>
<div class="right">

## Persona 3

**痛點**：想學 LLM harness 是怎麼做的，但 OpenAI Swarm / LangGraph 文件都停在 demo 級。

**解法**：這個 repo 本身就是教材。

- `.claude/hooks/` — 生命週期掛鉤實戰
- `.claude/skills/` — context injection 模式
- `.claude/agents/*.md` — 完整 agent 定義
- `audit.jsonl` — 可追溯歷史

</div>

Note:
這個 persona 會是 GitHub star 的主要來源。
