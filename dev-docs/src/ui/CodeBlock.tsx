import { useCallback, useRef, useState } from "react";

interface Props {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: Props) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="my-5 relative">
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2 rounded-t-lg"
        style={{
          background: "var(--bg3)",
          border: "1px solid var(--border)",
          borderBottom: "none",
        }}
      >
        <span
          className="text-[11px] font-mono uppercase tracking-wide"
          style={{ color: "var(--text3)" }}
        >
          {language || "text"}
        </span>
        <button
          onClick={handleCopy}
          className="text-[11px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition-all"
          style={{
            color: copied ? "var(--green)" : "var(--text3)",
            background: "none",
            border: "none",
          }}
        >
          {copied ? "copied!" : "copy"}
        </button>
      </div>

      {/* Code area */}
      <pre
        className="rounded-t-none rounded-b-lg overflow-x-auto leading-relaxed"
        style={{
          background: "var(--code-bg)",
          border: "1px solid var(--border)",
          padding: "1.25rem",
          margin: 0,
        }}
      >
        <code
          className="font-mono text-[13px]"
          style={{ color: "var(--code-text)" }}
        >
          {code}
        </code>
      </pre>
    </div>
  );
}
