import type { SalesStyleTokens } from "@/lib/sales/styles"
import { cn } from "@/lib/utils"

export interface ModuleItem {
  title: string
  content: string
  outcome: string
}

export interface ModulesTableProps {
  heading: string
  items: ModuleItem[]
  style: SalesStyleTokens
  className?: string
}

/**
 * 模組大綱 (course/module outline) — marketing content table (章節 → 核心內容
 * → 預期收穫), NOT a record list, so the reusable `<DataTable>` convention
 * does not apply here. Pure component: copy + style tokens only.
 */
export function ModulesTable({ heading, items, style, className }: ModulesTableProps) {
  return (
    <section className={cn("px-4 py-16 md:py-24", style.sectionBg, className)}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <h2 className={cn("text-3xl md:text-4xl", style.heading)}>{heading}</h2>
        </div>

        {/* Desktop: table layout */}
        <div className={cn("hidden overflow-hidden rounded-xl md:block", style.card)}>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-5 py-3 font-semibold">章節</th>
                <th className="px-5 py-3 font-semibold">核心內容</th>
                <th className="px-5 py-3 font-semibold">預期收穫</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.title} className={cn(i > 0 && "border-t")}>
                  <td className="px-5 py-4 font-medium">{item.title}</td>
                  <td className="text-muted-foreground px-5 py-4">{item.content}</td>
                  <td className={cn("px-5 py-4", style.accentText)}>{item.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards */}
        <ul className="flex flex-col gap-4 md:hidden">
          {items.map((item) => (
            <li key={item.title} className={cn("rounded-xl p-4", style.card)}>
              <p className="font-semibold">{item.title}</p>
              <p className="text-muted-foreground mt-1 text-sm">{item.content}</p>
              <p className={cn("mt-2 text-sm font-medium", style.accentText)}>→ {item.outcome}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
