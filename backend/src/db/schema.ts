import {
    boolean,
    doublePrecision,
    integer,
    index,
    uniqueIndex,
    jsonb,
    pgTable,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name'),
    role: text('role').default('user'),
    status: text('status').default('active'), // active | inactive
    isLocked: boolean('is_locked').default(false),
    userType: text('user_type').$type<'sme' | 'personal'>(),
    segment: text('segment').$type<
        'restaurant' |
        'pharmacy' |
        'supermarket' |
        'retail' |
        'autoparts' |
        'clinic' |
        'services' |
        'other' |
        'personal_freelancer' |
        'personal_consultant' |
        'personal_creative'
    >(),
    businessName: text('business_name'),
    country: text('country'),
    currency: text('currency').default('USD'),
    onboardingCompleted: boolean('onboarding_completed').default(false),
    businessId: text('business_id'),
    primaryWorkspace: text('primary_workspace'),
    moduleAccess: jsonb('module_access').$type<string[]>(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const otpCodes = pgTable('otp_codes', {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Inventory items table
export const inventoryItems = pgTable('inventory_items', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    current: integer('current').notNull(),
    min: integer('min').notNull(),
    max: integer('max'),
    unit: text('unit').notNull(),
    barcode: text('barcode'),
    category: text('category'),
    status: text('status').default('ok'), // ok | low | critical
    supplier: text('supplier'),
    price: doublePrecision('price').notNull(),
    businessId: text('business_id').default('biz_main').notNull(), // Multi-tenancy
});

// Products table (for POS barcode lookup)
export const products = pgTable('products', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    barcode: text('barcode').notNull().unique(),
    price: doublePrecision('price').notNull(),
    category: text('category'),
    businessId: text('business_id').default('biz_main').notNull(), // Multi-tenancy
});

// Orders table
export const orders = pgTable('orders', {
    id: text('id').primaryKey(),
    items: jsonb('items').$type<{ id: string; name: string; price: number; quantity: number }[]>(),
    subtotal: doublePrecision('subtotal').notNull(),
    tax: doublePrecision('tax').notNull(),
    total: doublePrecision('total').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    businessId: text('business_id').default('biz_main').notNull(), // Multi-tenancy
});

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

// Shared customers table for Commerce and future Services
export const customers = pgTable('customers', {
    id: text('id').primaryKey(),
    businessId: text('business_id').default('biz_main').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    companyName: text('company_name'),
    address: text('address'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    index('customers_business_id_idx').on(table.businessId),
]);

// Shared quotes table for Commerce and future Services
export const quotes = pgTable('quotes', {
    id: text('id').primaryKey(),
    businessId: text('business_id').default('biz_main').notNull(),
    customerId: text('customer_id'),
    quoteNumber: text('quote_number').notNull(),
    status: text('status').$type<QuoteStatus>().default('draft').notNull(),
    subtotal: doublePrecision('subtotal').notNull(),
    discountTotal: doublePrecision('discount_total').default(0).notNull(),
    taxTotal: doublePrecision('tax_total').default(0).notNull(),
    total: doublePrecision('total').notNull(),
    currency: text('currency').default('USD').notNull(),
    validUntil: timestamp('valid_until'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    index('quotes_business_id_idx').on(table.businessId),
    index('quotes_customer_id_idx').on(table.customerId),
    index('quotes_status_idx').on(table.status),
]);

// Shared quote line items table
export const quoteItems = pgTable('quote_items', {
    id: text('id').primaryKey(),
    businessId: text('business_id').default('biz_main').notNull(),
    quoteId: text('quote_id').notNull(),
    productId: text('product_id'),
    description: text('description').notNull(),
    quantity: doublePrecision('quantity').notNull(),
    unitPrice: doublePrecision('unit_price').notNull(),
    lineTotal: doublePrecision('line_total').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    index('quote_items_quote_id_idx').on(table.quoteId),
]);

export const restaurantMenus = pgTable('restaurant_menus', {
    id: text('id').primaryKey(),
    businessId: text('business_id').default('biz_main').notNull(),
    name: text('name').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
});

export const menuCategories = pgTable('menu_categories', {
    id: text('id').primaryKey(),
    businessId: text('business_id').default('biz_main').notNull(),
    menuId: text('menu_id').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
});

export const menuItems = pgTable('menu_items', {
    id: text('id').primaryKey(),
    businessId: text('business_id').default('biz_main').notNull(),
    categoryId: text('category_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    price: integer('price').notNull(),
    isAvailable: boolean('is_available').default(true).notNull(),
    prepTimeMinutes: integer('prep_time_minutes').default(0).notNull(),
});

export const menuItemAssets = pgTable('menu_item_assets', {
    itemId: text('item_id').primaryKey(),
    businessId: text('business_id').notNull(),
    mimeType: text('mime_type').notNull(),
    dataBase64: text('data_base64').notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    index('menu_item_assets_business_idx').on(table.businessId),
]);

export const restaurantTables = pgTable('restaurant_tables', {
    id: text('id').primaryKey(),
    businessId: text('business_id').default('biz_main').notNull(),
    label: text('label').notNull(),
    capacity: integer('capacity').notNull(),
    status: text('status').$type<'available' | 'occupied' | 'reserved' | 'cleaning'>().default('available').notNull(),
});

// Reservations stay separate from a table's current floor status: a table can
// be available now and still be reserved for a future booking.
export const restaurantBookings = pgTable('restaurant_bookings', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    customerId: text('customer_id'),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone'),
    partySize: integer('party_size').notNull(),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at').notNull(),
    tableIds: jsonb('table_ids').$type<string[]>().notNull().default([]),
    status: text('status').$type<'pending' | 'confirmed' | 'arrived' | 'seated' | 'completed' | 'cancelled' | 'no_show'>().notNull().default('pending'),
    occasion: text('occasion'),
    notes: text('notes'),
    depositAmount: doublePrecision('deposit_amount').notNull().default(0),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    index('restaurant_bookings_business_starts_idx').on(table.businessId, table.startsAt),
    index('restaurant_bookings_business_status_idx').on(table.businessId, table.status),
]);

export const restaurantOrders = pgTable('restaurant_orders', {
    id: text('id').primaryKey(),
    businessId: text('business_id').default('biz_main').notNull(),
    visibleOrderNumber: integer('visible_order_number'),
    orderNumberDate: text('order_number_date'),
    tableId: text('table_id'),
    status: text('status').$type<'pending' | 'in_kitchen' | 'ready' | 'delivered' | 'served' | 'collected' | 'closed' | 'paid' | 'cancelled'>().default('pending').notNull(),
    orderType: text('order_type').$type<'dine_in' | 'takeaway' | 'delivery'>(),
    customerId: text('customer_id'),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    deliveryAddress: text('delivery_address'),
    deliveryNotes: text('delivery_notes'),
    serviceStatus: text('service_status').$type<'pending' | 'in_kitchen' | 'ready' | 'delivered' | 'collected' | 'closed' | 'cancelled'>(),
    paymentStatus: text('payment_status').$type<'unpaid' | 'paid' | 'refunded'>(),
    paymentTiming: text('payment_timing').$type<'pay_before_service' | 'pay_after_service'>(),
    idempotencyKey: text('idempotency_key'),
    cancellationReason: text('cancellation_reason'),
    cancelledBy: text('cancelled_by'),
    cancelledAt: timestamp('cancelled_at'),
    createdBy: text('created_by').notNull(),
    total: integer('total').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const restaurantOrderItems = pgTable('restaurant_order_items', {
    id: text('id').primaryKey(),
    orderId: text('order_id').notNull(),
    menuItemId: text('menu_item_id').notNull(),
    name: text('name').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
    notes: text('notes'),
    status: text('status').$type<'pending' | 'cooking' | 'done'>().default('pending').notNull(),
});

export const kdsTickets = pgTable('kds_tickets', {
    id: text('id').primaryKey(),
    orderId: text('order_id').notNull(),
    businessId: text('business_id').default('biz_main').notNull(),
    status: text('status').$type<'new' | 'cooking' | 'done' | 'cancelled'>().default('new').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
});

export const restaurantPayments = pgTable('restaurant_payments', {
    id: text('id').primaryKey(),
    businessId: text('business_id').default('biz_main').notNull(),
    orderId: text('order_id').notNull(),
    method: text('method').$type<'cash' | 'card' | 'manual' | 'mobile'>().notNull(),
    amount: doublePrecision('amount').notNull(),
    status: text('status').$type<'completed' | 'refunded'>().default('completed').notNull(),
    paidAt: timestamp('paid_at').defaultNow(),
});

// Suppliers table
export const suppliers = pgTable('suppliers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    contact: text('contact'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    products: jsonb('products').$type<string[]>(),
    status: text('status').default('active'),
    businessId: text('business_id').default('biz_main').notNull(), // Multi-tenancy
});

export const purchaseOrders = pgTable('purchase_orders', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    supplierId: text('supplier_id'),
    inventoryItemId: text('inventory_item_id').notNull(),
    quantity: doublePrecision('quantity').notNull(),
    unitCost: doublePrecision('unit_cost').notNull().default(0),
    status: text('status').$type<'ordered' | 'received' | 'cancelled'>().notNull().default('ordered'),
    orderedAt: timestamp('ordered_at').notNull().defaultNow(),
    receivedAt: timestamp('received_at'),
    createdBy: text('created_by').notNull(),
}, (table) => [
    index('purchase_orders_business_idx').on(table.businessId),
]);

export const purchaseExpenseRecords = pgTable('purchase_expense_records', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    workspaceContext: text('workspace_context').$type<'restaurant'>().notNull().default('restaurant'),
    recordType: text('record_type').$type<'purchase' | 'expense'>().notNull(),
    status: text('status').$type<'saved' | 'voided'>().notNull().default('saved'),
    supplierName: text('supplier_name'),
    supplierId: text('supplier_id'),
    category: text('category').notNull(),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull(),
    recordDate: text('record_date').notNull(),
    reference: text('reference'),
    notes: text('notes'),
    source: text('source').$type<'manual' | 'approved_extraction' | 'purchase_order'>().notNull().default('manual'),
    approvedDraftId: text('approved_draft_id'),
    purchaseOrderId: text('purchase_order_id'),
    duplicateKeyExact: text('duplicate_key_exact'),
    duplicateFingerprint: text('duplicate_fingerprint'),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    voidedAt: timestamp('voided_at'),
    voidedBy: text('voided_by'),
}, (table) => [
    index('purchase_expense_records_business_idx').on(table.businessId),
    index('purchase_expense_records_business_date_idx').on(table.businessId, table.recordDate),
    index('purchase_expense_records_business_exact_idx').on(table.businessId, table.duplicateKeyExact),
    uniqueIndex('purchase_expense_records_purchase_order_uidx').on(table.purchaseOrderId),
]);

export const stockMovements = pgTable('stock_movements', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    inventoryItemId: text('inventory_item_id').notNull(),
    purchaseOrderId: text('purchase_order_id'),
    delta: doublePrecision('delta').notNull(),
    reason: text('reason').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    index('stock_movements_business_idx').on(table.businessId),
    index('stock_movements_item_idx').on(table.inventoryItemId),
]);

// Businesses table
export const businesses = pgTable('businesses', {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id'),
    publicCode: text('public_code').unique(),
    name: text('name').notNull(),
    type: text('type').default('retail'),
    country: text('country'),
    city: text('city'),
    address: text('address'),
    phone: text('phone'),
    email: text('email'),
    currency: text('currency').default('USD'),
    timezone: text('timezone').default('UTC'),
    taxIdentifier: text('tax_identifier'),
    restaurantType: text('restaurant_type').$type<'dine_in' | 'takeaway' | 'both'>().default('both'),
    logoPath: text('logo_path'),
    publicMenuEnabled: boolean('public_menu_enabled').default(true).notNull(),
    status: text('status').default('active'), // active | suspended
    suspensionReason: text('suspension_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const businessAssets = pgTable('business_assets', {
    businessId: text('business_id').primaryKey(),
    mimeType: text('mime_type').notNull(),
    dataBase64: text('data_base64').notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const staffMembers = pgTable('staff_members', {
    id: text('id').primaryKey(), businessId: text('business_id').notNull(), userId: text('user_id'),
    name: text('name').notNull(), email: text('email').notNull(), role: text('role').notNull(),
    moduleAccess: jsonb('module_access').$type<string[]>().notNull().default([]),
    shiftName: text('shift_name'), shiftStart: text('shift_start'), shiftEnd: text('shift_end'),
    status: text('status').$type<'invited'|'active'|'inactive'>().notNull().default('invited'),
    createdAt: timestamp('created_at').notNull().defaultNow(), updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, table => [uniqueIndex('staff_members_business_email_unique').on(table.businessId, table.email), index('staff_members_business_idx').on(table.businessId)]);

export const staffInvitations = pgTable('staff_invitations', {
    id: text('id').primaryKey(), businessId: text('business_id').notNull(), staffMemberId: text('staff_member_id').notNull(),
    email: text('email').notNull(), role: text('role').notNull(), moduleAccess: jsonb('module_access').$type<string[]>().notNull().default([]),
    status: text('status').$type<'pending'|'accepted'|'revoked'>().notNull().default('pending'),
    invitedBy: text('invited_by').notNull(), createdAt: timestamp('created_at').notNull().defaultNow(), acceptedAt: timestamp('accepted_at'),
}, table => [index('staff_invitations_email_idx').on(table.email), index('staff_invitations_business_idx').on(table.businessId)]);

export const businessModules = pgTable('business_modules', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    workspaceKey: text('workspace_key').notNull(),
    moduleKey: text('module_key').notNull(),
    enabled: boolean('enabled').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    uniqueIndex('business_modules_scope_unique').on(table.businessId, table.workspaceKey, table.moduleKey),
    index('business_modules_business_idx').on(table.businessId),
]);

// System Settings table
export const systemSettings = pgTable('system_settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(), // JSON string value
    description: text('description'),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// Audit Logs table
export const auditLogs = pgTable('audit_logs', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    businessId: text('business_id').notNull(),
    action: text('action').notNull(), // CREATE, UPDATE, DELETE, LOGIN, etc.
    entity: text('entity').notNull(), // ORDER, INVENTORY, etc.
    entityId: text('entity_id'),
    details: jsonb('details'),
    timestamp: timestamp('timestamp').defaultNow(),
});

// Q Assistant drafts are inert review records. They never execute operational
// actions directly; an owner/admin decision is recorded separately.
export const qAssistantDrafts = pgTable('q_assistant_drafts', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    createdBy: text('created_by').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    evidenceIds: jsonb('evidence_ids').$type<string[]>().notNull().default([]),
    status: text('status').notNull().default('pending'),
    reviewedBy: text('reviewed_by'),
    ownerEditedBody: text('owner_edited_body'),
    approvalNote: text('approval_note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at'),
}, (table) => [
    index('q_assistant_drafts_business_created_idx').on(table.businessId, table.createdAt),
    index('q_assistant_drafts_business_status_idx').on(table.businessId, table.status),
]);

// Owner-managed context for Q. It stores only information the owner explicitly
// saves for this business; it is never shared across businesses.
export const qBusinessMemories = pgTable('q_business_memories', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    ownerSummary: text('owner_summary'),
    businessGoals: text('business_goals'),
    operatingPriorities: jsonb('operating_priorities').$type<string[]>().notNull().default([]),
    updatedBy: text('updated_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    uniqueIndex('q_business_memories_business_unique').on(table.businessId),
]);

// Provider-neutral Q metering. Rules-only Q activity records zero model tokens;
// future model, image, and voice calls use the same tenant-scoped ledger.
export const qUsageEvents = pgTable('q_usage_events', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    userId: text('user_id').notNull(),
    conversationId: text('conversation_id'),
    feature: text('feature').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    imageTokens: integer('image_tokens').notNull().default(0),
    audioSeconds: integer('audio_seconds').notNull().default(0),
    estimatedCostUsdMicros: integer('estimated_cost_usd_micros').notNull().default(0),
    requestStatus: text('request_status').$type<'completed' | 'failed' | 'blocked'>().notNull(),
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean>>().notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    index('q_usage_events_business_created_idx').on(table.businessId, table.createdAt),
    index('q_usage_events_user_created_idx').on(table.userId, table.createdAt),
]);

// Conversation records are tenant-scoped. Q's rules-only replies can be
// replaced by a model provider later without changing ownership or feedback.
export const qAssistantConversations = pgTable('q_assistant_conversations', {
    id: text('id').primaryKey(),
    businessId: text('business_id').notNull(),
    createdBy: text('created_by').notNull(),
    title: text('title').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    index('q_assistant_conversations_business_updated_idx').on(table.businessId, table.updatedAt),
    index('q_assistant_conversations_creator_updated_idx').on(table.createdBy, table.updatedAt),
]);

export const qAssistantMessages = pgTable('q_assistant_messages', {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull(),
    businessId: text('business_id').notNull(),
    userId: text('user_id'),
    role: text('role').$type<'user' | 'assistant'>().notNull(),
    content: text('content').notNull(),
    evidenceCards: jsonb('evidence_cards').$type<Array<{ id: string; label: string; facts: string[] }>>().notNull().default([]),
    feedback: text('feedback').$type<'helpful' | 'not_helpful'>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    index('q_assistant_messages_conversation_created_idx').on(table.conversationId, table.createdAt),
    index('q_assistant_messages_business_created_idx').on(table.businessId, table.createdAt),
]);

// Q guest briefs carry a validated, sanitized pre-auth recommendation from the
// public concierge to a dedicated post-login claim boundary (A2.2, additive).
// The raw handoff token is NEVER stored — only its HMAC-derived hash.
// visitor_key_hash is optional, non-authoritative telemetry: it must never be
// used for authentication, authorization, claim ownership, brief retrieval,
// or user matching, and only a derived hash may be stored here.
export type QGuestBriefState = 'active' | 'claimed' | 'confirmed' | 'consumed' | 'expired' | 'dismissed' | 'revoked';

export const qGuestBriefs = pgTable('q_guest_briefs', {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    state: text('state').$type<QGuestBriefState>().notNull().default('active'),
    payload: jsonb('payload').notNull(), // QGuestBriefPayload v1 — sanitized by the A2.1 contract before write
    visitorKeyHash: text('visitor_key_hash'), // nullable; derived hash only; telemetry context only
    createdAt: timestamp('created_at').notNull().defaultNow(),
    activeExpiresAt: timestamp('active_expires_at').notNull(), // createdAt + 60 minutes
    claimedByUserId: text('claimed_by_user_id'), // set exactly once by the atomic claim
    claimedAt: timestamp('claimed_at'),
    confirmedAt: timestamp('confirmed_at'),
    confirmedFields: jsonb('confirmed_fields').$type<string[]>(), // subset of payload.prefill keys accepted by the owner
    stateUpdatedAt: timestamp('state_updated_at').notNull().defaultNow(),
    terminalAt: timestamp('terminal_at'), // set on consumed/expired/dismissed/revoked; drives 30-day cleanup
}, (table) => [
    uniqueIndex('q_guest_briefs_token_hash_unique').on(table.tokenHash),
    index('q_guest_briefs_claimed_user_state_idx').on(table.claimedByUserId, table.state),
    index('q_guest_briefs_state_active_expiry_idx').on(table.state, table.activeExpiresAt),
    index('q_guest_briefs_terminal_at_idx').on(table.terminalAt),
]);

// Type exports for use in services
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type OtpCode = typeof otpCodes.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type NewQuoteItem = typeof quoteItems.$inferInsert;
export type RestaurantMenu = typeof restaurantMenus.$inferSelect;
export type MenuCategory = typeof menuCategories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type RestaurantTable = typeof restaurantTables.$inferSelect;
export type RestaurantOrder = typeof restaurantOrders.$inferSelect;
export type RestaurantOrderItem = typeof restaurantOrderItems.$inferSelect;
export type KdsTicket = typeof kdsTickets.$inferSelect;
export type RestaurantPayment = typeof restaurantPayments.$inferSelect;
export type PurchaseExpenseRecord = typeof purchaseExpenseRecords.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
