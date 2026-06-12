# E79 — Example Domain Migration Templates

> **Phase**: 24 — Migration Domain-Based Refactoring
> **Priority**: P1 | **Points**: 5 SP | **Size**: S
> **Branch**: `MH/feat/E79-example-migrations`
> **Depends on**: E78

---

## Problem Statement

範例 domain 程式碼已移至 `docs/examples/domains/`（E70），但對應的 migration 仍在 `alembic/versions/`。範例應該是自包含的：程式碼 + migration + 文件都在同一個目錄下，讓新用戶可以完整參考。

## Target Structure

```
docs/examples/migrations/
├── README.md                    # 使用說明與安裝指引
├── places.py                    # places domain 的合併 migration
├── portfolios.py                # portfolios + portfolio_places 合併
├── teams.py                     # teams + team_members 合併
└── billing.py                   # subscription_plans + subscriptions + webhook_events
```

每個檔案遵循 ai-clock-work 模式：單一 domain、所有表格、明確 CREATE TABLE。

## Stories

### S1: Create Domain-Based Example Migrations
**AC**:
- [ ] `002_places.py` — 合併原 003 + 005（text constraints）+ 007（team_id FK）。down_revision = `'001'`
- [ ] `003_teams.py` — 合併原 006b（teams + team_members）。down_revision = `'001'`
- [ ] `004_portfolios.py` — 合併原 004 + 005 + 006 + 007。down_revision 依賴 `'002'`（places）+ `'003'`（teams），因為 portfolio_places FK → places.id，team_id FK → teams.id
- [ ] `005_billing.py` — 合併原 008（plans + subscriptions + webhook_events + teams alter）。down_revision = `'003'`（teams），因為 subscriptions FK → teams.id
- [ ] 依賴鏈：`001_auth → 002_places + 003_teams → 004_portfolios`，`003_teams → 005_billing`

### S2: Write Installation Guide
**AC**:
- [ ] `README.md` 說明如何將範例 migration 複製到 `alembic/versions/`
- [ ] 說明如何調整 revision chain
- [ ] 與 `docs/examples/domains/` README 交叉連結

### S3: Update Example Domain READMEs
**AC**:
- [ ] 每個範例 domain README 加入 migration 安裝步驟
- [ ] 指向 `docs/examples/migrations/` 中對應檔案

## Risk Notes

- **極低風險**：純文件/範例，不影響任何生產程式碼
- Migration 檔案為參考用途，不在 alembic 掃描路徑中

## Definition of Done

- [ ] `docs/examples/migrations/` 包含 4 個 domain-based migration + README
- [ ] 每個範例 domain README 有安裝連結
- [ ] Migration 內容與原始檔案功能等價
