import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync } from 'fs';

// Ensure data directory exists
try {
    mkdirSync('./data', { recursive: true });
} catch { }

// Create SQLite database connection
const sqlite = new Database('./data/one-os.db');

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');

// Create Drizzle instance with schema
export const db = drizzle(sqlite, { schema });

// Export for direct SQL queries if needed
export { sqlite };
