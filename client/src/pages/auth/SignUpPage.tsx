import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { extractApiDetail } from "../../api/errors";
import { registerRequestSchema } from "../../schemas/auth";
import type { RegisterRequest } from "../../schemas/auth";
import { useRegister } from "../../hooks/useAuth";
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

export default function SignUpPage() {
  const { t } = useTranslation("auth");
  const registerMutation = useRegister();
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
  });

  const onSubmit = (data: RegisterRequest) => {
    if (!termsAccepted) {
      setBanner({
        type: "error",
        message: t("signUp.termsError"),
      });
      return;
    }
    setBanner(null);

    registerMutation.mutate(data, {
      onSuccess: () => {
        setBanner({
          type: "success",
          message: t("signUp.successMessage", { email: data.email }),
        });
      },
      onError: (err) => {
        const detail = extractApiDetail(err);
        if (detail === "REGISTER_USER_ALREADY_EXISTS") {
          setBanner({
            type: "error",
            message: t("signUp.errorAlreadyExists"),
          });
        } else {
          setBanner({
            type: "error",
            message: t("signUp.errorGeneric"),
          });
        }
      },
    });
  };

  return (
    <AuthLayout>
      <Seo title="Sign Up" description="Create a new account" path="/signup" />
      <AuthCard
        title={t("signUp.title")}
        subtitle={
          <>
            {t("signUp.hasAccount")}{" "}
            <Link to="/signin">{t("signUp.signInLink")}</Link>
          </>
        }
      >
        {banner && <Banner variant={banner.type}>{banner.message}</Banner>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field-group">
            <div className="field">
              <label htmlFor="su-name">{t("signUp.displayNameLabel")}</label>
              <input
                type="text"
                id="su-name"
                placeholder={t("signUp.displayNamePlaceholder")}
                autoComplete="name"
                className={errors.display_name ? "error" : ""}
                aria-describedby={
                  errors.display_name ? "su-name-error" : undefined
                }
                aria-invalid={errors.display_name ? true : undefined}
                {...register("display_name")}
              />
              {errors.display_name && (
                <div className="field-hint err" id="su-name-error">
                  {errors.display_name.message}
                </div>
              )}
            </div>

            <div className="field">
              <label htmlFor="su-email">{t("signUp.emailLabel")}</label>
              <input
                type="email"
                id="su-email"
                placeholder={t("signUp.emailPlaceholder")}
                autoComplete="email"
                className={errors.email ? "error" : ""}
                aria-describedby={errors.email ? "su-email-error" : undefined}
                aria-invalid={errors.email ? true : undefined}
                {...register("email")}
              />
              {errors.email && (
                <div className="field-hint err" id="su-email-error">
                  {errors.email.message}
                </div>
              )}
            </div>

            <PasswordField
              label={t("signUp.passwordLabel")}
              id="su-pw"
              placeholder={t("signUp.passwordPlaceholder")}
              autoComplete="new-password"
              showStrength
              error={errors.password?.message}
              errorId="su-pw-error"
              {...register("password")}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="field-check">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span className="check-label">
                {t("signUp.termsAgree")}{" "}
                <a href="#">{t("signUp.termsLink")}</a>{" "}
                {t("signUp.termsAnd")}{" "}
                <a href="#">{t("signUp.privacyLink")}</a>
              </span>
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={registerMutation.isPending}
            disabled={registerMutation.isPending}
            className="w-full"
          >
            {t("signUp.submit")} →
          </Button>
        </form>

        <DividerLabel>{t("signUp.socialLabel")}</DividerLabel>
        <SocialButtons label="" providers={["google", "github"]} />
      </AuthCard>
    </AuthLayout>
  );
}
