import { useTranslation } from "react-i18next";
import { PageContainer } from "../../../components/ui";

export default function CommandsView() {
  const { t } = useTranslation("dashboard");
  const commands = [
    {
      cmd: '/spec "feature"',
      agent: "@spec-writer",
      trigger: "Any new feature start",
      gate: "openapi lint",
      gateColor: "var(--green)",
      writeback: "spec-log.md",
    },
    {
      cmd: "/implement feature",
      agent: "@spec-writer",
      trigger: "Spec exists, RED tests written",
      gate: "tests pass",
      gateColor: "var(--green)",
      writeback: "session-summary.md",
    },
    {
      cmd: "/review",
      agent: "@code-reviewer",
      trigger: "After any code change",
      gate: "no critical",
      gateColor: "var(--red)",
      writeback: "review-log.md",
    },
    {
      cmd: "/test",
      agent: "@test-runner",
      trigger: "Code complete, before deploy",
      gate: "\u226580% coverage",
      gateColor: "var(--green)",
      writeback: "test-status.md",
    },
    {
      cmd: "/deploy [staging|prod]",
      agent: "@deployer",
      trigger: "Tests + review passed",
      gate: "6 gates",
      gateColor: "var(--green)",
      writeback: "deploy-log.md",
    },
    {
      cmd: "/monitor",
      agent: "@devops-monitor",
      trigger: "Post-deploy or scheduled",
      gate: "health status",
      gateColor: "#4d9fff",
      writeback: "health-log.md",
    },
    {
      cmd: "/update-docs",
      agent: "All agents",
      trigger: "Session end or checkpoint",
      gate: "\u2014",
      gateColor: "var(--gray2)",
      writeback: "all context files",
    },
    {
      cmd: "/promote-learnings",
      agent: "@memory-curator",
      trigger: "End of each track",
      gate: "\u2014",
      gateColor: "var(--gray2)",
      writeback: "template-memory/",
    },
  ];

  return (
    <PageContainer
      eyebrow={t("commands.eyebrow")}
      title={t("commands.title")}
      subtitle={t("commands.subtitle")}
    >
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">/ {t("commands.allCommands")}</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("commands.thCommand")}</th>
              <th>{t("commands.thAgent")}</th>
              <th>{t("commands.thTrigger")}</th>
              <th>{t("commands.thGate")}</th>
              <th>{t("commands.thWriteback")}</th>
            </tr>
          </thead>
          <tbody>
            {commands.map((c) => (
              <tr key={c.cmd}>
                <td>
                  <span className="td-mono" style={{ color: "var(--amber)" }}>
                    {c.cmd}
                  </span>
                </td>
                <td>
                  <span className="td-mono">{c.agent}</span>
                </td>
                <td>{c.trigger}</td>
                <td>
                  <span style={{ color: c.gateColor }}>{c.gate}</span>
                </td>
                <td className="td-dim">{c.writeback}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
