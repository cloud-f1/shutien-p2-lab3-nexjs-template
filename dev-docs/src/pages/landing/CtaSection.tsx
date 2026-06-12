import { SectionLabel } from "./SectionLabel";

export function CtaSection() {
  return (
    <section id="cta" className="py-24">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <SectionLabel text="Ready to build different" />

        <h2
          className="font-heading font-extrabold text-3xl md:text-5xl tracking-tight mb-4"
          style={{ color: "var(--text)" }}
        >
          Stop starting
          <br />
          from zero.
        </h2>

        <p
          className="text-base mb-8 max-w-lg mx-auto"
          style={{ color: "var(--text2)" }}
        >
          Get the template used to build AI-Coding-Template — an AI agent pipeline
          that learns, remembers, and compounds.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <a
            href="https://github.com/alexhsieh/claude-agent-template"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm font-semibold px-6 py-3 rounded-lg no-underline transition-all hover:scale-105"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            Get the Template &rarr;
          </a>
          <a
            href="https://github.com/alexhsieh/claude-agent-template"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm px-6 py-3 rounded-lg no-underline transition-all"
            style={{
              border: "1px solid var(--border2)",
              color: "var(--text2)",
              background: "var(--bg2)",
            }}
          >
            Star on GitHub
          </a>
        </div>

        <p className="text-[11px] font-mono" style={{ color: "var(--text3)" }}>
          Free &amp; open source &middot; MIT License &middot; Works with Claude
          Code
        </p>
      </div>
    </section>
  );
}
