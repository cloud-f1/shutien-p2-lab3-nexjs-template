# AI-Coding-Template — Epic Progress Tracker

> **Purpose**: Machine-readable state for the Epic Loop orchestrator
> **Updated by**: Agent after each step completes
> **Read by**: `/athena:loop` or `SessionStart` to determine next action

---

<!-- PHASE_STATUS_START -->
## Phase Status

| Phase | Epics | Status |
|-------|-------|--------|
| Phase 0 | E0 | ✅ Complete |
| Phase 1 | E1, E2, E3 | ✅ Complete |
| Phase 2 | E4, E5, E6 | ✅ Complete |
| Phase 3 | E7, E8 | ✅ Complete |
| Phase 4 | E9, E10 | ✅ Complete |
| Phase 5 | E12, E13, E14, E15 | ✅ Complete |
| Infra | E11 | ✅ Complete |
| Phase 6 | E16, E17, E18, E19, E20 | ✅ Complete |
| Phase 7 | E21 | ✅ Complete |
| Phase 8 | E22, E23 | ✅ Complete |
| Phase 9 | E24, E25, E26 | ✅ Complete |
| Phase 10 | E27, E28 | ✅ Complete |
| Phase 11 | E29, E30, E31 | ✅ Complete |
| Phase 12 | E32, E33 | ✅ Complete |
| Phase 13 | E34, E35, E36, E37, E38 | ✅ Complete |
| Phase 14 | E39 | ✅ Complete |
| Phase 15 | E40 | ✅ Complete |
| Phase 16 | E41, E42, E43, E44, E45 | ✅ Complete |
| Phase 17 | E46, E47, E48, E49, E50 | ✅ Complete |
| Phase 18 | E51, E52, E53, E54, E55, E56 | ✅ Complete |
| Phase 19 | E57, E58, E59, E60, E61 | ✅ Complete |
| Phase 20 | E62, E63, E64, E65 | ✅ Complete |
| Phase 21 | E66, E67, E68, E69, E70, E71 | ✅ Complete |
| Phase 22 | E72 | ✅ Complete |
| Phase 23 | E73, E74, E75, E76, E77 | ✅ Complete |
| Phase 24 | E78, E79, E80, E81 | ✅ Complete |
| Phase 25 | E82, E83, E84, E85, E86 | ✅ Complete |
| Phase 26 | E87, E88, E89, E90, E91 | ✅ Complete |
| Phase 27 | E92, E93, E94, E95, E96 | ✅ Complete |
| Phase 28 | E97, E98, E99, E100, E101 | ✅ Complete |
| Phase 29 | E102, E103, E104, E105, E106 | ✅ Complete |
| Phase 30 | E107, E108, E109, E110, E111 | ✅ Complete |
| Phase 31 | E112, E113, E114, E115, E116, E117, E118, E119 | ✅ Complete |
| Phase 32 | E120, E121, E122, E123, E124 | ✅ Complete |
| Phase 33 | E125, E126, E127, E128, E129, E130 | ✅ Complete |
| Phase 34 | E131, E132, E133, E134, E135 | ✅ Complete |
| Phase 35 | E136, E137, E138, E139 | ✅ Complete |
| Phase 36 | E140, E141, E142, E143, E144 | ✅ Complete |
| Phase 37 | E145, E146, E147 | ✅ Complete |
| Phase 38 | E148, E149, E150, E151, E152, E153, E154 | ✅ Complete |
| Phase 39 | E155 | ✅ Complete |
| Phase 40 | E156, E157, E158, E159, E160, E161 | ✅ Complete |
| Phase 41 | E162, E163, E164 | ✅ Complete |
| Phase 42 | E165, E166 | ✅ Complete |
| Phase 43 | E167, E168, E169, E170, E171 | ✅ Complete |
| Phase 44 | E172, E173, E174, E175, E176, E177, E178, E179 | ✅ Complete |
| Phase 45 | E180, E181, E182, E183, E184, E185, E186 | ✅ Complete (Memory Mechanism Maturity — Ebbinghaus loop fully wired) |
| Phase 46 | E187, E188, E189, E190, E191, E192 | ✅ Complete (Workflow Discipline + Memory-Aware Planning — brainstorm-first + verification discipline + memory-aware retrieval + consolidation detector + cycle integration + bilingual guide) |
| Phase 47 | E193, E194, E195, E196, E197, E204, E205 | ✅ Complete (Foundation Truth — all 7 epics done: guard-integrity + skill-drift purge + doc-truth + state-file truth + memory-loop closure + pipeline-events + design-system realignment) |
| Phase 48 | E198, E199, E200, E201 | ✅ Complete (Ultracode Orchestration — effort dial + no-silent-caps + Workflow-native qa + Workflow-native batch) |
| Phase 49 | E202, E203 | ✅ Complete (Template↔Plugin Resolution — Path B canonical template + sync + athena-core v0.1.1 hardened) |
| Phase 50 | E206, E207, E208, E209, E210 | ✅ Complete (Operationalize the Dial — ultra judge panel + effort→cost observability + dependency security + athena-core sync v0.2.0 + deploy-skill consolidation) |
| Phase 51 | E211, E212, E213, E214, E215 | ✅ Complete (Stabilize + Phase 2 Foundation — all 5 shipped PRs #195-197/#200-201: athena-saas-profile registry foundation + fork secrets/OWASP + WCAG guides + VRT Phase B 336-matrix + cross-theme a11y matrix; auth `social_providers` server bug fixed en route, #199) |
| Phase 52 | E216 | ✅ Complete (Native Workflow Orchestration — `/athena:flow` interactive native-Workflow epic dispatcher merged via PR#205; completes the E198–E201 line with a budget-enforced, live-tree, no-`claude -p` path; athena-core sync pending) |
<!-- PHASE_STATUS_END -->

<!-- EPIC_MATRIX_START -->
## Epic Step Matrix

<!--
Steps: spec → implement → qa → commit → merge
Status: ⬜ pending | 🔄 in-progress | ✅ done | ⏭️ skip | ❌ failed
Size: S (~1 session) | M (1-2 sessions) | L (2-3 sessions)
Phase 46+ epics: enriched template — epic files include Implementation Phases, Per-Phase Checkpoints, and Test Strategy sections (produced by `scripts/plan/brainstorm-emit.sh render-epic`). E1–E186 epics use the legacy format; backward compat is additive-only.
-->

| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
| E0 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 0 — DONE |
| E1 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — DONE |
| E2 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — DONE |
| E3 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 — DONE |
| E4 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 2 — DONE |
| E5 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 2 — DONE |
| E6 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 2 — DONE |
| E7 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 3 — DONE |
| E8 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 3 — DONE |
| E9 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 4 — DONE |
| E10 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 4 — DONE |
| E11 | ✅ | ✅ | ✅ | ✅ | ✅ | Infra — DONE |
| E12 | ⏭️ | ✅ | ✅ | ✅ | ✅ | Phase 5 — DONE |
| E13 | ⏭️ | ✅ | ✅ | ✅ | ✅ | Phase 5 — DONE |
| E14 | ⏭️ | ✅ | ✅ | ✅ | ✅ | Phase 5 — DONE |
| E15 | ⏭️ | ✅ | ✅ | ✅ | ✅ | Phase 5 — DONE |
| E16 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 6 — DONE (6576056) |
| E17 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 6 — DONE (9f97a8f) |
| E18 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 6 — DONE (657eb0c) |
| E19 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 6 — DONE (4d764e9) |
| E20 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 6 — DONE (a6b46cd) |
| E21 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 7 — DONE (f5c2d94) |
| E22 | ⏭️ | ✅ | ✅ | ✅ | ✅ | Phase 8 — DONE PR#42 (ec31f9b) |
| E23 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 8 — DONE PR#43 (92ab9f0) |
| E24 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 9 — DONE PR#44 (6461b6e) |
| E25 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 9 — DONE PR#45 (ad7d0eb) |
| E26 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 9 — DONE PR#46 (96cf7a0) |
| E27 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 10 — DONE PR#47 (7f8cb08) |
| E28 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 10 — DONE PR#48 (5047721) |
| E29 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 11 — DONE PR#49 (161db4c) |
| E30 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 11 — DONE PR#50 (4a853d0) |
| E31 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 11 — DONE PR#51 (c7597a2) |
| E32 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 12 — DONE PR#52 (ed9a760) |
| E33 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 12 — DONE PR#53 (b8049d3) |
| E34 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 13 — DONE PR#54 (8c2aa83) |
| E35 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 13 — DONE PR#55 (0c29b32) |
| E36 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 13 — DONE PR#56 (e34c05c) |
| E37 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 13 — DONE PR#57 (7194454) |
| E38 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 13 — DONE PR#58 (f36cdd0) |
| E39 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 14 — DONE PR#59 (3e6095b) |
| E40 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 15 — DONE PR#60 |
| E41 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 16 — DONE PR#61 |
| E42 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 16 — DONE PR#63 |
| E43 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 16 — DONE PR#64 |
| E44 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 16 — DONE PR#65 |
| E45 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 16 — DONE PR#62 |
| E46 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 17 — DONE PR#68 (1153e4d) |
| E47 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 17 — DONE PR#69 |
| E48 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 17 — DONE PR#70 |
| E49 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 17 — DONE PR#71 |
| E50 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 17 — DONE PR#72 |
| E51 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 18 — DONE PR#74 |
| E52 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 18 — DONE PR#75 |
| E53 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 18 — DONE PR#76 |
| E54 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 18 — DONE PR#77 |
| E55 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 18 — DONE PR#78 |
| E56 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 18 — DONE PR#79 |
| E57 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 19 — DONE PR#82 |
| E58 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 19 — DONE PR#83 |
| E59 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 19 — DONE PR#84 |
| E60 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 19 — DONE PR#85 |
| E61 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 19 — DONE PR#86 |
| E62 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 20 — DONE PR#87 |
| E63 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 20 — DONE PR#88 |
| E64 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 20 — DONE PR#89 |
| E65 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 20 — DONE PR#90 |
| E66 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 21 — DONE PR#92 |
| E67 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 21 — DONE PR#93 |
| E68 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 21 — DONE PR#94 |
| E69 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 21 — DONE PR#95 |
| E70 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 21 — DONE PR#96 |
| E71 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 21 — DONE PR#97 |
| E72 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 22 — DONE PR#99 (eff624a) |
| E73 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 23 — DONE PR#101 |
| E74 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 23 — DONE PR#102 |
| E75 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 23 — DONE PR#104 |
| E76 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 23 — DONE PR#103 |
| E77 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 23 — DONE PR#105 |
| E78 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 24 — DONE PR#109 |
| E79 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 24 — DONE PR#110 |
| E80 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 24 — DONE PR#111 |
| E81 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 24 — DONE PR#112 |
| E82 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 25 — DONE PR#115 |
| E83 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 25 — DONE PR#116 |
| E84 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 25 — DONE PR#117 |
| E85 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 25 — DONE PR#118 |
| E86 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 25 — DONE PR#119 |
| E87 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 26 — DONE PR#120 |
| E88 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 26 — DONE PR#120 |
| E89 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 26 — DONE PR#120 |
| E90 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 26 — DONE PR#120 |
| E91 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 26 — DONE PR#121 |
| E92 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 27 — DONE PR#122 |
| E93 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 27 — DONE PR#122 |
| E94 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 27 — DONE PR#122 |
| E95 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 27 — DONE PR#123 |
| E96 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 27 — DONE PR#122 |
| E97 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 28 — DONE (bundled with E99) |
| E98 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 28 — DONE |
| E99 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 28 — DONE (23 contract tests) |
| E100 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 28 — DONE (hypothesis + parametrize + factories) |
| E101 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 28 — DONE (QA quality audit) |
| E102 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 29 — DONE |
| E103 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 29 — DONE |
| E104 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 29 — DONE |
| E105 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 29 — DONE |
| E106 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 29 — DONE |
| E107 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 30 — DONE (061b86f) |
| E108 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 30 — DONE (59ce9bc) |
| E109 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 30 — DONE (aa8a608) |
| E110 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 30 — DONE (9909f15) |
| E111 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 30 — DONE (e313d8a) |
| E112 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 31 — DONE (1a93f2f) |
| E113 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 31 — DONE (e0e9c2f) |
| E114 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 31 — DONE (2aba975) |
| E115 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 31 — DONE (9494b60) |
| E116 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 31 — DONE (4929034) |
| E117 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 31 — DONE (9b428bf) |
| E118 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 31 — DONE (92b002f) |
| E119 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 31 — DONE (f8b3779) |
| E120 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 32 — DONE (3f178cf) |
| E121 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 32 — DONE |
| E122 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 32 — DONE (c2f7731) |
| E123 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 32 — DONE (671b2bb) |
| E124 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 32 — DONE |
| E125 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 33 — DONE (fc37b7a) |
| E126 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 33 — DONE (9d5f8e9) |
| E127 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 33 — DONE (23e93f0) |
| E128 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 33 — DONE (abed9c1) |
| E129 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 33 — DONE (d6abb3e) |
| E130 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 33 — DONE (8adafe0) |
| E131 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 34 — DONE (4eda3a8) |
| E132 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 34 — DONE (db19f3d) |
| E133 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 34 — DONE (57b71c6) |
| E134 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 34 — DONE (47ceac4) |
| E135 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 34 — DONE (ee4f54f) |
| E136 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 35 — DONE (b0ea6ca) |
| E137 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 35 — DONE (c86f066) |
| E138 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 35 — DONE (de0538d) |
| E139 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 35 — DONE (c48a11e) |
| E140 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 36 — DONE (e14c63d) |
| E141 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 36 — DONE (f363822) |
| E142 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 36 — DONE (d974f8f) |
| E143 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 36 — DONE (206d5b1) |
| E144 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 36 — DONE (2235583) |
| E145 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 37 — DONE (043bbbe) Context Health Monitor |
| E146 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 37 — DONE (5b88312) Agent Metrics + /athena:metrics |
| E147 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 37 — DONE (08b2122) Evaluator Agent (@evaluator) |
| E148 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 38 — DONE (cf69e04) |
| E149 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 38 — DONE (cf69e04) |
| E150 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 38 — DONE (cf69e04) |
| E151 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 38 — DONE (cf69e04) |
| E152 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 38 — DONE (cf69e04) |
| E153 | ✅ | ✅ | ⏭️ | ✅ | ✅ | Phase 38 — DONE (cf69e04) |
| E154 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 38 — DONE (cf69e04) |
| E155 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 39 — DONE — Stop Verifier Rule #18 QA Gate (8/8 fixture tests pass) |
| E156 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 40 — DONE (PR #130) — schemathesis contract drift detection |
| E157 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 40 — DONE (PR #131) — alembic migration review gate + stop-verifier early-exit fix |
| E158 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 40 — DONE (PR #129) — [GENERALIZABLE] auto-trigger PostToolUse hook |
| E159 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 40 — DONE (PR #135) — Parts 1-4 SRE observability; Part 5 SRE CLI deferred to follow-up |
| E160 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 40 — DONE (PR #132) — context log auto-compact + auto-promotion pipeline |
| E161 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 40 — DONE end-to-end (PR #133 backend + PR #134 client); 11/11 ACs verified; auth tech debt CLOSED |
| E162 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 41 — DONE (PR #136) — iterative reviewer convergence loop, 3 verdicts CONVERGED/STUCK/MAX_REACHED |
| E163 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 41 — Part A DONE (PR #138, sha 0858e92); dogfood AC #7 deferred to Part B (separate dispatch) |
| E164 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 41 — DONE (PR #137) — /athena:autopilot + 4 confidence scorers, all 3 spec fixtures pass exactly |
| E165 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 42 — DONE (PR #139, sha 0869675) — spike 89961d0 themes (rose+forest) + Adding-a-Theme guide; 3 LOW snippet nits non-blocking |
| E166 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 42 — DONE (PR #140, sha e9d5d49) — 3 inline SVG diagrams (agent team / pipeline / stop-verifier); 11-agent + 20-rule ground truth reflected |
| E167 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 43 — DONE (PR #142, 4b4b545) — Tailwind + 8 primitives + Preset axis + 9 dashboard views migrated; 338/338 tests |
| E168 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 43 — DONE (PR #143, 8256f7a) — 9 public primitives + 5 pages migrated; 366/366 tests, coverage 85.91%/87.79% |
| E169 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 43 — DONE (PR #144, 03af616) — 6 auth primitives (4 new + 2 promoted) + 6 pages migrated; legacy pages/auth/components/ removed per spec; 355/355 tests, coverage 88.45%/83.05% |
| E170 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 43 — DONE (PR #145, 3754d21) — 4 page CSS files deleted, AuthLayout.tsx orphan removed, buttons/forms.css trimmed, css-architecture.md rewritten, designer agent + CLAUDE.md updated to primitive-first |
| E171 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 43 — DONE (PR #145, 3754d21) — Phase A smoke matrix shipped: 14-page visual.spec.ts + theme-preset/visual-mask helpers + playwright project config; baselines deferred to first dev-server CI run (Option B); Phase B (336-baseline full matrix) and Phase C (drift policy) deferred to follow-up epic |
| E172 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 44 — DONE (PR #147, ac79d0b) — primitives namespace + 22 EN/zh-TW pairs; 8 primitives migrated; 387/387 tests; coverage 86.28%/82.46% |
| E173 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 44 — DONE (PR #148, 39adaaf) — 7 form primitives shipped (TextInput/TextArea/NumberInput/Select/Checkbox/RadioGroup/Toggle) + .form-toggle* removed from forms.css; 421/421 tests (+34); coverage 89.62%/86.25% |
| E174 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 44 — DONE (PR #149, 3a72de0) — Modal + Drawer + Toast (Provider + useToast hook + Container); reuses useFocusTrap; ToastProvider wired into App.tsx; 445/445 tests (+24); coverage 90.45%/86.82% |
| E175 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 44 — DONE (PR #150, aeb5a2e) — 5 sub-components (DropdownMenu+NavItem in components/ui/, Sidebar+TopBar+UserMenu in components/dashboard/); DashboardLayout.tsx 237→91 lines (-62%); legacy CSS preserved for VRT/e2e/a11y compat (paired-VRT trim deferred); 472/472 tests (+27); coverage 90.67%/86.96% |
| E176 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 44 — DONE (PR #146, b314c6f) — Stop-verifier Rule #21 (no new pages/*.css) + Rule #22 (no new styles/common rules) + scripts/design-system-coverage.sh; 9/9 fixture tests pass; 86% pages compose primitives |
| E177 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 44 — DONE (PR #153, 6671a7a) — Phase 44 closeout. axe-core [a11y] Playwright project (19 tests across 2 specs) + a11y-runner helpers + A11Y_BASELINE.md doc; **0 static violations across all primitives** — upfront ARIA work paid off, no primitive TSX needed editing; baseline capture deferred to first CI run with live dev server (Option B) |
| E178 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 44 — DONE (PR #151, 9dacf50) — 5 layout primitives (Card+Tabs+Stack+Disclosure+Accordion) + bonus CardHeader/CardFooter/HStack/VStack aliases; full ARIA APG keyboard model on Tabs; legacy .c-card* CSS removed; 507/507 tests (+35); coverage 91.51%/86.52% |
| E179 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 44 — DONE (PR #152, 7818c25) — editorialPreset + densePreset + compactPreset extracted to presets/; PRESET_RECIPES.md (265 lines, 6 recipes); preset.ts 1304→1130 lines; circular-import gotcha resolved via barrel-only re-export; 515/515 tests (+8 integrity); coverage 89.46%/84.59% |
| E180 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 45 — DONE (PR #156, 5746e7f) — three retrieval event types append to `.claude/audit.jsonl`; `tier0_loaded` from session-start, `rule_fired` from stop-verifier (22 call sites), `agent_cited` from subagent-stop-writeback; `rule-to-lesson.json` ships with 13 mappings; 9 fixture tests green |
| E181 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 45 — DONE (PR #162, fdc9bb8) — `scripts/memory/{score.sh,migrate-strength.sh}`; 5 subcommands (get/reinforce/decay/decay-all/flag-weak); 3 hook chains (best-effort \|\| true); /athena:save runs decay-all post-checkpoint; /athena:learn Step 3.8 surfaces flag-weak; 18/18 fixture tests + 36 regression = 54/54 green |
| E182 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 45 — DONE (PR #163, 62fa276) — `scripts/memory/{inject.sh,match.sh,lesson-tags.json}`; Block A in session-start.sh preserved byte-identical, Block B added (best-effort `\|\| true`); ranks lessons by branch+path+tag cue, sources E181 score.sh get for tie-break; sidecar substitutes for Tier 0 frontmatter (per "do NOT mutate ~/.claude/template-memory" constraint); 15/15 fixture tests + 46 regression = 61/61 green |
| E183 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 45 — DONE (PR #164, 4714477) — `scripts/memory/promotion-follow-through.sh` (read-only); flags Tier 0 lessons promoted ≥30d ago with zero retrieval signals across all 3 E180 event types; markdown + JSON output; `/athena:learn` Step 4.5 wiring; 17/17 fixture tests + 54 regression = 71/71 green |
| E184 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 45 — DONE (PR #165, 5d86999) — `scripts/memory/forget.sh` (548 lines, atomic mv only) + `.claude/commands/athena/forget.md`; subcommands apply/dry-run/revive/list-archived; deletes lesson-tags.json sidecar entry on archive (E182 followup); audit events `lesson_archived` + `lesson_revived` for E186; safety verified by SHA256 snapshot (no real Tier 0 mutation); 16/16 fixture tests + 59 regression = 75/75 green |
| E185 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 45 — DONE (PR #157, 18e94e5) — `scripts/memory/{half-life-defaults.json,half-life-resolve.sh,backfill-half-life.sh}`; `@memory-curator` agent prompt + `/athena:promote` updated; one-time backfill applied to 8 Tier 0 files (idempotent); 12 fixture tests green |
| E186 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 45 — DONE (PR #166, 861e800) — `scripts/memory/metrics.sh` (491 lines, read-only); 7-section dashboard wired into `/athena:metrics --memory`: top-N retrieved + strength histogram + citation map + archive churn + strength activity + inject hit-rate (Block A vs B) + premature-promotion count; lesson_archived/lesson_revived schemas added to scripts/hooks/CLAUDE.md (E184 followup); 12/12 fixture tests + 87 regression = 99/99 green; real-audit smoke clean |
| E187 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 46 — DONE (PR #169, f10fbab) — `/athena:plan brainstorm` sub-mode; `brainstorm-emit.sh` harness + `@strategist` Brainstorm Mode; 7 fixture tests (8 assertions) green |
| E188 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 46 — DONE (PR #170, b882a7b) — Stop Rule #23 + verification-discipline.md skill + audit-emit-verification.sh; 19 fixture tests green |
| E189 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 46 — DONE (PR #173) — `brainstorm-retrieve.sh` + Step 0 in @strategist; 11 tests; Tier 0/1 retrieval at brainstorm start |
| E190 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 46 — DONE (PR #171, 45bef5c) — consolidation-detect.sh; Jaccard+cosine; 12 fixture tests; Step 4.6 in learn.md; 0 false positives on real Tier 0 |
| E191 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 46 — DONE (PR #174) — `/athena:cycle` brainstorm-first; CLAUDE.md + loop.md + EPIC_INDEX legend; promotion proposal seeded |
| E192 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 46 — DONE (PR #172) — Bilingual user guide (`docs/guides/{en,zh-TW}/brainstorm-first.md`) + learning-path + README updates. Per CLAUDE.md user preference: 使用者文件繁體中文 |
| E193 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 47 — DONE PR#180 — pipeline-boundary event instrumentation |
| E194 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 47 — DONE PR#176 — auto-injected skill drift purge |
| E195 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 47 — DONE PR#181 — generator + design-system realignment |
| E196 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 47 — DONE PR#178 — state-file truth (EPIC_INDEX ← epic-progress) |
| E197 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 47 — DONE PR#179 — memory loop closure |
| E198 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 48 — DONE PR#182 — effort dial foundation (resolve.sh + model-tier) |
| E199 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 48 — DONE PR#183 — no-silent-caps audit + /metrics --effort |
| E200 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 48 — DONE PR#184 — Workflow-native /athena:qa verification panel (POC) |
| E201 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 48 — DONE PR#185 — Workflow-native /athena:batch pipeline dispatch |
| E202 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 49 — DONE PR#186 — template↔plugin Path B: canonical template + sync |
| E203 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 49 — DONE (athena-core 5b07880) — v0.1.1 hardening: registry-read + version-sync + repo identity |
| E204 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 47 — DONE — is_epic_branch() shared matcher fixes Rule 18/19/20 fail-open on MH/feat/E{n}; fail-open canary + `make guard-selftest` (TDD red→green: canary 8/8, rule suites pass). Direct-to-main; push pending |
| E205 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 47 — DONE PR#177 — doc-truth reconciliation (docs match disk) |
| E206 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 50 — DONE PR#188 — ultra-tier judge panel (double-evaluator + N=3 spec-judge; 35/35 tests) |
| E207 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 50 — DONE PR#189 — effort→cost observability (effort_resolved enriched + cost-proxy dashboard) |
| E208 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 50 — DONE PR#190 — axios 1.13.6→1.16.1; pnpm audit --prod: No known vulnerabilities |
| E209 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 50 — DONE PR#191 — athena-core sync applied (65 files), v0.2.0 tagged, drift=0 |
| E210 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 50 — DONE PR#192 — deploy-readiness.md consolidated, fork-safety gating, tombstones |
| E211 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 51 — DONE PR#200 — VRT Phase B 336-cell matrix infra + bridge + 繁中 runbook; 339 baselines captured against a live backend session + verified stable (NOT committed — *.png gitignore + fork-specific). Unblocked by social_providers server fix (#199) |
| E212 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 51 — DONE PR#201 — cross-theme a11y matrix (12 cells × 14 pages) + axe-blind interaction sweep; 203/203 tests, 0 violations; ~20 contrast/aria fixes at token/primitive level (no disableRules); QA PASS (515 unit tests green); closes E177.b |
| E213 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 51 — DONE PR#195 — athena-saas-profile sibling repo (registry install.sh, SHIPPED .profiles[].root contract, 9-case install smoke + real-core roundtrip, tagged v0.1.0-alpha); QA PASS |
| E214 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 51 — DONE PR#196 — fork secrets-setup + OWASP Top 10 guide (bilingual EN+繁中, citations copy-verified); QA PASS |
| E215 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 51 — DONE PR#197 — WCAG AA extension guide for custom domains (bilingual EN+繁中, real matrix-edit recipe); QA PASS |
| E216 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 52 — DONE PR#205 (squash auto-merge) — `/athena:flow` interactive native-Workflow dispatcher (spec→implement→qa→commit, no `claude -p`); 20/20 fixture test, e201 regression 14/14; **adversarially validated — 3 bugs fixed** (wave truncation, cross-agent worktree stranding, blocked mis-mark); spec+plan in docs/superpowers/; athena-core sync (sync-to-plugin.sh --apply) pending |
<!-- EPIC_MATRIX_END -->

## Dependency Rules

```
E78: no deps
E79: E78
E80: E78
E81: E78, E80

# Phase 25 — AI Agent Team & Webhook Improvement
# Plan: docs/reference/agent-webhook-improvement-plan.md (COMPLETED)
E82: no deps
E83: no deps
E84: no deps
E85: E84
E86: E84, E82

# Phase 26 — Agent Specialization & Pipeline Observability
# Plan: docs/reference/parallel-pipeline-strategy.md (COMPLETED)
E87: no deps
E88: no deps
E89: no deps
E90: no deps
E91: E88

# Phase 27 — Documentation Enrichment for Beginners
E92: no deps
E93: no deps
E94: no deps
E95: E92
E96: no deps

# Phase 28 — Testing Mastery (from test-master.md principles)
E97: no deps
E98: no deps
E99: no deps
E100: E97
E101: E97, E98

# Phase 29 — Production Readiness & Template Polish
E102: no deps
E103: no deps
E104: E103
E105: no deps
E106: E103

# Phase 30 — Docker DevOps Maturity
# Learned from: ai-casino-shift + ai-finance-management sibling projects
E107: no deps
E108: E107
E109: E107, E108
E110: no deps
E111: E107

# Phase 31 — Integration Integrity Shield
# Learned from: ai-casino-shift E156–E167 (coverage paradox, nav gap, CSS drift)
E112: no deps
E113: no deps
E114: E112, E113
E115: E112
E116: no deps
E117: no deps
E118: no deps
E119: no deps

# Phase 32 — Two-Way Deploy (Zeabur + Cloud Run)
E120: no deps
E121: E120, E122
E122: no deps
E123: E120, E121
E124: E120, E121, E122, E123

# Phase 33 — Testing & CI Hardening (Cross-Project Wisdom)
# Sources: ShiftFlow, Hades, Finance, Chronos, Shuttle (484+ epics audited)
E125: no deps
E126: no deps
E127: no deps
E128: E127
E129: no deps
E130: no deps

# Phase 34 — Structured Logging & Error Standards
E131: no deps
E132: no deps
E133: no deps
E134: E129
E135: no deps

# Phase 35 — Backend Resilience Patterns
E136: no deps
E137: no deps
E138: no deps
E139: E137

# Phase 36 — Frontend, Tooling & Deploy Maturity
E140: no deps
E141: no deps
E142: E131
E143: no deps
E144: no deps

# Phase 37 — Harness Engineering: Observability & Evaluation
E145: no deps
E146: E145
E147: E146

# Phase 38 — Cross-Project Extraction (Casino-Shift)
E148: no deps
E149: no deps
E150: no deps
E151: no deps
E152: E151
E153: E148
E154: no deps

# Phase 39 — Hardening: QA Gate Enforcement
E155: no deps

# Phase 40 — Self-Review Improvements (2026-04-24)
# Source: self-review of template after 156 epics; all independent, all parallel-safe
E156: no deps
E157: no deps
E158: no deps
E159: no deps
E160: no deps (soft-depends on E158 for promotion-proposals/ format; lands independently)
E161: no deps

# Phase 41 — AI-First Integration (industry signals 2026-04-24: OpenMythos/RDT, Claude Design, Drafted)
E162: no deps
E163: no deps
E164: E162   # autopilot uses convergence signal as a confidence input

# Phase 42 — Visual Enrichment (Claude Design spike follow-up)
E165: no deps
E166: no deps

# Phase 43 — Universal Design System Adoption (PR #142 landed E167 retrospective)
# Goal: one framework for landing + auth + dashboard + legal + 404 so a fork
# can rebrand the whole app in one step (`setActivePreset(brand)` + `data-theme`).
E167: no deps                    # foundation: Tailwind + 8 primitives + Preset axis (DONE in PR #142)
E168: E167                       # public surface migration (LandingPage / GettingStarted / Legal / 404)
E169: E167                       # auth surface migration (6 auth pages + AuthLayout/AuthCard)
E170: E167, E168, E169           # legacy CSS deletion + css-architecture.md rewrite
E171: E167, E168, E169           # Playwright VRT — lock in after migrations stabilize

# Phase 44 — Design System Completion & Validation
# Goal: close every gap that prevents "validate everything" — bilingual chrome,
# full form library, overlays, chrome decomposition, mechanized enforcement,
# proven a11y, layout primitives, working brand examples.
E172: E167                       # i18n primitive-internal strings (parallel-safe with rest of Phase 44)
E173: E167                       # form primitives expansion (parallel-safe)
E174: E167                       # modal/drawer/toast (parallel-safe; soft-shares portal logic with E175)
E175: E167                       # DashboardLayout decomposition (parallel-safe)
E176: E167                       # enforcement rules (parallel-safe; uses legacy-allowed annotation pre-E170)
E177: E167, E168, E169, E173, E174, E175  # a11y sweep — last; needs every surface stable
E178: E167                       # layout primitive trio (parallel-safe)
E179: E167                       # brand preset starter pack (parallel-safe; updates on new slots from E173-E175+E178)

# Phase 45 — Memory Mechanism Maturity (Ebbinghaus model)
# Goal: close the retrieve/reinforce/decay loop on the Tier 0 memory pipeline.
# E180 is the foundation — every other epic reads its retrieval log.
E180: no deps                    # retrieval logging — emits .claude/retrieval.jsonl
E181: E180                       # strength score — reads retrieval events, decays over time
E182: E180, E181                 # selective inject — uses tags/domains; tie-breaks on strength
E183: E180                       # promotion follow-through — flags 30d-stale promotions
E184: E181                       # /athena:forget — archives below strength threshold
E185: no deps                    # half-life metadata at promotion — parallel-safe with E180/E181
E186: E180                       # metrics dashboard — read-only over the retrieval log + frontmatter

# Phase 46 — Workflow Discipline + Memory-Aware Planning
# Goal: graft 3 obra/superpowers patterns (brainstorming, writing-plans, verification) into athena namespace.
# 11 other superpowers skills skipped — athena equivalents already exist (TDD/batch/worktrees/debugger/loop/reviewer/ship).
# See docs/superpowers/specs/2026-05-18-athena-phase-46-roadmap.md §10 Appendix A.
E187: no deps                    # /athena:plan brainstorm sub-mode + enriched epic file template (foundation)
E188: no deps                    # verification discipline skill + Stop Rule #23 (independent of E187)
E189: E187                       # memory-aware planning — @strategist reads Tier 0/1 during brainstorm
E190: no deps                    # lesson consolidation detector — read-only Jaccard+cosine pairs
E191: E187, E188, E189           # cycle integration — wires brainstorm-first into /athena:cycle + docs (closeout)
E192: no deps                    # bilingual user guide — docs/guides/{en,zh-TW}/brainstorm-first.md (Cycle 20 addendum)

# Phase 47 — Foundation Truth (2-workflow enhancement audit, Cycle 21)
# (inline # comments omitted — the epic-graph.sh parser glues them onto the last dep token; see E196)
E193: no deps
E194: no deps
E195: E194
E196: no deps
E197: no deps
E204: no deps
E205: no deps

# Phase 48 — Ultracode Orchestration (effort/cost dial + Workflow-native qa/batch)
E198: E193
E199: E193, E198
E200: E198
E201: E198, E200

# Phase 49 — Template↔Plugin Resolution
E202: no deps
E203: E202
```

## Phase Parallelism

```
Phase 24: E78 → E79 + E80 (parallel after E78) → E81
Phase 25: E82 + E83 + E84 (all parallel, no deps) → E85 + E86 (parallel after E84, E86 also after E82)
Phase 26: E87 + E88 + E89 + E90 (all parallel) → E91 (after E88)
Phase 27: E92 + E93 + E94 + E96 (all parallel, no deps) → E95 (after E92)
Phase 28: E97 + E98 + E99 (all parallel, no deps) → E100 (after E97) → E101 (after E97 + E98)
Phase 29: E102 + E103 + E105 (all parallel, no deps) → E104 + E106 (after E103)
Phase 30: E107 + E110 (parallel, no deps) → E108 (after E107) → E109 + E111 (parallel after E107+E108)
Phase 31: E112 + E113 + E116 + E117 + E118 + E119 (all parallel, no deps) → E114 + E115 (parallel after E112+E113)
Phase 32: E120 + E122 (parallel, no deps) → E121 (after E120+E122) → E123 (after E120+E121) → E124 (after all)
Phase 33: E125 + E126 + E127 + E129 + E130 (all parallel, no deps) → E128 (after E127)
Phase 34: E131 + E132 + E133 + E135 (all parallel, no deps) → E134 (after E129)
Phase 35: E136 + E137 + E138 (all parallel, no deps) → E139 (after E137)
Phase 36: E140 + E141 + E143 + E144 (all parallel, no deps) → E142 (after E131)
Phase 37: E145 (no deps) → E146 (after E145) → E147 (after E146)
Phase 38: E148 + E149 + E150 + E151 + E154 (all parallel, no deps) → E152 (after E151) + E153 (after E148, parallel)
Phase 39: E155 (standalone, no deps)
Phase 40: E156 + E157 + E158 + E159 + E160 + E161 (all parallel, no deps — ideal `/athena:batch` wave)
Phase 41: E162 + E163 (parallel, no deps) → E164 (after E162)
Phase 42: E165 + E166 (parallel, no deps)
Phase 43: E167 (already done) → E168 + E169 (parallel after E167) → E170 + E171 (parallel after E168 + E169)
Phase 44: 7 epics parallel after E167 (E172 + E173 + E174 + E175 + E176 + E178 + E179) → E177 (after the 7 stabilize) — ideal `/athena:batch --phase 44` wave
Phase 45: E180 + E185 (parallel, no deps) → E181 + E183 + E186 (parallel after E180) + E182 (after E180+E181) → E184 (after E181)
Phase 46: E187 + E188 + E190 + E192 (parallel, no deps) → E189 (after E187) → E191 (after E187+E188+E189) — ideal `/athena:batch auto` first wave (4-epic parallel)
```

---

**Next Action:** Phase 47 in progress (Cycle 21, 2026-05-30) — 7 epics, 69 SP. E204 ✅ done (guard-integrity). Push the pending commits first, then run `/loop 2m /athena:batch auto` to dispatch Wave 1 (E193 + E194 + E196 + E197 + E205 — 5 parallel, no deps) → Wave 2 (E195). ⚠️ batch does `git reset --hard origin/main` — push local commits before running it.

- **Phase 43 (Universal Adoption)** — E167 already landed in PR #142 (Tailwind + 8 primitives + Preset axis + 9 dashboard views migrated). Remaining: `/athena:batch --phase 43` will dispatch E168 (public) + E169 (auth) in parallel after E167's PR merges; E170 (cleanup) + E171 (Playwright VRT) follow as a second wave.
- **Phase 44 (Completion & Validation)** — 8 epics. After Phase 43's PRs merge: `/athena:batch --phase 44` dispatches the 7-epic parallel wave (E172 + E173 + E174 + E175 + E176 + E178 + E179). Then E177 (a11y sweep) closes the phase once every surface is stable.
- **Phase 42** residual: `/athena:qa` on E165 to close the spike, then `/athena:spec E166` for the talk-deck diagrams.
- **Phase 40 / 41** remain in `🔄` (commits landed, merges pending) — not blocking Phases 43/44.

---

## Epic Naming Convention

```
E{number} — {Short Name}
Branch: MH/feat/E{number}-{slug}
Commit: feat(E{number}): {description}
```

## File Organization

- `docs/epics/EPIC_INDEX.md` — master tracker (state + catalog)
- `docs/epics/e{n}-{slug}.md` — detailed spec per epic (created during `spec` step)
- `docs/context/epic-progress.md` — lightweight state file (IDs + status only, read by loop)
- `docs/roadmap.md` — high-level product vision (NOT execution tracking)
- `docs/context/session-summary.md` — session resume point (references current epic)
