<!-- markdownlint-disable -->
## 一張圖看完

<img src="assets/diagrams/architecture.svg" alt="Architecture" style="max-height: 70vh; margin: 0.5em auto; display: block;">

<p style="font-size: 0.55em; color: var(--text-secondary); text-align: center;">
<code>openapi.yaml</code> 是唯一真理來源 — server、client、agents、hooks、skills 全部從它衍生
</p>

Note:
這張圖最重要的不是那些盒子，是中間那顆黃球。把 API contract 從「程式碼的產物」改成「程式碼的輸入」，後面所有自動化才有辦法對齊。

---

<!-- .slide: class="slide-grid cols-2" -->
## 技術選型決策

<div class="card">

### Server
- **FastAPI** + fastapi-users JWT
- **PostgreSQL** + Alembic
- **GUID TypeDecorator** (UUID 跨 DB 相容)

</div>
<div class="card">

### Client
- **React 18** + Vite + TypeScript
- **tokenCache** 記憶體存 JWT
- **React Query** cache tier 預設

</div>
<div class="card">

### Test
- server 90% / client 80% coverage
- Vitest + MSW 2 + Playwright
- Contract test 對齊 spec

</div>
<div class="card">

### Deploy → Zeabur

```
┌─────────┐    ┌─────────┐
│ server  │    │ client  │
│ FastAPI │    │  Vite   │
│ +alembic│    │ +build  │
└────┬────┘    └────┬────┘
     └──── Zeabur ──┘
         zbpack.json
```

`/athena:deploy` 跑 7 道 gate

</div>

Note:
快速帶過每個 card。重點是「每個選擇都有踩過雷」。
下一頁是 Epic Pipeline 的完整視圖（E166 inline SVG）。
