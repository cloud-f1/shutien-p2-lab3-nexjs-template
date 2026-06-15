import { Reveal } from "@/components/marketing/reveal"

const TESTIMONIALS = [
  {
    quote: "從 fork 到第一個付費客戶只花了兩週。金流抽象層讓我們先用 Stripe，之後接綠界完全沒改業務邏輯。",
    name: "產品負責人",
    role: "B2B SaaS 新創",
  },
  {
    quote: "型別安全、Server Components、模組化 —— 這正是我們想要的工程基礎。程式碼讀起來像是自己團隊寫的。",
    name: "技術主管",
    role: "工程顧問公司",
  },
  {
    quote: "3 階 RBAC 與後台管理開箱即用，省下我們重造輪子的時間，直接專注在領域功能上。",
    name: "共同創辦人",
    role: "垂直 SaaS",
  },
]

export function Testimonials() {
  return (
    <section className="px-4 py-16 md:py-24" id="testimonials">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">開發者怎麼說</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delayMs={i * 80}>
              <figure className="lift bg-card flex h-full flex-col gap-4 rounded-xl border p-6 shadow-xs">
                <blockquote className="text-sm leading-relaxed">「{t.quote}」</blockquote>
                <figcaption className="mt-auto">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-muted-foreground text-xs">{t.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
