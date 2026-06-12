import { useAdminHealth } from "../../../hooks/useAdminHealth";
import { useAdminSli } from "../../../hooks/useAdminSli";
import type { AdminHealthResponse, SliResponse } from "../../../schemas/admin";
import { PageContainer } from "../../../components/ui";

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function StatusIndicator({ ok }: { ok: boolean }) {
  return (
    <span
      className={`status-dot ${ok ? "green" : "red"}`}
      role="img"
      aria-label={ok ? "healthy" : "unhealthy"}
    />
  );
}

function HealthPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">{title}</div>
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
    </div>
  );
}

function HealthDetails({ data }: { data: AdminHealthResponse }) {
  return (
    <div
      className="grid-2"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
    >
      {/* Database */}
      <HealthPanel title="Database">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <StatusIndicator ok={data.db.status === "connected"} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
            {data.db.status}
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--gray)",
          }}
        >
          Latency: {data.db.latency_ms.toFixed(2)} ms
        </div>
      </HealthPanel>

      {/* Email */}
      <HealthPanel title="Email Provider">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <StatusIndicator ok={data.email.configured} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
            {data.email.provider}
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--gray)",
          }}
        >
          {data.email.configured ? "Configured" : "Not configured"}
        </div>
      </HealthPanel>

      {/* OAuth */}
      <HealthPanel title="OAuth Providers">
        {data.oauth.providers.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {data.oauth.providers.map((p) => (
              <span
                key={p}
                className="badge active"
                style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
              >
                {p}
              </span>
            ))}
          </div>
        ) : (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--gray)",
            }}
          >
            No OAuth providers configured
          </span>
        )}
      </HealthPanel>

      {/* App */}
      <HealthPanel title="Application">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "4px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--gray)" }}>Version</span>
          <span>{data.app.version}</span>
          <span style={{ color: "var(--gray)" }}>Uptime</span>
          <span>{formatUptime(data.app.uptime_seconds)}</span>
          <span style={{ color: "var(--gray)" }}>Environment</span>
          <span>{data.app.environment}</span>
        </div>
      </HealthPanel>
    </div>
  );
}

function SliDetails({ data }: { data: SliResponse }) {
  // Threshold visual cue: green ≥ 99%, red below.
  const successOk = data.success_rate_5m >= 0.99;
  // -1 means "pool size unsupported" (e.g. SQLite NullPool in tests).
  const poolUnsupported = data.db_pool.size < 0;

  return (
    <div
      className="grid-2"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginTop: 16,
      }}
    >
      {/* Success rate */}
      <HealthPanel title="Success Rate (5m)">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <StatusIndicator ok={successOk} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>
            {formatPct(data.success_rate_5m)}
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--gray)",
          }}
        >
          {data.sample_count} samples · window {data.window_seconds}s
        </div>
      </HealthPanel>

      {/* Latency */}
      <HealthPanel title="Latency (5m)">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "4px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--gray)" }}>p50</span>
          <span>{data.p50_ms.toFixed(2)} ms</span>
          <span style={{ color: "var(--gray)" }}>p95</span>
          <span>{data.p95_ms.toFixed(2)} ms</span>
        </div>
      </HealthPanel>

      {/* DB pool */}
      <HealthPanel title="DB Connection Pool">
        {poolUnsupported ? (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--gray)",
            }}
          >
            Pool stats unsupported (SQLite / NullPool)
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "4px 12px",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--gray)" }}>Size</span>
            <span>{data.db_pool.size}</span>
            <span style={{ color: "var(--gray)" }}>Checked out</span>
            <span>{data.db_pool.checked_out}</span>
            <span style={{ color: "var(--gray)" }}>Checked in</span>
            <span>{data.db_pool.checked_in}</span>
            <span style={{ color: "var(--gray)" }}>Overflow</span>
            <span>{data.db_pool.overflow}</span>
          </div>
        )}
      </HealthPanel>

      {/* Release */}
      <HealthPanel title="Release">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "4px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--gray)" }}>GIT_SHA</span>
          <span>{data.release}</span>
          <span style={{ color: "var(--gray)" }}>Environment</span>
          <span>{data.environment}</span>
        </div>
      </HealthPanel>

      {/* Top endpoints — full-width row */}
      <div style={{ gridColumn: "1 / -1" }}>
        <HealthPanel title="Top Endpoints">
          {data.top_endpoints.length === 0 ? (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--gray)",
              }}
            >
              No traffic in the current window
            </div>
          ) : (
            <table
              aria-label="Top endpoints by request count"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", color: "var(--gray)" }}>
                  <th style={{ padding: "4px 8px" }}>Path</th>
                  <th style={{ padding: "4px 8px" }}>Count</th>
                  <th style={{ padding: "4px 8px" }}>Success</th>
                  <th style={{ padding: "4px 8px" }}>p50</th>
                  <th style={{ padding: "4px 8px" }}>p95</th>
                </tr>
              </thead>
              <tbody>
                {data.top_endpoints.map((ep) => (
                  <tr key={ep.path}>
                    <td style={{ padding: "4px 8px" }}>{ep.path}</td>
                    <td style={{ padding: "4px 8px" }}>{ep.count}</td>
                    <td style={{ padding: "4px 8px" }}>
                      {formatPct(ep.success_rate)}
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      {ep.p50_ms.toFixed(2)} ms
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      {ep.p95_ms.toFixed(2)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </HealthPanel>
      </div>
    </div>
  );
}

export default function SystemHealthView() {
  const {
    data: healthData,
    isLoading: healthLoading,
    isError: healthError,
    error: healthErrorObj,
  } = useAdminHealth();
  const {
    data: sliData,
    isLoading: sliLoading,
    isError: sliError,
    error: sliErrorObj,
  } = useAdminSli();

  const isForbidden =
    (healthErrorObj instanceof Error &&
      healthErrorObj.message.includes("403")) ||
    (sliErrorObj instanceof Error && sliErrorObj.message.includes("403"));

  return (
    <PageContainer
      eyebrow="Administration"
      title="System Health"
      subtitle="Real-time system status and SLI snapshot — auto-refreshes every 30 seconds."
    >
      {(healthLoading || sliLoading) && !healthData && !sliData && (
        <div className="panel" style={{ padding: 32, textAlign: "center" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--gray)",
            }}
          >
            Loading health data...
          </span>
        </div>
      )}

      {(healthError || sliError) && !healthData && !sliData && (
        <div className="panel" style={{ padding: 32, textAlign: "center" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--red)",
            }}
          >
            {isForbidden
              ? "Access denied — superuser privileges required."
              : "Failed to load health data."}
          </span>
        </div>
      )}

      {healthData && <HealthDetails data={healthData} />}
      {sliData && <SliDetails data={sliData} />}
    </PageContainer>
  );
}
