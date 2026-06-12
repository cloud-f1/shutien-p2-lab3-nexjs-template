import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { extractApiDetail } from "../../api/errors";
import { loginRequestSchema } from "../../schemas/auth";
import type { LoginRequest } from "../../schemas/auth";
import { useLogin } from "../../hooks/useAuth";
import Seo from "../../components/Seo";
import {
  AuthLayout,
  AuthCard,
  Banner,
  Button,
  DividerLabel,
  PasswordField,
  SocialButtons,
} from "../../components/ui";

const TEST_ACCOUNTS = [
  { label: "Test User", email: "test@example.com", password: "test1234" },
  { label: "Admin", email: "admin@example.com", password: "admin1234" },
];

export default function SignInPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
  });

  const onSubmit = (data: LoginRequest) => {
    setBanner(null);

    loginMutation.mutate(data, {
      onSuccess: () => {
        setBanner({
          type: "success",
          message: t("signIn.successMessage"),
        });
        setTimeout(() => navigate("/dashboard"), 600);
      },
      onError: (err) => {
        const detail = extractApiDetail(err);
        if (detail === "LOGIN_BAD_CREDENTIALS") {
          setBanner({
            type: "error",
            message: t("signIn.errorBadCredentials"),
          });
        } else {
          setBanner({
            type: "error",
            message: t("signIn.errorGeneric"),
          });
        }
      },
    });
  };

  const fillTestAccount = (account: (typeof TEST_ACCOUNTS)[number]) => {
    setValue("email", account.email, { shouldValidate: true });
    setValue("password", account.password, { shouldValidate: true });
  };

  return (
    <AuthLayout>
      <Seo title="Sign In" description="Sign in to your account" path="/signin" />
      <AuthCard
        title={t("signIn.title")}
        subtitle={
          <>
            {t("signIn.noAccount")}{" "}
            <Link to="/signup">{t("signIn.signUpLink")}</Link>
          </>
        }
      >
        {banner && <Banner variant={banner.type}>{banner.message}</Banner>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field-group">
            <div className="field">
              <label htmlFor="si-email">{t("signIn.emailLabel")}</label>
              <input
                type="email"
                id="si-email"
                placeholder={t("signIn.emailPlaceholder")}
                autoComplete="email"
                className={errors.email ? "error" : ""}
                aria-describedby={errors.email ? "si-email-error" : undefined}
                aria-invalid={errors.email ? true : undefined}
                {...register("email")}
              />
              {errors.email && (
                <div className="field-hint err" id="si-email-error">
                  {errors.email.message}
                </div>
              )}
            </div>

            <PasswordField
              label={t("signIn.passwordLabel")}
              id="si-pw"
              placeholder={t("signIn.passwordPlaceholder")}
              autoComplete="current-password"
              error={errors.password?.message}
              errorId="si-pw-error"
              {...register("password")}
            />
          </div>

          <div className="form-row">
            <label className="field-check" style={{ margin: 0 }}>
              <input type="checkbox" />
              <span className="check-label">{t("signIn.rememberMe")}</span>
            </label>
            <Link to="/forgot-password" className="forgot-link">
              {t("signIn.forgotPassword")}
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={loginMutation.isPending}
            disabled={loginMutation.isPending}
            className="w-full mt-4"
          >
            {t("signIn.submit")} →
          </Button>
        </form>

        <DividerLabel>{t("signIn.socialLabel")}</DividerLabel>
        <SocialButtons label="" providers={["google", "github"]} />

        {/* Test accounts quick-fill */}
        <div className="test-accounts">
          <div className="test-accounts-label">
            {t("signIn.testAccountsLabel")}
          </div>
          <div className="test-accounts-btns">
            {TEST_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="btn-test-account"
                onClick={() => fillTestAccount(account)}
              >
                {account.label}
                <span className="test-email">{account.email}</span>
              </button>
            ))}
          </div>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
