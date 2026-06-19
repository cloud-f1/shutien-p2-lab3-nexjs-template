import type { Metadata } from "next"

import { getAuditLog } from "@/lib/audit"
import { listApiKeys } from "@/lib/api-keys"
import { getActiveSubscription } from "@/lib/billing/queries"
import { getCurrentMonthUsage } from "@/lib/db/queries/usage"
import { isAdmin, requireAuth } from "@/lib/permissions"
import { listWebhooks } from "@/lib/webhooks"

import { ApiKeysPanel } from "./_api-keys-panel"
import { AuditPanel } from "./_audit-panel"
import { BillingPanel } from "./_billing-panel"
import { SystemTabs } from "./_system-tabs"
import { WebhooksPanel } from "./_webhooks-panel"

export const metadata: Metadata = { title: "系統" }

export default async function SystemPage() {
  const session = await requireAuth()
  const admin = isAdmin(session.user.role)
  const [keys, webhooks, billing, audit, apiRequestUsage] = await Promise.all([
    listApiKeys(session.user.id),
    listWebhooks(session.user.id),
    getActiveSubscription(session.user.id),
    admin ? getAuditLog() : Promise.resolve(null),
    // E301 — current-month "api_request" usage for the billing panel meter.
    getCurrentMonthUsage(session.user.id, "api_request"),
  ])

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">系統</h1>
        <p className="text-muted-foreground mt-1 text-sm">API 金鑰、Webhooks、帳務與稽核紀錄。</p>
      </div>
      <SystemTabs
        apiKeys={<ApiKeysPanel keys={keys} isAdmin={admin} />}
        webhooks={<WebhooksPanel webhooks={webhooks} isAdmin={admin} />}
        billing={<BillingPanel active={billing} apiRequestUsage={apiRequestUsage} />}
        audit={audit ? <AuditPanel entries={audit} /> : null}
      />
    </div>
  )
}
