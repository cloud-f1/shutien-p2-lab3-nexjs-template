"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { defineAction } from "@/lib/define-action"
import { isAdmin } from "@/lib/is-admin"
import { salesPagesTable } from "@/lib/schema/sales"
import { createPreviewToken } from "@/lib/sales/preview-token"
import {
  createSalesPageSchema,
  deleteSalesPageSchema,
  previewSalesPageSchema,
  setSalesPageStatusSchema,
  updateSalesPageSchema,
} from "@/lib/validations/sales-pages"

const ADMIN_LIST_PATH = "/dashboard/admin/sales-pages"

/** Revalidate the admin list AND the public page for a given slug (ISR). */
function revalidateSalesPage(slug: string) {
  revalidatePath(ADMIN_LIST_PATH)
  revalidatePath(`/p/${slug}`)
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createSalesPageAction = defineAction<typeof createSalesPageSchema, { id: string; slug: string }>({
  allow: isAdmin,
  denyMessage: "只有管理員可以管理銷售頁。",
  schema: createSalesPageSchema,
  handler: async (input, ctx) => {
    // Keep the content's own slug in lock-step with the row slug (single source).
    const content = { ...input.content, slug: input.slug }
    const publishedAt = input.status === "published" ? new Date() : null

    try {
      const [row] = await db
        .insert(salesPagesTable)
        .values({
          slug: input.slug,
          productId: input.productId ?? null,
          content,
          renderMode: input.renderMode,
          status: input.status,
          publishedAt,
        })
        .returning({ id: salesPagesTable.id, slug: salesPagesTable.slug })

      revalidateSalesPage(row.slug)
      return {
        data: { id: row.id, slug: row.slug },
        audit: {
          actorId: ctx.actorId,
          action: "sales_page.created",
          targetType: "sales_page",
          targetId: row.id,
          metadata: { slug: row.slug, status: input.status },
        },
      }
    } catch (err) {
      // Unique-violation on slug → friendly message instead of a 500.
      if (err instanceof Error && err.message.includes("sales_pages_slug_unique")) {
        return { error: "此網址代稱已被使用，請換一個。" }
      }
      throw err
    }
  },
})

export async function createSalesPage(
  input: unknown,
): Promise<{ error?: string; id?: string; slug?: string }> {
  const result = await createSalesPageAction(input)
  return "ok" in result ? { id: result.id, slug: result.slug } : { error: result.error }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

const updateSalesPageAction = defineAction<typeof updateSalesPageSchema, { id: string; slug: string }>({
  allow: isAdmin,
  denyMessage: "只有管理員可以管理銷售頁。",
  schema: updateSalesPageSchema,
  handler: async (input, ctx) => {
    const existing = await db
      .select({
        id: salesPagesTable.id,
        status: salesPagesTable.status,
        publishedAt: salesPagesTable.publishedAt,
      })
      .from(salesPagesTable)
      .where(eq(salesPagesTable.id, input.id))
      .limit(1)
      .then((r) => r[0])

    if (!existing) return { error: "找不到銷售頁。" }

    const content = { ...input.content, slug: input.slug }
    // First transition into published stamps publishedAt; unpublish clears it;
    // staying published keeps the original stamp.
    const publishedAt =
      input.status === "published" ? (existing.publishedAt ?? new Date()) : null

    try {
      const result = await db
        .update(salesPagesTable)
        .set({
          slug: input.slug,
          productId: input.productId ?? null,
          content,
          renderMode: input.renderMode,
          status: input.status,
          publishedAt,
          updatedAt: new Date(),
        })
        .where(eq(salesPagesTable.id, input.id))

      if (result.count === 0) return { error: "找不到銷售頁。" }
    } catch (err) {
      if (err instanceof Error && err.message.includes("sales_pages_slug_unique")) {
        return { error: "此網址代稱已被使用，請換一個。" }
      }
      throw err
    }

    revalidateSalesPage(input.slug)
    return {
      data: { id: input.id, slug: input.slug },
      audit: {
        actorId: ctx.actorId,
        action: "sales_page.updated",
        targetType: "sales_page",
        targetId: input.id,
        metadata: { slug: input.slug, status: input.status },
      },
    }
  },
})

export async function updateSalesPage(
  input: unknown,
): Promise<{ error?: string; id?: string; slug?: string }> {
  const result = await updateSalesPageAction(input)
  return "ok" in result ? { id: result.id, slug: result.slug } : { error: result.error }
}

// ---------------------------------------------------------------------------
// Publish / unpublish (status flip)
// ---------------------------------------------------------------------------

const setSalesPageStatusAction = defineAction<typeof setSalesPageStatusSchema, { slug: string }>({
  allow: isAdmin,
  denyMessage: "只有管理員可以管理銷售頁。",
  schema: setSalesPageStatusSchema,
  handler: async (input, ctx) => {
    const publishedAt = input.status === "published" ? new Date() : null

    const [row] = await db
      .update(salesPagesTable)
      .set({ status: input.status, publishedAt, updatedAt: new Date() })
      .where(eq(salesPagesTable.id, input.id))
      .returning({ slug: salesPagesTable.slug })

    if (!row) return { error: "找不到銷售頁。" }

    revalidateSalesPage(row.slug)
    return {
      data: { slug: row.slug },
      audit: {
        actorId: ctx.actorId,
        action: input.status === "published" ? "sales_page.published" : "sales_page.unpublished",
        targetType: "sales_page",
        targetId: input.id,
        metadata: { slug: row.slug },
      },
    }
  },
})

export async function setSalesPageStatus(
  id: string,
  status: "draft" | "published",
): Promise<{ error?: string; slug?: string }> {
  const result = await setSalesPageStatusAction({ id, status })
  return "ok" in result ? { slug: result.slug } : { error: result.error }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

const deleteSalesPageAction = defineAction({
  allow: isAdmin,
  denyMessage: "只有管理員可以管理銷售頁。",
  schema: deleteSalesPageSchema,
  handler: async ({ id }, ctx) => {
    const [row] = await db
      .delete(salesPagesTable)
      .where(eq(salesPagesTable.id, id))
      .returning({ slug: salesPagesTable.slug })

    if (!row) return { error: "找不到銷售頁。" }

    revalidateSalesPage(row.slug)
    return {
      data: {},
      audit: {
        actorId: ctx.actorId,
        action: "sales_page.deleted",
        targetType: "sales_page",
        targetId: id,
        metadata: { slug: row.slug },
      },
    }
  },
})

export async function deleteSalesPage(id: string): Promise<{ error?: string } | null> {
  const result = await deleteSalesPageAction({ id })
  return "ok" in result ? null : { error: result.error }
}

// ---------------------------------------------------------------------------
// Draft preview link (admin generates a short-lived signed token)
// ---------------------------------------------------------------------------

const createSalesPagePreviewLinkAction = defineAction<typeof previewSalesPageSchema, { url: string }>({
  allow: isAdmin,
  denyMessage: "只有管理員可以管理銷售頁。",
  schema: previewSalesPageSchema,
  handler: async ({ id }, ctx) => {
    const [row] = await db
      .select({ slug: salesPagesTable.slug })
      .from(salesPagesTable)
      .where(eq(salesPagesTable.id, id))
      .limit(1)

    if (!row) return { error: "找不到銷售頁。" }

    const token = createPreviewToken(row.slug)
    return {
      data: { url: `/p/${row.slug}?preview=${token}` },
      audit: {
        actorId: ctx.actorId,
        action: "sales_page.preview_link",
        targetType: "sales_page",
        targetId: id,
        metadata: { slug: row.slug },
      },
    }
  },
})

export async function createSalesPagePreviewLink(
  id: string,
): Promise<{ error?: string; url?: string }> {
  const result = await createSalesPagePreviewLinkAction({ id })
  return "ok" in result ? { url: result.url } : { error: result.error }
}

// ---------------------------------------------------------------------------
// Read (admin list)
// ---------------------------------------------------------------------------
//
// `listSalesPages` deliberately does NOT live here (E350). This file is
// `"use server"` — every export is a public POST endpoint reachable by any
// client, with no guard applied to it by that fact alone. The list query
// (which returns draft/unpublished content) lives in `lib/sales/queries.ts`
// instead, an internal-only module with no `"use server"` directive, callable
// only from an already-authorized Server Component or Route Handler. The
// admin sales-pages page (`app/(dashboard)/dashboard/admin/sales-pages/page.tsx`)
// calls `requireAdmin()` before importing it from there.
