# 範例 Domain Migration

> 本目錄包含 4 個範例 domain 的合併 migration，與 `docs/examples/domains/` 的範例程式碼搭配使用。

## 檔案說明

| 檔案 | Domain | 依賴 | 建立的表格 |
|------|--------|------|-----------|
| `002_places.py` | Places | `001` (auth) | `places` |
| `003_teams.py` | Teams | `001` (auth) | `teams`, `team_members` |
| `004_portfolios.py` | Portfolios | `002` + `003` | `portfolios`, `portfolio_places` |
| `005_billing.py` | Billing | `003` (teams) | `subscription_plans`, `subscriptions`, `webhook_events` + ALTER `teams` |

## 依賴鏈

```
001_auth (已內建)
├── 002_places
├── 003_teams
│   └── 005_billing
└── 004_portfolios (depends on 002 + 003)
```

`001` 是專案內建的 auth migration（fastapi-users），不包含在本目錄中。

## 安裝步驟

### 1. 複製 migration 檔案

將需要的 migration 複製到 `server/alembic/versions/`：

```bash
# 例：安裝 places domain
cp docs/examples/migrations/002_places.py server/alembic/versions/

# 例：安裝 portfolios（需要 places + teams）
cp docs/examples/migrations/002_places.py server/alembic/versions/
cp docs/examples/migrations/003_teams.py server/alembic/versions/
cp docs/examples/migrations/004_portfolios.py server/alembic/versions/
```

### 2. 調整 revision chain

如果 `server/alembic/versions/` 已有其他 migration，你需要修改 `down_revision` 來接上現有的 chain：

1. 查看目前最新的 revision：
   ```bash
   cd server && uv run alembic heads
   ```

2. 編輯複製過來的 migration，將 `down_revision` 改為目前的 head revision ID

3. 如果安裝多個 domain，確認依賴順序正確（參考上方依賴鏈）

### 3. 執行 migration

```bash
cd server && uv run alembic upgrade head
```

### 4. 安裝對應的 domain 程式碼

參考 [`docs/examples/domains/README.md`](../domains/README.md) 將 server 和 client 程式碼複製到專案中。

## 注意事項

- 這些檔案是**參考範例**，不在 alembic 掃描路徑中
- 每個 migration 已合併原始多個步驟（建表 + 約束 + FK），可一次到位
- UUID 欄位使用 `sa.Uuid()`，相容 PostgreSQL 原生 UUID 與 SQLite CHAR(36)
- 財務數值欄位使用 `sa.Numeric(12, 2)` 而非 `Float`，避免浮點精度問題
