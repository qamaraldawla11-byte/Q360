
import { sqlite } from './client.js';

console.log('Running manual migration for Phase 2.5...');

try {
    // Add business_id columns
    try {
        sqlite.exec("ALTER TABLE inventory_items ADD COLUMN business_id TEXT DEFAULT 'biz_main' NOT NULL");
        console.log('✓ Added business_id to inventory_items');
    } catch (e: any) {
        if (!e.message.includes('duplicate column')) console.error('Error altering inventory_items:', e.message);
    }

    try {
        sqlite.exec("ALTER TABLE products ADD COLUMN business_id TEXT DEFAULT 'biz_main' NOT NULL");
        console.log('✓ Added business_id to products');
    } catch (e: any) {
        if (!e.message.includes('duplicate column')) console.error('Error altering products:', e.message);
    }

    try {
        sqlite.exec("ALTER TABLE orders ADD COLUMN business_id TEXT DEFAULT 'biz_main' NOT NULL");
        console.log('✓ Added business_id to orders');
    } catch (e: any) {
        if (!e.message.includes('duplicate column')) console.error('Error altering orders:', e.message);
    }

    try {
        sqlite.exec("ALTER TABLE suppliers ADD COLUMN business_id TEXT DEFAULT 'biz_main' NOT NULL");
        console.log('✓ Added business_id to suppliers');
    } catch (e: any) {
        if (!e.message.includes('duplicate column')) console.error('Error altering suppliers:', e.message);
    }

    // Create audit_logs
    sqlite.exec(`
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
    console.log('✓ Created audit_logs table');

    console.log('Migration complete.');
} catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
}
