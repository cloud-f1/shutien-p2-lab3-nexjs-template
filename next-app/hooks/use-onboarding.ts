"use client"

import { useCallback, useState } from "react"

const STORAGE_KEY = "onboarding_v1"

export interface OnboardingStep {
  id: string
  label: string
  href: string
}

interface StoredState {
  completed: string[]
  dismissed: boolean
}

/**
 * E310 — server-persisted onboarding state, hydrated from the user record.
 * The DB is the source of truth (survives device changes); localStorage is kept
 * only as a fast optimistic layer for per-step ticks. `completed`/`dismissed`
 * here mirror the `onboardingCompletedAt`/`onboardingDismissed` columns.
 */
export interface OnboardingServerState {
  /** True once onboardingCompletedAt is set on the user row. */
  completed: boolean
  /** Mirror of onboardingDismissed. */
  dismissed: boolean
}

const DEFAULT_STATE: StoredState = { completed: [], dismissed: false }

function readStorage(): StoredState {
  if (typeof window === "undefined") return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as StoredState
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_STATE
}

function writeStorage(state: StoredState): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore write errors (e.g. private browsing quota)
  }
}

export interface UseOnboardingReturn {
  steps: (OnboardingStep & { done: boolean })[]
  dismissed: boolean
  allDone: boolean
  markDone: (stepId: string) => void
  dismiss: () => void
}

export interface UseOnboardingOptions {
  /**
   * Server-hydrated state (from the user record) — the source of truth. When the
   * server says onboarding is complete or dismissed, that wins over localStorage
   * so the card stays hidden across devices. Per-step "done" ticks still come
   * from the optimistic localStorage layer for snappy UX.
   */
  serverState?: OnboardingServerState
  /** Persist a completion to the server (DB source of truth). */
  onComplete?: () => void
  /** Persist a dismissal to the server (DB source of truth). */
  onDismiss?: () => void
}

export function useOnboarding(
  initialSteps: OnboardingStep[],
  options: UseOnboardingOptions = {},
): UseOnboardingReturn {
  const { serverState, onComplete, onDismiss } = options

  // Lazy initializer reads localStorage once on first render (client-side only).
  // On the server readStorage() returns the empty default, so no hydration mismatch.
  const [stored, setStored] = useState<StoredState>(readStorage)

  const dismiss = useCallback(() => {
    setStored((prev) => {
      if (prev.dismissed) return prev
      const next: StoredState = { ...prev, dismissed: true }
      writeStorage(next)
      return next
    })
    onDismiss?.()
  }, [onDismiss])

  const steps = initialSteps.map((s) => ({
    ...s,
    done: stored.completed.includes(s.id),
  }))

  const localAllDone = steps.length > 0 && steps.every((s) => s.done)

  const markDone = useCallback(
    (stepId: string) => {
      setStored((prev) => {
        if (prev.completed.includes(stepId)) return prev
        const next: StoredState = {
          ...prev,
          completed: [...prev.completed, stepId],
        }
        writeStorage(next)
        // When this tick completes every step, persist completion server-side.
        if (next.completed.length >= initialSteps.length && initialSteps.length > 0) {
          onComplete?.()
        }
        return next
      })
    },
    [initialSteps.length, onComplete],
  )

  // Server state is authoritative for completion/dismissal — it survives device
  // changes. localStorage is the optimistic layer (faster per-step feedback).
  const allDone = Boolean(serverState?.completed) || localAllDone
  const dismissed = Boolean(serverState?.dismissed) || stored.dismissed

  return {
    steps,
    dismissed,
    allDone,
    markDone,
    dismiss,
  }
}
