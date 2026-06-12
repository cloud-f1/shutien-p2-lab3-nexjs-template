import { useTranslation } from "react-i18next";
import { useSubscription, useCreatePortal } from "../../hooks/useBilling";
import type { SubscriptionRead } from "../../schemas/billing";
import "./BillingSettingsPage.css";

interface BillingSettingsPageProps {
  teamId: string | undefined;
}

function SubscriptionDetails({
  subscription,
}: {
  subscription: SubscriptionRead;
}) {
  const { t } = useTranslation("billing");
  const { plan, status } = subscription;
  const isFree = status === "free";

  return (
    <div className="billing-details" role="region" aria-label="Subscription details">
      <div className="billing-details__plan">
        <h3 className="billing-details__plan-name">{plan.name}</h3>
        <span
          className={`billing-details__status billing-details__status--${status}`}
          role="status"
        >
          {status}
        </span>
      </div>

      {!isFree && (
        <dl className="billing-details__info">
          {subscription.current_period_end && (
            <>
              <dt>{t("settings.nextBilling")}</dt>
              <dd>
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </dd>
            </>
          )}
          {subscription.cancel_at_period_end && (
            <>
              <dt>{t("settings.cancellation")}</dt>
              <dd>{t("settings.cancelsAtEnd")}</dd>
            </>
          )}
        </dl>
      )}

      <div className="billing-details__features">
        <h4>{t("settings.planFeatures")}</h4>
        <ul role="list">
          {Object.entries(plan.features || {}).map(([key, value]) => (
            <li key={key}>
              <span aria-hidden="true">{value ? "+" : "-"}</span>{" "}
              {key.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function BillingSettingsPage({
  teamId,
}: BillingSettingsPageProps) {
  const { t } = useTranslation("billing");
  const {
    data: subscription,
    isLoading,
    error,
  } = useSubscription(teamId);
  const createPortal = useCreatePortal();

  const handleManageSubscription = () => {
    if (!teamId) return;
    createPortal.mutate(
      { team_id: teamId },
      {
        onSuccess: (data) => {
          window.location.href = data.portal_url;
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="billing-settings" role="status" aria-live="polite">
        {t("settings.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="billing-settings" role="alert">
        <p className="billing-settings__error">
          {t("settings.error")}
        </p>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const isFree = subscription.status === "free";
  const hasStripeCustomer = !!subscription.stripe_customer_id;

  return (
    <section
      className="billing-settings"
      aria-label={t("settings.title")}
    >
      <div className="billing-settings__header">
        <h2 className="billing-settings__title">{t("settings.title")}</h2>
      </div>

      <SubscriptionDetails subscription={subscription} />

      <div className="billing-settings__actions">
        {isFree ? (
          <a
            href="/pricing"
            className="billing-settings__btn billing-settings__btn--primary"
          >
            {t("settings.upgradePlan")}
          </a>
        ) : hasStripeCustomer ? (
          <button
            className="billing-settings__btn billing-settings__btn--primary"
            onClick={handleManageSubscription}
            disabled={createPortal.isPending}
            type="button"
          >
            {createPortal.isPending
              ? t("settings.openingPortal")
              : t("settings.manageSubscription")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
