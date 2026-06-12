interface StatCardProps {
  label: string;
  value: string;
  suffix: string;
  delta: string;
  deltaDir: "up" | "down" | "flat";
  glow: string;
}

export default function StatCard({
  label,
  value,
  suffix,
  delta,
  deltaDir,
  glow,
}: StatCardProps) {
  const arrow =
    deltaDir === "up" ? "\u2191 " : deltaDir === "down" ? "\u2193 " : "\u2014 ";
  return (
    <div
      className="stat-card"
      style={{ "--glow": glow } as React.CSSProperties}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-num">
        {value}
        <sup>{suffix}</sup>
      </div>
      <div className={`stat-delta ${deltaDir}`}>
        {arrow}
        {delta}
      </div>
    </div>
  );
}
