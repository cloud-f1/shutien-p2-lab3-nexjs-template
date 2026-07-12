CREATE TYPE "public"."sales_page_render_mode" AS ENUM('structured', 'custom');--> statement-breakpoint
CREATE TYPE "public"."sales_page_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "sales_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"product_id" uuid,
	"content" jsonb NOT NULL,
	"render_mode" "sales_page_render_mode" DEFAULT 'structured' NOT NULL,
	"status" "sales_page_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "sales_pages" ADD CONSTRAINT "sales_pages_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_pages_status_idx" ON "sales_pages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_pages_product_id_idx" ON "sales_pages" USING btree ("product_id");