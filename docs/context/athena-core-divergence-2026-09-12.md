# athena-core 分歧測量 — 2026-09-12

> 一次性測量報告。起因：`make drift-check` 報 61 檔漂移，而 `CLAUDE.md` 的
> 「Plugin Relationship (E202)」宣稱 template 是 canonical upstream、athena-core 以單向
> 同步接收。**測量結果與該宣稱不符**，因此把數字留檔，讓後續決定不必重跑。

## 方法

對五組同步配對（`.claude/agents/` → `agents/` 等）逐檔比對兩邊內容，統計
「只存在於下游的行數（−）」與「只存在於上游的行數（+）」。
58 個檔案在兩邊都存在且內容不同。

## 結果

| 形狀 | 檔數 | 意義 |
|---|---|---|
| 下游是上游的真子集（同步只會增加） | 1 | 可安全單向同步 —— 已於 athena-core PR #7 完成 |
| **雙向分歧**（兩邊各有對方沒有的內容） | 56 | 單向 `--apply` 會刪掉下游真實內容 |
| 僅下游有內容（上游無可貢獻） | 1 | **模板才是落後的一方** —— 方向相反 |

### 僅下游有內容（反向回收候選）

- `skills/athena-loop-speedups/SKILL.md` —— 下游多 44 行，上游多 0 行

實例：`skills/athena-loop-speedups/SKILL.md` 的 §8「Merge-back: rebase order + SEMANTIC
verification」整節只存在於 athena-core。

### 雙向分歧中差異最大的 12 檔

| 下游獨有 | 上游獨有 | 檔案 |
|---|---|---|
| 91 | 266 | `scripts/memory/match.sh` |
| 253 | 176 | `skills/security-audit/SKILL.md` |
| 67 | 173 | `skills/design-sync-roundtrip/SKILL.md` |
| 88 | 170 | `skills/testing-strategy/SKILL.md` |
| 79 | 122 | `skills/user-guide-builder/SKILL.md` |
| 168 | 111 | `skills/zeabur-deploy/SKILL.md` |
| 51 | 110 | `commands/athena/batch.md` |
| 86 | 106 | `skills/nextjs-saas-patterns/SKILL.md` |
| 54 | 71 | `scripts/memory/score.sh` |
| 45 | 60 | `commands/athena/audit.md` |
| 13 | 56 | `skills/verification-discipline/SKILL.md` |
| 12 | 55 | `commands/athena/tony.md` |

### 四個「結構性」檔案（永遠不要覆蓋）

`scripts/memory/inject.sh` · `score.sh` · `match.sh` · `half-life-resolve.sh` ——
下游改用 `CLAUDE_PLUGIN_ROOT` + `scripts/lib/common.sh` 做 plugin 打包定址，模板版是
repo 相對路徑。覆蓋會直接讓 plugin 失效。

## 為什麼不做整批調和

57 檔各自需要逐行判斷，而且方向不一致：

- `commands/athena/loop.md` —— 下游寫「agent 只有 pull 權限、永遠不能 merge」，**上游較新且正確**
  （2026-07-13 使用者授權 auto-merge）。此處該取上游。
- `skills/verification-discipline/SKILL.md` —— 下游獨有「Activation Status」整段（記載
  `STOP_RULE_23_ENABLED=1` 於 2026-07-10 才真正開啟、原 5 天 pilot 自動翻轉從未發生）。此處該留下游。

同一批檔案裡兩個方向都出現，沒有可機械化的規則。這是產品決定，不是同步腳本能表達的。

## 建議的下一步（需人決定）

1. 決定 athena-core 的定位：**它已不是模板的鏡像，而是分岔的姊妹版**。
2. 若要維持單向模型 → 先把下游獨有內容回收進模板，再推平。
3. 若接受分岔 → 把 `make drift-check` 從「閘門」降為「報表」，否則它會永遠是紅的，
   而永遠紅的閘門等於沒有閘門。
