import { SectionLabel } from "./SectionLabel";

const FEATURES = [
  {
    label: "Memory",
    title: "Zero-loss session handoff",
    desc: "Upload TECHSTACK.md to any Claude session and get full context back instantly. No re-explaining architecture, decisions, or current state.",
  },
  {
    label: "Enforcement",
    title: "Hooks that can't be bypassed",
    desc: "SessionStart loads context. PostToolUse runs lint. SubagentStop triggers write-back. PreToolUse blocks DROP TABLE. All deterministic.",
  },
  {
    label: "Commands",
    title: "8 slash commands",
    desc: "/spec /implement /review /test /deploy /sync /update-docs /promote-learnings — the full dev cycle as composable primitives.",
  },
  {
    label: "Quality Gates",
    title: "TDD enforced by default",
    desc: "RED > GREEN > REFACTOR is the only path. 80% coverage gate blocks deploy. @qa auto-validates PyJWT, bcrypt, cache tiers.",
  },
  {
    label: "Architecture",
    title: "OpenAPI-first contract",
    desc: "TypeScript types auto-generated from openapi.yaml. Schema drift between frontend and backend becomes impossible by design.",
  },
  {
    label: "Deployment",
    title: "6-gate deploy pipeline",
    desc: "@deployer runs all gates before touching git push. Server tests, client tests, openapi lint, TypeScript, git clean, correct branch.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionLabel text="What You Get" />
        <h2
          className="font-heading font-extrabold text-3xl md:text-4xl tracking-tight mb-12"
          style={{ color: "var(--text)" }}
        >
          Everything wired in. Nothing to configure.
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="rounded-xl p-6 transition-all hover:translate-y-[-2px]"
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className="text-[10px] font-mono uppercase tracking-wider mb-3 inline-block px-2 py-0.5 rounded"
                style={{
                  background:
                    "color-mix(in srgb, var(--accent) 10%, transparent)",
                  color: "var(--accent)",
                  border:
                    "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                }}
              >
                {f.label}
              </span>
              <h3
                className="font-heading font-bold text-base mb-2"
                style={{ color: "var(--text)" }}
              >
                {f.title}
              </h3>
              <p
                className="text-[13px] leading-relaxed m-0"
                style={{ color: "var(--text2)" }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
