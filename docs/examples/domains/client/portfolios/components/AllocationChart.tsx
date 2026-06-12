import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "../../../utils/formatCurrency";

const COLORS = [
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#6366F1",
];

interface AllocationData {
  category: string;
  percentage: string;
  value: string;
  count: number;
}

interface AllocationChartProps {
  data: AllocationData[];
}

interface TooltipPayload {
  category: string;
  percentage: number;
  rawValue: string;
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
        {item.category}
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        {formatCurrency(item.rawValue)} ({item.percentage.toFixed(1)}%)
      </div>
    </div>
  );
}

export default function AllocationChart({ data }: AllocationChartProps) {
  const chartData = data.map((d) => ({
    name: d.category,
    value: Number(d.percentage),
    category: d.category,
    percentage: Number(d.percentage),
    rawValue: d.value,
  }));

  if (chartData.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>
        No allocation data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          outerRadius={90}
          dataKey="value"
          nameKey="name"
          label={({ name, value }) =>
            `${name} (${Number(value).toFixed(0)}%)`
          }
          labelLine={false}
        >
          {chartData.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
