import 'dotenv/config';

const DATABASE_URL_ERROR = 'DATABASE_URL is not configured with a valid Postgres connection string.';
const Q360_STAGING_ENV = 'staging';
const Q360_STAGING_NAME = 'q360-staging';

export const requireQ360StagingDatabaseGuard = (commandName: string) => {
    if (process.env.Q360_DATABASE_ENV !== Q360_STAGING_ENV) {
        throw new Error(
            `${commandName} is blocked: set Q360_DATABASE_ENV=staging to confirm the isolated Q360 staging database.`,
        );
    }

    if (process.env.Q360_DATABASE_NAME !== Q360_STAGING_NAME) {
        throw new Error(
            `${commandName} is blocked: set Q360_DATABASE_NAME=q360-staging as the human-readable staging database marker.`,
        );
    }
};

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
