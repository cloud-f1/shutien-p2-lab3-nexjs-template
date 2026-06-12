import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency, formatPercent } from "../../../utils/formatCurrency";

interface PerformerData {
  place_name: string;
  gain_loss: string;
  gain_loss_pct: string | null;
}

interface PerformanceChartProps {
  data: PerformerData[];
}

interface TooltipPayload {
  name: string;
  gainLoss: number;
  rawGainLoss: string;
  rawPct: string | null;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TooltipPayload }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
        {item.name}
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        {formatCurrency(item.rawGainLoss)} ({formatPercent(item.rawPct)})
      </div>
    </div>
  );
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
  const chartData = data.map((d) => ({
    name:
      d.place_name.length > 15
        ? d.place_name.slice(0, 15) + "..."
        : d.place_name,
    gainLoss: Number(d.gain_loss),
    rawGainLoss: d.gain_loss,
    rawPct: d.gain_loss_pct,
  }));

  if (chartData.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>
        No performance data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData}>
        <XAxis
          dataKey="name"
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="gainLoss" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.gainLoss >= 0 ? "#10B981" : "#EF4444"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
