"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

import { createOneTimeCheckout } from "@/actions/checkout"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface SalesCheckoutButtonProps {
  /**
   * The product to buy (E327 slug). When null/undefined the button renders in a
   * disabled "coming soon" state — a custom sales page (E333) can render before
   * its product is linked without crashing.
   */
  productSlug?: string | null
  /** CTA copy. */
  label: string
  /** Merged onto the trigger <Button> (preset accent classes live upstream). */
  className?: string
  size?: "default" | "sm" | "lg"
}

/**
 * Shared sales-page CTA (E333). Collects a buyer email (guest checkout — no
 * login required, E327) then calls the `createOneTimeCheckout` Server Action and
 * hands off to the gateway: Stripe returns a `redirectUrl` (→ navigate), ECPay
 * returns an auto-submit `formHtml` (→ inject + submit). This is the ONE place
 * checkout is wired, so custom pages never touch prices or payment plumbing —
 * they just render `<SalesCheckoutButton productSlug={product.slug} …/>`.
 */
export function SalesCheckoutButton({
  productSlug,
  label,
  className,
  size = "lg",
}: SalesCheckoutButtonProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const disabled = !productSlug

  function submitCheckout(formHtml: string) {
    // ECPay auto-submit form — inject into a detached container and submit.
    const container = document.createElement("div")
    container.style.display = "none"
    container.innerHTML = formHtml
    document.body.appendChild(container)
    const form = container.querySelector("form")
    if (form) form.submit()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productSlug) return
    setError(null)
    startTransition(async () => {
      const result = await createOneTimeCheckout({
        productSlug,
        email: email.trim(),
        name: name.trim() || undefined,
      })
      if ("error" in result) {
        setError(result.error)
        return
      }
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl)
      } else if (result.formHtml) {
        submitCheckout(result.formHtml)
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        className={cn(className)}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {disabled ? "即將開放" : label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>完成報名</DialogTitle>
            <DialogDescription>
              填寫 Email 即可前往付款，訂單與收據會寄到這個信箱（免註冊）。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="checkout-email">電子郵件</Label>
              <Input
                id="checkout-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkout-name">姓名（選填）</Label>
              <Input
                id="checkout-name"
                autoComplete="name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder="王小明"
              />
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isPending ? "前往付款…" : "前往付款"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
