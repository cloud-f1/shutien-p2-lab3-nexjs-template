import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { useThemeStore } from "../components/ThemeProvider";
import LogoMark from "../components/LogoMark";
import Seo from "../components/Seo";
import {
  CTABanner,
  FeatureCard,
  FeatureGrid,
  Footer,
  HeroSection,
  NavBar,
  PublicLayout,
  Section,
} from "../components/ui";

const THEME_CARDS = [
  {
    id: "dark" as const,
    label: "Dark",
    colors: ["#07070f", "#f0a500", "#f0f0f8", "#0e0e1a"],
  },
  {
    id: "indigo" as const,
    label: "Indigo",
    colors: ["#0f0a2a", "#7c6fff", "#f0eeff", "#1a1340"],
  },
  {
    id: "navy" as const,
    label: "Navy",
    colors: ["#0a1628", "#4a9eff", "#e8f0ff", "#122240"],
  },
  {
    id: "sage" as const,
    label: "Sage",
    colors: ["#0f1a14", "#5cb88a", "#e8f5ee", "#1a2e22"],
  },
  {
    id: "rose" as const,
    label: "Rose",
    colors: ["#FBF7F5", "#E11D48", "#2A1A1F", "#F5EDEA"],
  },
  {
    id: "forest" as const,
    label: "Forest",
    colors: ["#0A120E", "#22C55E", "#E8F0EC", "#11201A"],
  },
];

const PRIMARY_BTN_CLS = [
  "inline-flex items-center gap-2 rounded font-body text-sm font-semibold",
  "bg-primary text-bg border border-primary px-6 py-3",
  "hover:bg-primary-dark hover:shadow-md transition-colors",
].join(" ");

const SECONDARY_BTN_CLS = [
  "inline-flex items-center gap-2 rounded font-body text-sm font-semibold",
  "bg-transparent text-text-primary border border-border px-6 py-3",
  "hover:bg-surface hover:border-text-secondary transition-colors",
].join(" ");

function ThemePreviewBlock() {
  const { t } = useTranslation("landing");
  const { theme, setTheme } = useThemeStore();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
      {THEME_CARDS.map((tc) => {
        const active = theme === tc.id;
        return (
          <button
            key={tc.id}
            onClick={() => setTheme(tc.id)}
            aria-label={`Switch to ${tc.label} theme`}
            className={[
              // E212: explicit bg-bg so the card label's contrast is computed
              // against the (dark) page surface, not a light color swatch that
              // axe samples through the transparent button.
              "relative flex flex-col items-stretch gap-3 rounded-lg border p-4 transition-all text-left bg-bg",
              active
                ? "border-primary shadow-md"
                : "border-border hover:border-text-secondary",
            ].join(" ")}
          >
            <div className="grid grid-cols-4 gap-1">
              {tc.colors.map((c, i) => (
                <div
                  key={i}
                  className="h-8 rounded"
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="font-display text-sm font-semibold text-text-primary">
              {tc.label}
            </div>
            {active && (
              <div className="absolute right-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-mono uppercase text-bg">
                {t("themes.active")}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  const { t } = useTranslation("landing");
  const { t: tc } = useTranslation("common");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" },
    );

    document
      .querySelectorAll(".reveal, .reveal-group")
      .forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <PublicLayout
      nav={
        <NavBar
          ariaLabel="Main navigation"
          brand={<LogoMark size={24} />}
          brandText={t("nav.brandName")}
          brandRender={(cls) => (
            <a href="#" className={cls}>
              <LogoMark size={24} />
              <span>{t("nav.brandName")}</span>
            </a>
          )}
          links={[
            { label: t("nav.agents"), href: "#pipeline" },
            { label: t("nav.selfLearning"), href: "#learning" },
            { label: t("nav.features"), href: "#features" },
            { label: t("nav.structure"), href: "#structure" },
            {
              label: t("nav.gettingStarted"),
              href: "/getting-started",
              render: (cls) => (
                <Link to="/getting-started" className={cls}>
                  {t("nav.gettingStarted")}
                </Link>
              ),
            },
            { label: t("nav.docs"), href: "/docs/" },
            {
              label: tc("nav.signIn"),
              href: "/signin",
              render: (cls) => (
                <Link to="/signin" className={cls}>
                  {tc("nav.signIn")}
                </Link>
              ),
            },
            {
              label: (
                <>
                  {t("nav.getTemplate")} &rarr;
                </>
              ),
              href: "/signup",
              cta: true,
              render: (cls) => (
                <Link to="/signup" className={cls}>
                  {t("nav.getTemplate")} &rarr;
                </Link>
              ),
            },
          ]}
        />
      }
      footer={
        <Footer
          brand={t("footer.brand")}
          brandHandle="@alexhsieh"
          links={[
            { label: t("footer.github"), href: "#" },
            { label: t("footer.youtube"), href: "#" },
            { label: t("footer.skool"), href: "#" },
            {
              label: "Privacy",
              href: "/privacy",
              render: (cls) => (
                <Link to="/privacy" className={cls}>
                  Privacy
                </Link>
              ),
            },
            {
              label: "Terms",
              href: "/terms",
              render: (cls) => (
                <Link to="/terms" className={cls}>
                  Terms
                </Link>
              ),
            },
          ]}
        />
      }
    >
      <Seo
        title="Home"
        description="6 specialized AI agents, self-learning memory, zero context loss. The only Claude Code template where every agent writes back what it learned."
        path="/"
      />

      {/* HERO */}
      <HeroSection
        id="hero"
        eyebrow={t("hero.eyebrow")}
        title={
          <>
            {t("hero.title1")}
            <br />
            <em className="text-primary not-italic font-display">
              {t("hero.title2")}
            </em>
            <br />
            {t("hero.title3")}
          </>
        }
        subtitle={
          <Trans
            i18nKey="hero.subtitle"
            ns="landing"
            components={{ strong: <strong /> }}
          />
        }
        actions={
          <>
            <Link to="/signup" className={PRIMARY_BTN_CLS}>
              {t("hero.ctaPrimary")}
              <span>&rarr;</span>
            </Link>
            <a href="#pipeline" className={SECONDARY_BTN_CLS}>
              {t("hero.ctaSecondary")}
            </a>
          </>
        }
      />

      {/* PROBLEM */}
      <Section id="problem" label={t("problem.label")} title={t("problem.title")} lede={t("problem.subtitle")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: t("problem.reexplainTitle"), desc: t("problem.reexplainDesc"), icon: "\u{1F501}" },
            { title: t("problem.silosTitle"), desc: t("problem.silosDesc"), icon: "\u{1F9F1}" },
            { title: t("problem.staticTitle"), desc: t("problem.staticDesc"), icon: "\u{1F4CB}" },
            { title: t("problem.enforcementTitle"), desc: t("problem.enforcementDesc"), icon: "\u{26A1}" },
          ].map((p, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-surface p-6"
            >
              <span className="problem-icon text-2xl" aria-hidden="true">
                {p.icon}
              </span>
              <div className="mt-3 font-display text-base font-semibold text-text-primary">
                {p.title}
              </div>
              <div className="mt-2 text-sm text-text-secondary leading-relaxed">
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* PIPELINE */}
      <Section
        id="pipeline"
        label={t("pipeline.label")}
        title={
          <>
            {t("pipeline.title1")}
            <br />
            {t("pipeline.title2")}
          </>
        }
        lede={t("pipeline.subtitle")}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { num: "01", icon: "\u{1F4D0}", name: "@spec-writer", role: "OpenAPI-first. Edits spec before any code exists.", model: "claude-opus" },
            { num: "02", icon: "\u{1F50D}", name: "@qa", role: "Security gate + 80% coverage gate. PyJWT, bcrypt, cache tiers, TDD compliance.", model: "claude-sonnet" },
            { num: "03", icon: "\u{1F3DB}\u{FE0F}", name: "@best-practice", role: "Deep architecture reasoning. Logs every decision.", model: "claude-opus" },
            { num: "04", icon: "\u{1F41B}", name: "@debugger", role: "5-phase root cause analysis. Auto-escalates after 3 tries.", model: "claude-sonnet" },
            { num: "05", icon: "\u{1F680}", name: "@deployer", role: "6 pre-deploy gates. Zero-bypass deploy policy.", model: "claude-sonnet" },
            { num: "06", icon: "\u{1F9E0}", name: "@memory-curator", role: "The self-learning engine. Promotes lessons across projects.", model: "claude-sonnet", highlight: true },
            { num: "07", icon: "\u{1F3AF}", name: "@strategist", role: "Audits repo, researches gaps, proposes epic cycles with human gate.", model: "claude-opus" },
          ].map((a) => (
            <div
              key={a.name}
              className={[
                "rounded-lg border bg-surface p-5",
                a.highlight ? "border-primary/40" : "border-border",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-mono text-xs text-text-muted">{a.num}</div>
                <span className="agent-icon text-xl" aria-hidden="true">
                  {a.icon}
                </span>
              </div>
              <div className="mt-3 font-display text-base font-semibold text-text-primary">
                {a.name}
              </div>
              <div className="mt-2 text-xs text-text-secondary leading-relaxed">
                {a.role}
              </div>
              <div className="mt-3 inline-block rounded bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-secondary">
                {a.model}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* SELF-LEARNING */}
      <Section
        id="learning"
        label={t("learning.label")}
        title={
          <>
            {t("learning.title1")}
            <br />
            {t("learning.title2")}
          </>
        }
        lede={t("learning.subtitle")}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border border-border bg-surface p-6">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <span className="font-display text-sm font-semibold text-text-primary">
                {t("learning.memoryArchitecture")}
              </span>
              <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                {t("learning.selfLearning")}
              </span>
            </div>
            <div className="space-y-4">
              <div className="rounded border border-border bg-surface-2 p-4">
                <div className="font-mono text-[11px] uppercase tracking-wider text-primary mb-2">
                  Tier 0 &mdash; Template Memory (Global)
                </div>
                <ul className="font-mono text-xs text-text-secondary space-y-1">
                  <li>failure-patterns.md</li>
                  <li>architecture-lessons.md</li>
                  <li>anti-patterns.md</li>
                  <li>testing-patterns.md</li>
                  <li className="text-text-muted">integration-gotchas.md</li>
                </ul>
              </div>
              <div className="text-center font-mono text-[11px] text-text-muted">
                &uarr; /promote-learnings
              </div>
              <div className="rounded border border-border bg-surface-2 p-4">
                <div className="font-mono text-[11px] uppercase tracking-wider text-primary mb-2">
                  Tier 1 &mdash; Project Memory (This Project)
                </div>
                <ul className="font-mono text-xs text-text-secondary space-y-1">
                  <li>session-summary.md</li>
                  <li>decisions.md</li>
                  <li>debug-log.md</li>
                  <li>review-log.md</li>
                  <li className="text-text-muted">deploy-log.md</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { num: "01", title: t("learning.step1Title"), desc: t("learning.step1Desc") },
              { num: "02", title: t("learning.step2Title"), desc: t("learning.step2Desc") },
              { num: "03", title: t("learning.step3Title"), desc: t("learning.step3Desc") },
              { num: "04", title: t("learning.step4Title"), desc: t("learning.step4Desc") },
            ].map((step) => (
              <div
                key={step.num}
                className="flex items-start gap-4 rounded-lg border border-border bg-surface p-5"
              >
                <div className="font-mono text-2xl font-bold text-primary">
                  {step.num}
                </div>
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold text-text-primary">
                    {step.title}
                  </div>
                  <div className="mt-1 text-sm text-text-secondary leading-relaxed">
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* FEATURES */}
      <Section
        id="features"
        label={t("features.label")}
        title={
          <>
            {t("features.title1")}
            <br />
            {t("features.title2")}
          </>
        }
      >
        <FeatureGrid>
          <FeatureCard
            label={t("features.memoryLabel")}
            title={t("features.memoryTitle")}
            description={t("features.memoryDesc")}
          />
          <FeatureCard
            label={t("features.enforcementLabel")}
            title={t("features.enforcementTitle")}
            description={t("features.enforcementDesc")}
          />
          <FeatureCard
            label={t("features.commandsLabel")}
            title={t("features.commandsTitle")}
            description={t("features.commandsDesc")}
          />
          <FeatureCard
            label={t("features.qualityLabel")}
            title={t("features.qualityTitle")}
            description={t("features.qualityDesc")}
          />
          <FeatureCard
            label={t("features.architectureLabel")}
            title={t("features.architectureTitle")}
            description={t("features.architectureDesc")}
          />
          <FeatureCard
            label={t("features.deploymentLabel")}
            title={t("features.deploymentTitle")}
            description={t("features.deploymentDesc")}
          />
        </FeatureGrid>
      </Section>

      {/* THEMES */}
      <Section
        id="themes"
        label={t("themes.label")}
        title={
          <>
            {t("themes.title1")}
            <br />
            {t("themes.title2")}
          </>
        }
        lede={t("themes.subtitle")}
      >
        <ThemePreviewBlock />
      </Section>

      {/* STRUCTURE */}
      <Section
        id="structure"
        label={t("structure.label")}
        title={t("structure.title")}
        lede={t("structure.subtitle")}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <pre className="rounded-lg border border-border bg-surface p-5 font-mono text-xs text-text-secondary leading-relaxed overflow-x-auto whitespace-pre">
{`${t("structure.filetreeHeader")}

CLAUDE.md              ← session identity
TECHSTACK.md           ← upload = full context

docs/
  openapi.yaml         ← source of all types
  context/             ← agent write-backs
    session-summary.md
    decisions.md
    debug-log.md ...

.claude/
  agents/              ← 7 agent definitions
    spec-writer.md
    qa.md
    memory-curator.md
    ... +3 more
  commands/            ← 14 slash commands
  skills/              ← domain context
  settings.json        ← all hooks wired

~/.claude/template-memory/
  NEW_PROJECT_PRIMER.md
  failure-patterns.md
  architecture-lessons.md`}
          </pre>
          <div className="space-y-4">
            {[
              { title: "TECHSTACK.md", desc: "The single file that restores full session context. Architecture, decisions, current state — all in one upload." },
              { title: ".claude/agents/*.md", desc: "6 pre-configured agents with system prompts, tool lists, model assignments, and write-back protocols." },
              { title: "docs/context/", desc: "Tier 1 project memory. Every agent writes here on Stop. Git-tracked, session-resumable, promotable." },
              { title: "~/.claude/template-memory/", desc: "Tier 0 cross-project wisdom. Grows with every project. NEW_PROJECT_PRIMER.md auto-compiled and auto-loaded." },
              { title: "scripts/hooks/", desc: "session-start.sh, pre-bash-guard.sh, post-edit-lint.sh, subagent-stop-writeback.sh — all production-ready." },
            ].map((sd, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-5">
                <div className="font-mono text-sm text-primary">{sd.title}</div>
                <div className="mt-2 text-sm text-text-secondary leading-relaxed">
                  {sd.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* CTA */}
      <CTABanner
        id="cta"
        eyebrow={t("cta.eyebrow")}
        title={
          <>
            {t("cta.title1")}
            <br />
            {t("cta.title2")}
          </>
        }
        subtitle={t("cta.subtitle")}
        actions={
          <>
            <Link to="/signup" className={PRIMARY_BTN_CLS}>
              {t("cta.primary")} &rarr;
            </Link>
            <a href="#" className={SECONDARY_BTN_CLS}>
              &#x2605; {t("cta.github")}
            </a>
          </>
        }
        note={t("cta.note")}
      />
    </PublicLayout>
  );
}
