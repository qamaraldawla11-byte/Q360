import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Users table
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name'),
    role: text('role').default('user'),
    status: text('status').default('active'), // active | inactive
    isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
    onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' }).default(false),
    primaryWorkspace: text('primary_workspace'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Inventory items table
export const inventoryItems = sqliteTable('inventory_items', {
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
    price: real('price').notNull(),
    businessId: text('business_id').default('biz_main').notNull(), // Multi-tenancy
});

// Products table (for POS barcode lookup)
export const products = sqliteTable('products', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    barcode: text('barcode').notNull().unique(),
    price: real('price').notNull(),
    category: text('category'),
    businessId: text('business_id').default('biz_main').notNull(), // Multi-tenancy
});

// Orders table
export const orders = sqliteTable('orders', {
    id: text('id').primaryKey(),
    items: text('items', { mode: 'json' }).$type<{ id: string; name: string; price: number; quantity: number }[]>(),
    subtotal: real('subtotal').notNull(),
    tax: real('tax').notNull(),
    total: real('total').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    businessId: text('business_id').default('biz_main').notNull(), // Multi-tenancy
});

// Suppliers table
export const suppliers = sqliteTable('suppliers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    contact: text('contact'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    products: text('products', { mode: 'json' }).$type<string[]>(),
    status: text('status').default('active'),
    businessId: text('business_id').default('biz_main').notNull(), // Multi-tenancy
});



// Businesses table
export const businesses = sqliteTable('businesses', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').default('retail'),
    status: text('status').default('active'), // active | suspended
    suspensionReason: text('suspension_reason'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// System Settings table
export const systemSettings = sqliteTable('system_settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(), // JSON string value
    description: text('description'),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Audit Logs table
export const auditLogs = sqliteTable('audit_logs', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    businessId: text('business_id').notNull(),
    action: text('action').notNull(), // CREATE, UPDATE, DELETE, LOGIN, etc.
    entity: text('entity').notNull(), // ORDER, INVENTORY, etc.
    entityId: text('entity_id'),
    details: text('details', { mode: 'json' }),
    timestamp: integer('timestamp', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Type exports for use in services
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;
