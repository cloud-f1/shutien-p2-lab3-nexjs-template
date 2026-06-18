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

export function useOnboarding(
  initialSteps: OnboardingStep[]
): UseOnboardingReturn {
  // Lazy initializer reads localStorage once on first render (client-side only).
  // On the server readStorage() returns the empty default, so no hydration mismatch.
  const [stored, setStored] = useState<StoredState>(readStorage)

  const markDone = useCallback((stepId: string) => {
    setStored((prev) => {
      if (prev.completed.includes(stepId)) return prev
      const next: StoredState = {
        ...prev,
        completed: [...prev.completed, stepId],
      }
      writeStorage(next)
      return next
    })
  }, [])

  const dismiss = useCallback(() => {
    setStored((prev) => {
      if (prev.dismissed) return prev
      const next: StoredState = { ...prev, dismissed: true }
      writeStorage(next)
      return next
    })
  }, [])

  const steps = initialSteps.map((s) => ({
    ...s,
    done: stored.completed.includes(s.id),
  }))

  const allDone = steps.length > 0 && steps.every((s) => s.done)

  return {
    steps,
    dismissed: stored.dismissed,
    allDone,
    markDone,
    dismiss,
  }
}
