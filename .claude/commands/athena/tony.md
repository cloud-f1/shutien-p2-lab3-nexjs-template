# /athena:tony — TONY Chief-of-Staff

> One-window entry point. State a goal in plain language — TONY routes it to the right teammate.

## Usage

```
/athena:tony <goal>
```

Examples:
- `/athena:tony I want to add a new billing module`
- `/athena:tony this login error keeps happening in prod`
- `/athena:tony review the auth changes I just pushed`
- `/athena:tony deploy to staging`
- `/athena:tony what should we build next?`

## How It Works

TONY is the chief-of-staff persona that lives in the `.claude/skills/chief-of-staff/` skill.

When you invoke `/athena:tony`, TONY:

1. **Decomposes the goal** into intent, urgency, and scope
2. **Routes to the right teammate** from the 12-agent roster
3. **Translates** the goal into the matching `/athena:*` command or agent invocation
4. **Reports back** with what was dispatched and why

## Routing Table (summary)

| Goal type | TONY routes to |
|---|---|
| "add feature / design spec" | PENNY → `/athena:spec` |
| "build / implement" | JUDE → `/athena:implement` |
| "review code / security" | ARGUS → `/athena:qa --review-only` |
| "run tests / coverage" | QUINN → `/athena:qa --test-only` |
| "deploy" | PORTER → `/athena:deploy` |
| "this is broken / debug" | DOC → auto-delegated |
| "architecture question" | SAGE → Q&A |
| "what should we build?" | ATLAS → `/athena:plan` |
| "run the pipeline" | MAX → `/athena:batch auto` |
| "DB / migration" | DELTA → `/athena:dba` |
| "UI design → code" | VERA → `/athena:design` |
| "remember this / promote" | REMI → `/athena:promote` |

See `docs/reference/agent-org-chart.md` for the full table and `docs/reference/agent-team.html` for a visual card view.

## Implementation

Load the `chief-of-staff` skill and follow its routing protocol:

```
Skill: chief-of-staff
Input: <goal from user>
```

The skill handles intent classification, teammate selection, and handoff.
