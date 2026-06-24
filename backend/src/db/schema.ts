import {
    boolean,
    doublePrecision,
    integer,
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
    price: integer('price').notNull(),
    isAvailable: boolean('is_available').default(true).notNull(),
    prepTimeMinutes: integer('prep_time_minutes').default(0).notNull(),
});

export const restaurantTables = pgTable('restaurant_tables', {
    id: text('id').primaryKey(),
    businessId: text('business_id').default('biz_main').notNull(),
    label: text('label').notNull(),
    capacity: integer('capacity').notNull(),
    status: text('status').$type<'available' | 'occupied' | 'reserved' | 'cleaning'>().default('available').notNull(),
});

export const restaurantOrders = pgTable('restaurant_orders', {
    id: text('id').primaryKey(),
    businessId: text('business_id').default('biz_main').notNull(),
    tableId: text('table_id'),
    status: text('status').$type<'pending' | 'in_kitchen' | 'ready' | 'served' | 'paid' | 'cancelled'>().default('pending').notNull(),
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
    status: text('status').$type<'new' | 'cooking' | 'done'>().default('new').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
});

export const restaurantPayments = pgTable('restaurant_payments', {
    id: text('id').primaryKey(),
    businessId: text('business_id').default('biz_main').notNull(),
    orderId: text('order_id').notNull(),
    method: text('method').$type<'cash' | 'card' | 'mobile'>().notNull(),
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

// Businesses table
export const businesses = pgTable('businesses', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').default('retail'),
    status: text('status').default('active'), // active | suspended
    suspensionReason: text('suspension_reason'),
    createdAt: timestamp('created_at').defaultNow(),
});

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

// Type exports for use in services
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type OtpCode = typeof otpCodes.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type RestaurantMenu = typeof restaurantMenus.$inferSelect;
export type MenuCategory = typeof menuCategories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type RestaurantTable = typeof restaurantTables.$inferSelect;
export type RestaurantOrder = typeof restaurantOrders.$inferSelect;
export type RestaurantOrderItem = typeof restaurantOrderItems.$inferSelect;
export type KdsTicket = typeof kdsTickets.$inferSelect;
export type RestaurantPayment = typeof restaurantPayments.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
