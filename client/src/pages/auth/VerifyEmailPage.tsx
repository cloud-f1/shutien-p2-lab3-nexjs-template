import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi } from "../../api/auth";
import { extractApiDetail } from "../../api/errors";
import Seo from "../../components/Seo";
import { AuthLayout, AuthCard, Banner } from "../../components/ui";

type Status = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const { t } = useTranslation("auth");
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<Status>(token ? "loading" : "error");
  const [errorMessage, setErrorMessage] = useState(
    token ? "" : t("verifyEmail.noTokenError"),
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    authApi
      .verifyEmail(token)
      .then(() => {
        if (!cancelled) setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = extractApiDetail(err);
        if (detail === "VERIFY_USER_BAD_TOKEN") {
          setErrorMessage(t("verifyEmail.badTokenError"));
        } else {
          setErrorMessage(t("verifyEmail.genericError"));
        }
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const title =
    status === "loading"
      ? t("verifyEmail.loadingTitle")
      : status === "success"
        ? t("verifyEmail.successTitle")
        : t("verifyEmail.errorTitle");

  const subtitle =
    status === "loading"
      ? t("verifyEmail.loadingSubtitle")
      : status === "error"
        ? t("verifyEmail.errorSubtitle")
        : undefined;

  return (
    <AuthLayout>
      <Seo
        title="Verify Email"
        description="Verify your email address"
        path="/verify-email"
      />
      <AuthCard
        title={title}
        subtitle={subtitle}
        footer={
          <Link to="/signin" className="forgot-link">
            {status === "success"
              ? `${t("verifyEmail.signInLink")} →`
              : `← ${t("verifyEmail.backToSignIn")}`}
          </Link>
        }
      >
        {status === "loading" && (
          <div
            className="text-center py-6"
            role="status"
            aria-label="Verifying"
          >
            <span
              className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
          </div>
        )}

        {status === "success" && (
          <Banner variant="success">{t("verifyEmail.successMessage")}</Banner>
        )}

        {status === "error" && (
          <Banner variant="error">{errorMessage}</Banner>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
