<!-- markdownlint-disable -->
<!-- .slide: class="slide-split" -->
<div class="left">

<div class="placeholder-img">[Shuttle dashboard]</div>

</div>
<div class="right">

## Shuttle

**羽球場地預訂 SaaS**

<ul style="font-size: 0.55em; color: var(--text-secondary); line-height: 1.7;">
<li>ai-badminton-booking-system</li>
<li>FastAPI + React</li>
<li>Domain: venues / slots / bookings</li>
<li>Delivered: 2 weeks</li>
</ul>

</div>

Note:
最乾淨的案例 — 幾乎沒擴充，基本就是 template + 一個 domain。

---

## 亮點

<div class="highlight-quote">
OpenAPI-first 讓前端和後端真的能同時開工。<br>
後端先把 spec 寫完，client 立刻 generate types，<br>
一週內兩邊就能對接，不用等對方。
</div>

<p style="font-size: 0.5em; color: var(--text-muted); margin-top: 1em; text-align: right;">
— 沒加任何新 agent，純粹靠 template 內建的 <code>@spec-writer</code>。
</p>

Note:
這頁講「最小使用案例」— 不用改 agent、不用調 harness，也能跑出 production 專案。

---

<!-- .slide: class="slide-split" -->
<div class="left">

<div class="placeholder-img">[ShiftFlow dashboard]</div>

</div>
<div class="right">

## ShiftFlow

**企業排班 — Lark 原生核准**

<ul style="font-size: 0.55em; color: var(--text-secondary); line-height: 1.7;">
<li>ai-casino-shift</li>
<li>50–500 員工 multi-tenant</li>
<li>Lark SSO + 互動卡片</li>
<li>排班週期 26 → 25 日</li>
</ul>

</div>

Note:
ShiftFlow 最特別的是排班週期不是 1 → 月底，是真實輪班制的 26–25。

---

## 亮點

<div class="highlight-quote">
Agent 正確處理了 26→25 日的排班週期邊界 —<br>
因為 @spec-writer 讀了 PRD，把這條業務規則寫進了<br>
<code>openapi.yaml</code> 的 <code>cycle_start_day: 26</code>，<br>
後面所有 test case 都對齊這個 spec，沒有一次弄錯日期。
</div>

<p style="font-size: 0.5em; color: var(--text-muted); margin-top: 1em; text-align: right;">
— Spec-first 的真正價值：把業務規則變成可執行的 contract。
</p>

Note:
這個案例證明「spec 不是文件，是程式碼的一部分」。

---

<!-- .slide: class="slide-split" -->
<div class="left">

<div class="placeholder-img">[Chronos dashboard]</div>

</div>
<div class="right">

## Chronos ⭐

**台灣中小企業 HR SaaS**

<ul style="font-size: 0.55em; color: var(--text-secondary); line-height: 1.7;">
<li>ai-clock-work</li>
<li>GPS/QR 打卡、薪資、勞基法合規</li>
<li><strong style="color: var(--primary);">157 epics</strong> shipped</li>
<li>+1 domain agent: <code>@labor-law</code></li>
</ul>

</div>

Note:
Chronos 是全場最重要的案例。它的 157 個 epic 證明這套 template 能 scale 到 production HR 系統。

---

## 亮點：<code>@labor-law</code> agent

<div class="highlight-quote">
@labor-law 在 PR review 時主動擋下一個違反 §38 的「未休代金」算法 —<br>
引用了勞基法條文的具體段落，指出計算應該按「當月工資 ÷ 30」<br>
而非「月薪 ÷ 22 工作天」。<br><br>
那一刻我才意識到：<strong>agent 可以是 domain expert，不只是 coder</strong>。
</div>

<p style="font-size: 0.5em; color: var(--text-muted); margin-top: 1em; text-align: right;">
— Chronos 新增 <code>.claude/agents/labor-law.md</code>，讓 AI 讀過全部勞基法。
</p>

Note:
這是整場 talk 的情緒高點之一。慢慢講，讓聽眾感受到「agent = domain expert」的衝擊。

---

<!-- .slide: class="slide-split" -->
<div class="left">

<div class="placeholder-img">[EventFlow dashboard]</div>

</div>
<div class="right">

## EventFlow

**活動管理（票務 + 報名）**

<ul style="font-size: 0.55em; color: var(--text-secondary); line-height: 1.7;">
<li>ai-event-mgn</li>
<li>events / tickets / attendees / check-in</li>
<li>QR code 入場</li>
<li>Delivered: 2 weeks from fork</li>
</ul>

</div>

Note:
另一個 2 週案例 — 證明「同一基底快速複製」不是偶發。

---

## 亮點

<div class="highlight-quote">
從 fork template 到第一個客戶上線，<br>
實際寫的 domain 程式碼只有 <strong>~600 行</strong>。<br>
其他全是 template 內建的 auth、dashboard、測試、CI。
</div>

<p style="font-size: 0.5em; color: var(--text-muted); margin-top: 1em; text-align: right;">
— 聚焦 business logic，不是 scaffold。
</p>

Note:
講到「600 行」停一下讓聽眾感受一下。

---

<!-- .slide: class="slide-split" -->
<div class="left">

<div class="placeholder-img">[AI Finance dashboard]</div>

</div>
<div class="right">

## AI Finance Management

**個人 / 中小企業財務**

<ul style="font-size: 0.55em; color: var(--text-secondary); line-height: 1.7;">
<li>ai-finance-management</li>
<li>記帳、發票、報稅、現金流分析</li>
<li>+1 domain agent: <code>@compliance-checker</code></li>
</ul>

</div>

Note:
財務 SaaS 最敏感的是會計準則 — 這就是 compliance-checker 上場的地方。

---

## 亮點：<code>@compliance-checker</code>

<div class="highlight-quote">
這個 agent 讀過 GAAP 與台灣 IFRS 的核心章節，<br>
在任何涉及會計科目的 PR 上自動 comment：<br>
「這筆收入認列不符合完工百分比法，建議改用完成合約法」。
</div>

<p style="font-size: 0.5em; color: var(--text-muted); margin-top: 1em; text-align: right;">
— 再次證明 agent 擴充成 domain expert 的通用模式。
</p>

Note:
兩個 domain expert agent（labor-law + compliance-checker）證明這不是偶發，是可重複的模式。
