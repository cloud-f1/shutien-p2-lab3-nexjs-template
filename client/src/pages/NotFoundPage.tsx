import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import { EmptyState, PublicLayout } from "../components/ui";

export default function NotFoundPage() {
  const { t } = useTranslation("common");

  return (
    <PublicLayout>
      <Seo
        title="Page Not Found"
        description="The page you're looking for doesn't exist"
        path=""
      />
      <EmptyState
        code={t("notFound.code")}
        title={t("notFound.title")}
        subtitle={t("notFound.message")}
        cta={
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded font-body text-sm font-semibold bg-primary text-bg border border-primary hover:bg-primary-dark hover:shadow-md transition-colors"
          >
            {t("notFound.backHome")}
          </Link>
        }
      />
    </PublicLayout>
  );
}
