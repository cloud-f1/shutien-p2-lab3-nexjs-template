# E361 — 狀態檔／分支錯置的防護

> Phase 87 · Size M · 5 SP · **P1**（2026-08-27 由 P2 上調 —— 見「事故 3」）
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**
> 來源：Phase 86 執行過程中 orchestrator 自己犯的兩次錯（Cycle 41）

## Problem

Phase 86 期間，orchestrator（我）犯了兩次同類錯誤，兩次都被後續檢查抓到並修正，
但**根因相同**：狀態檔活在工作區，而 orchestrator 在多個分支之間切換。

### 事故 1 — `reset --hard` 沖掉未提交的狀態

loop 協定建議以 `git fetch origin && git reset --hard origin/main` 同步 main。
執行時，工作區裡有**尚未提交**的 `epic-progress.md` 步驟標記（E353/E354/E355 的
implement/qa/commit 三格），全部被沖掉，退回 ⬜。

之所以未提交，是因為我刻意把狀態檔排除在 epic 分支之外（避免三個並行 epic 在同幾行上衝突）——
那個決定本身合理，但讓狀態長時間裸露在工作區。

### 事故 2 — 在錯的分支上跑 `state-update.sh`

把狀態 commit 移到 E356 分支後，我仍在 main 上跑 `state-update.sh E356 commit done`。
結果 main 的複本變成 spec ✅、implement ⬜、qa ⬜、commit ✅ —— **一個時序上不可能的組合**。

### 事故 3 — Phase 86 收尾時漏標階段列（**在本 epic 提案後才發生**）

收 Phase 86 時翻了 Epic Step Matrix 的 20 格，**卻漏了 Phase Status 列** —— 它仍寫著
`🟢 APPROVED` 而非 `✅ Complete`。

發現方式純屬偶然：核准 Phase 87 後計算專案摘要，`last_complete` 停在 85、pending 算出 9（應為 5）。
若沒有那次計算，這個錯會留在狀態檔裡。

**這起事故是在本 epic 已經被提案之後才發生的** —— 也就是說，即使問題已被辨識並寫成 epic，
同一類錯誤仍在繼續產生。這是把優先度從 P2 上調到 P1 的理由。

它也揭示了一條規格原本漏掉的檢查：**階段列的狀態必須與其所有 epic 的完成度一致**
（所有 epic 五步全 ✅ ⇒ 階段列必須是 ✅ Complete）。這條與事故 2 的「時序上不可能的組合」
同屬方向 3，但作用在不同的層級（階段 vs epic）。

## 為什麼 E353 的 drift gate 抓不到

E353 加的 `check-drift.sh` 比對「`EPIC_INDEX.md` 是否與 `epic-progress.md` 同步」。

**兩個檔案可以完美同步，而內容是錯的。** 事故 2 與事故 3 之後 `check-drift` 都回 exit 0 ——
因為 `render-index.sh` 忠實地把錯誤的狀態同步到了衍生檔。**兩個檔案完美一致地錯著。**
這是**不同的失效模式**，需要不同的守衛。

## Solution（方向，細節由 spec 階段定案）

三個候選方向，可擇一或組合。spec 階段應評估各自的誤報率與實作成本：

1. **消除裸露窗口** —— `state-update.sh` 寫完後自動 commit（或至少在 stdout 明確提示
   「狀態已變更但未提交」）。最直接，但會產生大量小 commit。
2. **分支感知** —— `state-update.sh` 偵測當前分支；若該 epic 的狀態 commit 已存在於
   別的分支，警告。需要定義「狀態承載分支」的概念。
3. **內部一致性檢查（建議優先評估）** —— `pre-merge-check` 以純規則檢查狀態檔自身的自洽性，
   **與分支無關、不需要 git 歷史知識**，誤報率最低。至少三條規則，各對應一起真實事故：
   - `commit=✅` 而 `implement=⬜`（時序上不可能）← 事故 2
   - 某階段所有 epic 五步全 ✅，但階段列不是 `✅ Complete` ← 事故 3
   - `merge=✅` 但找不到對應的合併 commit（此條需要 git 歷史，可列為選配）

方向 3 之所以建議優先：三起事故裡有兩起（2 和 3）純靠狀態檔內部就能偵測，
不需要定義「狀態承載分支」這種新概念，也不會像方向 1 那樣產生大量小 commit。

## Key Files

- `scripts/state/state-update.sh`
- `scripts/pre-merge-check.sh`（若採方向 3）
- 新增回歸測試（比照 E353：以環境變數注入 `mktemp -d` 副本，**不得**動真實狀態檔）

## Acceptance Criteria

1. **重現事故 2**：人為造出 `commit=✅` 而 `implement=⬜` 的狀態 → 新守衛**必須報錯**並指出
   哪個 epic 的哪兩格不一致。
1b. **重現事故 3**：人為造出「某階段所有 epic 五步全 ✅，但階段列仍是 🟢 APPROVED」
   → 新守衛**必須報錯**並指出是哪個階段。以 Phase 86 修正前的真實內容作為 fixture。
2. **重現事故 1**：人為造出「狀態已改但未提交」→ 依所選方向，自動提交或明確警告。
3. `main` 現況通過（不引入既有紅燈）。
4. 回歸測試以注入路徑操作 fixture，跑前後 `git status --porcelain` 位元組相同。
5. **不得**與 E353 的 drift gate 重複 —— 兩者的職責要在文件中寫清楚：
   drift gate 管「兩檔同步」，本 epic 管「內容自洽」。

## Out of Scope

- 重寫狀態檔格式或改用結構化格式 —— E353 已論證過 SSOT 鏈本身是對的。
- 改變 loop 協定建議的 `reset --hard` 同步方式。
