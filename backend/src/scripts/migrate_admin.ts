
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('Running manual migration for Admin Panel tables...');

    try {
        // Create Businesses Table
        db.run(sql`
            CREATE TABLE IF NOT EXISTS businesses (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'retail',
                status TEXT DEFAULT 'active',
                created_at INTEGER
            )
        `);
        console.log('Created businesses table.');

        // Create System Settings Table
        db.run(sql`
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT,
                updated_at INTEGER
            )
        `);
        console.log('Created system_settings table.');

    } catch (e) {
        console.error('Migration failed:', e);
    }
}

main();
