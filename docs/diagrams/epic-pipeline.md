# Epic 開發流程圖

> 本專案採用 Epic 驅動開發，每個功能嚴格遵循五步驟流水線。
> 使用 `/athena:loop` 指令每次推進一步。

---

## 主流程

```mermaid
graph LR
    SPEC["1. 規格設計<br/>spec"]
    IMPL["2. 實作<br/>implement"]
    QA["3. 品質閘門<br/>qa"]
    COMMIT["4. 提交<br/>commit"]
    MERGE["5. 合併<br/>merge"]

    SPEC -->|"/athena:spec → /athena:implement"| IMPL
    IMPL -->|"/athena:qa"| QA
    QA -->|"coverage ≥ 80%"| COMMIT
    COMMIT -->|"/athena:ship 或 /athena:pr"| MERGE

    QA -->|"coverage < 80%"| IMPL

    SPEC -.- SW["@spec-writer"]
    IMPL -.- MAIN["主 agent"]
    QA -.- QAA["@qa"]
    COMMIT -.- MAIN2["主 agent"]
    MERGE -.- MAIN3["主 agent"]

    style SPEC fill:#4a9eff,color:#fff
    style IMPL fill:#f59e0b,color:#fff
    style QA fill:#ef4444,color:#fff
    style COMMIT fill:#22c55e,color:#fff
    style MERGE fill:#8b5cf6,color:#fff
```

## SDD 子流程（在 spec 步驟內）

```mermaid
graph LR
    OA["openapi.yaml<br/>規格先行"]
    SC["Server 程式碼"]
    CC["Client 程式碼"]

    OA -->|"型別衍生"| SC
    SC -->|"API 契約"| CC

    style OA fill:#4a9eff,color:#fff
```

> **SDD（Spec-Driven Development）**：永遠先編輯 `docs/openapi.yaml`，再撰寫 server/client 程式碼。
> OpenAPI 為所有型別的唯一真實來源（Single Source of Truth）。

## TDD 子流程（在 implement 步驟內）

```mermaid
graph LR
    RED["RED<br/>寫失敗測試"]
    GREEN["GREEN<br/>寫最少程式碼通過"]
    REFACTOR["REFACTOR<br/>重構"]

    RED --> GREEN --> REFACTOR --> RED

    style RED fill:#ef4444,color:#fff
    style GREEN fill:#22c55e,color:#fff
    style REFACTOR fill:#f59e0b,color:#fff
```

## QA 閘門邏輯

```mermaid
graph TD
    RUN["執行測試套件"]
    CHECK{"coverage ≥ 80%?"}
    PASS["通過 — 進入 commit"]
    FAIL["失敗 — 回到 implement"]
    REVIEW["安全審查 + 程式碼審閱"]

    RUN --> REVIEW --> CHECK
    CHECK -->|是| PASS
    CHECK -->|否| FAIL

    style PASS fill:#22c55e,color:#fff
    style FAIL fill:#ef4444,color:#fff
```

## Phase 邊界

當一個 Phase 內所有 Epic 完成時，流程會暫停並回報：

- 總結已完成的 Epic 清單
- 更新 `docs/epics/EPIC_INDEX.md` 狀態
- 等待人工確認後才進入下一個 Phase

## 流程大原則

1. **一次推進一步** — `/athena:loop` 每次只執行一個步驟
2. **永不跳過 QA** — coverage 低於 80% 會被閘門擋住
3. **失敗時回退** — QA 不通過則回到 implement 步驟修復
4. **Phase 邊界暫停** — 所有 epic 完成才進入下一階段
