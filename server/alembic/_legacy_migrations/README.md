# 歸檔的 Legacy Migrations

> **歸檔日期**: 2026-03-25
> **歸檔原因**: E78 — Migration Archive & Core Consolidation

## 說明

此目錄包含 E78 之前的 9 個 Alembic migration 檔案。這些檔案已被整合為以 domain 為單位的新 migration 結構：

| 原始檔案 | 原始用途 | 新歸屬 |
|----------|---------|--------|
| `001_fastapi_users_initial.py` | user + oauth_account 表格 | → `versions/001_auth.py` |
| `002_add_sessions_table.py` | sessions 表格 | → `versions/001_auth.py` |
| `003_add_places_table.py` | places 範例 domain | 已移除（E70 歸檔） |
| `004_add_portfolio_tables.py` | portfolios 範例 domain | 已移除（E70 歸檔） |
| `005_add_text_length_constraints.py` | 範例 domain 約束 | 已移除（E70 歸檔） |
| `006_float_to_numeric.py` | 範例 domain 型別修正 | 已移除（E70 歸檔） |
| `006_add_teams_tables.py` | teams 範例 domain | 已移除（E70 歸檔） |
| `007_add_team_id_to_domains.py` | 範例 domain FK | 已移除（E70 歸檔） |
| `008_add_billing_tables.py` | billing 範例 domain | 已移除（E70 歸檔） |

## 為什麼歸檔？

1. **範例 domain 已移除**：places、portfolios、teams、billing 在 E70 已移至 `docs/examples/domains/`，但 migration 仍存在，導致新用戶 `alembic upgrade head` 會建立不需要的表格。
2. **整合 auth domain**：user + oauth_account + sessions 原本分散在兩個檔案，現整合為 `001_auth.py`，符合 ai-clock-work 的 domain-based 模式。

## 既有部署升級

若你的環境已經透過舊 migration 建立了表格，請參考 **[`../MIGRATION_GUIDE.md`](../MIGRATION_GUIDE.md)** 了解升級步驟。

## 注意事項

- 此目錄**僅供參考**，Alembic 不會掃描此目錄
- 請勿將這些檔案移回 `versions/`
