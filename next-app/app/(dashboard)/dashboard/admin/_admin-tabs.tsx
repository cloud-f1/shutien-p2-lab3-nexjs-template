"use client"

import type { ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/**
 * Admin console tabs (E331) — mirrors the dashboard/system `_*-tabs.tsx` pattern.
 * 會員 / 訂單 / 訂閱, admin-only (the page enforces requireAdmin before rendering).
 */
export function AdminTabs({
  members,
  orders,
  subscriptions,
}: {
  members: ReactNode
  orders: ReactNode
  subscriptions: ReactNode
}) {
  return (
    <Tabs defaultValue="members" className="gap-6">
      <TabsList className="flex-wrap">
        <TabsTrigger value="members">會員</TabsTrigger>
        <TabsTrigger value="orders">訂單</TabsTrigger>
        <TabsTrigger value="subscriptions">訂閱</TabsTrigger>
      </TabsList>
      <TabsContent value="members">{members}</TabsContent>
      <TabsContent value="orders">{orders}</TabsContent>
      <TabsContent value="subscriptions">{subscriptions}</TabsContent>
    </Tabs>
  )
}
