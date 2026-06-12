# Alembic Migration 規範

> Domain-based 命名慣例，參考 ai-clock-work 模式。

---

## 命名規則

```
versions/
  001_auth.py          # Auth domain（user, oauth_account, sessions）
  002_billing.py       # Billing domain（未來）
  003_teams.py         # Teams domain（未來）
```

- **檔名格式**：`NNN_{domain}.py`（NNN = 零填充三位數）
- **一個 domain 一個檔案**：同一 domain 的所有表格集中在同一個 migration
- **revision ID**：使用 `NNN`（如 `"001"`），不使用 Alembic 預設的 hex hash
- **chain**：`down_revision` 指向前一個 NNN（如 `"001"` → `"002"`）

## 建立新 Migration

### 方式一：透過 `make new-domain`

```bash
make new-domain NAME=billing
```

會自動產生 server + client 骨架，包含空的 migration 檔案。

### 方式二：手動建立

```bash
cd server

# 1. 先確認 model 已定義在 app/domains/{domain}/models.py
# 2. 用 autogenerate 產生 migration
uv run alembic revision --autogenerate -m "{domain} domain — {tables}"

# 3. 手動修改產生的檔案：
#    - 改 revision ID 為下一個 NNN
#    - 改 down_revision 為前一個 NNN
#    - 改檔名為 NNN_{domain}.py
#    - 確認 sa.Uuid() 正確（render_item hook 應自動處理）
```

### 方式三：Autogenerate 後驗證

```bash
cd server

# 產生 migration 後務必檢查
uv run alembic check

# 如果有 false positives（通常是 SQLite 的 UUID/nullable 差異），
# 確認 compare_type hook 是否正確處理
```

## Revision Chain 運作方式

```
None → 001_auth → 002_billing → 003_teams → ...
```

- 每個 migration 的 `down_revision` 指向前一個
- `alembic upgrade head` 依序執行所有 migration
- `alembic downgrade -1` 回滾最後一個

## Domain Model 自動發現

`app/models/__init__.py` 會自動掃描 `app/domains/*/models.py`，
確保所有 domain model 都會被 Alembic autogenerate 偵測到。
不需要手動 import。

## CI 驗證

CI pipeline 會執行 `alembic check`：

1. 使用 SQLite 建立臨時 DB
2. 執行 `alembic upgrade head` 套用所有 migration
3. 執行 `alembic check` 比對 model 與 DB schema
4. 如果有未追蹤的 model 變更，CI 失敗

## 注意事項

- **`compare_server_default=True`** 僅在 PostgreSQL 啟用；SQLite 會因文字式 default 比較產生 false positives
- **UUID 類型**：`render_item` hook 會將所有 UUID-like 類型正規化為 `sa.Uuid()`
- **`compare_type` hook**：處理 GUID ↔ sa.Uuid() ↔ CHAR(32/36) 的等價判斷，避免假警報
