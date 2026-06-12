import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../../components/Seo";
import { usePlans } from "../../hooks/useBilling";
import type { PlanRead } from "../../schemas/billing";
import "./PricingPage.css";

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function PlanCard({ plan }: { plan: PlanRead }) {
  const { t } = useTranslation("billing");
  const navigate = useNavigate();
  const isFree = plan.amount === 0;
  const isPopular = plan.slug === "pro";

  return (
    <article
      className={`pricing-card${isPopular ? " pricing-card--popular" : ""}`}
      aria-label={`${plan.name} plan`}
    >
      {isPopular && (
        <span className="pricing-card__badge" aria-label={t("pricing.mostPopular")}>
          {t("pricing.mostPopular")}
        </span>
      )}
      <h3 className="pricing-card__name">{plan.name}</h3>
      <div className="pricing-card__price">
        <span className="pricing-card__amount">
          {isFree ? t("pricing.free") : formatAmount(plan.amount, plan.currency)}
        </span>
        {!isFree && (
          <span className="pricing-card__interval">/{plan.interval}</span>
        )}
      </div>
      <ul className="pricing-card__features" role="list">
        {Object.entries(plan.features || {}).map(([key, value]) => (
          <li key={key} className="pricing-card__feature">
            <span
              className="pricing-card__feature-icon"
              aria-hidden="true"
            >
              {value ? "+" : "-"}
            </span>
            {key.replace(/_/g, " ")}
          </li>
        ))}
        {plan.limits &&
          Object.entries(plan.limits).map(([key, value]) => (
            <li key={key} className="pricing-card__feature">
              <span
                className="pricing-card__feature-icon"
                aria-hidden="true"
              >
                +
              </span>
              {String(value)} {key.replace(/_/g, " ")}
            </li>
          ))}
      </ul>
      <button
        className={`pricing-card__cta${isFree ? " pricing-card__cta--secondary" : ""}`}
        onClick={() => navigate(isFree ? "/signup" : "/signin")}
        type="button"
      >
        {isFree ? t("pricing.getStarted") : t("pricing.subscribe")}
      </button>
    </article>
  );
}

export default function PricingPage() {
  const { t } = useTranslation("billing");
  const { data: plans, isLoading, error } = usePlans();

  return (
    <main className="pricing-page" id="main-content">
      <Seo
        title="Pricing"
        description="Choose the right plan for your team. Start free, upgrade when you need more."
        path="/pricing"
      />
      <header className="pricing-page__header">
        <h1 className="pricing-page__title">{t("pricing.title")}</h1>
        <p className="pricing-page__subtitle">
          {t("pricing.subtitle")}
        </p>
      </header>

      {isLoading && (
        <div className="pricing-page__loading" role="status" aria-live="polite">
          {t("pricing.loading")}
        </div>
      )}

      {error && (
        <div className="pricing-page__error" role="alert">
          {t("pricing.error")}
        </div>
      )}

      {plans && plans.length > 0 && (
        <section
          className="pricing-page__grid"
          aria-label="Pricing plans"
        >
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </section>
      )}
    </main>
  );
}
