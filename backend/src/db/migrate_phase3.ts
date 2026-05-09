/**
 * Migration script for Phase 3 Admin Enhancements
 * Adds user status/lock fields and business suspension reason
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', '..', 'data', 'oneos.db');
const db = new Database(dbPath);

console.log('🔧 Running Phase 3 Admin Enhancement Migration...\n');

const migrations = [
    {
        name: 'Add status column to users',
        sql: `ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';`
    },
    {
        name: 'Add is_locked column to users',
        sql: `ALTER TABLE users ADD COLUMN is_locked INTEGER DEFAULT 0;`
    },
    {
        name: 'Add suspension_reason column to businesses',
        sql: `ALTER TABLE businesses ADD COLUMN suspension_reason TEXT;`
    }
];

for (const migration of migrations) {
    try {
        db.exec(migration.sql);
        console.log(`✅ ${migration.name}`);
    } catch (error: any) {
        if (error.message.includes('duplicate column name')) {
            console.log(`⚠️  ${migration.name} - Column already exists, skipping`);
        } else {
            console.error(`❌ ${migration.name} - Error: ${error.message}`);
        }
    }
}

console.log('\n🎉 Phase 3 Migration complete!');
db.close();
