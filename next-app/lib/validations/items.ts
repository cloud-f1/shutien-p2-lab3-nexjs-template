import { z } from "zod"

// E352 — the single title validation rule for items.title, shared by create
// AND update so the two paths cannot drift into disagreement again. E348
// found createItemSchema and updateItemSchema secretly disagreeing (one
// checked the raw untrimmed value, the other trimmed first — " " passed one
// and failed the other); E352 found the same discrepancy between
// createItemSchema and the hand-rolled `validateItemTitle()` that
// `createItem()` used to call. Extracting one field schema makes that class
// of bug structurally impossible instead of just currently-not-present.
//
// `invalid_type_error` covers non-string input (`FormData.get()` can return
// `string | File | null`). Both `createItem()` and `updateItem()` in
// actions/items.ts trim the raw FormData value before calling `.safeParse()`
// so `.min()`/`.max()` see the same trimmed value `validateItemTitle()` used
// to check — the schema itself does not trim (the REST route and the RHF
// form pass already-typed values straight through, matching the pattern
// `updateItemSchema` established in E348).
const itemTitleSchema = z
  .string({ invalid_type_error: "請輸入標題" })
  .min(1, "請輸入標題")
  .max(255, "標題過長（最多 255 個字元）。")

// Lab 3 (course-ai-coding-advanced-shutien, ch03-lab3) — note field validation
// contract: optional, max 200 chars, must not be entirely composed of symbol
// characters (avoids someone fat-fingering a run of punctuation and
// submitting it as a "note"). Validation layer only — this does not touch
// actions/items.ts, any UI component, the REST route, or the DB schema
// (lib/schema/items.ts has no `note` column yet); a note value never reaches
// storage through this change alone.
const itemNoteSchema = z
  .string()
  .max(200, "備註過長（最多 200 個字元）。")
  .refine((val) => val === "" || /[\p{L}\p{N}]/u.test(val), {
    message: "備註不可整段都是特殊符號。",
  })
  .optional()

export const createItemSchema = z.object({
  title: itemTitleSchema,
  note: itemNoteSchema,
})

export const updateItemSchema = z.object({
  title: itemTitleSchema,
  note: itemNoteSchema,
})

export type CreateItemInput = z.infer<typeof createItemSchema>
export type UpdateItemInput = z.infer<typeof updateItemSchema>
