import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pagination } from "./Pagination";
import { SearchInput } from "./SearchInput";
import { FilterSelect, type FilterOption } from "./FilterSelect";
import { getActivePreset } from "./preset";

export interface Column<T> {
  id: string;
  header: string;
  accessor: (row: T) => ReactNode;
  mono?: boolean;
  align?: "left" | "right" | "center";
  width?: string;
}

export interface RowAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  /** Override aria-label when the visible label needs more screen-reader context. */
  ariaLabel?: string;
}

export interface FilterDef {
  id: string;
  label: string;
  options: FilterOption[];
  /** Predicate to apply when filter has a value. */
  predicate?: (value: string, row: unknown) => boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Row fields to match search against. Defaults to all top-level string fields. */
  searchKeys?: (keyof T)[];
  filters?: FilterDef[];
  pageSize?: number;
  rowActions?: (row: T) => RowAction[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  ariaLabel?: string;
  /** Optional caption rendered as the toolbar's left-aligned label. */
  toolbarTitle?: ReactNode;
  className?: string;
}

function defaultMatch<T>(row: T, q: string, keys?: (keyof T)[]): boolean {
  const needle = q.toLowerCase();
  const candidates = keys
    ? keys.map((k) => row[k])
    : Object.values(row as Record<string, unknown>);
  return candidates.some(
    (v) => typeof v === "string" && v.toLowerCase().includes(needle),
  );
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchable = false,
  searchPlaceholder,
  searchKeys,
  filters,
  pageSize = 10,
  rowActions,
  isLoading = false,
  isError = false,
  errorMessage,
  emptyMessage,
  ariaLabel,
  toolbarTitle,
  className = "",
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const p = getActivePreset().table;
  const { t } = useTranslation("primitives");
  const resolvedErrorMessage = errorMessage ?? t("table.loadError");
  const resolvedEmptyMessage = emptyMessage ?? t("table.noData");

  const filtered = useMemo(() => {
    let rows = data;
    if (searchable && query.trim()) {
      rows = rows.filter((r) => defaultMatch(r, query.trim(), searchKeys));
    }
    if (filters) {
      for (const f of filters) {
        const v = filterState[f.id];
        if (!v) continue;
        if (f.predicate) {
          rows = rows.filter((r) => f.predicate!(v, r));
        } else {
          rows = rows.filter(
            (r) => String((r as Record<string, unknown>)[f.id] ?? "") === v,
          );
        }
      }
    }
    return rows;
  }, [data, searchable, query, searchKeys, filters, filterState]);

  const total = filtered.length;
  const usePager = pageSize > 0;
  const startIdx = usePager ? (page - 1) * pageSize : 0;
  const visible = usePager
    ? filtered.slice(startIdx, startIdx + pageSize)
    : filtered;

  // Reset to page 1 when filters/search narrow results past current page.
  const totalPages = usePager ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const showToolbar = searchable || !!filters?.length || !!toolbarTitle;
  const colCount = columns.length + (rowActions ? 1 : 0);

  return (
    <section className={[p.shell, className].join(" ")}>
      {showToolbar && (
        <div className={p.toolbar}>
          {toolbarTitle && <div className={p.toolbarTitle}>{toolbarTitle}</div>}
          {searchable && (
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className={p.toolbarSearchWidth}
            />
          )}
          {filters?.map((f) => (
            <FilterSelect
              key={f.id}
              label={f.label}
              value={filterState[f.id] ?? ""}
              onChange={(v) =>
                setFilterState((prev) => ({ ...prev, [f.id]: v }))
              }
              options={f.options}
            />
          ))}
        </div>
      )}

      <div className={p.scroll}>
        <table className={p.table} aria-label={ariaLabel}>
          <thead className={p.thead}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={[p.th, p.align[col.align ?? "left"]].join(" ")}
                >
                  {col.header}
                </th>
              ))}
              {rowActions && (
                <th scope="col" className={[p.th, p.align.right].join(" ")}>
                  {t("table.actions")}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={colCount} className={p.state}>
                  {t("table.loading")}
                </td>
              </tr>
            )}
            {!isLoading && isError && (
              <tr>
                <td colSpan={colCount} role="alert" className={p.state}>
                  {resolvedErrorMessage}
                </td>
              </tr>
            )}
            {!isLoading && !isError && visible.length === 0 && (
              <tr>
                <td colSpan={colCount} className={p.state}>
                  {resolvedEmptyMessage}
                </td>
              </tr>
            )}
            {!isLoading &&
              !isError &&
              visible.map((row) => {
                const id = getRowId(row);
                const actions = rowActions?.(row) ?? [];
                return (
                  <tr key={id} className={p.tr}>
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={[
                          p.td,
                          col.mono ? p.tdMono : "",
                          p.align[col.align ?? "left"],
                        ].join(" ")}
                      >
                        {col.accessor(row)}
                      </td>
                    ))}
                    {rowActions && (
                      <td className={[p.td, p.align.right].join(" ")}>
                        <div className={p.rowActionCluster}>
                          {actions.map((a, i) => (
                            <button
                              key={`${id}-${a.label}-${i}`}
                              type="button"
                              onClick={a.onClick}
                              disabled={a.disabled}
                              aria-label={a.ariaLabel}
                              className={
                                a.variant === "danger"
                                  ? p.rowAction.danger
                                  : p.rowAction.default
                              }
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {usePager && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}
