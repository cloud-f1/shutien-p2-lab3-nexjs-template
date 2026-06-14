# E78 — Migration Archive & Core Consolidation

> **Phase**: 24 — Migration Domain-Based Refactoring
> **Priority**: P0 | **Points**: 8 SP | **Size**: M
> **Branch**: `feat/E78-migration-archive`
> **Depends on**: none

---

## Problem Statement

ai-coding-template 有 9 個 migration 檔案，其中 003–008 屬於已歸檔的範例 domain（places、portfolios、teams、billing，E70 已移至 `docs/examples/domains/`）。但這些 migration 仍然留在 `alembic/versions/`，導致新用戶執行 `alembic upgrade head` 時會建立不存在的 domain 表格。

此外，auth 相關的表格分散在兩個檔案（001 + 002），不符合 ai-clock-work 的 domain-based 模式（一個 domain 一個檔案）。

## Target Pattern

參考 ai-clock-work 的 domain-based migration 模式：
```
001_auth.py        — user, oauth_account, sessions（合併原 001 + 002）
```

每個檔案包含一個 domain 的所有表格，使用明確的 `op.create_table()` 而非 autogenerate。

## Stories

### S1: Archive Legacy Migrations
**AC**:
- [ ] 建立 `server/alembic/_legacy_migrations/` 目錄
- [ ] 將現有 9 個 migration 檔案移至 `_legacy_migrations/`
- [ ] 新增 `_legacy_migrations/README.md` 說明歸檔原因與日期

### S2: Create Consolidated `001_auth.py`
**AC**:
- [ ] 建立新的 `001_auth.py`，合併 user + oauth_account + sessions 三張表
- [ ] revision = `'001'`，down_revision = `None`
- [ ] 使用 `sa.Uuid()` 遵循現有 alembic_hooks 規範
- [ ] `downgrade()` 正確 drop 三張表（reverse order）
- [ ] CHECK constraints、indexes 皆包含在內

### S3: Verify Fresh Migration Path
**AC**:
- [ ] `alembic upgrade head` 在空 DB 上成功建立所有 auth 表格
- [ ] Schema 與原始 9 個 migration 結果完全一致（比對 table structure）
- [ ] `alembic downgrade base` 成功清除所有表格
- [ ] 現有測試全數通過

### S4: Production Stamp & Orphan Cleanup Guide (MANDATORY)
**AC**:
- [ ] 建立 `server/alembic/MIGRATION_GUIDE.md` 說明既有部署升級步驟
- [ ] 步驟 1: `alembic stamp --purge head`（將 alembic_version 從 `008` 更新為 `001`）
- [ ] 步驟 2: 記錄 orphaned tables 清理路徑（places, portfolios, teams, billing 等表格在 production 中仍存在但不再被 Alembic 追蹤）
- [ ] 提供 `DROP TABLE IF EXISTS` 腳本供手動清理
- [ ] 在 `_legacy_migrations/README.md` 交叉連結此指南

### S5: Fix Model-Migration Default Drift
**AC**:
- [ ] Session model `device_info`: 改用 `server_default=""` 取代 `default=""`
- [ ] Session model `is_revoked`: 改用 `server_default=sa.text("false")` 取代 `default=False`
- [ ] 確保合併後的 `001_auth.py` 與 model 定義一致

## Risk Notes

- **低風險**：檔案搬移 + 合併，不改變任何 model 程式碼
- 既有 production（Zeabur）**必須** 執行 `alembic stamp --purge head`，否則 upgrade 會失敗
- orphaned domain tables 需要手動清理（不會自動 DROP）
- 測試需驗證 schema 等價性

## Definition of Done

- [ ] `_legacy_migrations/` 包含原始 9 個檔案
- [ ] `versions/` 只有 `001_auth.py`
- [ ] `alembic upgrade head` 建立正確 schema
- [ ] 所有 server tests 通過
- [ ] `alembic check` 無 pending changes
