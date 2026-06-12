# Migration 升級指南（E78）

> **適用對象**：已透過舊版 migration（001–008）建立表格的既有部署環境

---

## 背景

E78 將 9 個舊版 migration 整合為 1 個 domain-based migration：

- `001_auth.py` — user、oauth_account、sessions（合併原 001 + 002）
- 003–008（範例 domain）已移除，不再被 Alembic 追蹤

## 步驟 1：更新 Alembic 版本戳記

既有部署的 `alembic_version` 表格目前記錄的是 `008`，需要更新為新的 `001`：

```bash
cd server
alembic stamp --purge head
```

此指令會：
1. 清除 `alembic_version` 表格中的所有記錄
2. 寫入新的版本號 `001`
3. **不會**執行任何 DDL（不建表、不刪表）

## 步驟 2：清理孤立的範例 Domain 表格

以下表格由舊版 migration（003–008）建立，但對應的 domain 程式碼已在 E70 歸檔。
這些表格在 production 中仍然存在，但不再被 Alembic 追蹤。

**如確認不再需要這些表格的資料**，可執行以下 SQL 手動清理：

```sql
-- ⚠️ 警告：此操作不可逆，請先備份資料！

-- Billing domain（008）
DROP TABLE IF EXISTS webhook_events;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS subscription_plans;

-- Teams domain（006b, 007）— 注意 FK 依賴順序
DROP TABLE IF EXISTS team_members;

-- 先移除其他表的 team_id 欄位（007 新增的）
ALTER TABLE places DROP COLUMN IF EXISTS team_id;
ALTER TABLE portfolios DROP COLUMN IF EXISTS team_id;

DROP TABLE IF EXISTS teams;

-- Portfolios domain（004, 005, 006）
DROP TABLE IF EXISTS portfolio_places;
DROP TABLE IF EXISTS portfolios;

-- Places domain（003）
DROP TABLE IF EXISTS places;
```

## 步驟 3：驗證

```bash
# 確認 alembic_version 為 001
alembic current

# 確認沒有 pending migration
alembic check
```

## 參考

- 舊版 migration 檔案保留於 [`_legacy_migrations/`](./_legacy_migrations/README.md)
- Epic 規格：`docs/epics/e78-migration-archive-core-consolidation.md`
