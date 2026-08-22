"use client"

// E336 — mirrors the shadcn Sidebar's open/collapsed state to
// localStorage["sidebarCollapsed"] so it survives a full page reload. The
// SidebarProvider already writes a cookie on toggle, but the dashboard layout
// (a Server Component) never reads that cookie back into `defaultOpen`, so a
// reload always re-opens the sidebar. This component fills that gap.
//
// Renders nothing. Every localStorage access is try/caught — private
// windows / disabled site data must never throw, just fall back to the
// default expanded state.
import { useEffect, useRef } from "react"

import { useSidebar } from "@/components/ui/sidebar"

const STORAGE_KEY = "sidebarCollapsed"

export function SidebarCollapsePersist() {
  const { open, setOpen } = useSidebar()
  // A ref (not state) so flipping it doesn't itself trigger a render — this
  // only gates the persist effect below against the mount-time hydration read.
  const hydrated = useRef(false)

  // Apply the last-known state once, on mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === "true") setOpen(false)
      else if (stored === "false") setOpen(true)
    } catch {
      // localStorage unavailable — keep the default expanded state.
    } finally {
      hydrated.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist every subsequent change. Gated on `hydrated` so we don't
  // immediately overwrite the value we just read on mount.
  useEffect(() => {
    if (!hydrated.current) return
    try {
      window.localStorage.setItem(STORAGE_KEY, String(!open))
    } catch {
      // localStorage unavailable — nothing to persist.
    }
  }, [open])

  return null
}
