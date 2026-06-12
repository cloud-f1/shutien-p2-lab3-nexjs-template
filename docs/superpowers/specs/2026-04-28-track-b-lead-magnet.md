---
title: "Track B Lead Magnet Strategy (template-side spec)"
status: "approved"
version: "1.0"
created_at: "2026-04-28"
updated_at: "2026-04-28"
linked_to: "../../../../content-asset-system/docs/superpowers/specs/2026-04-28-claude-4-tracks-refactor-design.md"
---

# Track B Lead Magnet Strategy — `ai-coding-template` 的角色

## 為什麼這 repo 是 Track B 模組包的 lead magnet

Track B 5 模組（B1-B5）需要 reference codebase 給學員看 P1-P6 原理的具體 implementation。本 repo 是**最完整的 reference**，因為：

1. 11 agents + 21+ commands + 8+ skills 是 P6 (Skills+Plugins+Sub-agents 三位一體) 的 production-grade 實作
2. CLAUDE.md + `.claude/` 完整結構是 P3 (CLAUDE.md as .gitignore) 的範例
3. Epic-driven development (Phase 40+ active) 是 P5 (Plan-Code-Verify) 的工程實踐
4. SaaS feature build pattern 是 B3 (SaaS Ship Loop) 的具體展現

## Lead magnet → paid 路線

```
GitHub repo discovery (organic / SEO / 朋友推薦)
    ↓
fork + 跑 make init + 看 dashboard
    ↓ ~30%
讀 docs/zh-tw/getting-started.md → docs/zh-tw/track-b-integration.md
    ↓ ~5-10%
連到 Skool 工程師圈
    ↓ ~5-15% (founding 50 sell-through 為基準)
購買 Track B 模組包 NT$6,800 / 9,800
    ↓ ~5-15%
升級陪跑制 NT$50-80K/月
```

## 不能改的東西

未來 maintainer 改 README 時，**不能刪除**：

- §「給 Track B 模組包學員」整段（lead magnet 入口）
- Skool 工程師圈 link（除非 URL 改變要 update link）
- Star / Track B 模組包 badges
- `docs/zh-tw/getting-started.md` 的「Step 6 Track B 學員下一步」段
- `docs/zh-tw/track-b-integration.md` 整個檔（B1-B5 對應 navigation）
- CLAUDE.md 的「Fork 後客製化提示」段

刪這些等於切斷 lead magnet。

## 可以改的東西

- 介紹文案 wording（保留 link 即可）
- Track B 模組包定價（根據 v1 定價變動更新）
- Cross-cutting principles 列表（如新增 P7+ 加進去）
- 課程模組對應細節（隨 module 內容更新調整）

## Repo 自身演化的邊界

本 repo 是 active dev（最新 Phase 40-42）。Lead magnet 不應拖慢核心 dev：

- README 主體仍以 repo 自身價值為主（SaaS starter）
- Track B section 是 **附加** 不是替代
- 未來如 Track B 結束（不太可能但 hypothetically），lead magnet section 可移到 docs/legacy/ 不影響核心

## URLs（待 sales page 上線時 update）

目前 placeholder：

- Skool 工程師圈：https://www.skool.com/ai-brain-alex/about?ref=5dde9b20e8e7432aa9a01df6e89685f4 ✅（已用正確 referral）
- Track B sales page：暫用 Skool URL（Bundle 4 sales page 上線後 update）
- 陪跑制詢問表單：暫無，由 Skool 私訊或 Alex email 接

當 Bundle 4（content-asset-system Plan 4 §Phase 5-8）sales page + 詢問表單 live 後：

- README §「給 Track B 模組包學員」 link update
- `docs/zh-tw/getting-started.md` Step 6 link update
- `docs/zh-tw/track-b-integration.md` 「不在這 repo 的東西」段 update

## 變更紀錄

| 版本 | 日期 | 變更內容 |
|---|---|---|
| 1.0 | 2026-04-28 | 初版（Track B Bundle 2 釋出，鎖定 lead magnet 角色）|
