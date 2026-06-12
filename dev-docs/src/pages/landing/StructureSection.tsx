import { SectionLabel } from "./SectionLabel";
import { CodeBlock } from "../../ui/CodeBlock";

const FILE_TREE = `CLAUDE.md                    # session identity
TECHSTACK.md                 # upload = full context

docs/
  openapi.yaml               # source of all types
  context/                   # agent write-backs
    session-summary.md
    decisions.md
    debug-log.md   ...

.claude/
  agents/                    # 6 agent definitions
    spec-writer.md
    qa.md
    memory-curator.md
    ... +3 more
  commands/                  # 8 slash commands
  skills/                    # domain context
  settings.json              # all hooks wired

~/.claude/template-memory/
  NEW_PROJECT_PRIMER.md
  failure-patterns.md
  architecture-lessons.md`;

const KEY_FILES = [
  {
    file: "TECHSTACK.md",
    desc: "The single file that restores full session context. Architecture, decisions, current state — all in one upload.",
  },
  {
    file: ".claude/agents/*.md",
    desc: "6 pre-configured agents with system prompts, tool lists, model assignments, and write-back protocols.",
  },
  {
    file: "docs/context/",
    desc: "Tier 1 project memory. Every agent writes here on Stop. Git-tracked, session-resumable, promotable.",
  },
  {
    file: "~/.claude/template-memory/",
    desc: "Tier 0 cross-project wisdom. Grows with every project. NEW_PROJECT_PRIMER.md auto-compiled and auto-loaded.",
  },
  {
    file: "scripts/hooks/",
    desc: "session-start.sh, pre-bash-guard.sh, post-edit-lint.sh, subagent-stop-writeback.sh — all production-ready.",
  },
];

export function StructureSection() {
  return (
    <section id="structure" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionLabel text="What's Included" />
        <h2
          className="font-heading font-extrabold text-3xl md:text-4xl tracking-tight mb-3"
          style={{ color: "var(--text)" }}
        >
          Clone. Run. Ship.
        </h2>
        <p
          className="text-base max-w-xl mb-12"
          style={{ color: "var(--text2)" }}
        >
          Everything pre-wired: agents, hooks, commands, memory docs, CI/CD,
          Dockerfiles.
        </p>

        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <CodeBlock language="text" code={FILE_TREE} />
          </div>

          <div className="grid gap-3 content-start">
            {KEY_FILES.map((kf) => (
              <div
                key={kf.file}
                className="rounded-lg p-4"
                style={{
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                }}
              >
                <code
                  className="font-mono text-[12px] mb-1 block"
                  style={{ color: "var(--accent)" }}
                >
                  {kf.file}
                </code>
                <p
                  className="text-[13px] leading-relaxed m-0"
                  style={{ color: "var(--text2)" }}
                >
                  {kf.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
