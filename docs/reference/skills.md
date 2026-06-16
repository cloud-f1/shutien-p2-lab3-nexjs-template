# 技能模組 | Skills

> Skills 是**自動載入的上下文注入器**，當 Agent 處理特定類型的任務時自動啟用。
>
> Skills are auto-loaded context injectors — activated when agents work on specific task types.

---

## 技能一覽 | Overview

| 技能 / Skill | 說明 / Description | 觸發時機 / When Triggered |
|-------------|-------------------|-------------------------|
| `nextjs-saas-patterns` | 本模板的非顯而易見陷阱：Auth.js v5 + JWT、RBAC 從 DB 重讀角色、shadcn blocks、Drizzle seed、Docker、繁中 i18n — Hard-won gotchas for THIS Next.js 16 + Auth.js v5 + Drizzle + shadcn template | 觸碰 auth / login / sessions / RBAC / shadcn blocks / seed / Docker / i18n 時 |
| `next-best-practices` | Next.js 慣例：file conventions、RSC 邊界、data patterns、async APIs、metadata、route handlers、image/font 優化 | 寫 Next.js 頁面 / route handler / data fetching 時 |
| `athena-loop-speedups` | 編排實務：把 serial「跑→錯→猜→重跑」變成快速可靠的 loop。平行 subagent / Workflow / QA / model 選擇 / e2e 加速 | 規劃或執行 epic、fan-out agent、跑 `/athena:flow`·`/athena:batch`·`/athena:loop` 時 |
| `deploy-config` | 設定並執行 production deploy（Road 1 Zeabur 主 / Road 2 GCP Cloud Run + Cloud SQL）：preflight、env 接線、per-road CLI、gotchas | 部署或設定 deploy config 時 |
| `module-author` | 教 agent scaffold 一個合規的 `@saas` 註冊表模組：檔案佈局、`module.manifest.json` 宣告 deps/env/db、Server Action / Route Handler 位置、配對的 `install-*` skill | 建立新 `@saas` 功能模組時 |
| `install-*`（landing / stripe-billing / ecpay-billing） | 將對應的 `@saas/*` 模組安裝進專案：接 env、跑 db migration、驗證 route + action | `npx shadcn@latest add @saas/<module>` 之後 |
| vendor `vercel-*` | Vercel 工程團隊的 React / Next.js 效能與 composition 最佳實務 | 寫 / review / refactor React 元件時 |

> 完整清單：`ls -1d .claude/skills/*/`。

---

## 技能定義檔位置

所有技能定義位於 `.claude/skills/` 目錄。

Skill definitions live in `.claude/skills/`.
