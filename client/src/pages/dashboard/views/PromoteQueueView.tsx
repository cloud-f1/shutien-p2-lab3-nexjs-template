import { useTranslation } from "react-i18next";
import { PageContainer } from "../../../components/ui";

export default function PromoteQueueView() {
  const { t } = useTranslation("dashboard");
  return (
    <PageContainer
      eyebrow={t("promote.eyebrow")}
      title={t("promote.title")}
      subtitle={t("promote.subtitle")}
    >
      <div
        style={{
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button className="topbar-btn primary" style={{ fontSize: 12 }}>
          {"\u2191"} {t("promote.promoteAll")} (5)
        </button>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--gray2)",
          }}
        >
          {t("promote.promoteHint")}
        </span>
      </div>

      <div className="panel">
        <div>
          <PromoteItem
            title="PyJWT import pattern — never use python-jose"
            desc={
              <>
                python-jose has been unmaintained since 2022 with known RS256
                vulnerability. Always{" "}
                <code className="code-green">import jwt</code> from PyJWT
                {"\u2265"}2.9.
              </>
            }
            source="my-saas-app /debug-log.md"
            target="failure-patterns.md"
            promoteLabel={t("promote.promoteBtn")}
          />
          <PromoteItem
            title={'asyncio_mode = "auto" in pyproject.toml'}
            desc={
              <>
                Eliminates{" "}
                <code className="code-amber">@pytest.mark.asyncio</code>{" "}
                decorator on every async test. Works with pytest-asyncio
                {"\u2265"}0.21.
              </>
            }
            source="my-saas-app /debug-log.md"
            target="testing-patterns.md"
            promoteLabel={t("promote.promoteBtn")}
          />
          <PromoteItem
            title="forgot-password always returns HTTP 200"
            desc="Prevents email enumeration attacks. Return 200 regardless of whether the email exists in the database. Send email only internally after response."
            source="my-saas-app /review-log.md"
            target="security-learnings.md"
            promoteLabel={t("promote.promoteBtn")}
          />
          <PromoteItem
            title="Cloudflare Worker CPU time limit on large payloads"
            desc="Workers have a 50ms CPU wall. For large Notion pages, implement pagination with streaming response — never try to process entire document in one request."
            source="ravenotion / debug-log.md"
            target="architecture-lessons.md"
            promoteLabel={t("promote.promoteBtn")}
          />
          <PromoteItem
            title="Access token must never touch localStorage"
            desc={
              <>
                XSS can read localStorage. Access tokens belong in in-memory{" "}
                <code className="code-amber">tokenCache.ts</code> only. Refresh
                token in httpOnly cookie for production.
              </>
            }
            source="my-saas-app /review-log.md"
            target="anti-patterns.md"
            promoteLabel={t("promote.promoteBtn")}
          />
        </div>
      </div>
    </PageContainer>
  );
}

function PromoteItem({
  title,
  desc,
  source,
  target,
  promoteLabel,
}: {
  title: string;
  desc: React.ReactNode;
  source: string;
  target: string;
  promoteLabel: string;
}) {
  return (
    <div className="promote-item-full">
      <span className="promote-tag">GENERALIZABLE</span>
      <div className="promote-body">
        <div className="promote-title">{title}</div>
        <div className="promote-desc">{desc}</div>
        <div className="promote-meta-row">
          <span className="promote-source">
            {"\uD83D\uDCC2"} {source}
          </span>
          <span className="promote-target">&rarr; {target}</span>
        </div>
      </div>
      <div className="promote-actions">
        <button className="promote-btn approve">
          {"\u2713"} {promoteLabel}
        </button>
        <button className="promote-btn dismiss">{"\u2715"}</button>
      </div>
    </div>
  );
}
