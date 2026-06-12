import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { extractApiDetail } from "../../api/errors";
import { resetPasswordRequestSchema } from "../../schemas/auth";
import type { ResetPasswordRequest } from "../../schemas/auth";
import { useResetPassword } from "../../hooks/useAuth";
import Seo from "../../components/Seo";
import {
  AuthLayout,
  AuthCard,
  Banner,
  Button,
  PasswordField,
} from "../../components/ui";

export default function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const mutation = useResetPassword();
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordRequest>({
    resolver: zodResolver(resetPasswordRequestSchema),
    defaultValues: { token },
  });

  const onSubmit = (data: ResetPasswordRequest) => {
    setBanner(null);

    mutation.mutate(data, {
      onSuccess: () => {
        setBanner({
          type: "success",
          message: t("resetPassword.successMessage"),
        });
      },
      onError: (err) => {
        const detail = extractApiDetail(err);
        if (detail === "RESET_PASSWORD_BAD_TOKEN") {
          setBanner({
            type: "error",
            message: t("resetPassword.errorBadToken"),
          });
        } else {
          setBanner({
            type: "error",
            message: t("resetPassword.errorGeneric"),
          });
        }
      },
    });
  };

  if (!token) {
    return (
      <AuthLayout>
        <AuthCard
          title={t("resetPassword.invalidLinkTitle")}
          subtitle={t("resetPassword.invalidLinkSubtitle")}
          footer={
            <Link to="/forgot-password" className="forgot-link">
              {t("resetPassword.requestNewLink")} →
            </Link>
          }
        >
          <Banner variant="error">
            {t("resetPassword.invalidLinkMessage")}
          </Banner>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Seo
        title="Reset Password"
        description="Set a new password"
        path="/reset-password"
      />
      <AuthCard
        title={t("resetPassword.title")}
        subtitle={t("resetPassword.subtitle")}
        footer={
          <Link to="/signin" className="forgot-link">
            ← {t("resetPassword.backToSignIn")}
          </Link>
        }
      >
        {banner && (
          <Banner variant={banner.type}>{banner.message}</Banner>
        )}

        {banner?.type !== "success" && (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <input type="hidden" {...register("token")} />

            <div className="field-group">
              <PasswordField
                label={t("resetPassword.newPasswordLabel")}
                id="rp-pw"
                placeholder={t("resetPassword.newPasswordPlaceholder")}
                autoComplete="new-password"
                showStrength
                error={errors.new_password?.message}
                errorId="rp-pw-error"
                {...register("new_password")}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={mutation.isPending}
              disabled={mutation.isPending}
              className="w-full mt-4"
            >
              {t("resetPassword.submit")} →
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
