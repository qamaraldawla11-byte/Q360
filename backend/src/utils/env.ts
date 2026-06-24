import 'dotenv/config';

const DATABASE_URL_ERROR = 'DATABASE_URL is not configured with a valid Postgres connection string.';

export const requireDatabaseUrl = () => {
    const databaseUrl = process.env.DATABASE_URL?.trim();

    if (!databaseUrl) {
        throw new Error(DATABASE_URL_ERROR);
    }

    try {
        const parsed = new URL(databaseUrl);
        if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
            throw new Error(DATABASE_URL_ERROR);
        }
    } catch {
        throw new Error(DATABASE_URL_ERROR);
    }

    return databaseUrl;
};
