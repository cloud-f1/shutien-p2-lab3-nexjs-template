# Custom Agents

You can add your own Claude Code agents to the @saas template's agent team.

## File Format

Agents live in `.claude/agents/` as Markdown files with YAML frontmatter:

```markdown
---
name: my-agent
description: One-line description for the orchestrator to understand when to delegate
model: claude-sonnet-4-5
tools:
  - Read
  - Write
  - Bash
  - Edit
---

# My Agent

Your agent's instructions go here. Be specific about:
- What tasks this agent handles
- What output format it produces
- How it signals completion
```

## Example: Domain Expert Agent

```markdown
---
name: domain-expert
description: Expert in domain-driven design patterns for the @saas template
model: claude-sonnet-4-5
tools:
  - Read
  - Bash
---

# Domain Expert

You are a DDD expert for the @saas template. When asked to design a new domain:

1. Read existing domains in next-app/registry/ for conventions
2. Propose schema tables in Drizzle format
3. Define Server Action signatures
4. Sketch the route structure
5. Identify RBAC requirements

Output a structured design document.
```

## Registering an Agent

Save the file in `.claude/agents/my-agent.md`. Claude Code auto-discovers agents in that directory.

To invoke explicitly:
```
@my-agent — describe the task
```

## Best Practices

- Keep agent scope narrow — one agent per concern
- Define clear input/output contracts
- Reference specific files for conventions (e.g., "read registry/landing/ for module patterns")
- Use `description:` to help the orchestrator delegate correctly
- Pair each agent with a corresponding `/athena:*` command if it has a repeatable workflow
