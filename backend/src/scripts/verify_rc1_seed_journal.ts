// Verification-only script for Q360-PS-CTO-B1-S5.
// Seeds drizzle.__drizzle_migrations and q360_baseline_provenance for migrations
// 0000 and 0001 so that /readyz can be exercised in a disposable database.

import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import postgres from 'postgres';

interface JournalEntry {
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
}

interface JournalFile {
    version: string;
    dialect: string;
    entries: JournalEntry[];
}

const hashFile = async (filePath: string): Promise<string> => {
    const buffer = await readFile(filePath);
    return createHash('sha256').update(buffer).digest('hex');
};

const loadJournal = async (journalPath: string): Promise<JournalFile> => {
    const content = await readFile(journalPath, 'utf8');
    return JSON.parse(content) as JournalFile;
};

const run = async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('DATABASE_URL is required');
        process.exit(1);
    }

    const sql = postgres(databaseUrl, { max: 1, ssl: false });

    try {
        const journal = await loadJournal('./drizzle/meta/_journal.json');

        await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS drizzle`);
        await sql.unsafe(`
            CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
                id SERIAL PRIMARY KEY,
                hash text NOT NULL,
                created_at bigint NOT NULL
            )
        `);

        for (const entry of journal.entries) {
            const migrationPath = `./drizzle/${entry.tag}.sql`;
            const hash = await hashFile(migrationPath);
            const existing = await sql`SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${hash} LIMIT 1`;
            if (existing.length === 0) {
                await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`;
            }
            console.log(`Seeded journal hash for ${entry.tag}: ${hash.slice(0, 16)}...`);
        }

        await sql.unsafe(`
            CREATE TABLE IF NOT EXISTS public.q360_baseline_provenance (
                key text PRIMARY KEY NOT NULL,
                value text NOT NULL,
                recorded_at timestamp DEFAULT now() NOT NULL
            )
        `);
        await sql`
            INSERT INTO public.q360_baseline_provenance (key, value, recorded_at)
            VALUES ('rc1_verification', 'true', now())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, recorded_at = EXCLUDED.recorded_at
        `;

        console.log('RC1 journal seed complete.');
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    } finally {
        await sql.end();
    }
};

run();
