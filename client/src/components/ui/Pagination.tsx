import { useTranslation } from "react-i18next";
import { getActivePreset } from "./preset";

export interface PaginationProps {
  /** 1-indexed current page. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Build a windowed page list like `[1, "…", 4, 5, 6, "…", 12]`. */
function buildPages(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const out: (number | "ellipsis")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) out.push("ellipsis");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < totalPages - 1) out.push("ellipsis");
  out.push(totalPages);
  return out;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className = "",
}: PaginationProps) {
  if (pageSize <= 0 || total <= 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const pages = buildPages(safePage, totalPages);
  const p = getActivePreset().pagination;
  const { t } = useTranslation("primitives");

  return (
    <nav aria-label={t("pagination.label")} className={[p.shell, className].join(" ")}>
      <div className={p.summary}>
        {t("pagination.summary", { start, end, total })}
      </div>
      <ol className={p.list}>
        <li>
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage === 1}
            aria-label={t("pagination.previous")}
            className={[
              p.button.base,
              p.button.idle,
              safePage === 1 ? p.button.disabled : "",
            ].join(" ")}
          >
            {p.prevGlyph}
          </button>
        </li>
        {pages.map((pg, i) =>
          pg === "ellipsis" ? (
            <li key={`e-${i}`} aria-hidden="true" className={p.ellipsis}>
              {"…"}
            </li>
          ) : (
            <li key={pg}>
              <button
                type="button"
                onClick={() => onPageChange(pg)}
                aria-current={pg === safePage ? "page" : undefined}
                aria-label={t("pagination.page", { n: pg })}
                className={[
                  p.button.base,
                  pg === safePage ? p.button.active : p.button.idle,
                ].join(" ")}
              >
                {pg}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage === totalPages}
            aria-label={t("pagination.next")}
            className={[
              p.button.base,
              p.button.idle,
              safePage === totalPages ? p.button.disabled : "",
            ].join(" ")}
          >
            {p.nextGlyph}
          </button>
        </li>
      </ol>
    </nav>
  );
}
