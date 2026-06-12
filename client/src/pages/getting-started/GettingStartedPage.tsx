import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../../components/Seo";
import { apiClient } from "../../api/client";
import { PublicLayout, Section } from "../../components/ui";

interface CheckItem {
  id: string;
  label: string;
  description: string;
  status: "checking" | "pass" | "fail";
  detail?: string;
}

const INITIAL_CHECKS: CheckItem[] = [
  {
    id: "env",
    label: "Environment configured",
    description: "API server is reachable",
    status: "checking",
  },
  {
    id: "db",
    label: "Database connected",
    description: "PostgreSQL is running and migrated",
    status: "checking",
  },
  {
    id: "auth",
    label: "Authentication working",
    description: "Auth endpoints are responding",
    status: "checking",
  },
];

const CARD_CLS =
  "mx-auto w-full max-w-3xl rounded-lg border border-border bg-surface p-8 md:p-10";

const PROGRESS_TRACK_CLS =
  "h-2 flex-1 rounded-full bg-surface-2 overflow-hidden";
const PROGRESS_FILL_CLS = "h-full rounded-full bg-primary transition-all";

const CHECK_ROW_CLS =
  "flex items-start gap-4 rounded-lg border border-border bg-bg/60 p-4";

const RETRY_BTN_CLS = [
  "mt-6 inline-flex items-center gap-2 rounded border border-border",
  "bg-transparent px-4 py-2 font-body text-sm font-semibold text-text-primary",
  "hover:bg-surface-2 hover:border-text-secondary transition-colors",
].join(" ");

export default function GettingStartedPage() {
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS);
  const [allPassed, setAllPassed] = useState(false);

  useEffect(() => {
    runChecks();
  }, []);

  async function runChecks() {
    const updated = [...INITIAL_CHECKS];

    try {
      const res = await apiClient.get("/health");
      if (res.data?.status === "ok" || res.data?.status === "healthy") {
        updated[0] = {
          ...updated[0],
          status: "pass",
          detail: `API v${res.data.version ?? "unknown"} is running`,
        };
      } else {
        updated[0] = {
          ...updated[0],
          status: "fail",
          detail: `Unexpected status: ${res.data?.status}`,
        };
      }

      if (res.data?.database === "connected") {
        updated[1] = {
          ...updated[1],
          status: "pass",
          detail: "PostgreSQL connected",
        };
      } else {
        updated[1] = {
          ...updated[1],
          status: "fail",
          detail:
            res.data?.database === "disconnected"
              ? "Database is disconnected — check Docker: make db"
              : "No database status available",
        };
      }
    } catch {
      updated[0] = {
        ...updated[0],
        status: "fail",
        detail: "Cannot reach API server — is it running? Try: make go",
      };
      updated[1] = {
        ...updated[1],
        status: "fail",
        detail: "Cannot check database — API server unreachable",
      };
    }

    try {
      await apiClient.post("/auth/jwt/login", new URLSearchParams());
      updated[2] = {
        ...updated[2],
        status: "pass",
        detail: "Auth endpoints responding",
      };
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 422 || status === 400) {
        updated[2] = {
          ...updated[2],
          status: "pass",
          detail: "Auth endpoints responding (login form ready)",
        };
      } else {
        updated[2] = {
          ...updated[2],
          status: "fail",
          detail: "Auth endpoints not responding — check server logs",
        };
      }
    }

    setChecks(updated);
    setAllPassed(updated.every((c) => c.status === "pass"));
  }

  const passedCount = checks.filter((c) => c.status === "pass").length;

  return (
    <PublicLayout>
      <Seo
        title="Getting Started"
        description="Set up your development environment and verify everything is working."
        path="/getting-started"
      />

      <Section
        label="Setup Guide"
        title="Getting Started"
        lede="Verify your development environment is set up correctly."
        ariaLabel="Setup Guide"
      >
        <div className={CARD_CLS}>
          {/* Progress bar */}
          <div className="mb-6 flex items-center gap-3">
            <div className={PROGRESS_TRACK_CLS}>
              <div
                className={PROGRESS_FILL_CLS}
                style={{ width: `${(passedCount / checks.length) * 100}%` }}
              />
            </div>
            <span className="font-mono text-xs text-text-secondary whitespace-nowrap">
              {passedCount}/{checks.length} checks passed
            </span>
          </div>

          {/* Checklist */}
          <ul className="flex flex-col gap-3">
            {checks.map((check) => (
              <li key={check.id} className={CHECK_ROW_CLS}>
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                  {check.status === "checking" && (
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-text-muted"
                      aria-label="Checking..."
                    />
                  )}
                  {check.status === "pass" && (
                    <span
                      className="text-success font-mono text-lg leading-none"
                      aria-label="Passed"
                    >
                      &#10003;
                    </span>
                  )}
                  {check.status === "fail" && (
                    <span
                      className="text-danger font-mono text-lg leading-none"
                      aria-label="Failed"
                    >
                      &#10007;
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-semibold text-text-primary">
                    {check.label}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {check.detail ?? check.description}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Retry button */}
          <button className={RETRY_BTN_CLS} onClick={runChecks} type="button">
            Re-run checks
          </button>

          {/* Next Steps */}
          <div className="mt-10 border-t border-border pt-6">
            <h2 className="font-display text-xl font-semibold text-text-primary">
              {allPassed ? "All systems go!" : "Next Steps"}
            </h2>
            {allPassed ? (
              <div className="mt-4 text-sm text-text-secondary leading-relaxed">
                <p>
                  Your environment is fully configured. Here is what to do next:
                </p>
                <ul className="mt-3 list-disc pl-6 space-y-2">
                  <li>
                    <strong className="text-text-primary">
                      Create your first domain:
                    </strong>{" "}
                    <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-primary">
                      make new-domain NAME=notes
                    </code>
                  </li>
                  <li>
                    <strong className="text-text-primary">
                      Run the interactive tutorial:
                    </strong>{" "}
                    <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-primary">
                      make tutorial
                    </code>
                  </li>
                  <li>
                    <strong className="text-text-primary">
                      Explore the API docs:
                    </strong>{" "}
                    <a
                      className="text-primary underline-offset-2 hover:underline"
                      href="http://localhost:8080/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      localhost:8080/docs
                    </a>
                  </li>
                  <li>
                    <Link
                      to="/dashboard"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Go to Dashboard
                    </Link>
                  </li>
                </ul>
              </div>
            ) : (
              <div className="mt-4 text-sm text-text-secondary leading-relaxed">
                <p>Some checks failed. Try these fixes:</p>
                <ul className="mt-3 list-disc pl-6 space-y-2">
                  <li>
                    <strong className="text-text-primary">
                      Start everything:
                    </strong>{" "}
                    <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-primary">
                      make go
                    </code>
                  </li>
                  <li>
                    <strong className="text-text-primary">
                      Start just the database:
                    </strong>{" "}
                    <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-primary">
                      make db
                    </code>
                  </li>
                  <li>
                    <strong className="text-text-primary">
                      Run diagnostics:
                    </strong>{" "}
                    <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-primary">
                      make doctor
                    </code>
                  </li>
                  <li>
                    <strong className="text-text-primary">
                      Check prerequisites:
                    </strong>{" "}
                    <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-primary">
                      make check-prereqs
                    </code>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
