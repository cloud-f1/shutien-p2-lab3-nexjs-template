import { cn } from "@/lib/utils"

interface Feature {
  title: string
  description: string
  icon: string
}

const FEATURES: Feature[] = [
  {
    icon: "🔐",
    title: "Authentication built-in",
    description:
      "NextAuth v5 with email/password, email verification, and role-based access control (RBAC) out of the box.",
  },
  {
    icon: "💳",
    title: "Billing-ready",
    description:
      "PaymentProvider abstraction supports Stripe and ECPay. Swap gateways without touching your app logic.",
  },
  {
    icon: "🗄️",
    title: "Database with Drizzle",
    description:
      "Type-safe Drizzle ORM on PostgreSQL. Migrations, seeding, and schema fragments — all included.",
  },
  {
    icon: "🎨",
    title: "Dark mode & theming",
    description:
      "Tailwind v4 + next-themes + shadcn/ui. Class-strategy dark mode toggles with a single keypress.",
  },
  {
    icon: "🧩",
    title: "Registry modules",
    description:
      "Install features via `npx shadcn@latest add @saas/<module>`. Each module ships with a manifest and install skill.",
  },
  {
    icon: "🚀",
    title: "Deploy anywhere",
    description:
      "Zeabur config included. Single-service Next.js app with a Dockerfile and auto-migrations on start.",
  },
]

interface FeatureCardProps extends Feature {
  className?: string
}

function FeatureCard({ icon, title, description, className }: FeatureCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-6 text-card-foreground shadow-sm",
        className,
      )}
    >
      <span className="text-2xl" role="img" aria-label={title}>
        {icon}
      </span>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function Features() {
  return (
    <section className="px-4 py-16 md:py-24" id="features">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need to ship
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            Stop rebuilding the same boilerplate. This template handles the
            infrastructure so you can start on your core product on day one.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
}
