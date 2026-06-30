import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { requireQ360StagingDatabaseGuard } from './src/utils/env.ts';

loadDotenv({ path: process.env.DOTENV_CONFIG_PATH || '.env', quiet: true });

requireQ360StagingDatabaseGuard('db:push');

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL || '',
        ssl: process.env.POSTGRES_SSL === 'false' ? false : 'require',
    },
});
