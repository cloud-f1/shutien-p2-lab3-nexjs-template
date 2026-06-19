/**
 * OnboardingChecklist — Getting Started card for the dashboard home page.
 *
 * HOW TO CUSTOMIZE (fork teams):
 * ─────────────────────────────
 * The step list is defined in the DEFAULT_STEPS array below.
 * Each step has:
 *   • id    — unique string key (used for localStorage persistence)
 *   • label — user-facing label (繁體中文 by default; change to your locale)
 *   • href  — destination when the user clicks the step label
 *
 * To customize:
 *   1. Edit DEFAULT_STEPS — add, remove, or reorder entries.
 *   2. If you add new localStorage keys, bump the STORAGE_KEY in
 *      hooks/use-onboarding.ts ("onboarding_v1" → "onboarding_v2") so
 *      returning users get a fresh checklist instead of stale state.
 *   3. Pass a custom steps array via the `steps` prop to drive the list
 *      from a server component or feature-flag system instead of hardcoding.
 *
 * The component is a client island — the parent dashboard page stays RSC.
 */

"use client"

import { completeOnboarding, dismissOnboarding } from "@/actions/user"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type OnboardingServerState,
  type OnboardingStep,
  useOnboarding,
} from "@/hooks/use-onboarding"
import { cn } from "@/lib/utils"
import { CheckCircle2, Circle, X } from "lucide-react"
import Link from "next/link"

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: "invite-team",
    label: "邀請團隊成員",
    href: "/dashboard/system?tab=team",
  },
  {
    id: "create-api-key",
    label: "建立 API 金鑰",
    href: "/dashboard/system?tab=api-keys",
  },
  {
    id: "configure-webhook",
    label: "設定 Webhook",
    href: "/dashboard/system?tab=webhooks",
  },
  {
    id: "choose-plan",
    label: "選擇方案",
    href: "/dashboard/settings?tab=billing",
  },
]

interface OnboardingChecklistProps {
  /** Override the default step list. Useful for feature-flag or server-driven step lists. */
  steps?: OnboardingStep[]
  /**
   * Server-hydrated onboarding state from the user record (E310). When provided
   * it is the source of truth: completion/dismissal persist to the DB and survive
   * device changes; localStorage stays as an optimistic per-step layer.
   */
  serverState?: OnboardingServerState
}

export function OnboardingChecklist({
  steps: stepsProp,
  serverState,
}: OnboardingChecklistProps) {
  const { steps, dismissed, allDone, markDone, dismiss } = useOnboarding(
    stepsProp ?? DEFAULT_STEPS,
    {
      serverState,
      onComplete: () => {
        void completeOnboarding()
      },
      onDismiss: () => {
        void dismissOnboarding()
      },
    }
  )

  // Hidden entirely when dismissed or when all steps are complete
  if (dismissed || allDone) return null

  return (
    <Card
      className={cn(
        "mx-4 lg:mx-6 transition-opacity duration-500",
        allDone && "opacity-0 pointer-events-none"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">快速入門</CardTitle>
        <button
          onClick={dismiss}
          aria-label="關閉入門清單"
          className="text-muted-foreground hover:text-foreground transition-colors rounded-sm p-1 -mr-1"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          完成以下步驟，開始使用您的帳戶。
        </p>
        <ul className="space-y-3">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-3">
              <button
                onClick={() => markDone(step.id)}
                aria-label={step.done ? `${step.label}（已完成）` : `標記為完成：${step.label}`}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>
              <Link
                href={step.href}
                className={cn(
                  "text-sm hover:underline underline-offset-4",
                  step.done
                    ? "line-through text-muted-foreground"
                    : "text-foreground"
                )}
              >
                {step.label}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
