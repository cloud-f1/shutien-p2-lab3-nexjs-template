ALTER TABLE "webhooks" ADD COLUMN "scope" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE INDEX "webhooks_scope_idx" ON "webhooks" USING btree ("scope");