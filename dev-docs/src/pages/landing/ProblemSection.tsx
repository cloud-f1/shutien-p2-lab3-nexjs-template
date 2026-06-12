import { SectionLabel } from "./SectionLabel";

const PROBLEMS = [
  {
    icon: "01",
    title: "Re-explaining the same context",
    desc: "Every new session needs a wall of backstory. Which packages to use, what decisions were made, where you left off. Wasted tokens, wasted time.",
  },
  {
    icon: "02",
    title: "Agents work in silos",
    desc: "Your spec agent doesn't know what the reviewer found. Your debugger doesn't remember the last three bugs. Each agent starts fresh, every time.",
  },
  {
    icon: "03",
    title: "Templates stay static",
    desc: "You find a bug, fix it, move on. The next project hits the same bug. Every project reinvents the same wheel. None of your experience compounds.",
  },
  {
    icon: "04",
    title: "No enforcement layer",
    desc: "Agents forget rules. PyJWT becomes python-jose. Security patterns drift. Without automatic enforcement, every review is playing catch-up.",
  },
];

export function ProblemSection() {
  return (
    <section id="problem" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionLabel text="The Problem" />
        <h2
          className="font-heading font-extrabold text-3xl md:text-4xl tracking-tight mb-3"
          style={{ color: "var(--text)" }}
        >
          Every session starts blind.
        </h2>
        <p
          className="text-base max-w-xl mb-12"
          style={{ color: "var(--text2)" }}
        >
          You've been here. Smart agents, great work — then the session ends and
          it's all gone.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {PROBLEMS.map((p) => (
            <div
              key={p.icon}
              className="rounded-xl p-6 transition-all hover:translate-y-[-2px]"
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className="text-[11px] font-mono font-bold mb-3 inline-block"
                style={{ color: "var(--red)" }}
              >
                {p.icon}
              </span>
              <h3
                className="font-heading font-bold text-base mb-2"
                style={{ color: "var(--text)" }}
              >
                {p.title}
              </h3>
              <p
                className="text-sm leading-relaxed m-0"
                style={{ color: "var(--text2)" }}
              >
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
