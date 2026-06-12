# 技能模組 | Skills

> 8 個技能模組（Skills）是**自動載入的上下文注入器**，當 Agent 處理特定類型的任務時自動啟用。
>
> 8 auto-loaded context injectors — activated when agents work on specific task types.

---

## 技能一覽 | Overview

| 技能 / Skill | 說明 / Description | 觸發時機 / When Triggered |
|-------------|-------------------|-------------------------|
| `server-patterns` | FastAPI 端點結構、SQLAlchemy 模型慣例、依賴注入模式、pytest 測試模板 | 編輯 `server/` 目錄時 |
| `client-patterns` | React Query 4 層快取（STATIC/SEMI/SECURITY/REALTIME）、Token 安全管理、`createService()` 工廠模式 | 編輯 `client/src/` 時 |
| `openapi-first` | SDD 工作流：先寫 spec → `openapi-typescript` 生成型別 → `satisfies z.ZodType<T>` 編譯時偏移偵測 | 設計 API 或建立新端點時 |
| `frontend-review` | WCAG a11y 檢查清單、React 反模式偵測（useEffect 濫用、missing deps）、CSS 架構一致性 | `/athena:qa` 前端審查時 |
| `tdd-workflow` | RED → GREEN → REFACTOR 循環：先寫失敗測試 → 最小實作 → 重構。Server pytest + Client Vitest | `/athena:implement` 時 |
| `debugging` | 已知故障模式速查（GUID 型別不匹配、async context 錯誤、CORS 設定），診斷指令清單 | @debugger 啟動時 |
| `upgrade-stripe` | Stripe API 版本升級指引、SDK 版本管理、升級檢查清單、版本測試方法 | 升級 Stripe 或修改帳務功能時 |
| `dba-migrations` | 資料庫 schema 管理：GUID 雙層設計、Alembic migration 模式、常見情境模板、禁用模式清單 — Database schema management: two-layer UUID design, Alembic migration patterns, common scenario templates, banned pattern list | 建立/編輯 model、產生/審查 migration、新增欄位/資料表、除錯 migration 錯誤時 |

---

## 技能定義檔位置

所有技能定義位於 `.claude/skills/` 目錄。

Skill definitions live in `.claude/skills/`.
