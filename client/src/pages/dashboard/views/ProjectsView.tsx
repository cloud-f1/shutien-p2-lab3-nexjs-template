import { useTranslation } from "react-i18next";
import { PageContainer } from "../../../components/ui";

export default function ProjectsView() {
  const { t } = useTranslation("dashboard");
  return (
    <PageContainer
      eyebrow={t("projects.eyebrow")}
      title={t("projects.title")}
      subtitle={t("projects.subtitle")}
    >
      <div className="grid-3">
        <div
          className="project-card"
          style={
            {
              "--card-accent": "var(--green)",
              "--card-accent-hover": "var(--green)",
            } as React.CSSProperties
          }
        >
          <div className="project-card-header">
            <div>
              <div className="project-name">My SaaS App</div>
              <div className="project-slug">my-saas-app &middot; Track 1</div>
            </div>
            <span className="badge active">active</span>
          </div>
          <div className="project-meta">
            <div className="meta-row">
              <span className="meta-label">{t("projects.coverage")}</span>
              <div className="cov-bar-wrap">
                <div className="cov-bar" style={{ width: "84%" }} />
              </div>
              <span className="meta-val green">84%</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">{t("projects.track")}</span>
              <span className="meta-val">Auth &amp; Identity Core</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">{t("projects.stack")}</span>
              <span className="meta-val">FastAPI + React + PostgreSQL</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">{t("projects.deploy")}</span>
              <span className="meta-val green">
                Zeabur staging &middot; healthy
              </span>
            </div>
          </div>
          <div className="project-footer">
            <span>Last: @deployer &middot; 2h ago</span>
            <span style={{ color: "var(--amber)" }}>
              12 decisions logged &rarr;
            </span>
          </div>
        </div>

        <div
          className="project-card"
          style={
            {
              "--card-accent": "var(--amber)",
              "--card-accent-hover": "var(--amber2)",
            } as React.CSSProperties
          }
        >
          <div className="project-card-header">
            <div>
              <div className="project-name">RaveNotion</div>
              <div className="project-slug">ravenotion &middot; Cloudflare</div>
            </div>
            <span className="badge staging">staging</span>
          </div>
          <div className="project-meta">
            <div className="meta-row">
              <span className="meta-label">{t("projects.coverage")}</span>
              <div className="cov-bar-wrap">
                <div className="cov-bar warn" style={{ width: "76%" }} />
              </div>
              <span className="meta-val amber">76%</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">{t("projects.track")}</span>
              <span className="meta-val">SEO Pipeline</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">{t("projects.stack")}</span>
              <span className="meta-val">Cloudflare Workers + Next.js</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">{t("projects.deploy")}</span>
              <span className="meta-val amber">
                Staging &middot; coverage below gate
              </span>
            </div>
          </div>
          <div className="project-footer">
            <span>Last: @test-runner &middot; 1d ago</span>
            <span style={{ color: "var(--amber)" }}>
              8 decisions logged &rarr;
            </span>
          </div>
        </div>

        <div
          className="project-card"
          style={{ "--card-accent": "var(--gray2)" } as React.CSSProperties}
        >
          <div className="project-card-header">
            <div>
              <div className="project-name">n8n Automation Hub</div>
              <div className="project-slug">n8n-hub &middot; Zeabur</div>
            </div>
            <span className="badge paused">paused</span>
          </div>
          <div className="project-meta">
            <div className="meta-row">
              <span className="meta-label">{t("projects.coverage")}</span>
              <div className="cov-bar-wrap">
                <div className="cov-bar" style={{ width: "91%" }} />
              </div>
              <span className="meta-val green">91%</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">{t("projects.track")}</span>
              <span className="meta-val">Workflow Engine</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">{t("projects.stack")}</span>
              <span className="meta-val">n8n + TypeScript + Supabase</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">{t("projects.deploy")}</span>
              <span className="meta-val">
                Production &middot; no recent activity
              </span>
            </div>
          </div>
          <div className="project-footer">
            <span>Last: @best-practice &middot; 12d ago</span>
            <span style={{ color: "var(--gray2)" }}>18 decisions logged</span>
          </div>
        </div>
      </div>

      {/* New project CTA */}
      <div className="new-project-cta">
        <div className="new-project-title">{t("projects.newProject")}</div>
        <div className="new-project-sub">{t("projects.newProjectSub")}</div>
      </div>
    </PageContainer>
  );
}
