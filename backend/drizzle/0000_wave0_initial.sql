CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"business_id" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_assets" (
	"business_id" text PRIMARY KEY NOT NULL,
	"mime_type" text NOT NULL,
	"data_base64" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_modules" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"workspace_key" text NOT NULL,
	"module_key" text NOT NULL,
	"enabled" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text,
	"public_code" text,
	"name" text NOT NULL,
	"type" text DEFAULT 'retail',
	"country" text,
	"city" text,
	"address" text,
	"phone" text,
	"email" text,
	"currency" text DEFAULT 'USD',
	"timezone" text DEFAULT 'UTC',
	"tax_identifier" text,
	"restaurant_type" text DEFAULT 'both',
	"logo_path" text,
	"public_menu_enabled" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active',
	"suspension_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "businesses_public_code_unique" UNIQUE("public_code")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text DEFAULT 'biz_main' NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"company_name" text,
	"address" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"current" integer NOT NULL,
	"min" integer NOT NULL,
	"max" integer,
	"unit" text NOT NULL,
	"barcode" text,
	"category" text,
	"status" text DEFAULT 'ok',
	"supplier" text,
	"price" double precision NOT NULL,
	"business_id" text DEFAULT 'biz_main' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kds_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"business_id" text DEFAULT 'biz_main' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text DEFAULT 'biz_main' NOT NULL,
	"menu_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_item_assets" (
	"item_id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"mime_type" text NOT NULL,
	"data_base64" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text DEFAULT 'biz_main' NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"price" integer NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"prep_time_minutes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"items" jsonb,
	"subtotal" double precision NOT NULL,
	"tax" double precision NOT NULL,
	"total" double precision NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"business_id" text DEFAULT 'biz_main' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"barcode" text NOT NULL,
	"price" double precision NOT NULL,
	"category" text,
	"business_id" text DEFAULT 'biz_main' NOT NULL,
	CONSTRAINT "products_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "purchase_expense_records" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"workspace_context" text DEFAULT 'restaurant' NOT NULL,
	"record_type" text NOT NULL,
	"status" text DEFAULT 'saved' NOT NULL,
	"supplier_name" text,
	"supplier_id" text,
	"category" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"record_date" text NOT NULL,
	"reference" text,
	"notes" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"approved_draft_id" text,
	"purchase_order_id" text,
	"duplicate_key_exact" text,
	"duplicate_fingerprint" text,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"voided_at" timestamp,
	"voided_by" text
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"supplier_id" text,
	"inventory_item_id" text NOT NULL,
	"quantity" double precision NOT NULL,
	"unit_cost" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ordered' NOT NULL,
	"ordered_at" timestamp DEFAULT now() NOT NULL,
	"received_at" timestamp,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "q_assistant_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"created_by" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "q_assistant_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"created_by" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"owner_edited_body" text,
	"approval_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "q_assistant_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"business_id" text NOT NULL,
	"user_id" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"evidence_cards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "q_business_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"owner_summary" text,
	"business_goals" text,
	"operating_priorities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "q_guest_briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"payload" jsonb NOT NULL,
	"visitor_key_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"active_expires_at" timestamp NOT NULL,
	"claimed_by_user_id" text,
	"claimed_at" timestamp,
	"confirmed_at" timestamp,
	"confirmed_fields" jsonb,
	"state_updated_at" timestamp DEFAULT now() NOT NULL,
	"terminal_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "q_usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" text,
	"feature" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"image_tokens" integer DEFAULT 0 NOT NULL,
	"audio_seconds" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd_micros" integer DEFAULT 0 NOT NULL,
	"request_status" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text DEFAULT 'biz_main' NOT NULL,
	"quote_id" text NOT NULL,
	"product_id" text,
	"description" text NOT NULL,
	"quantity" double precision NOT NULL,
	"unit_price" double precision NOT NULL,
	"line_total" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text DEFAULT 'biz_main' NOT NULL,
	"customer_id" text,
	"quote_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" double precision NOT NULL,
	"discount_total" double precision DEFAULT 0 NOT NULL,
	"tax_total" double precision DEFAULT 0 NOT NULL,
	"total" double precision NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"valid_until" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"customer_id" text,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"party_size" integer NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"table_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"occasion" text,
	"notes" text,
	"deposit_amount" double precision DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_menus" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text DEFAULT 'biz_main' NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text DEFAULT 'biz_main' NOT NULL,
	"visible_order_number" integer,
	"order_number_date" text,
	"table_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"order_type" text,
	"customer_id" text,
	"customer_name" text,
	"customer_phone" text,
	"delivery_address" text,
	"delivery_notes" text,
	"service_status" text,
	"payment_status" text,
	"payment_timing" text,
	"idempotency_key" text,
	"cancellation_reason" text,
	"cancelled_by" text,
	"cancelled_at" timestamp,
	"created_by" text NOT NULL,
	"total" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text DEFAULT 'biz_main' NOT NULL,
	"order_id" text NOT NULL,
	"method" text NOT NULL,
	"amount" double precision NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"paid_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "restaurant_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text DEFAULT 'biz_main' NOT NULL,
	"label" text NOT NULL,
	"capacity" integer NOT NULL,
	"status" text DEFAULT 'available' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"staff_member_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"module_access" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"module_access" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"shift_name" text,
	"shift_start" text,
	"shift_end" text,
	"status" text DEFAULT 'invited' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"inventory_item_id" text NOT NULL,
	"purchase_order_id" text,
	"delta" double precision NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"phone" text,
	"email" text,
	"address" text,
	"products" jsonb,
	"status" text DEFAULT 'active',
	"business_id" text DEFAULT 'biz_main' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'user',
	"status" text DEFAULT 'active',
	"is_locked" boolean DEFAULT false,
	"user_type" text,
	"segment" text,
	"business_name" text,
	"country" text,
	"currency" text DEFAULT 'USD',
	"onboarding_completed" boolean DEFAULT false,
	"business_id" text,
	"primary_workspace" text,
	"module_access" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "business_modules_scope_unique" ON "business_modules" USING btree ("business_id","workspace_key","module_key");--> statement-breakpoint
CREATE INDEX "business_modules_business_idx" ON "business_modules" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "customers_business_id_idx" ON "customers" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "menu_item_assets_business_idx" ON "menu_item_assets" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "purchase_expense_records_business_idx" ON "purchase_expense_records" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "purchase_expense_records_business_date_idx" ON "purchase_expense_records" USING btree ("business_id","record_date");--> statement-breakpoint
CREATE INDEX "purchase_expense_records_business_exact_idx" ON "purchase_expense_records" USING btree ("business_id","duplicate_key_exact");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_expense_records_purchase_order_uidx" ON "purchase_expense_records" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_business_idx" ON "purchase_orders" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "q_assistant_conversations_business_updated_idx" ON "q_assistant_conversations" USING btree ("business_id","updated_at");--> statement-breakpoint
CREATE INDEX "q_assistant_conversations_creator_updated_idx" ON "q_assistant_conversations" USING btree ("created_by","updated_at");--> statement-breakpoint
CREATE INDEX "q_assistant_drafts_business_created_idx" ON "q_assistant_drafts" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "q_assistant_drafts_business_status_idx" ON "q_assistant_drafts" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "q_assistant_messages_conversation_created_idx" ON "q_assistant_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "q_assistant_messages_business_created_idx" ON "q_assistant_messages" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "q_business_memories_business_unique" ON "q_business_memories" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "q_guest_briefs_token_hash_unique" ON "q_guest_briefs" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "q_guest_briefs_claimed_user_state_idx" ON "q_guest_briefs" USING btree ("claimed_by_user_id","state");--> statement-breakpoint
CREATE INDEX "q_guest_briefs_state_active_expiry_idx" ON "q_guest_briefs" USING btree ("state","active_expires_at");--> statement-breakpoint
CREATE INDEX "q_guest_briefs_terminal_at_idx" ON "q_guest_briefs" USING btree ("terminal_at");--> statement-breakpoint
CREATE INDEX "q_usage_events_business_created_idx" ON "q_usage_events" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "q_usage_events_user_created_idx" ON "q_usage_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "quote_items_quote_id_idx" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quotes_business_id_idx" ON "quotes" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "quotes_customer_id_idx" ON "quotes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "restaurant_bookings_business_starts_idx" ON "restaurant_bookings" USING btree ("business_id","starts_at");--> statement-breakpoint
CREATE INDEX "restaurant_bookings_business_status_idx" ON "restaurant_bookings" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "staff_invitations_email_idx" ON "staff_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "staff_invitations_business_idx" ON "staff_invitations" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_business_email_unique" ON "staff_members" USING btree ("business_id","email");--> statement-breakpoint
CREATE INDEX "staff_members_business_idx" ON "staff_members" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "stock_movements_business_idx" ON "stock_movements" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "stock_movements_item_idx" ON "stock_movements" USING btree ("inventory_item_id");