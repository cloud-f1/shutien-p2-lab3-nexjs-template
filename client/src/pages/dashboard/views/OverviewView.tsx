import { useTranslation } from "react-i18next";
import { useCurrentUser } from "../../../hooks/useAuth";
import StatCard from "../../../components/dashboard/StatCard";
import { PageContainer } from "../../../components/ui";

export default function OverviewView() {
  const { t } = useTranslation("dashboard");
  const { data: user } = useCurrentUser();
  const userName = user?.display_name || user?.email?.split("@")[0] || "User";

  return (
    <PageContainer
      eyebrow={t("overview.eyebrow")}
      title={t("overview.greeting", { name: userName })}
      subtitle={t("overview.summary")}
    >
      {/* Stats */}
      <div className="stats-row">
        <StatCard
          label={t("overview.statProjects")}
          value="3"
          suffix={t("overview.statProjectsSuffix")}
          delta={t("overview.statProjectsDelta")}
          deltaDir="up"
          glow="rgba(240,165,0,0.06)"
        />
        <StatCard
          label={t("overview.statMemory")}
          value="24"
          suffix={t("overview.statMemorySuffix")}
          delta={t("overview.statMemoryDelta")}
          deltaDir="up"
          glow="rgba(165,148,255,0.06)"
        />
        <StatCard
          label={t("overview.statCoverage")}
          value="83"
          suffix="%"
          delta={t("overview.statCoverageDelta")}
          deltaDir="up"
          glow="rgba(0,212,138,0.06)"
        />
        <StatCard
          label={t("overview.statDeploys")}
          value="12"
          suffix={t("overview.statDeploysSuffix")}
          delta={t("overview.statDeploysDelta")}
          deltaDir="flat"
          glow="rgba(77,159,255,0.06)"
        />
      </div>

      {/* Recent projects + Promote queue */}
      <div className="grid-62">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-icon">{"\u25EB"}</span>{" "}
              {t("overview.recentProjects")}
            </div>
            <button className="panel-action">
              {t("buttons.viewAll", { ns: "common" })} &rarr;
            </button>
          </div>
          <div>
            <ProjectRow
              name="My SaaS App"
              slug="my-saas-app"
              track="Track 1"
              cov="84% cov"
              covColor="var(--green)"
              focus="auth endpoints"
              status="active"
            />
            <ProjectRow
              name="RaveNotion"
              slug="ravenotion"
              track="Cloudflare Workers"
              cov="76% cov"
              covColor="var(--amber)"
              focus="seo pipeline"
              status="staging"
            />
            <ProjectRow
              name="n8n Automation Hub"
              slug="n8n-hub"
              track="Zeabur"
              cov="paused"
              covColor="var(--gray2)"
              focus="no activity"
              status="paused"
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-icon">{"\u2191"}</span>{" "}
              {t("overview.promoteQueue")}
            </div>
            <button className="panel-action">
              {t("overview.promoteAll")} &rarr;
            </button>
          </div>
          <div>
            <div className="promote-item" style={{ display: "flex", gap: 12 }}>
              <span className="promote-tag">GENERALIZABLE</span>
              <div>
                <div className="promote-title">PyJWT import pattern</div>
                <div className="promote-desc">
                  Never use{" "}
                  <code
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--red)",
                      background: "var(--bg3)",
                      padding: "1px 4px",
                      borderRadius: 2,
                    }}
                  >
                    python-jose
                  </code>
                </div>
                <div className="promote-target">&rarr; failure-patterns.md</div>
              </div>
            </div>
            <div className="promote-item" style={{ display: "flex", gap: 12 }}>
              <span className="promote-tag">GENERALIZABLE</span>
              <div>
                <div className="promote-title">asyncio_mode = auto</div>
                <div className="promote-desc">
                  Eliminates decorator on every async test
                </div>
                <div className="promote-target">&rarr; testing-patterns.md</div>
              </div>
            </div>
            <div
              style={{
                padding: "12px 16px",
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--gray2)",
              }}
            >
              {t("overview.moreItems", { count: 3 })}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Activity + Quick Commands */}
      <div className="grid-62">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-icon">{"\u25CE"}</span>{" "}
              {t("overview.recentActivity")}
            </div>
            <button className="panel-action">
              {t("overview.fullLog")} &rarr;
            </button>
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
                  All 6 gates passed. <code>git push origin main</code> &rarr;
                  Zeabur staging deployed. Health check <strong>200 OK</strong>.
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
                  Tagged <strong>2 items</strong> <code>[GENERALIZABLE]</code>{" "}
                  in debug-log.md. NEW_PROJECT_PRIMER.md queued for
                  regeneration.
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
                  <strong>0 critical</strong>, 1 warning: hardcoded TTL on
                  auth.py L47. Fixed and confirmed LGTM.
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
                  Coverage <strong>84%</strong> (server) &middot;{" "}
                  <strong>81%</strong> (client). Gate cleared. TypeScript 0
                  errors.
                </>
              }
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-icon">/</span>{" "}
              {t("overview.quickCommands")}
            </div>
          </div>
          <div className="commands-grid">
            {[
              { name: "/spec", desc: "Design a feature spec before any code" },
              { name: "/review", desc: "Security + quality gate on git diff" },
              {
                name: "/test",
                desc: "Run coverage gate, block deploy if <80%",
              },
              {
                name: "/deploy",
                desc: "6-gate deploy to staging or production",
              },
              {
                name: "/promote-learnings",
                desc: "Push GENERALIZABLE items to Tier 0",
              },
              {
                name: "/update-docs",
                desc: "All agents checkpoint to docs/context/",
              },
            ].map((cmd) => (
              <div className="cmd-card" key={cmd.name}>
                <div className="cmd-name">{cmd.name}</div>
                <div className="cmd-desc">{cmd.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

/* ── Helpers ── */

function ProjectRow({
  name,
  slug,
  track,
  cov,
  covColor,
  focus,
  status,
}: {
  name: string;
  slug: string;
  track: string;
  cov: string;
  covColor: string;
  focus: string;
  status: "active" | "staging" | "paused";
}) {
  return (
    <div className="project-row">
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--white)",
            marginBottom: 2,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--gray2)",
          }}
        >
          {slug} &middot; {track}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: covColor,
              marginBottom: 2,
            }}
          >
            {cov}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--gray2)",
            }}
          >
            {focus}
          </div>
        </div>
        <span className={`badge ${status}`}>{status}</span>
      </div>
    </div>
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
