const LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/alexhsieh/claude-agent-template",
  },
  { label: "YouTube", href: "#" },
  { label: "Skool Community", href: "#" },
  { label: "Docs", href: "#" },
];

export function Footer() {
  return (
    <footer
      className="py-8 px-6"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span
          className="text-[12px] font-mono"
          style={{ color: "var(--text3)" }}
        >
          Claude Agent Template &middot; Built by @alexhsieh
        </span>
        <nav aria-label="Footer links" className="flex gap-4">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel={
                l.href.startsWith("http") ? "noopener noreferrer" : undefined
              }
              className="text-[12px] font-mono no-underline transition-colors hover:underline"
              style={{ color: "var(--text2)" }}
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
