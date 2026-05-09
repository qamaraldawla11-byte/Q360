
import { db } from '../db/client.js';
import { users, auditLogs, inventoryItems } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Mock server URL
const API_URL = 'http://localhost:3001/api';

async function main() {
    console.log('🚀 Starting Phase 2.5 Verification...');

    // 1. Verify Database Schema (Audit Logs, BusinessID)
    try {
        const testAudit = db.select().from(auditLogs).limit(1).get();
        console.log('✅ Audit Log table exists');
    } catch (e) {
        console.error('❌ Audit Log table missing', e);
    }

    // 2. Setup Test Users (Admin vs Staff in different business)
    // We can't easily register via API without proper flow, so seed/check DB.
    // Admin exists.
    // Let's create a "competitor" user directly in DB for testing multi-tenancy.

    const competitorId = 'usr_comp_001';
    const competitorBiz = 'biz_competitor';

    db.insert(users).values({
        id: competitorId,
        email: 'competitor@test.com',
        name: 'Competitor',
        role: 'admin',
        primaryWorkspace: competitorBiz
    }).onConflictDoNothing().run();

    console.log('✅ Competitor user ensured');

    // 3. Insert Competitor Item
    const compItemId = 'inv_comp_item_1';
    db.insert(inventoryItems).values({
        id: compItemId,
        name: 'Competitor Secret Sauce',
        current: 100,
        min: 10,
        unit: 'L',
        price: 99.99,
        businessId: competitorBiz
    }).onConflictDoNothing().run();

    console.log('✅ Competitor item ensured');

    // 4. Verify Data Isolation (Manual Check Logic or API)
    // Since API needs running server, we assume server is running.
    // We will run this script AFTER server start.

    console.log('...Waiting for server checks (run this script manually while server is running to test API)...');
    console.log('This script only setup test data. Manual verification steps recommended:');
    console.log('1. Login as Admin (biz_main). GET /api/inventory. Should NOT see "Competitor Secret Sauce".');
    console.log('2. Login as Competitor. GET /api/inventory. Should see ONLY "Competitor Secret Sauce".');
    console.log('3. Create Order as Staff. Check Audit Logs.');
}

main().catch(console.error);
