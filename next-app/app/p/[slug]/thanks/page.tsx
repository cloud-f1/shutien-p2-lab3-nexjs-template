/**
 * One-time purchase thank-you / settlement-status page — E327.
 *
 * Guests reach this after checkout via a signed link
 * (`/p/[slug]/thanks?order=<id>&token=<hmac>`). We load the order by id and
 * verify the email-derived token (no session required), then show `paid` vs
 * `pending` — because an ECPay ReturnURL redirect can beat the server-to-server
 * notify that actually flips the order to paid (return-races-notify).
 *
 * NOTE: `app/p/[slug]/page.tsx` (the sales page) belongs to E326 — this route
 * only owns the `thanks/` subroute.
 */

import Link from "next/link"
import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { ordersTable, productsTable } from "@/lib/schema"
import { verifyOrderAccessToken } from "@/lib/billing/order-token"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "TWD" ? 0 : 2,
    }).format(currency === "TWD" ? amount : amount / 100)
  } catch {
    return `${amount} ${currency}`
  }
}

export default async function ThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams
  const orderId = typeof sp.order === "string" ? sp.order : ""
  const token = typeof sp.token === "string" ? sp.token : ""

  if (!orderId || !token) notFound()

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1)

  if (!order) notFound()
  // Guard against leaking another buyer's order — token is derived from the
  // order id + the order's own email (timing-safe compare).
  if (!verifyOrderAccessToken(order.id, order.customerEmail, token)) notFound()

  const [product] = await db
    .select({ name: productsTable.name, slug: productsTable.slug })
    .from(productsTable)
    .where(eq(productsTable.id, order.productId))
    .limit(1)

  const isPaid = order.status === "paid"
  const isFailed = order.status === "failed"
  const isPending = order.status === "pending"

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-center justify-center px-4 py-16">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center">
            {isPaid ? (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                付款完成
              </Badge>
            ) : isFailed ? (
              <Badge variant="destructive">付款失敗</Badge>
            ) : (
              <Badge variant="secondary">確認付款中</Badge>
            )}
          </div>
          <CardTitle className="mt-2 text-2xl">
            {isPaid
              ? "感謝您的購買！"
              : isFailed
                ? "這筆付款未能完成"
                : "我們正在確認您的付款"}
          </CardTitle>
          <CardDescription>
            {isPaid
              ? "您的訂單已成功付款，我們已寄送確認信到您的信箱。"
              : isPending
                ? "金流通知可能稍有延遲，請稍候幾秒後重新整理此頁面。"
                : "若款項已扣除但狀態未更新，請聯絡客服協助處理。"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Separator />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">商品</dt>
              <dd className="font-medium">{product?.name ?? slug}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">金額</dt>
              <dd className="font-medium">
                {formatAmount(order.amount, order.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{order.customerEmail}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">訂單編號</dt>
              <dd className="font-mono text-xs">{order.id}</dd>
            </div>
          </dl>
          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row">
            {isPending && (
              <Button asChild variant="outline" className="flex-1">
                {/* Re-fetch server state — return can race the notify. */}
                <Link href={`/p/${slug}/thanks?order=${order.id}&token=${token}`}>
                  重新整理狀態
                </Link>
              </Button>
            )}
            <Button asChild className="flex-1">
              <Link href={`/p/${product?.slug ?? slug}`}>返回商品頁</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
