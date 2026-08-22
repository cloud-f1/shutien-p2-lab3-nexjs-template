"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { LogOut, Lock, MoonStar, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { NAV_FLAT, resolveNavForRole } from "@/lib/nav"
import type { Role } from "@/lib/schema"

export interface CommandPaletteProps {
  role: Role | string | undefined
}

/** ⌘K command palette (E263). Nav + theme + sign-out. Reduced-motion safe (CSS). */
export function CommandPalette({ role }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  // E336 — "前往" group derives from lib/nav.ts (the single nav data source)
  // via the shared resolveNavForRole() helper, filtered to items opted into
  // the palette. Locked items render inert (same as the desktop sidebar) —
  // NOT a plain clickable entry — so the palette can't bypass a lock the
  // sidebar enforces.
  const destinations = resolveNavForRole(
    NAV_FLAT.filter((item) => item.inPalette !== false),
    role,
  )

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hidden gap-2 sm:inline-flex"
        aria-label="開啟命令面板"
      >
        <Search className="size-4" />
        <span>搜尋…</span>
        <kbd className="bg-muted text-muted-foreground pointer-events-none ml-2 hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] md:inline-flex">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="輸入指令或搜尋… · Type a command or search…" />
        <CommandList>
          <CommandEmpty>找不到結果。</CommandEmpty>
          <CommandGroup heading="前往 · Go to">
            {destinations.map(({ item, locked }) => {
              const Icon = locked ? Lock : item.icon
              return (
                <CommandItem
                  key={item.id}
                  disabled={locked}
                  aria-disabled={locked || undefined}
                  onSelect={locked ? undefined : () => go(item.url)}
                >
                  <Icon /> {item.label}
                  {locked && (
                    <span className="text-muted-foreground ml-auto text-xs">已鎖定</span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
          <CommandGroup heading="操作 · Actions">
            <CommandItem
              onSelect={() => {
                setTheme(theme === "dark" ? "light" : "dark")
                setOpen(false)
              }}
            >
              <MoonStar /> 切換深色模式
            </CommandItem>
            <CommandItem onSelect={() => signOut()}>
              <LogOut /> 登出
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
