import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { requireDatabaseUrl } from '../utils/env.js';

const databaseUrl = requireDatabaseUrl();

export const queryClient = postgres(databaseUrl, {
    max: Number(process.env.POSTGRES_POOL_SIZE || 10),
    ssl: process.env.POSTGRES_SSL === 'false' ? false : 'require',
});

export const db = drizzle(queryClient, { schema });

export const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    })
    : null;

export const first = async <T>(query: PromiseLike<T[]>): Promise<T | undefined> => {
    const rows = await query;
    return rows[0];
};

export const closeDatabase = async () => {
    await queryClient.end();
};
