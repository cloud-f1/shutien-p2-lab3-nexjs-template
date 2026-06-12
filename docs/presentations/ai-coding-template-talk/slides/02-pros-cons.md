<!-- markdownlint-disable -->
<!-- .slide: class="slide-grid cols-2" -->
## 好處

<div class="card">

### ① 0 → 可部署 SaaS < 1 天

Auth、主題、表單、測試框架、CI/CD 全內建。`make go` 一鍵啟動。

</div>
<div class="card">

### ② Stop Verifier — 17 條防線

提交前自動掃：localStorage 禁令、fireEvent 禁令、staleTime 硬編、MSW 位置、OpenAPI 漂移…

</div>
<div class="card">

### ③ 5 個 production 專案共享基底

不是 demo。真實付錢的系統在生產環境跑。

</div>
<div class="card">

### ④ 測試 out-of-the-box

client 80% / server 90% coverage。Contract test 對齊 spec。Hypothesis + factory-boy 做三角驗證。

</div>

Note:
強調「內建」兩字 — 這些不是要你自己配，不是要你自己學，是現成的。

---

## 代價

<ul style="text-align: left; max-width: 28em; margin: 1em auto; font-size: 0.75em; line-height: 1.7;">
<li><strong>① 學習曲線陡</strong> — 9 個 agent、19 個 command、17 條 stop rule、3 層 memory…前兩天會覺得炸腦</li>
<li><strong>② Claude Code 綁定</strong> — 離開 Anthropic 生態這套就不能用。這是真實的 vendor lock-in</li>
<li><strong>③ 過度切分傾向</strong> — Chronos 157 個 epic 顯示 epic 被切得很細，有時一個 feature 其實拆成 4 個 epic，管理成本不低</li>
<li><strong>④ 單 orchestrator 瓶頸</strong> — <code>@orchestrator</code> 現在是 DAG 的瓶頸點，它的 context 很快爆</li>
</ul>

Note:
這頁很重要 — 不講代價聽眾不會信你。刻意把負面點講得比好處頁還長。

---

<!-- .slide: class="slide-grid" -->
## 不適合什麼

<div class="card">

### 🙅 一人 weekend hack

Overkill。直接用 Next.js + Supabase 半天上線更快。

</div>
<div class="card">

### 🙅 非 FastAPI/React 技術棧

Harness 和 stack 綁太緊。Spring Boot、Rails、Go 都搬不過去。

</div>
<div class="card">

### 🙅 排斥 AI 輔助的團隊

這套的前提是「你願意讓 agent 改你的 code」。如果心理抗拒，所有 automation 都是雜訊。

</div>

Note:
坦承工具邊界是取得信任的捷徑。不要造神。
