# E341 — doc↔code 常數契約測試（把散文釘在程式碼上）

> Phase 82 · feature/test-infra · Cycle 36（fork harvest wave 3 — ai-rc-engineer-pm，2026-08-22）
> Status: ⬜ pending
> Depends: none

## Problem

`/athena:audit` 的 Step 6a 已經有「doc↔code 常數漂移」這個檢查項（E319 backport 進來的），
但它是**由 agent 逐次人工比對**——跑不跑、比不比得完整，全看那次 agent 的耐心。CI 擋不住。

模板現在有一批**同時寫在文件散文與程式碼裡**的常數，只要其中一邊改了，另一邊會靜默腐爛：

| 常數 | 程式碼源 | 文件複述處 |
|---|---|---|
| Effort tier 四階數值 | `scripts/effort/resolve.sh` | `CLAUDE.md` 的 Effort Tiers 表格 |
| RBAC 能力矩陣 | `next-app/lib/team-utils.ts` `CAPABILITIES` / `PERMISSION_MATRIX` | 權限說明文件 + `/dashboard/admin` 矩陣 UI |
| 角色清單 | `lib/schema` 的 `Role` | CLAUDE.md、seed 說明、user guide |
| 方案與價格 | `lib/billing/plans.ts` + `config/pricing.json` | 行銷頁文案、方案說明文件 |
| 狀態語意色 | `components/status-badge.tsx` `TONES` | design-system skill 的 tone 清單 |

fork 用一支 `lib/doc-contract.test.ts` 把這些值釘住：測試失敗 = 文件與程式碼已分歧，
**必須兩邊一起修**。這比「叫 agent 記得檢查」可靠一個數量級。

## Solution

1. **`next-app/lib/doc-contract.test.ts`** — 一支測試檔，每個 `describe` 對應一組被文件複述的常數。
   檔頭註解寫明契約本身（照 fork 的寫法）：
   > 這支測試把**文件裡的散文數值**釘在**程式碼常數**上。散文無法被型別檢查，所以會靜默腐爛。
   > 測試 FAIL = 兩者已分歧 → **同時修程式碼常數與複述它的文件**，不要只改一邊讓測試變綠。
   每個斷言旁註明**文件出處**（檔案 + 章節），讓修的人知道要去改哪一頁。
2. **首批契約**（不求全，求真的會漂的那幾組）：
   - **Effort tiers**：讀 `scripts/effort/resolve.sh`（以子行程或解析文字）取四階的
     `MAX_CONCURRENT` / `MAX_ITERATIONS` / `REVIEW_LOOP_BUDGET` / `AUTOPILOT_THRESHOLD`，
     對照 CLAUDE.md 表格中記載的值（`quick 1/1/15000/0.80`、`standard 4/4/50000/0.85`、
     `thorough 4/6/150000/0.90`、`ultra …/8/500000/0.95`）。
   - **RBAC 矩陣**：`CAPABILITIES` 的 key 集合與 `PERMISSION_MATRIX` 的 role×capability 真值表逐格斷言；
     並斷言 `PERMISSION_MATRIX` 的 role 鍵集合 === `Role` 型別的全體（新增角色時強迫補矩陣）。
   - **方案價格**：`plans.ts` / `config/pricing.json` 的方案 slug、價格、幣別與行銷頁引用一致；
     `usage-utils` 的 UNLIMITED 慣例（未設限 = 無限）成立。
   - **狀態 tone**：`StatusBadge` 的 `TONES` 鍵集合 === design-system skill 所列 tone 清單。
3. **接線**：
   - 這支測試跟著 `pnpm test` 跑（不需額外設定），確保 `make verify` / `pre-merge-check.sh` 天然涵蓋。
   - `/athena:audit` 的 Step 6a 改寫：先跑 `pnpm test doc-contract`，**測試通過的部分不再人工比對**，
     agent 只負責測試涵蓋不到的散文（流程描述、截圖、範例指令）。
   - `docs/context/qa-patterns.md` 記一則「doc↔code 契約測試」模式，說明何時該加一條新契約
     （判準：這個數值被文件用散文複述過，且改動它不會讓任何既有測試變紅）。
   - `testing-strategy` skill 補一小節（屬於測試金字塔哪一層、為何不是 e2e）。

## Key Files
- `next-app/lib/doc-contract.test.ts`（新）
- `.claude/commands/athena/audit.md`（Step 6a 改寫）
- `docs/context/qa-patterns.md` · `.claude/skills/testing-strategy/SKILL.md`

## Acceptance Criteria
- [ ] `pnpm test doc-contract` 通過；**故意改壞任一常數會讓它變紅**（在 PR 描述或 commit 訊息中留下這次驗證的證據）
- [ ] 四組契約全部落地（effort tiers · RBAC 矩陣 · 方案價格 · 狀態 tone）
- [ ] 每條斷言旁標註文件出處（檔案 + 章節），修的人不用自己找
- [ ] `PERMISSION_MATRIX` 的 role 鍵集合與 `Role` 型別同步的守衛存在（新增角色會紅）
- [ ] `/athena:audit` Step 6a 已改為「先跑測試、只人工比對測試涵蓋不到的部分」
- [ ] `make verify` 涵蓋此測試（不需新增 script）
- [ ] typecheck / lint / unit 綠

## Cross-Epic
- E319 — `/athena:audit` Step 6 doc↔code 檢查是本 epic 的前身，本 epic 把它從散文變成可執行
- E198 — effort tier 數值來源
- E262 — StatusBadge tone 清單

## Out of Scope
- 反向產生文件（不做 docs generation，文件仍是人寫的散文）
- 把所有常數都納入契約（只釘真的被文件複述、且改了不會讓既有測試變紅的那些）
