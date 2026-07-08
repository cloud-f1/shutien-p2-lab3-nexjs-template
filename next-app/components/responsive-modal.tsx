"use client"

// E323 — Responsive modal. Desktop = centred Dialog; mobile (<768px) = bottom Sheet
// (a bottom-sheet drawer). Both primitives natively support Esc-to-close + background
// scroll-lock. Switches on useIsMobile(). Controlled via open / onOpenChange — pairs
// with the template's CRUD-modal convention (see app/(dashboard)/dashboard/items/).
import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

export interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  /** Accessible description (optional). */
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  /** Desktop Dialog width in px (default 640). */
  width?: number
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 640,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92vh] gap-0 rounded-t-2xl p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          {footer ? (
            // pb-[env(safe-area-inset-bottom)] keeps footer buttons clear of the iOS
            // home-indicator gesture bar. The Sheet's z-50 already sits above the
            // mobile tab bar's z-40 (see components/mobile-tab-bar.tsx) so footer
            // controls are never covered.
            <SheetFooter className="flex-row items-center justify-between gap-2.5 border-t pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-h-[88vh] gap-0 p-0 sm:max-w-[var(--responsive-modal-w)]")}
        style={{ ["--responsive-modal-w" as string]: `${width}px` }}
      >
        <DialogHeader className="border-b px-5 py-[15px]">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? (
          <DialogFooter className="flex-row items-center justify-between gap-2.5 border-t px-5 py-[13px]">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
