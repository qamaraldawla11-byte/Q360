-- Q360-PS-CTO-B1-S4 NOTE:
-- This migration intentionally drops the global "products_barcode_unique" constraint
-- because barcode uniqueness is being redefined as tenant-scoped via the partial
-- unique indexes "products_business_barcode_idx" and "products_business_sku_idx"
-- below. The barcode column is also made nullable so that products without a
-- barcode do not participate in the uniqueness rule.
--
-- Safety impact: removes a global uniqueness guarantee. Deployment must ensure
-- no duplicate barcodes exist across the same business before applying this
-- migration, and the migration should be run in a single transaction so the new
-- partial-unique index is created immediately after the old constraint is dropped.
--
-- Pre-flight check (run against the target database before this migration):
--   SELECT business_id, barcode, COUNT(*) AS n
--   FROM products
--   WHERE barcode IS NOT NULL AND barcode <> ''
--   GROUP BY business_id, barcode
--   HAVING COUNT(*) > 1;
-- If this query returns any rows, the migration must be blocked until the
-- duplicates are resolved (merge, re-barcode, or archive the duplicates).
--
-- SKU pre-flight check:
--   SELECT business_id, sku, COUNT(*) AS n
--   FROM products
--   WHERE sku IS NOT NULL AND sku <> ''
--   GROUP BY business_id, sku
--   HAVING COUNT(*) > 1;
-- Any rows returned block migration until duplicate SKUs are resolved.
ALTER TABLE "products" DROP CONSTRAINT "products_barcode_unique";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "barcode" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "default_price_amount_minor" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "products_business_id_idx" ON "products" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "products_business_sku_idx" ON "products" USING btree ("business_id","sku") WHERE "products"."sku" IS NOT NULL AND "products"."sku" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX "products_business_barcode_idx" ON "products" USING btree ("business_id","barcode") WHERE "products"."barcode" IS NOT NULL AND "products"."barcode" <> '';