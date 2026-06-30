import { and, eq } from 'drizzle-orm';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';
import {
  inventoryItems,
  menuCategories,
  menuItems,
  products,
  restaurantMenus,
  restaurantTables,
  suppliers,
  users,
  businesses,
} from './schema.js';

requireQ360StagingDatabaseGuard('db:seed');
requireDatabaseUrl();

const { closeDatabase, db } = await import('./client.js');

console.log('Seeding database...');

try {
await db.insert(businesses).values({
  id: 'biz_main',
  name: 'Main Business',
  type: 'restaurant',
  status: 'active',
}).onConflictDoNothing();
console.log('  Main business seeded');

await db.insert(users).values({
  id: 'usr_admin_001',
  email: 'admin@one-os.io',
  name: 'System Admin',
  role: 'admin',
  businessId: 'biz_main',
  onboardingCompleted: false,
  primaryWorkspace: 'biz_main',
}).onConflictDoNothing();
console.log('  Admin user seeded');

const inventoryData = [
  { id: '1', name: 'Fresh Milk (1L)', current: 45, min: 50, unit: 'units', barcode: '123456', category: 'Dairy', status: 'low' as const, supplier: 'Dairy Fresh Co.', price: 3.99, businessId: 'biz_main' },
  { id: '2', name: 'Bread - Whole Wheat', current: 12, min: 30, unit: 'units', barcode: '234567', category: 'Bakery', status: 'critical' as const, supplier: 'Local Bakery', price: 2.49, businessId: 'biz_main' },
  { id: '3', name: 'Eggs (Dozen)', current: 80, min: 40, unit: 'units', barcode: '345678', category: 'Dairy', status: 'ok' as const, supplier: 'Farm Fresh', price: 4.99, businessId: 'biz_main' },
  { id: '4', name: 'Pasta - Spaghetti', current: 200, min: 100, unit: 'units', barcode: '456789', category: 'Dry Goods', status: 'ok' as const, supplier: 'Import Foods', price: 1.99, businessId: 'biz_main' },
  { id: '5', name: 'Tomatoes (per kg)', current: 25, min: 50, unit: 'kg', barcode: '567890', category: 'Produce', status: 'low' as const, supplier: 'Green Valley Farm', price: 2.99, businessId: 'biz_main' },
];

await db.insert(inventoryItems).values(inventoryData).onConflictDoNothing();
console.log('  Inventory items seeded');

const productData = [
  { id: '1', name: 'Fresh Milk (1L)', barcode: '123456', price: 3.99, category: 'Dairy', businessId: 'biz_main' },
  { id: '2', name: 'Bread - Whole Wheat', barcode: '234567', price: 2.49, category: 'Bakery', businessId: 'biz_main' },
  { id: '3', name: 'Eggs (Dozen)', barcode: '345678', price: 4.99, category: 'Dairy', businessId: 'biz_main' },
  { id: '4', name: 'Pasta - Spaghetti', barcode: '456789', price: 1.99, category: 'Dry Goods', businessId: 'biz_main' },
  { id: '5', name: 'Tomatoes (per kg)', barcode: '567890', price: 2.99, category: 'Produce', businessId: 'biz_main' },
];

await db.insert(products).values(productData).onConflictDoNothing();
console.log('  Products seeded');

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

await db.insert(suppliers).values(supplierData).onConflictDoNothing();
console.log('  Suppliers seeded');

const mainMenu = {
  id: 'restaurant_main_menu',
  businessId: 'biz_main',
  name: 'Main Menu',
  isActive: true,
};
await db.insert(restaurantMenus).values(mainMenu).onConflictDoNothing();

const restaurantCategories = ['Starters', 'Mains', 'Drinks', 'Desserts'].map((name, index) => ({
  id: `restaurant_category_${name.toLowerCase()}`,
  businessId: 'biz_main',
  menuId: mainMenu.id,
  name,
  sortOrder: index,
}));
await db.insert(menuCategories).values(restaurantCategories).onConflictDoNothing();

const categoryIds = Object.fromEntries(restaurantCategories.map((category) => [category.name, category.id]));
const legacyRestaurantItemIds = [
  'menu_truffle_fries',
  'menu_caesar_salad',
  'menu_wagyu_burger',
  'menu_grilled_salmon',
  'menu_craft_cola',
  'menu_espresso',
  'menu_cheesecake',
];
for (const id of legacyRestaurantItemIds) {
  await db.delete(menuItems).where(and(eq(menuItems.id, id), eq(menuItems.businessId, 'biz_main')));
}

const restaurantMenuData = [
  { id: 'restaurant_item_bruschetta', name: 'Bruschetta', price: 800, categoryId: categoryIds.Starters },
  { id: 'restaurant_item_caesar_salad', name: 'Caesar Salad', price: 1200, categoryId: categoryIds.Starters },
  { id: 'restaurant_item_grilled_chicken', name: 'Grilled Chicken', price: 1800, categoryId: categoryIds.Mains },
  { id: 'restaurant_item_beef_burger', name: 'Beef Burger', price: 1600, categoryId: categoryIds.Mains },
  { id: 'restaurant_item_pasta_carbonara', name: 'Pasta Carbonara', price: 1500, categoryId: categoryIds.Mains },
  { id: 'restaurant_item_margherita_pizza', name: 'Margherita Pizza', price: 1400, categoryId: categoryIds.Mains },
  { id: 'restaurant_item_soft_drink', name: 'Soft Drink', price: 400, categoryId: categoryIds.Drinks },
  { id: 'restaurant_item_fresh_juice', name: 'Fresh Juice', price: 600, categoryId: categoryIds.Drinks },
].map((item) => ({
  ...item,
  businessId: 'biz_main',
  isAvailable: true,
  prepTimeMinutes: 0,
}));

await db.insert(menuItems).values(restaurantMenuData).onConflictDoNothing();
console.log('  Restaurant menu seeded');

for (let index = 1; index <= 12; index += 1) {
  await db.delete(restaurantTables)
    .where(and(eq(restaurantTables.id, `table_${index}`), eq(restaurantTables.businessId, 'biz_main')));
}

const tableData = Array.from({ length: 12 }, (_, index) => {
  const number = index + 1;
  return {
    id: `restaurant_table_t${number}`,
    businessId: 'biz_main',
    label: `T${number}`,
    capacity: number <= 3 ? 2 : number <= 9 ? 4 : 6,
    status: 'available' as const,
  };
});

await db.insert(restaurantTables).values(tableData).onConflictDoNothing();
console.log('  Restaurant tables seeded');

console.log('Database seeding complete!');
} catch (error) {
  console.error('Database seeding failed:', error);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
