CREATE TYPE "public"."sales_page_event" AS ENUM('page_view', 'cta_click', 'checkout_started');--> statement-breakpoint
CREATE TABLE "sales_page_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"event" "sales_page_event" NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"session_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "utm" jsonb;--> statement-breakpoint
CREATE INDEX "sales_page_events_slug_created_idx" ON "sales_page_events" USING btree ("slug","created_at");--> statement-breakpoint
CREATE INDEX "sales_page_events_slug_event_idx" ON "sales_page_events" USING btree ("slug","event");--> statement-breakpoint
CREATE INDEX "sales_page_events_created_idx" ON "sales_page_events" USING btree ("created_at");