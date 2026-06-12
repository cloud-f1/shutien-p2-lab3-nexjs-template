import { useTranslation } from "react-i18next";
import { PageContainer } from "../../../components/ui";

export default function MemoryHubView() {
  const { t } = useTranslation("dashboard");
  return (
    <PageContainer
      eyebrow={t("memory.eyebrow")}
      title={t("memory.title")}
      subtitle={t("memory.subtitle")}
    >
      <div className="panel">
        {/* Tier 0 */}
        <div className="memory-tier">
          <div className="tier-header">
            <span className="tier-badge t0">{t("memory.tier0")}</span>
            <span className="tier-title">{t("memory.tier0Title")}</span>
            <span className="tier-path">~/.claude/template-memory/</span>
          </div>
          <div className="mem-file-grid">
            <MemFile
              name="failure-patterns.md"
              count="7 entries"
              date="2h ago"
            />
            <MemFile
              name="architecture-lessons.md"
              count="8 entries"
              date="3h ago"
            />
            <MemFile name="anti-patterns.md" count="6 entries" date="1d ago" />
            <MemFile
              name="testing-patterns.md"
              count="5 entries"
              date="3d ago"
            />
            <MemFile
              name="security-learnings.md"
              count="4 entries"
              date="5d ago"
            />
            <MemFile
              name="NEW_PROJECT_PRIMER.md"
              count="compiled"
              date="2h ago"
              highlight
            />
          </div>
        </div>

        {/* Tier 1 */}
        <div className="memory-tier">
          <div className="tier-header">
            <span className="tier-badge t1">{t("memory.tier1")}</span>
            <span className="tier-title">{t("memory.tier1Title")}</span>
            <span className="tier-path">docs/context/</span>
          </div>
          <div className="mem-file-grid">
            <MemFile name="session-summary.md" count="current" date="2h ago" />
            <MemFile name="decisions.md" count="12 decisions" date="5h ago" />
            <MemFile name="debug-log.md" count="4 entries" date="3h ago" />
            <MemFile name="review-log.md" count="6 reviews" date="5h ago" />
            <MemFile name="deploy-log.md" count="3 deploys" date="2h ago" />
            <MemFile name="test-status.md" count="84% / 81%" date="6h ago" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function MemFile({
  name,
  count,
  date,
  highlight,
}: {
  name: string;
  count: string;
  date: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="mem-file"
      style={
        highlight
          ? {
              borderColor: "var(--amber)",
              background: "rgba(240,165,0,0.04)",
            }
          : undefined
      }
    >
      <div
        className="mem-file-name"
        style={highlight ? { color: "var(--amber)" } : undefined}
      >
        {name}
      </div>
      <div className="mem-file-meta">
        <span
          className="mem-file-count"
          style={highlight ? { color: "var(--amber)" } : undefined}
        >
          {count}
        </span>
        <span className="mem-file-date">{date}</span>
      </div>
    </div>
  );
}
