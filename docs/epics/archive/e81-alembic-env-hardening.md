# E81 — Alembic Env Hardening & CI Gate

> **Phase**: 24 — Migration Domain-Based Refactoring
> **Priority**: P2 | **Points**: 5 SP | **Size**: S
> **Branch**: `feat/E81-alembic-ci-gate`
> **Depends on**: E78, E80

---

## Problem Statement

目前沒有 CI 機制驗證 migration 與 model 是否同步。如果開發者修改 model 但忘記產生 migration，問題要到部署時才會被發現。

## Stories

### S1: Add `alembic check` to CI
**AC**:
- [ ] CI pipeline 新增步驟：`alembic check` 驗證無 pending migrations
- [ ] 如果有未追蹤的 model 變更，CI 失敗
- [ ] 適用於 PR checks

### S2: Env.py Improvements
**AC**:
- [ ] 加入 `compare_server_default=True` 提升 autogenerate 精確度
- [ ] 確認 domain model auto-discovery 與合併後的 migration 正常運作
- [ ] 驗證 `render_item` hook 正確處理 `sa.Uuid()` normalization

### S3: Migration Naming Convention Doc
**AC**:
- [ ] 在 `server/alembic/README.md` 記錄命名規範
- [ ] Domain-based: `NNN_{domain}.py`（NNN = 零填充三位數）
- [ ] 一個 domain 一個檔案，所有表格集中
- [ ] 參考 ai-clock-work 模式

## Risk Notes

- **低風險**：CI 增強 + 文件
- `compare_server_default=True` + SQLite 在 CI 中可能產生 false positives（SQLite 以 text 存儲 defaults，比較為字串式）— 可能需要條件性啟用（僅 PostgreSQL）
- `alembic check` 需要 DB connection — CI 必須有 test DB（可使用 SQLite in-memory）
- E78 S5 已修正 model-migration default drift，可減少 false positives

## Definition of Done

- [ ] CI 有 `alembic check` 步驟
- [ ] 有 pending migration 時 CI 失敗
- [ ] `server/alembic/README.md` 包含命名規範
- [ ] env.py 改進已驗證
