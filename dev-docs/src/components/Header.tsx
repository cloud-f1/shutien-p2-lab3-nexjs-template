import { useTheme } from "../context/ThemeContext";
import { useProgressBar } from "../hooks/useProgressBar";

export function Header() {
  const { theme, toggle } = useTheme();
  const progress = useProgressBar();

  return (
    <>
      {/* Progress bar */}
      <div
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

      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 h-14 backdrop-blur-xl flex items-center px-6 z-[100] gap-4"
        style={{
          background: "color-mix(in srgb, var(--bg) 92%, transparent)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <a
          href="#"
          className="font-heading font-extrabold text-lg tracking-tight flex items-center gap-2.5 no-underline"
          style={{ color: "var(--text)" }}
        >
          <div
            className="w-[26px] h-[26px] flex items-center justify-center"
            style={{
              background: "var(--accent)",
              clipPath:
                "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            }}
          />
          AI-Coding-Template
        </a>

        <span
          className="text-[11px] font-mono px-2 py-0.5 rounded"
          style={{
            background: "var(--bg3)",
            border: "1px solid var(--border2)",
            color: "var(--text2)",
          }}
        >
          Developer Docs
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span
            className="text-[11px] font-mono px-2 py-0.5 rounded"
            style={{
              background: "var(--bg3)",
              border: "1px solid var(--border2)",
              color: "var(--text2)",
            }}
          >
            v0.5.0
          </span>
          <span
            className="text-[11px] font-mono px-2.5 py-0.5 rounded-full"
            style={{
              background: "color-mix(in srgb, var(--gold) 12%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
              color: "var(--gold)",
            }}
          >
            Track 1 — In Progress
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
        </div>
      </header>
    </>
  );
}
