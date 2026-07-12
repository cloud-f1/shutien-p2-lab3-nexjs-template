"use client"

import { useState, useTransition } from "react"
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type FieldArrayPath,
  type FieldErrors,
  type Path,
  type Resolver,
  type UseFormRegister,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, XIcon } from "lucide-react"

import { createSalesPage, updateSalesPage } from "@/actions/sales-pages"
import type { SalesPageContent } from "@/lib/sales/content"
import { salesPageFormSchema, type SalesPageFormValues } from "@/lib/validations/sales-pages"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ProductOption } from "./_sales-page-dialog"
import type { SalesPageRow } from "./_sales-pages-table"

/** A minimal valid content template so a new page starts editable, not blank. */
const DEFAULT_CONTENT: SalesPageContent = {
  slug: "",
  meta: { title: "新銷售頁", description: "一句話描述你的產品。" },
  style: { preset: "clean", heroVariant: "video-top" },
  hero: {
    headline: "主標題",
    subheadline: "副標題：一句話痛點 + 承諾。",
    trustItems: ["信任標記 1"],
    cta: { label: "立即購買", href: "/checkout" },
  },
  painPoints: { heading: "你是否也有這些困擾？", items: ["痛點 1"] },
  solution: { heading: "解決方案", description: "說明你的產品如何解決上述痛點。" },
  modules: { heading: "內容大綱", items: [{ title: "模組一", content: "內容", outcome: "成果" }] },
  testimonials: {
    heading: "學員見證",
    items: [{ quote: "很棒的產品！", name: "王小明", role: "使用者" }],
  },
  pricing: {
    heading: "限時優惠",
    price: 1000,
    currency: "TWD",
    deadline: "2030-01-01T00:00:00.000Z",
    features: ["功能 1"],
    cta: { label: "立即購買", href: "/checkout" },
  },
  riskReversal: { heading: "退款保證", guaranteeDays: 30, description: "30 天內不滿意全額退款。" },
  faq: { heading: "常見問題", items: [{ question: "問題 1？", answer: "解答 1。" }] },
}

function toFormValues(page: SalesPageRow | null): SalesPageFormValues {
  if (!page) {
    return {
      slug: "",
      productId: "",
      renderMode: "structured",
      status: "draft",
      content: DEFAULT_CONTENT,
    }
  }
  return {
    slug: page.slug,
    productId: page.productId ?? "",
    renderMode: page.renderMode,
    status: page.status,
    content: page.content,
  }
}

type Errs = FieldErrors<SalesPageFormValues>

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-md border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  )
}

/**
 * Repeatable list of plain-string fields (trust items, bullets, features…).
 * Uses the concrete `SalesPageFormValues` generic at the boundary (so call
 * sites need no cast); only the dynamic string path is cast internally, since
 * RHF's `Path`/`FieldArrayPath` are string-literal unions.
 */
type StringArrayName =
  | "content.hero.trustItems"
  | "content.painPoints.items"
  | "content.solution.bullets"
  | "content.pricing.features"

function StringList({
  control,
  register,
  name,
  label,
  addLabel,
}: {
  control: Control<SalesPageFormValues>
  register: UseFormRegister<SalesPageFormValues>
  name: StringArrayName
  label: string
  addLabel: string
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as unknown as FieldArrayPath<SalesPageFormValues>,
  })
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {fields.map((f, i) => (
        <div key={f.id} className="flex items-center gap-2">
          <Input {...register(`${name}.${i}` as unknown as Path<SalesPageFormValues>)} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="移除"
            onClick={() => remove(i)}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append("" as unknown as never)}
      >
        <PlusIcon className="size-4" /> {addLabel}
      </Button>
    </div>
  )
}

export function SalesPageForm({
  products,
  page,
  onSuccess,
  onCancel,
}: {
  products: ProductOption[]
  page: SalesPageRow | null
  onSuccess: () => void
  onCancel: () => void
}) {
  const editing = Boolean(page)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SalesPageFormValues>({
    // Cast: the deeply-nested content schema pushes TS past the point where it
    // can structurally reconcile zodResolver's inferred type with the form
    // generic (spurious "two unrelated types" error) — the runtime is correct.
    resolver: zodResolver(salesPageFormSchema) as unknown as Resolver<SalesPageFormValues>,
    defaultValues: toFormValues(page),
  })

  const renderMode = watch("renderMode")
  const isCustom = renderMode === "custom"
  const e = errors as Errs

  const modules = useFieldArray({ control, name: "content.modules.items" })
  const testimonials = useFieldArray({ control, name: "content.testimonials.items" })
  const faq = useFieldArray({ control, name: "content.faq.items" })

  function onSubmit(values: SalesPageFormValues) {
    setServerError(null)
    const payload = {
      ...(editing && page ? { id: page.id } : {}),
      slug: values.slug,
      productId: values.productId || null,
      renderMode: values.renderMode,
      status: values.status,
      content: { ...values.content, slug: values.slug },
    }
    startTransition(async () => {
      const result = editing ? await updateSalesPage(payload) : await createSalesPage(payload)
      if (result.error) setServerError(result.error)
      else onSuccess()
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-4" noValidate>
      {/* ── Basics ─────────────────────────────────────────────────────── */}
      <Section title="基本設定">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="slug">網址代稱 (slug)</Label>
            <Input id="slug" placeholder="my-course" {...register("slug")} />
            <FieldError message={e.slug?.message} />
          </div>
          <div className="space-y-1.5">
            <Label>連結產品</Label>
            <Controller
              control={control}
              name="productId"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="（無）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">（無）</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>狀態</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="published">已發佈</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>渲染模式</Label>
            <Controller
              control={control}
              name="renderMode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="structured">結構化（表單編輯）</SelectItem>
                    <SelectItem value="custom">自訂（由 code 管理，E333）</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        {isCustom && (
          <p className="text-muted-foreground text-xs">
            此頁設為「自訂」— 內容由 E333 的 custom page registry 接管，以下內容欄位僅供保存，不會用於結構化渲染。
          </p>
        )}
      </Section>

      <fieldset disabled={isCustom} className="space-y-5 disabled:opacity-60">
        {/* ── Meta ─────────────────────────────────────────────────────── */}
        <Section title="Meta（SEO / 分享）">
          <div className="space-y-1.5">
            <Label htmlFor="meta-title">頁面標題</Label>
            <Input id="meta-title" {...register("content.meta.title")} />
            <FieldError message={e.content?.meta?.title?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta-desc">頁面描述</Label>
            <Textarea id="meta-desc" {...register("content.meta.description")} />
            <FieldError message={e.content?.meta?.description?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta-og">OG 圖片網址（選填）</Label>
            <Input id="meta-og" {...register("content.meta.ogImage")} />
          </div>
        </Section>

        {/* ── Style ────────────────────────────────────────────────────── */}
        <Section title="風格">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>風格預設</Label>
              <Controller
                control={control}
                name="content.style.preset"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bold">Bold（強烈）</SelectItem>
                      <SelectItem value="premium">Premium（高級）</SelectItem>
                      <SelectItem value="clean">Clean（簡潔）</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hero 版型</Label>
              <Controller
                control={control}
                name="content.style.heroVariant"
                render={({ field }) => (
                  <Select value={field.value ?? "video-top"} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video-top">影片置頂</SelectItem>
                      <SelectItem value="video-left">影片置左</SelectItem>
                      <SelectItem value="minimal">極簡</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </Section>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <Section title="Hero（主視覺）">
          <div className="space-y-1.5">
            <Label htmlFor="hero-badge">徽章（選填）</Label>
            <Input id="hero-badge" {...register("content.hero.badge")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hero-headline">主標題</Label>
            <Input id="hero-headline" {...register("content.hero.headline")} />
            <FieldError message={e.content?.hero?.headline?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hero-sub">副標題</Label>
            <Textarea id="hero-sub" {...register("content.hero.subheadline")} />
            <FieldError message={e.content?.hero?.subheadline?.message} />
          </div>
          <StringList
            control={control}
            register={register}
            name="content.hero.trustItems"
            label="信任標記"
            addLabel="新增標記"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hero-cta-label">CTA 文字</Label>
              <Input id="hero-cta-label" {...register("content.hero.cta.label")} />
              <FieldError message={e.content?.hero?.cta?.label?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hero-cta-href">CTA 連結</Label>
              <Input id="hero-cta-href" {...register("content.hero.cta.href")} />
              <FieldError message={e.content?.hero?.cta?.href?.message} />
            </div>
          </div>
        </Section>

        {/* ── Pain points ──────────────────────────────────────────────── */}
        <Section title="痛點">
          <div className="space-y-1.5">
            <Label htmlFor="pp-heading">標題</Label>
            <Input id="pp-heading" {...register("content.painPoints.heading")} />
            <FieldError message={e.content?.painPoints?.heading?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-intro">引言（選填）</Label>
            <Input id="pp-intro" {...register("content.painPoints.intro")} />
          </div>
          <StringList
            control={control}
            register={register}
            name="content.painPoints.items"
            label="痛點項目"
            addLabel="新增痛點"
          />
          <FieldError message={e.content?.painPoints?.items?.message} />
        </Section>

        {/* ── Solution ─────────────────────────────────────────────────── */}
        <Section title="解決方案">
          <div className="space-y-1.5">
            <Label htmlFor="sol-heading">標題</Label>
            <Input id="sol-heading" {...register("content.solution.heading")} />
            <FieldError message={e.content?.solution?.heading?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sol-desc">說明</Label>
            <Textarea id="sol-desc" {...register("content.solution.description")} />
            <FieldError message={e.content?.solution?.description?.message} />
          </div>
          <StringList
            control={control}
            register={register}
            name="content.solution.bullets"
            label="賣點（選填）"
            addLabel="新增賣點"
          />
        </Section>

        {/* ── Modules ──────────────────────────────────────────────────── */}
        <Section title="模組大綱">
          <div className="space-y-1.5">
            <Label htmlFor="mod-heading">標題</Label>
            <Input id="mod-heading" {...register("content.modules.heading")} />
            <FieldError message={e.content?.modules?.heading?.message} />
          </div>
          {modules.fields.map((f, i) => (
            <div key={f.id} className="space-y-2 rounded border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">模組 {i + 1}</span>
                <Button type="button" variant="ghost" size="icon" aria-label="移除模組" onClick={() => modules.remove(i)}>
                  <XIcon className="size-4" />
                </Button>
              </div>
              <Input placeholder="標題" {...register(`content.modules.items.${i}.title`)} />
              <Input placeholder="內容" {...register(`content.modules.items.${i}.content`)} />
              <Input placeholder="成果" {...register(`content.modules.items.${i}.outcome`)} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => modules.append({ title: "", content: "", outcome: "" })}>
            <PlusIcon className="size-4" /> 新增模組
          </Button>
        </Section>

        {/* ── Testimonials ─────────────────────────────────────────────── */}
        <Section title="見證">
          <div className="space-y-1.5">
            <Label htmlFor="test-heading">標題</Label>
            <Input id="test-heading" {...register("content.testimonials.heading")} />
            <FieldError message={e.content?.testimonials?.heading?.message} />
          </div>
          {testimonials.fields.map((f, i) => (
            <div key={f.id} className="space-y-2 rounded border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">見證 {i + 1}</span>
                <Button type="button" variant="ghost" size="icon" aria-label="移除見證" onClick={() => testimonials.remove(i)}>
                  <XIcon className="size-4" />
                </Button>
              </div>
              <Textarea placeholder="引言" {...register(`content.testimonials.items.${i}.quote`)} />
              <Input placeholder="姓名" {...register(`content.testimonials.items.${i}.name`)} />
              <Input placeholder="身份 / 職稱" {...register(`content.testimonials.items.${i}.role`)} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => testimonials.append({ quote: "", name: "", role: "" })}>
            <PlusIcon className="size-4" /> 新增見證
          </Button>
        </Section>

        {/* ── Pricing ──────────────────────────────────────────────────── */}
        <Section title="定價">
          <div className="space-y-1.5">
            <Label htmlFor="price-heading">標題</Label>
            <Input id="price-heading" {...register("content.pricing.heading")} />
            <FieldError message={e.content?.pricing?.heading?.message} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">價格</Label>
              <Input id="price" type="number" {...register("content.pricing.price", { valueAsNumber: true })} />
              <FieldError message={e.content?.pricing?.price?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-orig">原價（選填）</Label>
              <Input
                id="price-orig"
                type="number"
                {...register("content.pricing.originalPrice", {
                  setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-currency">幣別</Label>
              <Input id="price-currency" {...register("content.pricing.currency")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price-deadline">倒數截止時間（ISO 8601）</Label>
            <Input id="price-deadline" placeholder="2030-01-01T00:00:00.000Z" {...register("content.pricing.deadline")} />
            <FieldError message={e.content?.pricing?.deadline?.message} />
          </div>
          <StringList
            control={control}
            register={register}
            name="content.pricing.features"
            label="方案內容"
            addLabel="新增項目"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="price-cta-label">CTA 文字</Label>
              <Input id="price-cta-label" {...register("content.pricing.cta.label")} />
              <FieldError message={e.content?.pricing?.cta?.label?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-cta-href">CTA 連結</Label>
              <Input id="price-cta-href" {...register("content.pricing.cta.href")} />
              <FieldError message={e.content?.pricing?.cta?.href?.message} />
            </div>
          </div>
        </Section>

        {/* ── Risk reversal ────────────────────────────────────────────── */}
        <Section title="風險逆轉">
          <div className="space-y-1.5">
            <Label htmlFor="rr-heading">標題</Label>
            <Input id="rr-heading" {...register("content.riskReversal.heading")} />
            <FieldError message={e.content?.riskReversal?.heading?.message} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rr-days">保證天數</Label>
              <Input id="rr-days" type="number" {...register("content.riskReversal.guaranteeDays", { valueAsNumber: true })} />
              <FieldError message={e.content?.riskReversal?.guaranteeDays?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rr-students">學員數（選填）</Label>
              <Input
                id="rr-students"
                type="number"
                {...register("content.riskReversal.studentsCount", {
                  setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
                })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rr-desc">說明</Label>
            <Textarea id="rr-desc" {...register("content.riskReversal.description")} />
            <FieldError message={e.content?.riskReversal?.description?.message} />
          </div>
        </Section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <Section title="常見問題">
          <div className="space-y-1.5">
            <Label htmlFor="faq-heading">標題</Label>
            <Input id="faq-heading" {...register("content.faq.heading")} />
            <FieldError message={e.content?.faq?.heading?.message} />
          </div>
          {faq.fields.map((f, i) => (
            <div key={f.id} className="space-y-2 rounded border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">問題 {i + 1}</span>
                <Button type="button" variant="ghost" size="icon" aria-label="移除問題" onClick={() => faq.remove(i)}>
                  <XIcon className="size-4" />
                </Button>
              </div>
              <Input placeholder="問題" {...register(`content.faq.items.${i}.question`)} />
              <Textarea placeholder="解答" {...register(`content.faq.items.${i}.answer`)} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => faq.append({ question: "", answer: "" })}>
            <PlusIcon className="size-4" /> 新增問題
          </Button>
        </Section>
      </fieldset>

      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}

      <div className="bg-background sticky bottom-0 flex items-center justify-end gap-2 border-t py-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          取消
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "儲存中…" : editing ? "儲存變更" : "建立"}
        </Button>
      </div>
    </form>
  )
}
