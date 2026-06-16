# 啟動新專案 — 封存模板 Epic 並從 E1 開始

> 當你 fork 了本模板並要開始自己的產品時，使用此流程保留模板的 epic 歷史作為參考，同時讓自己的 epic 編號從 E1 開始。

## 為什麼要封存而不是刪除

本模板目前累積了 160+ 個 epic（E1–E166，跨越 42 個 phase），每一個都是實戰驗證過的模式：

- 測試金字塔 × 覆蓋率防線 × Stop verifier 規則
- Agent team 架構 × Epic pipeline × QA gate
- Playwright e2e 檢查 × Drizzle 遷移審查 × Autopilot 信心分數

這些不是「雜訊」，是你未來做技術決策時可以直接翻閱的案例庫。刪掉就沒了；封存後你隨時能 `grep` 查詢、複製模式、學習為什麼當初這麼設計。

## 一鍵執行

```bash
make new-project
```

這會呼叫 `scripts/template-reset.sh --archive`，行為如下：

| 步驟 | 動作 |
|------|------|
| 1 | 將 `docs/epics/e*.md` + `docs/epics/phase-*-prd.md` 搬到 `docs/epics/_archive/<YYYY-MM-DD>-from-template/` |
| 2 | 將當前 `EPIC_INDEX.md` 快照成 `_archive/<date>/EPIC_INDEX.md.snapshot` |
| 3 | 在封存目錄寫入 `README.md` 說明這是模板歷史 |
| 4 | 從 `docs/templates/epics/EPIC_INDEX.md` 重置為空白 epic tracker（Phase 0 + 空表格，下一個 epic 編號 = E1） |
| 5 | 從 `docs/templates/context/` 重置所有 context 文件（debug-log, review-log 等）為空白 |
| 6 | 清除模板專屬的 skill 和 backward-compat shim |

## 執行後的專案結構

```
docs/epics/
├── EPIC_INDEX.md                    # 空白 tracker，等你寫 E1
├── CLAUDE.md                        # 保留（epic 開發慣例）
└── _archive/
    └── 2026-04-24-from-template/
        ├── README.md                # 說明這是模板歷史
        ├── EPIC_INDEX.md.snapshot   # 模板最後的 epic state（160+ epics）
        ├── e1-*.md … e166-*.md      # 所有 epic 規格
        └── phase-*-prd.md           # 所有 phase PRD
```

## 建立你的第一個 Epic

```bash
# 1. 開一個新分支
git checkout -b feat/E1-my-first-feature

# 2. 啟動 spec 工作流
/athena:spec E1 "使用者註冊 + Email 驗證"

# 3. 接著走 epic pipeline（spec → implement → qa → commit → merge）
/athena:loop
```

`/athena:loop` 會讀 `docs/epics/EPIC_INDEX.md` 上的 E1，跑標準管線一路到合併。模板封存下來的 E1–E166 **不會**被 loop 讀到——它們在 `_archive/` 裡只是參考資料。

## 想要參考模板的實作時怎麼辦？

範例：你要實作「使用者 session 管理」，想知道模板怎麼做的。

```bash
# 在封存中搜尋相關 epic
grep -l "session" docs/epics/_archive/*/e*.md

# 結果會指向 e161-auth-adapter-sunset-refresh-hardening.md
# 裡面有完整的 session 模型、rotation、reuse detection 設計
```

封存後的 epic 仍是可讀可搜尋的 markdown，你可以整段複製規格、挑選 acceptance criteria、或 借用 migration 審查模式。

## 什麼時候不要跑 `make new-project`

- **你正在維護模板本身** — 這個動作會清掉模板 epic，你就沒東西可維護了
- **你還沒提交** — 確認 `git status` 沒有未提交的改動，這個指令會修改多個檔案
- **你已經跑過一次並寫了 E1** — 再跑一次會把你自己的 E1 也封存掉（除非你想要這樣）

## 回滾

這個操作是可回復的，因為它是 `mv` 而不是 `rm`：

```bash
# 把模板 epic 搬回去（如果你反悔了）
mv docs/epics/_archive/<date>-from-template/e*.md docs/epics/
mv docs/epics/_archive/<date>-from-template/phase-*-prd.md docs/epics/
mv docs/epics/_archive/<date>-from-template/EPIC_INDEX.md.snapshot docs/epics/EPIC_INDEX.md
rm -rf docs/epics/_archive/<date>-from-template/
```

或直接 `git reset --hard HEAD` 如果你尚未 commit。

## 和 `make init` 的差別

| 指令 | Epic 處理 | 跑其他步驟 |
|------|-----------|-----------|
| `make init` | **刪除** epic 檔案 | 安裝相依、初始化資料庫、跑遷移、啟動 Site Builder CLI |
| `make new-project` | **封存** epic 檔案 | 只重置 epic + context；不碰相依 / DB / build |

- 如果你要「完整的 post-clone 初始化」流程 → `make init`（但會刪掉模板 epic）
- 如果你只想「封存模板 epic 並從 E1 開始」 → `make new-project`
- 如果你兩者都要：先 `make new-project` 保留 epic 封存，再手動跑 `make setup ensure-db migrate generate-types`
