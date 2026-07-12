import type { Metadata } from "next"

import { getAuditLog } from "@/lib/audit"
import { listApiKeys } from "@/lib/api-keys"
import { getActiveSubscription } from "@/lib/billing/queries"
import { getCurrentMonthUsage } from "@/lib/db/queries/usage"
import { getLiveRole, isAdmin, requireAuth } from "@/lib/permissions"
import { listSystemWebhooks, listWebhooks } from "@/lib/webhooks"

import { ApiKeysPanel } from "./_api-keys-panel"
import { AuditPanel } from "./_audit-panel"
import { BillingPanel } from "./_billing-panel"
import { SystemTabs } from "./_system-tabs"
import { SystemWebhooksPanel } from "./_system-webhooks-panel"
import { WebhooksPanel } from "./_webhooks-panel"

export const metadata: Metadata = { title: "系統" }

export default async function SystemPage() {
  const session = await requireAuth()
  // Re-read the live role from the DB (not the possibly-stale JWT snapshot) so a
  // demoted admin loses the system-webhooks surface immediately (E330 RBAC).
  const admin = isAdmin(await getLiveRole(session.user.id))
  const [keys, webhooks, systemWebhooks, billing, audit, apiRequestUsage] = await Promise.all([
    listApiKeys(session.user.id),
    listWebhooks(session.user.id),
    admin ? listSystemWebhooks() : Promise.resolve(null),
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
        systemWebhooks={
          systemWebhooks ? <SystemWebhooksPanel webhooks={systemWebhooks} /> : null
        }
        billing={<BillingPanel active={billing} apiRequestUsage={apiRequestUsage} />}
        audit={audit ? <AuditPanel entries={audit} /> : null}
      />
    </div>
  )
}
