import { sql } from 'drizzle-orm';
import { db } from './client.js';

let migrationPromise: Promise<void> | null = null;

export const ensureRestaurantServiceFlowSchema = () => {
    migrationPromise ??= (async () => {
        await db.execute(sql`
            ALTER TABLE restaurant_orders
            ADD COLUMN IF NOT EXISTS order_type text,
            ADD COLUMN IF NOT EXISTS service_status text,
            ADD COLUMN IF NOT EXISTS payment_status text,
            ADD COLUMN IF NOT EXISTS payment_timing text,
            ADD COLUMN IF NOT EXISTS idempotency_key text,
            ADD COLUMN IF NOT EXISTS visible_order_number integer,
            ADD COLUMN IF NOT EXISTS order_number_date text,
            ADD COLUMN IF NOT EXISTS cancellation_reason text,
            ADD COLUMN IF NOT EXISTS cancelled_by text,
            ADD COLUMN IF NOT EXISTS cancelled_at timestamp
        `);
        await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS restaurant_orders_business_idempotency_key_idx
            ON restaurant_orders (business_id, idempotency_key)
            WHERE idempotency_key IS NOT NULL
        `);
        await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS restaurant_orders_business_daily_visible_number_idx
            ON restaurant_orders (business_id, order_number_date, visible_order_number)
            WHERE visible_order_number IS NOT NULL AND order_number_date IS NOT NULL
        `);
    })();
    return migrationPromise;
};
