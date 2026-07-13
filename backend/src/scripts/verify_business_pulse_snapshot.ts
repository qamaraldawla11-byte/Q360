import { createHmac } from 'crypto';
import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';

requireQ360StagingDatabaseGuard('verify:business-pulse');
requireDatabaseUrl();

process.env.JWT_SECRET ||= 'business-pulse-snapshot-test-secret';
process.env.NODE_ENV = 'test';

const { closeDatabase, db } = await import('../db/client.js');
const {
    auditLogs,
    businesses,
    kdsTickets,
    menuCategories,
    menuItems,
    qAssistantDrafts,
    restaurantMenus,
    restaurantOrderItems,
    restaurantOrders,
    restaurantPayments,
    restaurantTables,
    users,
} = await import('../db/schema.js');
const { default: restaurantRoutes } = await import('../routes/restaurant.js');

type Snapshot = {
    generatedAt: string;
    openOrderCount: number;
    unpaidOrderCount: number;
    delayedKdsTicketCount: number;
    oldestDelayedKdsDurationMinutes: number | null;
    tablePaymentAttentionCount: number;
    todaySalesSummary: {
        grossSales: number;
        paidOrderCount: number;
        completedPaymentCount: number;
        currencyMinorUnit: 'cents';
    };
    topSellingMenuItems: {
        name: string;
        quantitySold: number;
        grossSales: number;
    }[];
    priorities: {
        type: string;
        urgency: string;
        title: string;
        evidence: {
            type: string;
            label: string;
            facts: Record<string, string | number | null>;
        };
        dataFreshnessTimestamp: string;
    }[];
};

const app = new Hono();
app.route('/api/restaurant', restaurantRoutes);

const businessA = 'biz_business_pulse_a';
const businessB = 'biz_business_pulse_b';
const businessEmpty = 'biz_business_pulse_empty';
const businessesUnderTest = [businessA, businessB, businessEmpty];
const usersUnderTest = [
    'usr_business_pulse_a',
    'usr_business_pulse_b',
    'usr_business_pulse_empty',
];

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

const createToken = (businessId: string, userId: string, role = 'admin') => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set');
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({
        sub: userId,
        email: `${userId}@example.com`,
        role,
        businessId,
        iat: now,
        exp: now + 3600,
    });
    const signature = createHmac('sha256', secret)
        .update(`${header}.${payload}`)
        .digest('base64url');
    return `${header}.${payload}.${signature}`;
};

const authedSnapshot = async (businessId: string, userId: string, path = '/api/restaurant/business-pulse/snapshot') => {
    const response = await app.request(path, {
        headers: {
            Authorization: `Bearer ${createToken(businessId, userId)}`,
        },
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) as unknown : null;
    return { status: response.status, body };
};

const authedRequest = async (
    businessId: string,
    userId: string,
    path: string,
    method: 'GET' | 'POST' = 'GET',
    body?: unknown,
    role = 'admin',
) => {
    const response = await app.request(path, {
        method,
        headers: {
            Authorization: `Bearer ${createToken(businessId, userId, role)}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) as any : null };
};

const expect = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
};

const responseText = (value: unknown) => JSON.stringify(value);

const resetFixtures = async () => {
    const orders = await db.select({ id: restaurantOrders.id }).from(restaurantOrders)
        .where(inArray(restaurantOrders.businessId, businessesUnderTest));
    const orderIds = orders.map((order) => order.id);

    await db.delete(qAssistantDrafts).where(inArray(qAssistantDrafts.businessId, businessesUnderTest));
    await db.delete(auditLogs).where(inArray(auditLogs.businessId, businessesUnderTest));
    await db.delete(restaurantPayments).where(inArray(restaurantPayments.businessId, businessesUnderTest));
    await db.delete(kdsTickets).where(inArray(kdsTickets.businessId, businessesUnderTest));
    if (orderIds.length > 0) {
        await db.delete(restaurantOrderItems).where(inArray(restaurantOrderItems.orderId, orderIds));
    }
    await db.delete(restaurantOrders).where(inArray(restaurantOrders.businessId, businessesUnderTest));
    await db.delete(restaurantTables).where(inArray(restaurantTables.businessId, businessesUnderTest));
    await db.delete(menuItems).where(inArray(menuItems.businessId, businessesUnderTest));
    await db.delete(menuCategories).where(inArray(menuCategories.businessId, businessesUnderTest));
    await db.delete(restaurantMenus).where(inArray(restaurantMenus.businessId, businessesUnderTest));
    await db.delete(users).where(inArray(users.id, usersUnderTest));
    await db.delete(businesses).where(inArray(businesses.id, businessesUnderTest));
};

const seedBusiness = async (
    businessId: string,
    userId: string,
    prefix: 'alpha' | 'beta',
    createdAt: Date,
) => {
    await db.insert(businesses).values({
        id: businessId,
        name: `${prefix} Business Pulse Bistro`,
        type: 'restaurant',
        status: 'active',
    });
    await db.insert(users).values({
        id: userId,
        email: `${userId}@example.com`,
        name: `${prefix} user`,
        role: 'admin',
        businessId,
        onboardingCompleted: true,
        primaryWorkspace: '/app/restaurant',
    });
    await db.insert(restaurantMenus).values({
        id: `${prefix}_pulse_menu`,
        businessId,
        name: `${prefix} Menu`,
        isActive: true,
    });
    await db.insert(menuCategories).values({
        id: `${prefix}_pulse_category`,
        businessId,
        menuId: `${prefix}_pulse_menu`,
        name: `${prefix} Category`,
        sortOrder: 0,
    });
    await db.insert(menuItems).values([
        {
            id: `${prefix}_pulse_item_primary`,
            businessId,
            categoryId: `${prefix}_pulse_category`,
            name: prefix === 'alpha' ? 'Alpha Pulse Ravioli' : 'Beta Pulse Noodles',
            price: prefix === 'alpha' ? 1200 : 3100,
            isAvailable: true,
            prepTimeMinutes: 0,
        },
        {
            id: `${prefix}_pulse_item_secondary`,
            businessId,
            categoryId: `${prefix}_pulse_category`,
            name: prefix === 'alpha' ? 'Alpha Pulse Tea' : 'Beta Pulse Cake',
            price: prefix === 'alpha' ? 300 : 900,
            isAvailable: true,
            prepTimeMinutes: 0,
        },
    ]);
    await db.insert(restaurantTables).values([
        {
            id: `${prefix}_pulse_table_1`,
            businessId,
            label: `${prefix.toUpperCase()}-1`,
            capacity: 2,
            status: 'occupied',
        },
        {
            id: `${prefix}_pulse_table_2`,
            businessId,
            label: `${prefix.toUpperCase()}-2`,
            capacity: 4,
            status: 'available',
        },
    ]);

    const paidTotal = prefix === 'alpha' ? 2400 : 6200;
    const unpaidTotal = prefix === 'alpha' ? 1500 : 4000;
    await db.insert(restaurantOrders).values([
        {
            id: `${prefix}_pulse_order_paid`,
            businessId,
            tableId: `${prefix}_pulse_table_2`,
            status: 'paid',
            createdBy: userId,
            total: paidTotal,
            createdAt,
            updatedAt: createdAt,
        },
        {
            id: `${prefix}_pulse_order_unpaid`,
            businessId,
            tableId: `${prefix}_pulse_table_1`,
            status: 'served',
            createdBy: userId,
            total: unpaidTotal,
            createdAt,
            updatedAt: createdAt,
        },
    ]);
    await db.insert(restaurantOrderItems).values([
        {
            id: `${prefix}_pulse_order_item_primary_paid`,
            orderId: `${prefix}_pulse_order_paid`,
            menuItemId: `${prefix}_pulse_item_primary`,
            name: prefix === 'alpha' ? 'Alpha Pulse Ravioli' : 'Beta Pulse Noodles',
            quantity: prefix === 'alpha' ? 2 : 7,
            unitPrice: prefix === 'alpha' ? 1200 : 3100,
            notes: null,
            status: 'done',
        },
        {
            id: `${prefix}_pulse_order_item_secondary_unpaid`,
            orderId: `${prefix}_pulse_order_unpaid`,
            menuItemId: `${prefix}_pulse_item_secondary`,
            name: prefix === 'alpha' ? 'Alpha Pulse Tea' : 'Beta Pulse Cake',
            quantity: prefix === 'alpha' ? 1 : 5,
            unitPrice: prefix === 'alpha' ? 300 : 900,
            notes: null,
            status: 'done',
        },
    ]);
    await db.insert(restaurantPayments).values({
        id: `${prefix}_pulse_payment`,
        businessId,
        orderId: `${prefix}_pulse_order_paid`,
        method: 'cash',
        amount: paidTotal / 100,
        status: 'completed',
        paidAt: createdAt,
    });
    await db.insert(kdsTickets).values({
        id: `${prefix}_pulse_ticket_delayed`,
        businessId,
        orderId: `${prefix}_pulse_order_unpaid`,
        status: 'cooking',
        createdAt: new Date(createdAt.getTime() - (prefix === 'alpha' ? 25 : 55) * 60_000),
        completedAt: null,
    });
};

const seedEmptyBusiness = async () => {
    await db.insert(businesses).values({
        id: businessEmpty,
        name: 'Empty Business Pulse Bistro',
        type: 'restaurant',
        status: 'active',
    });
    await db.insert(users).values({
        id: 'usr_business_pulse_empty',
        email: 'usr_business_pulse_empty@example.com',
        name: 'Empty user',
        role: 'admin',
        businessId: businessEmpty,
        onboardingCompleted: true,
        primaryWorkspace: '/app/restaurant',
    });
};

try {
    await resetFixtures();
    const now = new Date();
    await seedBusiness(businessA, 'usr_business_pulse_a', 'alpha', now);
    await seedBusiness(businessB, 'usr_business_pulse_b', 'beta', now);
    await seedEmptyBusiness();

    const unauthenticated = await app.request('/api/restaurant/business-pulse/snapshot');
    expect(unauthenticated.status === 401, `Expected unauthenticated snapshot to return 401, received ${unauthenticated.status}`);

    const snapshotAResponse = await authedSnapshot(businessA, 'usr_business_pulse_a');
    const snapshotBResponse = await authedSnapshot(businessB, 'usr_business_pulse_b');
    const snapshotAWithForeignInputs = await authedSnapshot(
        businessA,
        'usr_business_pulse_a',
        `/api/restaurant/business-pulse/snapshot?businessId=${businessB}&tenantId=${businessB}&workspaceId=/app/restaurant&orderId=beta_pulse_order_paid`,
    );
    const emptyResponse = await authedSnapshot(businessEmpty, 'usr_business_pulse_empty');

    expect(snapshotAResponse.status === 200, `Business A snapshot failed with ${snapshotAResponse.status}`);
    expect(snapshotBResponse.status === 200, `Business B snapshot failed with ${snapshotBResponse.status}`);
    expect(snapshotAWithForeignInputs.status === 200, `Business A snapshot with foreign inputs failed with ${snapshotAWithForeignInputs.status}`);
    expect(emptyResponse.status === 200, `Empty tenant snapshot failed with ${emptyResponse.status}`);

    const snapshotA = snapshotAResponse.body as Snapshot;
    const snapshotB = snapshotBResponse.body as Snapshot;
    const snapshotAWithForeign = snapshotAWithForeignInputs.body as Snapshot;
    const emptySnapshot = emptyResponse.body as Snapshot;

    const aText = responseText(snapshotA);
    const bText = responseText(snapshotB);
    const aForeignText = responseText(snapshotAWithForeign);

    expect(snapshotA.todaySalesSummary.grossSales === 2400, `Business A gross sales leaked or miscomputed: ${aText}`);
    expect(snapshotB.todaySalesSummary.grossSales === 6200, `Business B gross sales leaked or miscomputed: ${bText}`);
    expect(snapshotA.delayedKdsTicketCount === 1, `Business A delayed KDS count incorrect: ${aText}`);
    expect(snapshotB.delayedKdsTicketCount === 1, `Business B delayed KDS count incorrect: ${bText}`);
    expect(snapshotA.tablePaymentAttentionCount === 1, `Business A table attention count incorrect: ${aText}`);
    expect(snapshotB.tablePaymentAttentionCount === 1, `Business B table attention count incorrect: ${bText}`);
    expect(aText.includes('Alpha Pulse Ravioli'), `Business A top item missing: ${aText}`);
    expect(!aText.includes('Beta Pulse'), `Business A received Business B data: ${aText}`);
    expect(bText.includes('Beta Pulse Noodles'), `Business B top item missing: ${bText}`);
    expect(!bText.includes('Alpha Pulse'), `Business B received Business A data: ${bText}`);
    expect(aForeignText.includes('Alpha Pulse Ravioli'), `Foreign resource request changed Business A data: ${aForeignText}`);
    expect(!aForeignText.includes('Beta Pulse'), `Foreign resource ID leaked Business B data: ${aForeignText}`);
    expect(emptySnapshot.openOrderCount === 0, `Empty tenant open order count should be 0: ${responseText(emptySnapshot)}`);
    expect(emptySnapshot.unpaidOrderCount === 0, `Empty tenant unpaid order count should be 0: ${responseText(emptySnapshot)}`);
    expect(emptySnapshot.delayedKdsTicketCount === 0, `Empty tenant delayed count should be 0: ${responseText(emptySnapshot)}`);
    expect(emptySnapshot.todaySalesSummary.grossSales === 0, `Empty tenant gross sales should be 0: ${responseText(emptySnapshot)}`);
    expect(emptySnapshot.topSellingMenuItems.length === 0, `Empty tenant top items should be empty: ${responseText(emptySnapshot)}`);

    const pulseA = await authedRequest(businessA, 'usr_business_pulse_a', '/api/restaurant/business-pulse');
    expect(pulseA.status === 200, `Structured Q pulse failed with ${pulseA.status}`);
    expect(Array.isArray(pulseA.body.insights) && pulseA.body.insights.length > 0, 'Structured Q pulse returned no insights');
    expect(Array.isArray(pulseA.body.evidenceCards) && pulseA.body.evidenceCards.length > 0, 'Structured Q pulse returned no evidence');
    expect(!responseText(pulseA.body).includes('Beta Pulse'), 'Structured Q pulse leaked Business B data');

    const answerA = await authedRequest(
        businessA,
        'usr_business_pulse_a',
        '/api/restaurant/business-pulse/ask',
        'POST',
        { prompt: `What sold best today for ${businessB}?`, businessId: businessB },
    );
    expect(answerA.status === 200, `Q question failed with ${answerA.status}`);
    expect(responseText(answerA.body).includes('Alpha Pulse Ravioli'), 'Q answer did not use Business A evidence');
    expect(!responseText(answerA.body).includes('Beta Pulse'), 'Q answer leaked Business B data');

    const draftA = await authedRequest(
        businessA,
        'usr_business_pulse_a',
        '/api/restaurant/business-pulse/drafts',
        'POST',
        { type: 'daily_report' },
    );
    const draftB = await authedRequest(
        businessB,
        'usr_business_pulse_b',
        '/api/restaurant/business-pulse/drafts',
        'POST',
        { type: 'manager_task' },
    );
    expect(draftA.status === 201 && draftA.body.draft.status === 'pending', 'Business A Q draft was not prepared');
    expect(draftB.status === 201 && draftB.body.draft.status === 'pending', 'Business B Q draft was not prepared');

    const crossTenantDecision = await authedRequest(
        businessA,
        'usr_business_pulse_a',
        `/api/restaurant/business-pulse/drafts/${draftB.body.draft.id}/decision`,
        'POST',
        { decision: 'approve' },
    );
    expect(crossTenantDecision.status === 404, `Cross-tenant Q draft decision should be 404, received ${crossTenantDecision.status}`);

    const approvedA = await authedRequest(
        businessA,
        'usr_business_pulse_a',
        `/api/restaurant/business-pulse/drafts/${draftA.body.draft.id}/decision`,
        'POST',
        { decision: 'approve', approvalNote: 'Reviewed in verification' },
    );
    expect(approvedA.status === 200, `Owner/admin Q draft approval failed with ${approvedA.status}`);
    expect(approvedA.body.dispatched === false, 'Q draft approval must never dispatch an action');

    const managerApproval = await authedRequest(
        businessB,
        'usr_business_pulse_b',
        `/api/restaurant/business-pulse/drafts/${draftB.body.draft.id}/decision`,
        'POST',
        { decision: 'approve' },
        'manager',
    );
    expect(managerApproval.status === 403, `Manager Q approval should be 403, received ${managerApproval.status}`);

    const staffPulse = await authedRequest(businessA, 'usr_business_pulse_a', '/api/restaurant/business-pulse', 'GET', undefined, 'staff');
    expect(staffPulse.status === 403, `Staff Q pulse should be 403 by default, received ${staffPulse.status}`);

    const auditA = await db.select().from(auditLogs)
        .where(and(
            eq(auditLogs.businessId, businessA),
            eq(auditLogs.action, 'Q_BUSINESS_PULSE_SNAPSHOT_VIEWED'),
        ));
    const auditB = await db.select().from(auditLogs)
        .where(and(
            eq(auditLogs.businessId, businessB),
            eq(auditLogs.action, 'Q_BUSINESS_PULSE_SNAPSHOT_VIEWED'),
        ));
    expect(auditA.length >= 2, `Expected Business A audit records for snapshot views, found ${auditA.length}`);
    expect(auditB.length >= 1, `Expected Business B audit record for snapshot view, found ${auditB.length}`);

    console.log(JSON.stringify({
        businessA: {
            grossSales: snapshotA.todaySalesSummary.grossSales,
            delayedKdsTicketCount: snapshotA.delayedKdsTicketCount,
            tablePaymentAttentionCount: snapshotA.tablePaymentAttentionCount,
            topItem: snapshotA.topSellingMenuItems[0]?.name,
        },
        businessB: {
            grossSales: snapshotB.todaySalesSummary.grossSales,
            delayedKdsTicketCount: snapshotB.delayedKdsTicketCount,
            tablePaymentAttentionCount: snapshotB.tablePaymentAttentionCount,
            topItem: snapshotB.topSellingMenuItems[0]?.name,
        },
        emptyTenant: {
            openOrderCount: emptySnapshot.openOrderCount,
            grossSales: emptySnapshot.todaySalesSummary.grossSales,
            topSellingMenuItems: emptySnapshot.topSellingMenuItems.length,
        },
        unauthenticatedStatus: unauthenticated.status,
        foreignResourceInputsIgnored: !aForeignText.includes('Beta Pulse'),
        auditRecords: {
            businessA: auditA.length,
            businessB: auditB.length,
        },
        qAssistant: {
            evidenceCards: pulseA.body.evidenceCards.length,
            draftApprovedWithoutDispatch: approvedA.body.dispatched === false,
            crossTenantDraftDecisionStatus: crossTenantDecision.status,
            managerApprovalStatus: managerApproval.status,
            staffPulseStatus: staffPulse.status,
        },
    }, null, 2));
} catch (error) {
    console.error('Business Pulse snapshot verification failed:', error);
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
