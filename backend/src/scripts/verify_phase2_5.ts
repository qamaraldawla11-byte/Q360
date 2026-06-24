import { db } from '../db/client.js';
import { users, auditLogs, inventoryItems } from '../db/schema.js';

console.log('Starting Phase 2.5 verification...');

await db.select().from(auditLogs).limit(1);
console.log('Audit log table exists');

const competitorId = 'usr_comp_001';
const competitorBiz = 'biz_competitor';

await db.insert(users).values({
    id: competitorId,
    email: 'competitor@test.com',
    name: 'Competitor',
    role: 'admin',
    primaryWorkspace: competitorBiz,
}).onConflictDoNothing();

console.log('Competitor user ensured');

const compItemId = 'inv_comp_item_1';
await db.insert(inventoryItems).values({
    id: compItemId,
    name: 'Competitor Secret Sauce',
    current: 100,
    min: 10,
    unit: 'L',
    price: 99.99,
    businessId: competitorBiz,
}).onConflictDoNothing();

console.log('Competitor item ensured');
console.log('Manual API checks: biz_main inventory should not include Competitor Secret Sauce; competitor workspace should.');
