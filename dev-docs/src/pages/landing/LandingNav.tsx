import { useTheme } from "../../context/ThemeContext";
import { useScrollSpy } from "../../hooks/useScrollSpy";
import { useProgressBar } from "../../hooks/useProgressBar";

const NAV_ITEMS = [
  { id: "pipeline", label: "Agents" },
  { id: "learning", label: "Self-Learning" },
  { id: "features", label: "Features" },
  { id: "structure", label: "Structure" },
];

const SECTION_IDS = [
  "hero",
  "problem",
  "pipeline",
  "learning",
  "features",
  "structure",
  "cta",
];

export function LandingNav() {
  const { theme, toggle } = useTheme();
  const progress = useProgressBar();
  const activeId = useScrollSpy(SECTION_IDS);

  return (
    <>
      <div
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
        className="fixed top-14 left-0 right-0 h-0.5 z-50"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full transition-[width] duration-75"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, var(--accent), var(--accent2))",
          }}
        />
      </div>

      <header
        className="fixed top-0 left-0 right-0 h-14 backdrop-blur-xl flex items-center px-6 z-[100]"
        style={{
          background: "color-mix(in srgb, var(--bg) 92%, transparent)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <a
          href="#/landing"
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById("hero")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          className="font-heading font-extrabold text-sm tracking-tight flex items-center gap-2.5 no-underline uppercase"
          style={{ color: "var(--text)", letterSpacing: "0.05em" }}
        >
          <div
            className="w-[26px] h-[26px] flex items-center justify-center"
            style={{
              background: "var(--accent)",
              clipPath:
                "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            }}
          />
          Claude Agent Template
        </a>

        <nav
          aria-label="Landing page sections"
          className="hidden md:flex items-center gap-6 ml-auto mr-6"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#/landing`}
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById(item.id)
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-[13px] font-mono no-underline transition-colors"
              style={{
                color: activeId === item.id ? "var(--accent2)" : "var(--text2)",
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 ml-auto md:ml-0">
          <span
            className="text-[11px] font-mono px-2 py-0.5 rounded hidden sm:inline"
            style={{
              background: "var(--bg3)",
              border: "1px solid var(--border2)",
              color: "var(--text2)",
            }}
          >
            v2.0.0
          </span>
          <button
            onClick={toggle}
            className="px-2 py-1 rounded-md text-base leading-none cursor-pointer transition-all"
            style={{
              background: "var(--bg3)",
              border: "1px solid var(--border2)",
              color: "var(--text2)",
            }}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19"}
          </button>
          <a
            href="#/landing"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("cta")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-[13px] font-mono px-3 py-1.5 rounded-lg no-underline transition-all hidden sm:inline-block"
            style={{
              background: "var(--accent)",
              color: "#000",
              fontWeight: 600,
            }}
          >
            Get Template
          </a>
        </div>
      </header>
    </>
  );
}
