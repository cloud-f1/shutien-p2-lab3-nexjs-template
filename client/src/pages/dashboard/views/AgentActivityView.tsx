import { useTranslation } from "react-i18next";
import { PageContainer } from "../../../components/ui";

export default function AgentActivityView() {
  const { t } = useTranslation("dashboard");
  return (
    <PageContainer
      eyebrow={t("activity.eyebrow")}
      title={t("activity.title")}
      subtitle={t("activity.subtitle")}
    >
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <span className="panel-icon">{"\u25CE"}</span>{" "}
            {t("activity.feedTitle")}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span className="filter-tag active">{t("activity.allAgents")}</span>
          </div>
        </div>
        <div>
          <ActivityRow
            icon={"\uD83D\uDE80"}
            agentClass="agent-deploy"
            name="@deployer"
            project="my-saas-app"
            time="2h ago"
            text={
              <>
                6/6 gates passed. Server 84%, client 81%, openapi lint{" "}
                {"\u2713"}, TypeScript 0 errors, git clean, branch main. Pushed
                to Zeabur. <strong>Health check 200</strong>.
              </>
            }
          />
          <ActivityRow
            icon={"\uD83E\uDDE0"}
            agentClass="agent-curator"
            name="@memory-curator"
            project="my-saas-app"
            time="3h ago"
            text={
              <>
                Scanned debug-log.md. Tagged <strong>2 entries</strong>{" "}
                <code>[GENERALIZABLE]</code>: PyJWT pattern + asyncio_mode
                config. Added to promote queue.
              </>
            }
          />
          <ActivityRow
            icon={"\uD83D\uDD0D"}
            agentClass="agent-review"
            name="@code-reviewer"
            project="my-saas-app"
            time="5h ago"
            text={
              <>
                <strong>
                  Critical: 0 &middot; Warning: 1 &middot; Suggestion: 2
                </strong>
                . Warning: auth.py L47 hardcoded TTL=900. User fixed &rarr;
                re-review passed LGTM.
              </>
            }
          />
          <ActivityRow
            icon={"\uD83E\uDDEA"}
            agentClass="agent-test"
            name="@test-runner"
            project="my-saas-app"
            time="6h ago"
            text={
              <>
                pytest coverage <strong>84%</strong> (server) &middot; vitest{" "}
                <strong>81%</strong> (client). Both above 80% gate. Lint 0
                errors. TypeScript clean.
              </>
            }
          />
          <ActivityRow
            icon={"\uD83D\uDCD0"}
            agentClass="agent-deploy"
            name="@spec-writer"
            project="my-saas-app"
            time="8h ago"
            text={
              <>
                Designed <code>POST /auth/logout</code> endpoint. Redoc lint
                passed. <code>openapi-typescript</code> ran. Implementation plan
                written to spec-log.md.
              </>
            }
          />
          <ActivityRow
            icon={"\uD83C\uDFDB\uFE0F"}
            agentClass="agent-curator"
            name="@best-practice"
            project="my-saas-app"
            time="1d ago"
            text={
              <>
                Architecture decision ADR-012: refresh token rotation strategy.
                Chose <strong>single-use rotation</strong> with family tracking.
                Logged to decisions.md.
              </>
            }
          />
          <ActivityRow
            icon={"\uD83D\uDC1B"}
            agentClass="agent-review"
            name="@debugger"
            project="ravenotion"
            time="1d ago"
            text={
              <>
                5-phase root cause: Cloudflare Worker CPU time exceeded on large
                Notion pages. Fix: pagination + streaming response. Tagged{" "}
                <code>[GENERALIZABLE]</code>.
              </>
            }
          />
          <ActivityRow
            icon={"\uD83D\uDCE1"}
            agentClass="agent-test"
            name="@devops-monitor"
            project="n8n-hub"
            time="12d ago"
            text={
              <>
                Health check: <strong>All green</strong>. Response p99 &lt;
                200ms. Memory 68%. No alerts. Health-log.md updated.
              </>
            }
          />
        </div>
      </div>
    </PageContainer>
  );
}

function ActivityRow({
  icon,
  agentClass,
  name,
  project,
  time,
  text,
}: {
  icon: string;
  agentClass: string;
  name: string;
  project: string;
  time: string;
  text: React.ReactNode;
}) {
  return (
    <div className="activity-item">
      <div className={`activity-agent-icon ${agentClass}`}>{icon}</div>
      <div className="activity-body">
        <div className="activity-top">
          <span className="activity-agent-name">{name}</span>
          <span className="activity-project">&middot; {project}</span>
          <span className="activity-time">{time}</span>
        </div>
        <div className="activity-text">{text}</div>
      </div>
    </div>
  );
}
