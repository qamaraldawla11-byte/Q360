ALTER TABLE "inventory_items" ADD COLUMN "product_id" text;--> statement-breakpoint
CREATE INDEX "inventory_items_product_id_idx" ON "inventory_items" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "operation_id" text;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "movement_type" text;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "source_module" text;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_business_operation_item_uidx" ON "stock_movements" USING btree ("business_id","operation_id","inventory_item_id") WHERE "stock_movements"."operation_id" IS NOT NULL;
