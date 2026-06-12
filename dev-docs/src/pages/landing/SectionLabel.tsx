interface SectionLabelProps {
  text: string;
}

export function SectionLabel({ text }: SectionLabelProps) {
  return (
    <span
      className="text-[11px] font-mono uppercase tracking-widest mb-4 inline-block"
      style={{ color: "var(--accent)" }}
    >
      {text}
    </span>
  );
}
