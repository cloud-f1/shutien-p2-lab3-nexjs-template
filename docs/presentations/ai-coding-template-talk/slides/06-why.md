<!-- markdownlint-disable -->
## Before vs After

<img src="assets/diagrams/before-after.svg" alt="Before vs After" style="max-height: 75vh; margin: 0.3em auto; display: block;">

Note:
每個 bullet 都對應一個真實的慘痛經驗。左邊 = 現實，右邊 = 解法。如果現場有人點頭，就多停兩秒。

---

## 對照表

<!-- .slide: class="slide-grid cols-2" -->
<div class="card">

### Context 丟失

→ **Memory Tier 0/1** 持久記憶

</div>
<div class="card">

### Mock 漂移

→ **Contract test** 對齊 openapi.yaml

</div>
<div class="card">

### 跳過測試

→ **Stop Verifier** 17 條擋下

</div>
<div class="card">

### Prompt 不穩

→ **Agent role lock** 固定角色

</div>
<div class="card">

### PR 像賭博

→ **audit.jsonl** 每步可回放

</div>
<div class="card">

### Token 爆掉

→ **Skill tool** 按需載入

</div>

Note:
對照表的價值是「每個痛點都有機械化解法」。記住「每個問題都有名字」就夠了。

---

## 成績單

<div style="font-size: 1.1em; line-height: 2.2; font-family: var(--font-mono); text-align: left; max-width: 22em; margin: 1em auto;">

<strong style="color: var(--primary);">661</strong> tests on template itself<br>
<strong style="color: var(--primary);">157</strong> epics shipped on Chronos<br>
<strong style="color: var(--primary);">5</strong> production projects from same base<br>
<strong style="color: var(--primary);">80% / 90%</strong> client / server coverage<br>
<strong style="color: var(--primary);">17</strong> Stop Verifier rules<br>
<strong style="color: var(--primary);">19</strong> /athena:* commands<br>
<strong style="color: var(--primary);">9</strong> AI agents

</div>

<div style="font-size: 0.4em; color: var(--text-muted); margin-top: 1em;">
measured as of 2026-04-11
</div>

Note:
數字頁請慢唸。留一個「這些都是真的嗎」的懸念讓下一章（專案案例）自己接話。
