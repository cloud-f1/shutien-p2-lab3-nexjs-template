import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { forgotPasswordRequestSchema } from "../../schemas/auth";
import type { ForgotPasswordRequest } from "../../schemas/auth";
import { useForgotPassword } from "../../hooks/useAuth";
import Seo from "../../components/Seo";
import { AuthLayout, AuthCard, Banner, Button } from "../../components/ui";

export default function ForgotPasswordPage() {
  const { t } = useTranslation("auth");
  const mutation = useForgotPassword();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
  });

  const onSubmit = (data: ForgotPasswordRequest) => {
    mutation.mutate(data, {
      onSettled: () => {
        // Always show success — email enumeration prevention
        setSubmitted(true);
      },
    });
  };

  return (
    <AuthLayout>
      <Seo
        title="Forgot Password"
        description="Reset your password"
        path="/forgot-password"
      />
      <AuthCard
        title={t("forgotPassword.title")}
        subtitle={t("forgotPassword.subtitle")}
        footer={
          <Link to="/signin" className="forgot-link">
            ← {t("forgotPassword.backToSignIn")}
          </Link>
        }
      >
        {submitted && (
          <Banner variant="success">
            {t("forgotPassword.successMessage")}
          </Banner>
        )}

        {!submitted && (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="field-group">
              <div className="field">
                <label htmlFor="fp-email">
                  {t("forgotPassword.emailLabel")}
                </label>
                <input
                  type="email"
                  id="fp-email"
                  placeholder={t("forgotPassword.emailPlaceholder")}
                  autoComplete="email"
                  className={errors.email ? "error" : ""}
                  aria-describedby={
                    errors.email ? "fp-email-error" : undefined
                  }
                  aria-invalid={errors.email ? true : undefined}
                  {...register("email")}
                />
                {errors.email && (
                  <div className="field-hint err" id="fp-email-error">
                    {errors.email.message}
                  </div>
                )}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={mutation.isPending}
              disabled={mutation.isPending}
              className="w-full mt-4"
            >
              {t("forgotPassword.submit")} →
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
