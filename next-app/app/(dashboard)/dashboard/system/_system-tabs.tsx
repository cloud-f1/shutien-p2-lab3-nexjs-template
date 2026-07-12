"use client"

import type { ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function SystemTabs({
  apiKeys,
  webhooks,
  systemWebhooks,
  billing,
  audit,
}: {
  apiKeys: ReactNode
  webhooks: ReactNode
  systemWebhooks: ReactNode | null
  billing: ReactNode
  audit: ReactNode | null
}) {
  return (
    <Tabs defaultValue="api-keys" className="gap-6">
      <TabsList className="flex-wrap">
        <TabsTrigger value="api-keys">API 金鑰</TabsTrigger>
        <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        {systemWebhooks && <TabsTrigger value="system-webhooks">系統 Webhooks</TabsTrigger>}
        <TabsTrigger value="billing">帳務</TabsTrigger>
        {audit && <TabsTrigger value="audit">稽核紀錄</TabsTrigger>}
      </TabsList>
      <TabsContent value="api-keys">{apiKeys}</TabsContent>
      <TabsContent value="webhooks">{webhooks}</TabsContent>
      {systemWebhooks && <TabsContent value="system-webhooks">{systemWebhooks}</TabsContent>}
      <TabsContent value="billing">{billing}</TabsContent>
      {audit && <TabsContent value="audit">{audit}</TabsContent>}
    </Tabs>
  )
}
