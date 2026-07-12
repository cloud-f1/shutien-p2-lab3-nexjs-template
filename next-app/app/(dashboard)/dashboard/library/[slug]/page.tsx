import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { DownloadIcon, ExternalLinkIcon, PlayCircleIcon } from "lucide-react"

import { db } from "@/lib/db"
import { productsTable } from "@/lib/schema"
import { requireAuth } from "@/lib/permissions"
import { hasEntitlement } from "@/lib/entitlements"
import { getLibraryContent, type LibraryModule } from "@/lib/library/content"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "內容" }

function ModuleIcon({ kind }: { kind: LibraryModule["kind"] }) {
  if (kind === "download") return <DownloadIcon className="size-4" />
  if (kind === "video") return <PlayCircleIcon className="size-4" />
  return <ExternalLinkIcon className="size-4" />
}

export default async function LibraryItemPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await requireAuth()

  // Load the product (server-owned) — an unknown slug is a 404.
  const [product] = await db
    .select({
      name: productsTable.name,
      description: productsTable.description,
      entitlementKey: productsTable.entitlementKey,
    })
    .from(productsTable)
    .where(and(eq(productsTable.slug, slug), eq(productsTable.active, true)))
    .limit(1)

  // A product with no entitlement key is not deliverable content.
  if (!product || !product.entitlementKey) notFound()

  // Server-side OWNERSHIP guard (live DB read). No client-trusted check. A buyer
  // who does not own this product is sent to the sales page to purchase it.
  const owns = await hasEntitlement(session.user.id, product.entitlementKey)
  if (!owns) redirect(`/p/${slug}`)

  const content = getLibraryContent(product.entitlementKey)

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/dashboard/library">← 返回內容庫</Link>
        </Button>
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        {product.description ? (
          <p className="text-muted-foreground mt-1 text-sm">{product.description}</p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">內容</CardTitle>
          <CardDescription>{content.intro}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {content.modules.length === 0 ? (
            <p className="text-muted-foreground text-sm">內容準備中，敬請期待。</p>
          ) : (
            <ul className="divide-border divide-y">
              {content.modules.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{m.title}</span>
                    {m.description ? (
                      <span className="text-muted-foreground text-xs">{m.description}</span>
                    ) : null}
                  </div>
                  {m.url ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={m.url} target="_blank" rel="noopener noreferrer">
                        <ModuleIcon kind={m.kind} />
                        {m.kind === "download" ? "下載" : "開啟"}
                      </a>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
