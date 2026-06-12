# CI 流水線說明

> 新手友善指南：推送程式碼或開 PR 時會發生什麼。

## CI 執行哪些檢查

當你推送到分支或開啟 Pull Request 時，GitHub Actions 會自動執行以下檢查：

| 檢查 | 說明 | 本地指令 |
|------|------|---------|
| **伺服器測試** | 執行所有 Python 測試 + 覆蓋率 | `cd server && uv run pytest` |
| **前端測試** | 執行所有 Vitest 測試 + 覆蓋率 | `cd client && pnpm test:coverage` |
| **型別生成** | 驗證 `src/api/types.ts` 與 `openapi.yaml` 一致 | `cd client && pnpm generate:types` |
| **程式碼風格** | 檢查格式與風格 | `make lint` |

## 常見 CI 失敗與修復方法

### 1. 「Coverage does not meet threshold」

**原因**：你的程式碼變更讓測試覆蓋率低於 80%。

**修復**：
```bash
cd client && pnpm test:coverage    # 查看哪些檔案覆蓋率不足
cd server && uv run pytest --cov   # 伺服器端同上
```

為未覆蓋的分支撰寫測試。覆蓋率報告會顯示確切的行號。

### 2. 「Generated types are stale」

**原因**：你修改了 `docs/openapi.yaml` 但忘了重新生成 TypeScript 型別。

**修復**：
```bash
cd client && pnpm generate:types
git add client/src/api/types.ts
git commit -m "chore: regenerate types from openapi.yaml"
```

### 3. 「Lint errors」

**原因**：程式碼格式或風格違規。

**修復**：
```bash
# 伺服器 (Python)
cd server && uv run ruff check --fix && uv run ruff format

# 前端 (TypeScript)
cd client && pnpm lint --fix
```

### 4. 「Test failures」

**原因**：一個或多個測試失敗。

**修復**：
```bash
# 在本地執行失敗的測試
cd client && pnpm vitest run src/path/to/failing.test.tsx
cd server && uv run pytest tests/path/to/test_file.py -v
```

閱讀錯誤訊息 — 通常會告訴你確切的斷言失敗原因。

## 推送前在本地執行 CI

推送前在本地執行檢查可以節省時間：

```bash
make test          # 執行所有測試套件
make lint          # 檢查格式
cd client && pnpm generate:types && git diff --exit-code src/api/types.ts  # 檢查型別
```

或使用一體化診斷：

```bash
make doctor        # 檢查環境健康狀態
```

## CI 工作流程檔案

工作流程定義在 `.github/workflows/`：

| 檔案 | 觸發條件 | 說明 |
|------|---------|------|
| `ci.yml` | Push / PR | 測試、覆蓋率、lint、型別檢查 |
| `docker-publish.yml` | Push 到 main | 建構並推送 Docker 映像到 GHCR |
| `audit.yml` | 排程 / 手動 | 依賴安全稽核 |

## 需要幫助？

- 查看[快速開始指南](quickstart.md)了解設定說明
- 執行 `make doctor` 診斷環境問題
- 如果卡住了，附上 CI 日誌開一個 Issue

---

## 下一步

- **[不使用 Claude Code 開發](without-claude-code.md)** — 僅使用 `make` 指令的完整開發流程
- **[OpenAPI 設計模式](openapi-patterns.md)** — 掌握 API 設計模式，避免常見陷阱
- **[AI Agent 團隊指南](ai-agent-team-guide.md)** — 透過序列與並行 Agent 執行自動化你的工作流程
- **[學習路徑](learning-path.md)** — 查看所有指南的推薦閱讀順序
