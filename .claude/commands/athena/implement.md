---
description: "(epic) TDD cycle from spec → red → green → refactor. Strict coverage gate."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Context Preloading (1M context)

Before starting TDD, batch-read in parallel (single tool call round):
1. `docs/specs/$ARGUMENTS.md` — the feature spec
2. `docs/context/qa-patterns.md` — patterns to follow proactively
3. All source files listed in the spec's "Implementation Order" section
4. Corresponding test files (if they exist)

Do NOT read files one-by-one — batch all reads in a single parallel call.

# TDD Cycle

RED: write failing tests → GREEN: minimum code → REFACTOR: clean
Then auto-invoke @qa (review + test)
