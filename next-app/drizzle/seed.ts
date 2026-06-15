import bcrypt from "bcryptjs"
import { inArray } from "drizzle-orm"

import { db } from "../lib/db"
import {
  apiKeysTable,
  auditLogTable,
  invitationsTable,
  itemsTable,
  notificationsTable,
  plansTable,
  subscriptionsTable,
  paymentEventsTable,
  usersTable,
  webhookDeliveriesTable,
  webhooksTable,
} from "../lib/schema"
import { generateApiKey } from "../lib/api-keys-utils"
import { generateWebhookSecret } from "../lib/webhooks-utils"
import { generateInviteToken, inviteExpiry } from "../lib/team-utils"
import { PAID_TIERS, PRICING_CURRENCY, getTierBySlug } from "../lib/billing/pricing"

const now = new Date()
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const daysFromNow = (n: number) => new Date(now.getTime() + n * 86_400_000)
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3_600_000)

async function seed() {
  // Production guard — these are static, publicly-known demo passwords. Refuse to
  // run against a production database unless explicitly opted in via ALLOW_SEED=true.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
    console.error(
      "❌ Refusing to seed in production. Set ALLOW_SEED=true to override (NOT recommended — these are public demo credentials).",
    )
    process.exit(1)
  }

  console.log("🌱 Seeding database...")

  // ── Demo accounts (RBAC tiers) ──────────────────────────────────────────
  const [adminHash, editorHash, viewerHash] = await Promise.all([
    bcrypt.hash("Admin123!", 12),
    bcrypt.hash("Editor123!", 12),
    bcrypt.hash("Viewer123!", 12),
  ])

  await db
    .insert(usersTable)
    .values([
      { name: "Test Admin", email: "admin@example.com", passwordHash: adminHash, emailVerified: now, role: "admin" },
      { name: "Test Editor", email: "editor@example.com", passwordHash: editorHash, emailVerified: now, role: "editor" },
      // Viewer — read-only. Required for e2e RBAC tests (gives a non-admin subject
      // so the role <Select> renders and the non-admin redirect guard has a target).
      { name: "Test Viewer", email: "viewer@example.com", passwordHash: viewerHash, emailVerified: now, role: "viewer" },
    ])
    .onConflictDoNothing()

  // Re-read IDs (onConflictDoNothing returns nothing on re-runs, so SELECT instead).
  const users = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(inArray(usersTable.email, ["admin@example.com", "editor@example.com", "viewer@example.com"]))
  const idByEmail = Object.fromEntries(users.map((u) => [u.email, u.id])) as Record<string, string>
  const adminId = idByEmail["admin@example.com"]
  const editorId = idByEmail["editor@example.com"]

  // ── Demo data enrichment (idempotent: only when plans are empty) ─────────
  const alreadyEnriched = (await db.$count(plansTable)) > 0
  if (alreadyEnriched) {
    console.log("ℹ︎ Demo data already present — skipping enrichment (reset the DB to re-seed).")
  } else if (adminId) {
    await enrich(adminId, editorId)
  }

  console.log("")
  console.log("✅ Seed complete!")
  console.log("   Admin  → admin@example.com / Admin123!")
  console.log("   Editor → editor@example.com / Editor123!")
  console.log("   Viewer → viewer@example.com / Viewer123!")
  console.log("")
}

/** Populate the backend SaaS surfaces (E267–E272 + billing) with demo content. */
async function enrich(adminId: string, editorId: string | undefined) {
  console.log("🎨 Enriching with demo data (billing, API keys, webhooks, audit, invites, notifications)…")

  // ── Billing: pricing tiers + an active subscription for the admin ────────
  const plans = await db
    .insert(plansTable)
    .values(
      // Derived from config/pricing.json (single source of truth) — the paid tiers.
      PAID_TIERS.map((t) => ({
        providerPriceId: t.providerPriceId!,
        interval: t.interval,
        amount: t.monthlyPrice * 100, // dollars → cents
        currency: PRICING_CURRENCY,
      })),
    )
    .returning({ id: plansTable.id, priceId: plansTable.providerPriceId })
  const proTier = getTierBySlug("pro")
  const proPlan = plans.find((p) => p.priceId === proTier?.providerPriceId) ?? plans[0]

  await db.insert(subscriptionsTable).values({
    userId: adminId,
    planId: proPlan.id,
    provider: "stripe",
    providerSubId: "sub_demo_admin",
    status: "active",
    currentPeriodEnd: daysFromNow(18),
    providerMeta: { current_period_end: Math.floor(daysFromNow(18).getTime() / 1000) },
  })

  await db.insert(paymentEventsTable).values([
    {
      provider: "stripe",
      providerEventId: "evt_demo_001",
      type: "invoice.payment_succeeded",
      payload: { amount_paid: 2900, currency: "usd", plan: "Pro" },
      processedAt: daysAgo(12),
      createdAt: daysAgo(12),
    },
    {
      provider: "stripe",
      providerEventId: "evt_demo_002",
      type: "invoice.payment_succeeded",
      payload: { amount_paid: 2900, currency: "usd", plan: "Pro" },
      processedAt: daysAgo(42),
      createdAt: daysAgo(42),
    },
  ])

  // ── E267: API keys (only the hash is stored; plaintext shown once) ───────
  const prodKey = generateApiKey()
  const ciKey = generateApiKey()
  await db.insert(apiKeysTable).values([
    {
      userId: adminId,
      name: "Production",
      prefix: prodKey.prefix,
      hashedKey: prodKey.hashedKey,
      scopes: ["read", "write"],
      lastUsedAt: hoursAgo(5),
      createdAt: daysAgo(30),
    },
    {
      userId: adminId,
      name: "CI / CD",
      prefix: ciKey.prefix,
      hashedKey: ciKey.hashedKey,
      scopes: ["read"],
      createdAt: daysAgo(7),
    },
  ])

  // ── E268: a webhook endpoint + a realistic delivery log ──────────────────
  const [hook] = await db
    .insert(webhooksTable)
    .values({
      userId: adminId,
      url: "https://example.com/webhooks/ai-app",
      events: ["*"],
      secret: generateWebhookSecret(),
      active: true,
      createdAt: daysAgo(20),
    })
    .returning({ id: webhooksTable.id })
  await db.insert(webhookDeliveriesTable).values([
    { webhookId: hook.id, event: "subscription.updated", status: "success", responseCode: 200, attempts: 1, payload: { id: "sub_demo_admin" }, createdAt: hoursAgo(2) },
    { webhookId: hook.id, event: "api_key.created", status: "success", responseCode: 200, attempts: 1, payload: { name: "CI / CD" }, createdAt: daysAgo(7) },
    { webhookId: hook.id, event: "ping", status: "failed", responseCode: 500, attempts: 3, payload: { message: "test" }, createdAt: daysAgo(1) },
  ])

  // ── E269: audit trail of sensitive actions ───────────────────────────────
  await db.insert(auditLogTable).values([
    { actorId: adminId, action: "user.role_changed", targetType: "user", targetId: editorId, metadata: { role: "editor" }, createdAt: daysAgo(15) },
    { actorId: adminId, action: "api_key.created", targetType: "api_key", metadata: { name: "Production", prefix: prodKey.prefix }, createdAt: daysAgo(30) },
    { actorId: adminId, action: "webhook.created", targetType: "webhook", targetId: hook.id, metadata: { url: "https://example.com/webhooks/ai-app" }, createdAt: daysAgo(20) },
    { actorId: adminId, action: "invitation.created", targetType: "invitation", metadata: { email: "newhire@example.com", role: "editor" }, createdAt: daysAgo(3) },
  ])

  // ── E270: a pending team invitation ──────────────────────────────────────
  await db.insert(invitationsTable).values({
    email: "newhire@example.com",
    role: "editor",
    token: generateInviteToken(),
    status: "pending",
    invitedBy: adminId,
    expiresAt: inviteExpiry(now),
    createdAt: daysAgo(3),
  })

  // ── E272: notifications (zh-TW copy; mix of read/unread) ──────────────────
  await db.insert(notificationsTable).values([
    { userId: adminId, title: "歡迎使用 AI App Template", body: "你的工作區已就緒 —— 從建立第一個 API 金鑰開始。", type: "info", createdAt: daysAgo(30) },
    { userId: adminId, title: "API 用量達 80%", body: "本月 API 呼叫已使用 80%，可於帳務頁面升級方案。", type: "warning", createdAt: hoursAgo(8) },
    { userId: adminId, title: "Webhook 投遞失敗", body: "端點 example.com 回應 500，已重試 3 次。", type: "error", createdAt: daysAgo(1) },
    { userId: adminId, title: "付款成功", body: "Pro 方案 US$29 已成功收款。", type: "success", readAt: daysAgo(1), createdAt: daysAgo(12) },
    { userId: adminId, title: "新登入裝置", body: "偵測到來自台北的新登入。", type: "info", readAt: daysAgo(2), createdAt: daysAgo(2) },
  ])
  if (editorId) {
    await db.insert(notificationsTable).values([
      { userId: editorId, title: "你已被指派為編輯者", body: "你現在可以建立與編輯內容。", type: "success", createdAt: daysAgo(15) },
      { userId: editorId, title: "新的內容待審", body: "有 2 筆內容等待你審閱。", type: "info", createdAt: hoursAgo(20) },
    ])
  }

  // ── Domain items (so the dashboard list isn't empty) ─────────────────────
  await db.insert(itemsTable).values([
    { userId: adminId, title: "Q3 產品藍圖", createdAt: daysAgo(9) },
    { userId: adminId, title: "客戶回饋整理", createdAt: daysAgo(5) },
    { userId: adminId, title: "API 文件草稿", createdAt: daysAgo(2) },
    ...(editorId
      ? [
          { userId: editorId, title: "行銷文案 v2", createdAt: daysAgo(4) },
          { userId: editorId, title: "電子報範本", createdAt: daysAgo(1) },
        ]
      : []),
  ])

  console.log("   • 3 plans + an active Pro subscription (admin)")
  console.log("   • 2 API keys, 1 webhook (+3 deliveries), 4 audit entries")
  console.log("   • 1 pending invite, 7 notifications, 5 items")
  console.log(`   ℹ︎ demo API key (test the bearer auth): ${prodKey.plaintext}`)
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err)
    process.exit(1)
  })
