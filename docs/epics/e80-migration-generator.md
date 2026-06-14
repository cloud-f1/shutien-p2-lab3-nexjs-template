# E80 — Migration Generator in `make new-domain`

> **Phase**: 24 — Migration Domain-Based Refactoring
> **Priority**: P1 | **Points**: 5 SP | **Size**: S
> **Branch**: `feat/E80-migration-generator`
> **Depends on**: E78

---

## Problem Statement

`make new-domain NAME=x` 產生 models、schemas、endpoints、tests — 但不產生 Alembic migration 檔案。開發者必須手動執行 `alembic revision --autogenerate`，這破壞了「零設定」的 DX 承諾。

ai-clock-work 的模式是每個 domain 都有預先撰寫的 migration，使用明確的 `op.create_table()` 而非 autogenerate。

## Target

`make new-domain NAME=notes` 同時產生：
```
server/alembic/versions/NNN_notes.py
```

遵循 domain-based 命名：`{next_number}_{domain_name}.py`

## Stories

### S1: Create Migration Template
**AC**:
- [ ] `docs/templates/domain/server/migration.py.tmpl` — migration 模板
- [ ] 模板包含：create_table with GUID PK, user_id FK, timestamps, name/description
- [ ] 使用 `sa.Uuid()` 遵循 alembic_hooks 規範
- [ ] `downgrade()` 正確 drop table

### S2: Update Domain Generator Script
**AC**:
- [ ] `scripts/new-site/` 或 `Makefile` 的 new-domain target 加入 migration 生成
- [ ] 使用 `alembic heads` 命令偵測當前 head revision（比掃描檔名更穩健）
- [ ] 自動偵測下一個 migration 編號（掃描 `alembic/versions/` 檔名取最大值 +1）
- [ ] 自動設定 `down_revision` 為 `alembic heads` 的輸出
- [ ] 處理多 head 情況（提示使用者先 `alembic merge`）
- [ ] 輸出產生的 migration 路徑

### S3: Documentation Update
**AC**:
- [ ] `make new-domain` 的 help 文字包含 migration 說明
- [ ] 相關 guide 更新（如有）

## Risk Notes

- **中等風險**：需要正確偵測 revision chain
- 如果 migration chain 有分支（多 head），需要 `alembic merge` — 但 domain-based 模式下通常不會
- 產生的 migration 是起點，開發者可能需要手動調整

## Definition of Done

- [ ] `make new-domain NAME=test_domain` 產生完整 domain + migration 檔案
- [ ] Migration 檔案可直接 `alembic upgrade head` 使用
- [ ] 自動偵測 revision 編號正確
- [ ] 模板遵循 ai-clock-work domain-based 命名模式
