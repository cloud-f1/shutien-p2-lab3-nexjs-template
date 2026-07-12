/**
 * Delivery content map — E328. The 內容庫 delivery page renders modules / download
 * links from this per-product map, keyed by a product's `entitlement_key`. Keeping
 * it a plain data map (not DB rows) is deliberate for the template: a fork wires
 * its own real content source (course platform, file storage, …) by replacing this
 * module. Access to the page is guarded server-side by `hasEntitlement` BEFORE any
 * of this is read — this file never gates anything, it only describes deliverables.
 */

export type LibraryModuleKind = "video" | "download" | "link" | "text"

export interface LibraryModule {
  title: string
  kind: LibraryModuleKind
  /** External/asset URL for video/download/link kinds. */
  url?: string
  description?: string
}

export interface LibraryContent {
  /** Short intro shown at the top of the delivery page. */
  intro: string
  modules: LibraryModule[]
}

/**
 * Per-entitlement delivery content. Add an entry keyed by the product's
 * `entitlement_key` to attach real modules/downloads to a product.
 */
export const LIBRARY_CONTENT: Record<string, LibraryContent> = {
  "course-nextjs-saas": {
    intro: "歡迎加入課程！以下是所有單元內容，購買後永久觀看。",
    modules: [
      {
        title: "第 1 章 — 專案架構總覽",
        kind: "video",
        url: "https://example.com/lessons/1",
        description: "Next.js App Router、RSC 邊界與資料流。",
      },
      {
        title: "第 2 章 — 認證與 RBAC",
        kind: "video",
        url: "https://example.com/lessons/2",
        description: "Auth.js v5、JWT session 與即時角色再讀取。",
      },
      {
        title: "課程講義 (PDF)",
        kind: "download",
        url: "https://example.com/downloads/handbook.pdf",
        description: "完整講義下載，方便離線閱讀。",
      },
    ],
  },
}

/**
 * Content for a product's `entitlement_key`, or a graceful default when a
 * deliverable product has no bespoke content wired yet (so the page still
 * renders something meaningful instead of a blank surface).
 */
export function getLibraryContent(entitlementKey: string): LibraryContent {
  return (
    LIBRARY_CONTENT[entitlementKey] ?? {
      intro: "感謝您的購買！內容正在準備中，稍後即可在此存取。",
      modules: [],
    }
  )
}
