import { cn } from "@/lib/utils"

interface FaqItem {
  question: string
  answer: string
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is this template?",
    answer:
      "A production-ready Next.js 16 SaaS starter. It includes authentication (NextAuth v5), billing (Stripe/ECPay via a PaymentProvider abstraction), 3-tier RBAC, Drizzle/Postgres, and shadcn/ui — so you can ship your product instead of rebuilding infrastructure.",
  },
  {
    question: "How do I install additional modules?",
    answer:
      "Run `npx shadcn@latest add @saas/<module-name>` from the `next-app/` directory. Each module ships with a `module.manifest.json` and a paired `install-*` skill that wires env vars, runs migrations, and walks you through any manual steps.",
  },
  {
    question: "Which payment gateways are supported?",
    answer:
      "The billing layer ships a `PaymentProvider` interface (E231). Stripe and ECPay adapters are implemented in dedicated modules. Additional gateways (TapPay, NewebPay) are reserved slots you can implement.",
  },
  {
    question: "Can I deploy to my own infrastructure?",
    answer:
      "Yes. The template ships a `Dockerfile` and a Zeabur config (`zbpack.json`), but any Node-compatible host works. Alembic-style migrations run on startup automatically.",
  },
  {
    question: "Is this open-source?",
    answer:
      "Yes. Fork it, extend it, use it commercially. Attribution is appreciated but not required.",
  },
]

interface FaqItemComponentProps extends FaqItem {
  className?: string
}

function FaqItemComponent({ question, answer, className }: FaqItemComponentProps) {
  return (
    <div className={cn("flex flex-col gap-2 border-b py-4 last:border-b-0", className)}>
      <h3 className="font-medium">{question}</h3>
      <p className="text-sm text-muted-foreground">{answer}</p>
    </div>
  )
}

export function Faq() {
  return (
    <section className="px-4 py-16 md:py-24" id="faq">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Frequently asked questions
          </h2>
          <p className="text-muted-foreground">
            Everything you need to know. Can&apos;t find what you&apos;re
            looking for? Open an issue on GitHub.
          </p>
        </div>
        <div>
          {FAQ_ITEMS.map((item) => (
            <FaqItemComponent key={item.question} {...item} />
          ))}
        </div>
      </div>
    </section>
  )
}
