import { db, sqlite } from './client.js';
import { users, inventoryItems, products, suppliers } from './schema.js';
import { eq } from 'drizzle-orm';

console.log('🌱 Seeding database...');

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    is_locked INTEGER DEFAULT 0,
    onboarding_completed INTEGER DEFAULT 0,
    primary_workspace TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    current INTEGER NOT NULL,
    min INTEGER NOT NULL,
    max INTEGER,
    unit TEXT NOT NULL,
    barcode TEXT,
    category TEXT,
    status TEXT DEFAULT 'ok',
    supplier TEXT,
    price REAL NOT NULL,
    business_id TEXT DEFAULT 'biz_main' NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    barcode TEXT NOT NULL UNIQUE,
    price REAL NOT NULL,
    category TEXT,
    business_id TEXT DEFAULT 'biz_main' NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    items TEXT,
    subtotal REAL NOT NULL,
    tax REAL NOT NULL,
    total REAL NOT NULL,
    created_at INTEGER,
    business_id TEXT DEFAULT 'biz_main' NOT NULL
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    products TEXT,
    status TEXT DEFAULT 'active',
    business_id TEXT DEFAULT 'biz_main' NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    business_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    timestamp INTEGER
  );
`);

// Seed admin user
const adminExists = db.select().from(users).where(eq(users.email, 'admin@one-os.io')).get();
if (!adminExists) {
  db.insert(users).values({
    id: 'usr_admin_001',
    email: 'admin@one-os.io',
    name: 'System Admin',
    role: 'admin',
    onboardingCompleted: false,
    primaryWorkspace: 'biz_main',
  }).run();
  console.log('  ✓ Admin user created');
}

// Seed inventory items (from frontend mocks)
const inventoryData = [
  { id: '1', name: 'Fresh Milk (1L)', current: 45, min: 50, unit: 'units', barcode: '123456', category: 'Dairy', status: 'low' as const, supplier: 'Dairy Fresh Co.', price: 3.99, businessId: 'biz_main' },
  { id: '2', name: 'Bread - Whole Wheat', current: 12, min: 30, unit: 'units', barcode: '234567', category: 'Bakery', status: 'critical' as const, supplier: 'Local Bakery', price: 2.49, businessId: 'biz_main' },
  { id: '3', name: 'Eggs (Dozen)', current: 80, min: 40, unit: 'units', barcode: '345678', category: 'Dairy', status: 'ok' as const, supplier: 'Farm Fresh', price: 4.99, businessId: 'biz_main' },
  { id: '4', name: 'Pasta - Spaghetti', current: 200, min: 100, unit: 'units', barcode: '456789', category: 'Dry Goods', status: 'ok' as const, supplier: 'Import Foods', price: 1.99, businessId: 'biz_main' },
  { id: '5', name: 'Tomatoes (per kg)', current: 25, min: 50, unit: 'kg', barcode: '567890', category: 'Produce', status: 'low' as const, supplier: 'Green Valley Farm', price: 2.99, businessId: 'biz_main' },
];

for (const item of inventoryData) {
  const exists = db.select().from(inventoryItems).where(eq(inventoryItems.id, item.id)).get();
  if (!exists) {
    db.insert(inventoryItems).values(item).run();
  }
}
console.log('  ✓ Inventory items seeded');

// Seed products (for POS barcode lookup)
const productData = [
  { id: '1', name: 'Fresh Milk (1L)', barcode: '123456', price: 3.99, category: 'Dairy', businessId: 'biz_main' },
  { id: '2', name: 'Bread - Whole Wheat', barcode: '234567', price: 2.49, category: 'Bakery', businessId: 'biz_main' },
  { id: '3', name: 'Eggs (Dozen)', barcode: '345678', price: 4.99, category: 'Dairy', businessId: 'biz_main' },
  { id: '4', name: 'Pasta - Spaghetti', barcode: '456789', price: 1.99, category: 'Dry Goods', businessId: 'biz_main' },
  { id: '5', name: 'Tomatoes (per kg)', barcode: '567890', price: 2.99, category: 'Produce', businessId: 'biz_main' },
];

for (const product of productData) {
  const exists = db.select().from(products).where(eq(products.id, product.id)).get();
  if (!exists) {
    db.insert(products).values(product).run();
  }
}
console.log('  ✓ Products seeded');

// Seed suppliers
const supplierData = [
  {
    id: 'sup_001',
    name: 'Dairy Fresh Co.',
    contact: 'John Smith',
    phone: '+1 555 0101',
    email: 'orders@dairyfresh.com',
    address: '123 Dairy Lane, Farmville',
    products: ['Fresh Milk', 'Yogurt', 'Cheese'],
    status: 'active',
    businessId: 'biz_main',
  },
  {
    id: 'sup_002',
    name: 'Green Valley Farm',
    contact: 'Maria Garcia',
    phone: '+1 555 0102',
    email: 'sales@greenvalley.com',
    address: '456 Farm Road, Greenville',
    products: ['Tomatoes', 'Lettuce', 'Carrots'],
    status: 'active',
    businessId: 'biz_main',
  },
  {
    id: 'sup_003',
    name: 'Local Bakery',
    contact: 'Bob Wilson',
    phone: '+1 555 0103',
    email: 'wholesale@localbakery.com',
    address: '789 Baker Street, Downtown',
    products: ['Bread', 'Pastries', 'Cakes'],
    status: 'active',
    businessId: 'biz_main',
  },
];

for (const supplier of supplierData) {
  const exists = db.select().from(suppliers).where(eq(suppliers.id, supplier.id)).get();
  if (!exists) {
    db.insert(suppliers).values(supplier).run();
  }
}
console.log('  ✓ Suppliers seeded');

console.log('✅ Database seeding complete!');
