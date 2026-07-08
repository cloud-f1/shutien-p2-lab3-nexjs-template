"use client"

// @saas/csv-io — reference bulk-import dialog (E325).
//
// A thin shadcn Dialog wrapper: pick a file, hand its text to the caller's `onImport`
// (which should call `parseCsv()` from `@/lib/csv-io/import` plus the caller's own
// upsert-by-key Server Action), and render the resulting per-row error list. This
// component holds NO parsing/db logic itself — it is a starting point to copy/adapt
// per module, not a one-size-fits-all import UI.
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
// Relative — not "@/lib/csv-io/import" — because this file's source location
// (registry/csv-io/components/) and install target (components/) both sit one
// directory above lib/csv-io/, so the same relative path resolves in both places.
import type { RowError } from "../lib/csv-io/import"

export interface CsvImportResult {
  imported: number
  errors: RowError[]
}

export interface CsvImportDialogProps {
  title: string
  description?: string
  triggerLabel?: string
  /** Read the picked file's text, parse + upsert it, and report a result summary. */
  onImport: (text: string) => Promise<CsvImportResult>
  /** Called after an import with zero row errors (e.g. `router.refresh()`). */
  onDone?: () => void
}

export function CsvImportDialog({
  title,
  description,
  triggerLabel = "Import CSV",
  onImport,
  onDone,
}: CsvImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<CsvImportResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setFile(null)
      setResult(null)
    }
  }

  function handleImport() {
    if (!file) return
    startTransition(async () => {
      const text = await file.text()
      const next = await onImport(text)
      setResult(next)
      if (next.errors.length === 0) {
        onDone?.()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        {result ? (
          <div className="text-sm">
            <p>{result.imported} row(s) imported.</p>
            {result.errors.length > 0 ? (
              <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-4 text-destructive">
                {result.errors.map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={handleImport} disabled={!file || isPending}>
            {isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
