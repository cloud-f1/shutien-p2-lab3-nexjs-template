<!-- markdownlint-disable -->
## LLM 健忘症問題

<div style="display: flex; justify-content: center; gap: 2em; margin-top: 1em;">
<div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1em; max-width: 16em; font-size: 0.6em; text-align: left;">
<div style="font-size: 1.2em; margin-bottom: 0.5em;">📅 Day 1</div>
「請不要用 <code>any</code>」<br>
「請用 <code>userEvent</code> 不要用 <code>fireEvent</code>」<br>
「PR 要拆小」<br>
→ <span style="color: var(--success);">✓ 有效</span>
</div>
<div style="font-size: 2em; align-self: center; color: var(--text-muted);">→</div>
<div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1em; max-width: 16em; font-size: 0.6em; text-align: left;">
<div style="font-size: 1.2em; margin-bottom: 0.5em;">📅 Day 7</div>
同樣的問題又出現了<br>
「怎麼又寫成 <code>fireEvent</code>」<br>
「上週才講過的 convention…」<br>
→ <span style="color: var(--danger);">✗ 全忘了</span>
</div>
</div>

<p style="font-size: 0.65em; text-align: center; margin-top: 1.5em;">
真正的問題不是 LLM 記憶不夠，是<strong>沒有讓它記住的機制</strong>
</p>

Note:
給聽眾一個「這個問題你有感」的 moment。問：「有用 ChatGPT/Claude 超過一週的舉手」、「覺得它越來越不聽話的舉手」。

---

## Memory Tier — 兩層記憶

<img src="assets/diagrams/memory-tier.svg" alt="Memory Tier" style="max-height: 65vh; margin: 0.5em auto; display: block;">

<p style="font-size: 0.55em; color: var(--text-secondary); text-align: center;">
Chronos 踩的雷 → promote → 所有新專案自動繼承 — 教訓會跨專案傳遞
</p>

Note:
Tier 0 的威力是「教訓會跨專案傳遞」— 別的 template 沒有這個。Tier 1 每個 agent 有自己的寫回檔，/athena:save 一鍵 checkpoint。

---

## Learning Loop 有牙齒

<div style="display: flex; justify-content: center; align-items: center; gap: 0.8em; margin-top: 1em; font-size: 0.55em; font-family: var(--font-mono);">
<div style="background: var(--surface); border: 1px solid #ff4f4f; border-radius: 8px; padding: 1em; text-align: center;">
<div style="color: #ff4f4f; font-weight: 700; margin-bottom: 0.3em;">違規</div>
agent 寫了 fireEvent
</div>
<div style="color: var(--primary); font-size: 2em;">→</div>
<div style="background: var(--surface); border: 1px solid var(--primary); border-radius: 8px; padding: 1em; text-align: center;">
<div style="color: var(--primary); font-weight: 700; margin-bottom: 0.3em;">Stop Verifier</div>
Rule #2 擋下 commit
</div>
<div style="color: var(--primary); font-size: 2em;">→</div>
<div style="background: var(--surface); border: 1px solid var(--info); border-radius: 8px; padding: 1em; text-align: center;">
<div style="color: var(--info); font-weight: 700; margin-bottom: 0.3em;">Memory 寫回</div>
記入 Tier 1 memory
</div>
<div style="color: var(--primary); font-size: 2em;">→</div>
<div style="background: var(--surface); border: 1px solid var(--success); border-radius: 8px; padding: 1em; text-align: center;">
<div style="color: var(--success); font-weight: 700; margin-bottom: 0.3em;">下次</div>
agent 不再犯
</div>
</div>

<p style="font-size: 0.55em; text-align: center; margin-top: 1.5em; color: var(--text-secondary);">
閉環：違規 → 被擋 → 記住 → 不再犯。不是靠人記得提醒，是機械化的學習。
</p>

Note:
這是 Learning System 最關鍵的 slide — 閉環。前面講問題、講結構，這裡收束成「為什麼它有效」。
