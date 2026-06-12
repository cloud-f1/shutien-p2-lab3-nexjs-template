import { SectionLabel } from "./SectionLabel";

const TIER0_FILES = [
  "failure-patterns.md",
  "architecture-lessons.md",
  "anti-patterns.md",
  "testing-patterns.md",
  "integration-gotchas.md",
];

const TIER1_FILES = [
  "session-summary.md",
  "decisions.md",
  "debug-log.md",
  "review-log.md",
  "deploy-log.md",
];

const STEPS = [
  {
    num: "01",
    title: "Agent finds bug in Project A",
    desc: "@debugger solves it, writes to debug-log.md, tags it [GENERALIZABLE]",
  },
  {
    num: "02",
    title: "@memory-curator promotes it",
    desc: "Reads the tag, formats as a template entry, adds to failure-patterns.md",
  },
  {
    num: "03",
    title: "NEW_PROJECT_PRIMER.md regenerated",
    desc: "Auto-compiled bootstrap doc. Every new project loads this on SessionStart, Day 1.",
  },
  {
    num: "04",
    title: "Project B never hits that bug",
    desc: "The template warns you before you write a single line. Your experience compounds permanently.",
  },
];

export function LearningSection() {
  return (
    <section id="learning" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionLabel text="The Breakthrough" />
        <h2
          className="font-heading font-extrabold text-3xl md:text-4xl tracking-tight mb-3"
          style={{ color: "var(--text)" }}
        >
          Every project makes the next one smarter.
        </h2>
        <p
          className="text-base max-w-2xl mb-12"
          style={{ color: "var(--text2)" }}
        >
          This is the part no other template does. A promotion engine that turns
          project-specific experience into permanent cross-project wisdom.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-16">
          <MemoryTier
            label="Tier 0 — Template Memory (Global)"
            path="~/.claude/template-memory/"
            files={TIER0_FILES}
            accentVar="--accent"
          />
          <MemoryTier
            label="Tier 1 — Project Memory (This Project)"
            path="docs/context/"
            files={TIER1_FILES}
            accentVar="--accent2"
          />
        </div>

        <div className="flex items-center justify-center mb-12">
          <span
            className="font-mono text-xs px-4 py-2 rounded-full"
            style={{
              background: "color-mix(in srgb, var(--green) 10%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--green) 30%, transparent)",
              color: "var(--green)",
            }}
          >
            /promote-learnings
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s) => (
            <div
              key={s.num}
              className="rounded-xl p-5"
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className="text-[11px] font-mono font-bold mb-2 inline-block"
                style={{ color: "var(--green)" }}
              >
                Step {s.num}
              </span>
              <h3
                className="font-heading font-bold text-sm mb-2"
                style={{ color: "var(--text)" }}
              >
                {s.title}
              </h3>
              <p
                className="text-[13px] leading-relaxed m-0"
                style={{ color: "var(--text2)" }}
              >
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MemoryTier({
  label,
  path,
  files,
  accentVar,
}: {
  label: string;
  path: string;
  files: string[];
  accentVar: string;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "var(--bg2)",
        border: `1px solid color-mix(in srgb, var(${accentVar}) 25%, transparent)`,
      }}
    >
      <h3
        className="font-heading font-bold text-sm mb-1"
        style={{ color: `var(${accentVar})` }}
      >
        {label}
      </h3>
      <p
        className="font-mono text-[11px] mb-3"
        style={{ color: "var(--text3)" }}
      >
        {path}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {files.map((f) => (
          <span
            key={f}
            className="text-[11px] font-mono px-2 py-0.5 rounded"
            style={{
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              color: "var(--text2)",
            }}
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
