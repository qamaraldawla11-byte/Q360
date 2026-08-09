CREATE TABLE "business_assets" (
	"business_id" text PRIMARY KEY NOT NULL,
	"mime_type" text NOT NULL,
	"data_base64" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "business_modules" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"workspace_key" text NOT NULL,
	"module_key" text NOT NULL,
	"enabled" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "businesses" ADD COLUMN "owner_user_id" TEXT;

ALTER TABLE "businesses" ADD COLUMN "public_code" TEXT;

ALTER TABLE "businesses" ADD COLUMN "country" TEXT;

ALTER TABLE "businesses" ADD COLUMN "city" TEXT;

ALTER TABLE "businesses" ADD COLUMN "address" TEXT;

ALTER TABLE "businesses" ADD COLUMN "phone" TEXT;

ALTER TABLE "businesses" ADD COLUMN "email" TEXT;

ALTER TABLE "businesses" ADD COLUMN "currency" TEXT DEFAULT 'USD';

ALTER TABLE "businesses" ADD COLUMN "timezone" TEXT DEFAULT 'UTC';

ALTER TABLE "businesses" ADD COLUMN "tax_identifier" TEXT;

ALTER TABLE "businesses" ADD COLUMN "restaurant_type" TEXT DEFAULT 'both';

ALTER TABLE "businesses" ADD COLUMN "logo_path" TEXT;

ALTER TABLE "businesses" ADD COLUMN "public_menu_enabled" BOOLEAN DEFAULT true NOT NULL;

ALTER TABLE "businesses" ADD COLUMN "updated_at" TIMESTAMP DEFAULT now();

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

CREATE TABLE "menu_item_assets" (
	"item_id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"mime_type" text NOT NULL,
	"data_base64" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "menu_items" ADD COLUMN "image_url" TEXT;

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

CREATE TABLE "q_assistant_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"created_by" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

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

ALTER TABLE "restaurant_orders" ADD COLUMN "customer_id" TEXT;

ALTER TABLE "restaurant_orders" ADD COLUMN "customer_name" TEXT;

ALTER TABLE "restaurant_orders" ADD COLUMN "customer_phone" TEXT;

ALTER TABLE "restaurant_orders" ADD COLUMN "delivery_address" TEXT;

ALTER TABLE "restaurant_orders" ADD COLUMN "delivery_notes" TEXT;

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

ALTER TABLE "users" ADD COLUMN "module_access" JSONB;

ALTER TABLE "businesses" ADD CONSTRAINT "businesses_public_code_unique" UNIQUE ("public_code");

CREATE UNIQUE INDEX "business_modules_scope_unique" ON "business_modules" USING btree ("business_id","workspace_key","module_key");

CREATE INDEX "business_modules_business_idx" ON "business_modules" USING btree ("business_id");

CREATE INDEX "customers_business_id_idx" ON "customers" USING btree ("business_id");

CREATE INDEX "menu_item_assets_business_idx" ON "menu_item_assets" USING btree ("business_id");

CREATE INDEX "purchase_expense_records_business_idx" ON "purchase_expense_records" USING btree ("business_id");

CREATE INDEX "purchase_expense_records_business_date_idx" ON "purchase_expense_records" USING btree ("business_id","record_date");

CREATE INDEX "purchase_expense_records_business_exact_idx" ON "purchase_expense_records" USING btree ("business_id","duplicate_key_exact");

CREATE UNIQUE INDEX "purchase_expense_records_purchase_order_uidx" ON "purchase_expense_records" USING btree ("purchase_order_id");

CREATE INDEX "purchase_orders_business_idx" ON "purchase_orders" USING btree ("business_id");

CREATE INDEX "q_assistant_conversations_business_updated_idx" ON "q_assistant_conversations" USING btree ("business_id","updated_at");

CREATE INDEX "q_assistant_conversations_creator_updated_idx" ON "q_assistant_conversations" USING btree ("created_by","updated_at");

CREATE INDEX "q_assistant_drafts_business_created_idx" ON "q_assistant_drafts" USING btree ("business_id","created_at");

CREATE INDEX "q_assistant_drafts_business_status_idx" ON "q_assistant_drafts" USING btree ("business_id","status");

CREATE INDEX "q_assistant_messages_conversation_created_idx" ON "q_assistant_messages" USING btree ("conversation_id","created_at");

CREATE INDEX "q_assistant_messages_business_created_idx" ON "q_assistant_messages" USING btree ("business_id","created_at");

CREATE UNIQUE INDEX "q_business_memories_business_unique" ON "q_business_memories" USING btree ("business_id");

CREATE UNIQUE INDEX "q_guest_briefs_token_hash_unique" ON "q_guest_briefs" USING btree ("token_hash");

CREATE INDEX "q_guest_briefs_claimed_user_state_idx" ON "q_guest_briefs" USING btree ("claimed_by_user_id","state");

CREATE INDEX "q_guest_briefs_state_active_expiry_idx" ON "q_guest_briefs" USING btree ("state","active_expires_at");

CREATE INDEX "q_guest_briefs_terminal_at_idx" ON "q_guest_briefs" USING btree ("terminal_at");

CREATE INDEX "q_usage_events_business_created_idx" ON "q_usage_events" USING btree ("business_id","created_at");

CREATE INDEX "q_usage_events_user_created_idx" ON "q_usage_events" USING btree ("user_id","created_at");

CREATE INDEX "quote_items_quote_id_idx" ON "quote_items" USING btree ("quote_id");

CREATE INDEX "quotes_business_id_idx" ON "quotes" USING btree ("business_id");

CREATE INDEX "quotes_customer_id_idx" ON "quotes" USING btree ("customer_id");

CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");

CREATE INDEX "restaurant_bookings_business_starts_idx" ON "restaurant_bookings" USING btree ("business_id","starts_at");

CREATE INDEX "restaurant_bookings_business_status_idx" ON "restaurant_bookings" USING btree ("business_id","status");

CREATE INDEX "staff_invitations_email_idx" ON "staff_invitations" USING btree ("email");

CREATE INDEX "staff_invitations_business_idx" ON "staff_invitations" USING btree ("business_id");

CREATE UNIQUE INDEX "staff_members_business_email_unique" ON "staff_members" USING btree ("business_id","email");

CREATE INDEX "staff_members_business_idx" ON "staff_members" USING btree ("business_id");

CREATE INDEX "stock_movements_business_idx" ON "stock_movements" USING btree ("business_id");

CREATE INDEX "stock_movements_item_idx" ON "stock_movements" USING btree ("inventory_item_id");