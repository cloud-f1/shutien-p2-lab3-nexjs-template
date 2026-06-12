# 架構圖索引

> 本目錄包含 AI-Coding-Template 的視覺化架構文件。
> 所有圖表使用 [Mermaid](https://mermaid.js.org/) 語法，GitHub 會自動渲染。

---

## 圖表清單

| 檔案 | 標題 | 適合對象 |
|------|------|----------|
| [system-architecture.md](system-architecture.md) | 系統架構圖 | 新使用者 — 快速理解四層架構全貌 |
| [epic-pipeline.md](epic-pipeline.md) | Epic 開發流程圖 | 開發者 — 理解 spec-first + TDD 流水線 |
| [agent-collaboration.md](agent-collaboration.md) | Agent 協作圖 | 開發者 — 掌握 9 個 agent 的觸發與互動 |
| [auth-flow.md](auth-flow.md) | 認證流程圖 | 後端/前端開發者 — JWT 生命週期 + refresh 輪替 |
| [domain-structure.md](domain-structure.md) | Domain 結構圖 | 後端開發者 — E22 registry 插件機制 |

## 如何閱讀

- 每份檔案包含一或多張 Mermaid 圖 + 簡短說明文字
- 節點標籤使用**繁體中文描述 + 英文技術名詞**（如：「快取層（React Query）」）
- 在 GitHub 網頁上直接開啟即可看到渲染後的圖表

## 相關文件

- [TECHSTACK.md](../../TECHSTACK.md) — 技術棧總覽
- [CLAUDE.md](../../CLAUDE.md) — 專案規則與 Agent 團隊
- [docs/epics/EPIC_INDEX.md](../epics/EPIC_INDEX.md) — 開發進度追蹤
