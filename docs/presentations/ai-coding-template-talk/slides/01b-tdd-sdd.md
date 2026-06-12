<!-- markdownlint-disable -->
## SDD + TDD — 兩個 Before

<img src="assets/diagrams/sdd-tdd-flow.svg" alt="SDD + TDD flow" style="max-height: 70vh; margin: 0.3em auto; display: block;">

<p style="font-size: 0.5em; color: var(--text-secondary); text-align: center; margin-top: 0.3em;">
兩個「Before」— Spec 先於 Test，Test 先於 Code
</p>

Note:
這是整個 template 的方法論基礎。不是技術、不是工具，是「先做什麼」的順序。

- **SDD** = Spec-Driven Development：先寫 `openapi.yaml`，它不是文件，是契約
- **TDD** = Test-Driven Development：RED → GREEN → REFACTOR 三步循環

Spec 畫出「要做什麼」，Test 證明「有做到」，Code 只是實作細節。

---

## 為什麼 LLM coding 特別需要這兩個

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5em; margin-top: 1em;">

<div style="background: #1a0e0e; border: 2px solid #ff4f4f; border-radius: 10px; padding: 1.2em; text-align: left;">
<div style="font-size: 0.7em; font-weight: 800; color: #ff4f4f; margin-bottom: 0.6em;">❌ 沒有 SDD + TDD</div>
<ul style="font-size: 0.5em; line-height: 1.7; color: var(--text-secondary); padding-left: 1.2em;">
<li>LLM 邊猜邊寫，憑直覺理解需求</li>
<li>改 server 忘了改 client → type 對不上</li>
<li>「測試待會補」→ 永遠補不上</li>
<li>PR review 只能靠感覺</li>
<li>Agent 產出無法驗證，只能信任</li>
</ul>
</div>

<div style="background: #0e1a0e; border: 2px solid #00d48a; border-radius: 10px; padding: 1.2em; text-align: left;">
<div style="font-size: 0.7em; font-weight: 800; color: #00d48a; margin-bottom: 0.6em;">✅ 有 SDD + TDD</div>
<ul style="font-size: 0.5em; line-height: 1.7; color: var(--text-secondary); padding-left: 1.2em;">
<li>Spec 是黑板 — agent 不能跑題</li>
<li>改 spec → 自動 regenerate types → drift 被抓到</li>
<li>Test 先寫 → agent 有明確目標</li>
<li>PR review 看 coverage + contract test 結果</li>
<li>Agent 產出可機械化驗收</li>
</ul>
</div>

</div>

<p style="font-size: 0.55em; text-align: center; margin-top: 1.5em;">
<strong>關鍵洞察</strong>：LLM 擅長「寫」，不擅長「驗」<br>
<span style="color: var(--text-secondary); font-size: 0.85em;">Spec + Test 把「驗」這件事從 LLM 手上拿走，改交給機械</span>
</p>

Note:
這頁是整個 talk 的「方法論關鍵」— 沒有 SDD/TDD，後面所有 harness 工具都是空談。

關鍵洞察要慢慢講：「LLM 擅長寫不擅長驗」這句是這個章節最值得記住的一句話。

---

## 好處 vs 代價 — 誠實版

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1em; margin-top: 0.8em;">

<div>
<h3 style="color: var(--success); font-size: 0.8em; margin-bottom: 0.5em;">✅ 好處</h3>
<div style="display: grid; gap: 0.5em;">
<div style="background: var(--surface); border-left: 3px solid var(--success); padding: 0.6em 0.8em; font-size: 0.5em; text-align: left;">
<strong>設計階段抓到歧義</strong><br>
<span style="color: var(--text-secondary);">寫 spec 時就發現「這個 field 到底是什麼 type」</span>
</div>
<div style="background: var(--surface); border-left: 3px solid var(--success); padding: 0.6em 0.8em; font-size: 0.5em; text-align: left;">
<strong>前後端並行開發</strong><br>
<span style="color: var(--text-secondary);">Spec 一到位，client/server 同時開工</span>
</div>
<div style="background: var(--surface); border-left: 3px solid var(--success); padding: 0.6em 0.8em; font-size: 0.5em; text-align: left;">
<strong>重構有安全網</strong><br>
<span style="color: var(--text-secondary);">Test 綠 = 行為沒壞，放心改內部</span>
</div>
<div style="background: var(--surface); border-left: 3px solid var(--success); padding: 0.6em 0.8em; font-size: 0.5em; text-align: left;">
<strong>Agent 有明確目標</strong><br>
<span style="color: var(--text-secondary);">Spec + failing test = 機械可驗收的任務</span>
</div>
</div>
</div>

<div>
<h3 style="color: var(--danger); font-size: 0.8em; margin-bottom: 0.5em;">⚠️ 代價</h3>
<div style="display: grid; gap: 0.5em;">
<div style="background: var(--surface); border-left: 3px solid var(--danger); padding: 0.6em 0.8em; font-size: 0.5em; text-align: left;">
<strong>前期感覺很慢</strong><br>
<span style="color: var(--text-secondary);">寫 spec、寫 failing test 都不是「產出」</span>
</div>
<div style="background: var(--surface); border-left: 3px solid var(--danger); padding: 0.6em 0.8em; font-size: 0.5em; text-align: left;">
<strong>紀律成本高</strong><br>
<span style="color: var(--text-secondary);">很容易偷偷跳過，需要 Stop Verifier 擋</span>
</div>
<div style="background: var(--surface); border-left: 3px solid var(--danger); padding: 0.6em 0.8em; font-size: 0.5em; text-align: left;">
<strong>Spec / Test 本身要維護</strong><br>
<span style="color: var(--text-secondary);">改需求要同步改 spec → test → code 三處</span>
</div>
<div style="background: var(--surface); border-left: 3px solid var(--danger); padding: 0.6em 0.8em; font-size: 0.5em; text-align: left;">
<strong>過度測試會拖慢迭代</strong><br>
<span style="color: var(--text-secondary);">UI prototype 階段不該 100% coverage</span>
</div>
</div>
</div>

</div>

<p style="font-size: 0.5em; color: var(--text-muted); text-align: center; margin-top: 1em;">
短期投資 ‧ 長期回報 — 但前提是你要跑到「長期」
</p>

Note:
這頁要坦承：SDD + TDD 前期真的感覺慢，很多人卡在這裡放棄。但長期效益（refactor 自由度、agent 可驗收）才是主賣點。

如果現場有人喊「我試過 TDD 但放棄了」— 反問「你有 Stop Verifier 這種機械化紀律嗎？」這就回到為什麼 harness 重要。
