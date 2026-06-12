import { CodeBlock } from "../../ui/CodeBlock";

const STATS = [
  { number: "6", suffix: "x", label: "Specialized Agents" },
  { number: "2", suffix: "-tier", label: "Memory System" },
  { number: "0", suffix: "x", label: "Re-explaining needed" },
];

const SESSION_CODE = `## Session - 2026-03-07
Branch: main

### Done
  auth endpoints - 84% coverage
  @qa - LGTM
  deploy staging - healthy

### Next Action
/spec "place search endpoint"

### Promote?
[GENERALIZABLE: PyJWT import
 pattern - template memory]`;

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center pt-14 overflow-hidden"
    >
      <div className="w-full max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span
            className="text-[11px] font-mono uppercase tracking-widest mb-4 inline-block px-3 py-1 rounded-full"
            style={{
              color: "var(--accent)",
              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
            }}
          >
            Claude Code &middot; Production Template &middot; v2.0.0
          </span>

          <h1
            className="font-heading font-extrabold text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight mt-4 mb-6"
            style={{ color: "var(--text)" }}
          >
            6 Agents.
            <br />
            <span style={{ color: "var(--accent)" }}>Self-Learning.</span>
            <br />
            Zero Context Loss.
          </h1>

          <p
            className="text-base md:text-lg leading-relaxed max-w-lg mb-8"
            style={{ color: "var(--text2)" }}
          >
            The only Claude Code template where every agent{" "}
            <strong style={{ color: "var(--text)" }}>writes back</strong> what
            it learned — and every project makes the{" "}
            <strong style={{ color: "var(--text)" }}>next one smarter</strong>.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="#/landing"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("cta")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="font-mono text-sm font-semibold px-5 py-2.5 rounded-lg no-underline transition-all hover:scale-105"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              Get the Template &rarr;
            </a>
            <a
              href="#/landing"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("pipeline")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="font-mono text-sm px-5 py-2.5 rounded-lg no-underline transition-all"
              style={{
                border: "1px solid var(--border2)",
                color: "var(--text2)",
                background: "var(--bg2)",
              }}
            >
              See how it works
            </a>
          </div>

          <div
            className="flex gap-8 mt-10 pt-6"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {STATS.map((s) => (
              <div key={s.label}>
                <div
                  className="font-heading font-extrabold text-2xl"
                  style={{ color: "var(--text)" }}
                >
                  {s.number}
                  <span
                    className="text-sm font-mono ml-0.5"
                    style={{ color: "var(--accent)" }}
                  >
                    {s.suffix}
                  </span>
                </div>
                <div
                  className="text-[11px] font-mono mt-1"
                  style={{ color: "var(--text3)" }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:block">
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: "1px solid var(--border)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div
              className="px-4 py-2 text-[11px] font-mono flex items-center gap-2"
              style={{
                background: "var(--bg3)",
                borderBottom: "1px solid var(--border)",
                color: "var(--text3)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--green)" }}
              />
              session-summary.md
            </div>
            <CodeBlock language="markdown" code={SESSION_CODE} />
          </div>
        </div>
      </div>
    </section>
  );
}
