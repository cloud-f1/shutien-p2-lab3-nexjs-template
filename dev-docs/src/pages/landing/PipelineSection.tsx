import { SectionLabel } from "./SectionLabel";

const AGENTS = [
  {
    num: "01",
    name: "@spec-writer",
    role: "OpenAPI-first. Edits spec before any code exists.",
    model: "claude-opus",
  },
  {
    num: "02",
    name: "@qa",
    role: "Security gate + 80% coverage gate. PyJWT, bcrypt, cache tiers, TDD compliance.",
    model: "claude-sonnet",
  },
  {
    num: "03",
    name: "@best-practice",
    role: "Deep architecture reasoning. Logs every decision.",
    model: "claude-opus",
  },
  {
    num: "04",
    name: "@debugger",
    role: "5-phase root cause analysis. Auto-escalates after 3 tries.",
    model: "claude-sonnet",
  },
  {
    num: "05",
    name: "@deployer",
    role: "6 pre-deploy gates. Zero-bypass deploy policy.",
    model: "claude-sonnet",
  },
  {
    num: "06",
    name: "@memory-curator",
    role: "The self-learning engine. Promotes lessons across projects.",
    model: "claude-sonnet",
    highlight: true,
  },
];

export function PipelineSection() {
  return (
    <section id="pipeline" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionLabel text="The System" />
        <h2
          className="font-heading font-extrabold text-3xl md:text-4xl tracking-tight mb-3"
          style={{ color: "var(--text)" }}
        >
          6 agents. One pipeline. Every step covered.
        </h2>
        <p
          className="text-base max-w-2xl mb-12"
          style={{ color: "var(--text2)" }}
        >
          From spec to production, each agent has a defined role, a designated
          memory doc, and a model matched to the job.
        </p>

        <div className="grid gap-2">
          {AGENTS.map((a) => (
            <div
              key={a.num}
              className="rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 transition-all"
              style={{
                background: a.highlight
                  ? "color-mix(in srgb, var(--accent) 8%, var(--bg2))"
                  : "var(--bg2)",
                border: a.highlight
                  ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)"
                  : "1px solid var(--border)",
              }}
            >
              <span
                className="text-[11px] font-mono font-bold shrink-0 w-6"
                style={{
                  color: a.highlight ? "var(--accent)" : "var(--text3)",
                }}
              >
                {a.num}
              </span>
              <span
                className="font-mono text-sm font-semibold shrink-0 w-36"
                style={{
                  color: a.highlight ? "var(--accent)" : "var(--accent2)",
                }}
              >
                {a.name}
              </span>
              <span
                className="text-sm flex-1"
                style={{ color: "var(--text2)" }}
              >
                {a.role}
              </span>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded shrink-0"
                style={{
                  background: "var(--bg3)",
                  border: "1px solid var(--border)",
                  color: "var(--text3)",
                }}
              >
                {a.model}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
