import { randomUUID } from 'crypto';
import { Hono, type Context } from 'hono';
import { and, asc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import {
    kdsTickets,
    menuCategories,
    menuItems,
    restaurantMenus,
    restaurantOrderItems,
    restaurantOrders,
    restaurantPayments,
    restaurantTables,
    users,
} from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import {
    canPerformRestaurantAction,
    isOrderClosedForCancellation,
    isOrderPaid,
    legacyStatusFor,
    orderTypeFor,
    paymentStatusFor,
    paymentTimingFor,
    serviceStatusFor,
    validateRestaurantOrderTransition,
    type RestaurantActor,
    type RestaurantOrderType as OrderType,
    type RestaurantPaymentStatus as PaymentStatus,
    type RestaurantPaymentTiming as PaymentTiming,
    type RestaurantServiceStatus as ServiceStatus,
} from '../services/restaurantDomain.js';
import type { AppEnv } from '../types/app.js';
import { logAudit } from '../utils/audit.js';

const restaurant = new Hono<AppEnv>();
const tableStatuses = ['available', 'occupied', 'reserved', 'cleaning'] as const;
const orderStatuses = ['pending', 'in_kitchen', 'ready', 'delivered', 'served', 'collected', 'closed', 'paid', 'cancelled'] as const;
const ticketStatuses = ['new', 'cooking', 'done', 'cancelled'] as const;
const paymentMethods = ['cash', 'card', 'manual', 'mobile'] as const;
const orderTypes = ['dine_in', 'takeaway'] as const;
const paymentTimings = ['pay_before_service', 'pay_after_service'] as const;
type TableStatus = typeof tableStatuses[number];
type OrderStatus = typeof orderStatuses[number];
type TicketStatus = typeof ticketStatuses[number];
const delayedKdsThresholdMinutes = 15;
const priorityTypes = ['kds_delay', 'unpaid_orders', 'table_attention', 'sales_summary', 'top_items'] as const;
const priorityUrgencies = ['info', 'attention', 'urgent'] as const;
const evidenceTypes = ['kds', 'orders', 'tables', 'payments', 'menu_items', 'sales'] as const;
type PriorityType = typeof priorityTypes[number];
type PriorityUrgency = typeof priorityUrgencies[number];
type EvidenceType = typeof evidenceTypes[number];

type RestaurantTimingLog = {
    route: 'POST /restaurant/orders' | 'POST /restaurant/orders/pay-now' | 'GET /restaurant/kds';
    correlationId: string;
    requestDurationMs: number;
    requestParsingDurationMs?: number;
    authorizationDurationMs?: number;
    idempotencyLookupDurationMs?: number;
    transactionStartDelayDurationMs?: number;
    transactionDurationMs?: number;
    transactionCallbackDurationMs?: number;
    transactionCommitFinalizationDurationMs?: number;
    tableValidationDurationMs?: number;
    menuValidationQueryDurationMs?: number;
    orderNumberAllocationDurationMs?: number;
    orderNumberLockDurationMs?: number;
    orderNumberQueryDurationMs?: number;
    orderWriteDurationMs?: number;
    orderInsertDurationMs?: number;
    orderItemInsertDurationMs?: number;
    paymentWriteDurationMs?: number;
    paymentInsertDurationMs?: number;
    kdsWriteDurationMs?: number;
    kdsInsertDurationMs?: number;
    tableUpdateDurationMs?: number;
    auditLogInsertDurationMs?: number;
    queryDurationMs?: number;
    responsePreparationDurationMs?: number;
    responseOrderRefetchDurationMs?: number;
    responseItemsRefetchDurationMs?: number;
    responsePaymentsRefetchDurationMs?: number;
    orderType?: OrderType;
    kdsTicketCount?: number;
};

const timingNow = () => performance.now();
const durationSince = (startedAt: number) => Math.round((timingNow() - startedAt) * 100) / 100;
const addTimingDuration = (
    timings: Partial<Record<string, number>> | undefined,
    key: string,
    durationMs: number,
) => {
    if (!timings) return;
    timings[key] = Math.round(((timings[key] ?? 0) + durationMs) * 100) / 100;
};
const safeCorrelationId = (value?: string | null) => (
    value && /^[A-Za-z0-9_.:-]{1,100}$/.test(value) ? value : randomUUID()
);

const logRestaurantTiming = (timing: RestaurantTimingLog) => {
    console.info(JSON.stringify(timing));
};

interface BusinessPulseEvidence {
    type: EvidenceType;
    label: string;
    facts: Record<string, string | number | null>;
}

interface BusinessPulsePriority {
    type: PriorityType;
    urgency: PriorityUrgency;
    title: string;
    evidence: BusinessPulseEvidence;
    dataFreshnessTimestamp: string;
}

interface BusinessPulseSnapshot {
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
    priorities: BusinessPulsePriority[];
}

restaurant.use('/*', authMiddleware);

const parseJson = async <T>(c: Context<AppEnv>) => {
    try {
        return await c.req.json<T>();
    } catch {
        return null;
    }
};

const forbid = (c: Context<AppEnv>, message = 'Forbidden: Insufficient permissions') => c.json({ error: message }, 403);

const restaurantActorFor = async (c: Context<AppEnv>): Promise<RestaurantActor> => {
    const role = c.get('userRole');
    const actor: RestaurantActor = {
        userId: c.get('userId'),
        businessId: c.get('businessId'),
        role,
        legacyOwnerUser: null,
    };
    if (role !== 'user') return actor;

    actor.legacyOwnerUser = await first(db.select({
        id: users.id,
        role: users.role,
        businessId: users.businessId,
        userType: users.userType,
        segment: users.segment,
        onboardingCompleted: users.onboardingCompleted,
        primaryWorkspace: users.primaryWorkspace,
    }).from(users).where(and(
        eq(users.id, c.get('userId')),
        eq(users.businessId, c.get('businessId')),
    )));

    return actor;
};

const todayBounds = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
};

const dateBoundsFor = (dateValue: string | undefined) => {
    const source = dateValue ?? orderNumberDateFor(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) return null;

    const [year, month, day] = source.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    if (
        start.getFullYear() !== year ||
        start.getMonth() !== month - 1 ||
        start.getDate() !== day
    ) {
        return null;
    }

    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { date: source, start, end };
};

const orderNumberDateFor = (date: Date) => date.toISOString().slice(0, 10);

const displayOrderNumberFor = (order: typeof restaurantOrders.$inferSelect) =>
    typeof order.visibleOrderNumber === 'number' && Number.isSafeInteger(order.visibleOrderNumber)
        ? `#${order.visibleOrderNumber}`
        : 'Order pending number';

const isUniqueOrderNumberConflict = (error: unknown) =>
    error instanceof Error && error.message.includes('restaurant_orders_business_daily_visible_number_idx');

const kitchenOrderPayload = (
    order: typeof restaurantOrders.$inferSelect,
    items: typeof restaurantOrderItems.$inferSelect[],
) => ({
    id: order.id,
    businessId: order.businessId,
    displayOrderNumber: displayOrderNumberFor(order),
    tableId: order.tableId,
    orderType: orderTypeFor(order),
    serviceStatus: serviceStatusFor(order),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items,
});

const kdsTicketWithOrder = async (businessId: string, ticketId: string) => {
    const ticket = await first(db.select().from(kdsTickets)
        .where(and(eq(kdsTickets.id, ticketId), eq(kdsTickets.businessId, businessId)))
    );
    if (!ticket) return null;
    const order = await first(db.select().from(restaurantOrders)
        .where(and(eq(restaurantOrders.id, ticket.orderId), eq(restaurantOrders.businessId, businessId)))
    );
    const items = await db.select().from(restaurantOrderItems)
        .where(eq(restaurantOrderItems.orderId, ticket.orderId));
    const table = order?.tableId
        ? await first(db.select().from(restaurantTables)
            .where(and(
                eq(restaurantTables.id, order.tableId),
                eq(restaurantTables.businessId, businessId),
            ))
        )
        : null;
    return {
        ...ticket,
        order: order ? kitchenOrderPayload(order, items) : null,
        tableLabel: table?.label ?? null,
    };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidEvidence = (value: unknown): value is BusinessPulseEvidence => {
    if (!isRecord(value)) return false;
    if (!evidenceTypes.includes(value.type as EvidenceType)) return false;
    if (typeof value.label !== 'string' || value.label.length === 0) return false;
    if (!isRecord(value.facts)) return false;
    return Object.values(value.facts).every((fact) => (
        typeof fact === 'string' ||
        typeof fact === 'number' ||
        fact === null
    ));
};

const isValidPriority = (value: unknown): value is BusinessPulsePriority => {
    if (!isRecord(value)) return false;
    return (
        priorityTypes.includes(value.type as PriorityType) &&
        priorityUrgencies.includes(value.urgency as PriorityUrgency) &&
        typeof value.title === 'string' &&
        value.title.length > 0 &&
        isValidEvidence(value.evidence) &&
        typeof value.dataFreshnessTimestamp === 'string' &&
        !Number.isNaN(Date.parse(value.dataFreshnessTimestamp))
    );
};

const validateBusinessPulseSnapshot = (value: unknown): BusinessPulseSnapshot => {
    if (!isRecord(value)) throw new Error('INVALID_BUSINESS_PULSE_SNAPSHOT');
    const summary = value.todaySalesSummary;
    if (
        typeof value.generatedAt !== 'string' ||
        Number.isNaN(Date.parse(value.generatedAt)) ||
        typeof value.openOrderCount !== 'number' ||
        typeof value.unpaidOrderCount !== 'number' ||
        typeof value.delayedKdsTicketCount !== 'number' ||
        !(typeof value.oldestDelayedKdsDurationMinutes === 'number' || value.oldestDelayedKdsDurationMinutes === null) ||
        typeof value.tablePaymentAttentionCount !== 'number' ||
        !isRecord(summary) ||
        typeof summary.grossSales !== 'number' ||
        typeof summary.paidOrderCount !== 'number' ||
        typeof summary.completedPaymentCount !== 'number' ||
        summary.currencyMinorUnit !== 'cents' ||
        !Array.isArray(value.topSellingMenuItems) ||
        !Array.isArray(value.priorities)
    ) {
        throw new Error('INVALID_BUSINESS_PULSE_SNAPSHOT');
    }

    for (const item of value.topSellingMenuItems) {
        if (
            !isRecord(item) ||
            typeof item.name !== 'string' ||
            item.name.length === 0 ||
            typeof item.quantitySold !== 'number' ||
            typeof item.grossSales !== 'number'
        ) {
            throw new Error('INVALID_BUSINESS_PULSE_SNAPSHOT');
        }
    }

    if (!value.priorities.every(isValidPriority)) {
        throw new Error('INVALID_BUSINESS_PULSE_SNAPSHOT');
    }

    return value as unknown as BusinessPulseSnapshot;
};

const minutesSince = (date: Date, now: Date) =>
    Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));

const buildPriority = (
    type: PriorityType,
    urgency: PriorityUrgency,
    title: string,
    evidence: BusinessPulseEvidence,
    dataFreshnessTimestamp: string,
): BusinessPulsePriority => ({
    type,
    urgency,
    title,
    evidence,
    dataFreshnessTimestamp,
});

const buildBusinessPulseSnapshot = async (businessId: string): Promise<BusinessPulseSnapshot> => {
    const generatedAtDate = new Date();
    const generatedAt = generatedAtDate.toISOString();
    const { start, end } = todayBounds();
    const todayOrders = await db.select().from(restaurantOrders)
        .where(and(
            eq(restaurantOrders.businessId, businessId),
            gte(restaurantOrders.createdAt, start),
            lt(restaurantOrders.createdAt, end),
        ));
    const orderIds = todayOrders.map((order) => order.id);
    const nonCancelledOrderIds = todayOrders
        .filter((order) => order.status !== 'cancelled')
        .map((order) => order.id);
    const payments = orderIds.length > 0
        ? await db.select().from(restaurantPayments)
            .where(and(
                eq(restaurantPayments.businessId, businessId),
                inArray(restaurantPayments.orderId, orderIds),
            ))
        : [];
    const completedPaymentsToday = payments.filter((payment) => (
        payment.status === 'completed' &&
        payment.paidAt &&
        payment.paidAt >= start &&
        payment.paidAt < end
    ));
    const completedPaymentOrderIds = new Set(completedPaymentsToday.map((payment) => payment.orderId));
    const openOrders = todayOrders.filter((order) => (
        order.status === 'pending' ||
        order.status === 'in_kitchen' ||
        order.status === 'ready' ||
        order.status === 'delivered' ||
        order.status === 'served'
    ));
    const unpaidOrders = todayOrders.filter((order) => (
        order.status !== 'paid' &&
        order.status !== 'cancelled' &&
        !completedPaymentOrderIds.has(order.id)
    ));
    const activeTickets = await db.select().from(kdsTickets)
        .where(and(
            eq(kdsTickets.businessId, businessId),
            or(eq(kdsTickets.status, 'new'), eq(kdsTickets.status, 'cooking')),
        ));
    const delayedTickets = activeTickets
        .map((ticket) => ({
            ticket,
            durationMinutes: minutesSince(ticket.createdAt, generatedAtDate),
        }))
        .filter((entry) => entry.durationMinutes >= delayedKdsThresholdMinutes);
    const oldestDelayedKdsDurationMinutes = delayedTickets.length
        ? Math.max(...delayedTickets.map((entry) => entry.durationMinutes))
        : null;
    const tablePaymentAttentionCount = new Set(
        unpaidOrders
            .filter((order) => order.tableId && (order.status === 'ready' || order.status === 'delivered' || order.status === 'served'))
            .map((order) => order.tableId as string),
    ).size;
    const completedPaidPaymentsToday = completedPaymentsToday;
    const grossSales = completedPaidPaymentsToday
        .reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0);
    const paidOrderCount = new Set(
        completedPaidPaymentsToday.map((payment) => payment.orderId),
    ).size;
    const orderItems = nonCancelledOrderIds.length > 0
        ? await db.select().from(restaurantOrderItems)
            .where(inArray(restaurantOrderItems.orderId, nonCancelledOrderIds))
        : [];
    const topItemsByName = new Map<string, { quantitySold: number; grossSales: number }>();
    for (const item of orderItems) {
        const previous = topItemsByName.get(item.name) ?? { quantitySold: 0, grossSales: 0 };
        previous.quantitySold += item.quantity;
        previous.grossSales += item.quantity * item.unitPrice;
        topItemsByName.set(item.name, previous);
    }
    const topSellingMenuItems = [...topItemsByName.entries()]
        .map(([name, values]) => ({ name, ...values }))
        .sort((a, b) => b.quantitySold - a.quantitySold || b.grossSales - a.grossSales || a.name.localeCompare(b.name))
        .slice(0, 5);
    const priorities: BusinessPulsePriority[] = [];

    if (delayedTickets.length > 0) {
        priorities.push(buildPriority(
            'kds_delay',
            oldestDelayedKdsDurationMinutes && oldestDelayedKdsDurationMinutes >= 30 ? 'urgent' : 'attention',
            `${delayedTickets.length} kitchen ticket${delayedTickets.length === 1 ? '' : 's'} delayed`,
            {
                type: 'kds',
                label: 'Delayed KDS tickets',
                facts: {
                    delayedTicketCount: delayedTickets.length,
                    oldestDurationMinutes: oldestDelayedKdsDurationMinutes,
                    delayThresholdMinutes: delayedKdsThresholdMinutes,
                },
            },
            generatedAt,
        ));
    }

    if (unpaidOrders.length > 0) {
        priorities.push(buildPriority(
            'unpaid_orders',
            unpaidOrders.length >= 3 ? 'urgent' : 'attention',
            `${unpaidOrders.length} unpaid order${unpaidOrders.length === 1 ? '' : 's'}`,
            {
                type: 'orders',
                label: 'Open unpaid orders',
                facts: {
                    unpaidOrderCount: unpaidOrders.length,
                    openOrderCount: openOrders.length,
                },
            },
            generatedAt,
        ));
    }

    if (tablePaymentAttentionCount > 0) {
        priorities.push(buildPriority(
            'table_attention',
            'attention',
            `${tablePaymentAttentionCount} table${tablePaymentAttentionCount === 1 ? '' : 's'} may need payment attention`,
            {
                type: 'tables',
                label: 'Tables with ready or delivered unpaid orders',
                facts: {
                    tablePaymentAttentionCount,
                },
            },
            generatedAt,
        ));
    }

    priorities.push(buildPriority(
        'sales_summary',
        'info',
        'Today sales snapshot is ready',
        {
            type: 'sales',
            label: 'Today completed payments',
            facts: {
                grossSales,
                paidOrderCount,
                completedPaymentCount: completedPaidPaymentsToday.length,
            },
        },
        generatedAt,
    ));

    if (topSellingMenuItems.length > 0) {
        priorities.push(buildPriority(
            'top_items',
            'info',
            'Top-selling menu items are available',
            {
                type: 'menu_items',
                label: 'Top-selling items today',
                facts: {
                    itemCount: topSellingMenuItems.length,
                    topItemName: topSellingMenuItems[0]?.name ?? null,
                    topItemQuantitySold: topSellingMenuItems[0]?.quantitySold ?? null,
                },
            },
            generatedAt,
        ));
    }

    return validateBusinessPulseSnapshot({
        generatedAt,
        openOrderCount: openOrders.length,
        unpaidOrderCount: unpaidOrders.length,
        delayedKdsTicketCount: delayedTickets.length,
        oldestDelayedKdsDurationMinutes,
        tablePaymentAttentionCount,
        todaySalesSummary: {
            grossSales,
            paidOrderCount,
            completedPaymentCount: completedPaidPaymentsToday.length,
            currencyMinorUnit: 'cents',
        },
        topSellingMenuItems,
        priorities,
    });
};

const orderWithItems = async (
    businessId: string,
    orderId: string,
    timings?: Partial<Record<string, number>>,
) => {
    const orderRefetchStartedAt = timingNow();
    const order = await first(db.select().from(restaurantOrders)
        .where(and(eq(restaurantOrders.id, orderId), eq(restaurantOrders.businessId, businessId)))
    );
    addTimingDuration(timings, 'responseOrderRefetchDurationMs', durationSince(orderRefetchStartedAt));
    if (!order) return null;
    const itemsRefetchStartedAt = timingNow();
    const items = await db.select().from(restaurantOrderItems)
        .where(eq(restaurantOrderItems.orderId, orderId))
    addTimingDuration(timings, 'responseItemsRefetchDurationMs', durationSince(itemsRefetchStartedAt));
    const paymentsRefetchStartedAt = timingNow();
    const payments = await db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
        eq(restaurantPayments.orderId, orderId),
    ));
    addTimingDuration(timings, 'responsePaymentsRefetchDurationMs', durationSince(paymentsRefetchStartedAt));
    const completedPayment = payments.find((payment) => payment.status === 'completed') ?? null;
    const orderType = orderTypeFor(order);
    const serviceStatus = serviceStatusFor(order);
    const paymentStatus = paymentStatusFor(order, completedPayment);
    const paymentTiming = paymentTimingFor(order);
    return {
        ...order,
        displayOrderNumber: displayOrderNumberFor(order),
        orderType,
        serviceStatus,
        paymentStatus,
        paymentTiming,
        status: legacyStatusFor(orderType, serviceStatus, paymentStatus),
        items,
        payments,
    };
};

const integratedPaymentSummary = (
    payment: typeof restaurantPayments.$inferSelect,
    cashReceived?: number,
    changeDue?: number,
) => ({
    id: payment.id,
    method: payment.method,
    amount: payment.amount,
    status: payment.status,
    paidAt: payment.paidAt,
    ...(typeof cashReceived === 'number' ? { cashReceived } : {}),
    ...(typeof changeDue === 'number' ? { changeDue } : {}),
});

const payNowOrderResponse = async (
    businessId: string,
    orderId: string,
    cashReceived?: number,
    changeDue?: number,
) => {
    const order = await orderWithItems(businessId, orderId);
    if (!order) return null;
    const payment = await first(db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            eq(restaurantPayments.orderId, orderId),
            eq(restaurantPayments.status, 'completed'),
        ))
    );
    const ticket = await first(db.select().from(kdsTickets)
        .where(and(eq(kdsTickets.businessId, businessId), eq(kdsTickets.orderId, orderId)))
    );
    if (!payment) return null;
    return {
        order,
        payment: integratedPaymentSummary(payment, cashReceived, changeDue),
        kitchen: {
            ticket: ticket ? await kdsTicketWithOrder(businessId, ticket.id) : null,
        },
        visibleOrderNumber: order.visibleOrderNumber,
        displayOrderNumber: order.displayOrderNumber,
        nextAction: 'sent_to_kitchen' as const,
    };
};

restaurant.get('/business-pulse/snapshot', async (c) => {
    try {
        const businessId = c.get('businessId');
        const snapshot = await buildBusinessPulseSnapshot(businessId);
        await logAudit(c, 'Q_BUSINESS_PULSE_SNAPSHOT_VIEWED', 'RESTAURANT_BUSINESS_PULSE', null, {
            openOrderCount: snapshot.openOrderCount,
            unpaidOrderCount: snapshot.unpaidOrderCount,
            delayedKdsTicketCount: snapshot.delayedKdsTicketCount,
            tablePaymentAttentionCount: snapshot.tablePaymentAttentionCount,
            topSellingMenuItemCount: snapshot.topSellingMenuItems.length,
            generatedAt: snapshot.generatedAt,
        });
        return c.json(snapshot);
    } catch {
        return c.json({ error: 'Unable to generate Restaurant Business Pulse snapshot' }, 500);
    }
});

const ensureCategory = async (executor: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0], businessId: string, categoryId?: string, categoryName?: string) => {
    if (categoryId) {
        return await first(executor.select().from(menuCategories)
            .where(and(eq(menuCategories.id, categoryId), eq(menuCategories.businessId, businessId)))
        ) || null;
    }

    let menu = await first(executor.select().from(restaurantMenus)
        .where(and(eq(restaurantMenus.businessId, businessId), eq(restaurantMenus.isActive, true)))
    );
    if (!menu) {
        menu = { id: randomUUID(), businessId, name: 'Main Menu', isActive: true };
        await executor.insert(restaurantMenus).values(menu);
    }

    const name = categoryName?.trim() || 'Uncategorized';
    let category = await first(executor.select().from(menuCategories)
        .where(and(
            eq(menuCategories.businessId, businessId),
            eq(menuCategories.menuId, menu.id),
            eq(menuCategories.name, name),
        ))
    );
    if (!category) {
        const last = await first(executor.select({ sortOrder: menuCategories.sortOrder }).from(menuCategories)
            .where(and(eq(menuCategories.businessId, businessId), eq(menuCategories.menuId, menu.id)))
            .orderBy(sql`${menuCategories.sortOrder} DESC`)
        );
        category = {
            id: randomUUID(),
            businessId,
            menuId: menu.id,
            name,
            sortOrder: (last?.sortOrder ?? -1) + 1,
        };
        await executor.insert(menuCategories).values(category);
    }
    return category;
};

restaurant.get('/menu', async (c) => {
    const businessId = c.get('businessId');
    const categories = await db.select().from(menuCategories)
        .where(eq(menuCategories.businessId, businessId))
        .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));
    const items = await db.select().from(menuItems)
        .where(eq(menuItems.businessId, businessId))
        .orderBy(asc(menuItems.name));
    return c.json({
        categories: categories.map((category) => ({
            id: category.id,
            name: category.name,
            items: items.filter((item) => item.categoryId === category.id),
        })),
    });
});

restaurant.post('/menu/categories', async (c) => {
    const body = await parseJson<{ name?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ error: 'Name is required' }, 400);
    if (name.length > 80) return c.json({ error: 'Name must be 80 characters or fewer' }, 400);

    const businessId = c.get('businessId');
    let categoryId = '';
    try {
        await db.transaction(async (tx) => {
            let menu = await first(tx.select().from(restaurantMenus)
                .where(and(eq(restaurantMenus.businessId, businessId), eq(restaurantMenus.isActive, true)))
            );
            if (!menu) {
                menu = { id: randomUUID(), businessId, name: 'Main Menu', isActive: true };
                await tx.insert(restaurantMenus).values(menu);
            }

            const duplicate = await first(tx.select().from(menuCategories)
                .where(and(
                    eq(menuCategories.businessId, businessId),
                    eq(menuCategories.menuId, menu.id),
                    eq(menuCategories.name, name),
                ))
            );
            if (duplicate) throw new Error('CATEGORY_EXISTS');

            const last = await first(tx.select({ sortOrder: menuCategories.sortOrder }).from(menuCategories)
                .where(and(eq(menuCategories.businessId, businessId), eq(menuCategories.menuId, menu.id)))
                .orderBy(sql`${menuCategories.sortOrder} DESC`)
            );
            categoryId = randomUUID();
            await tx.insert(menuCategories).values({
                id: categoryId,
                businessId,
                menuId: menu.id,
                name,
                sortOrder: (last?.sortOrder ?? -1) + 1,
            });
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'CATEGORY_EXISTS') {
            return c.json({ error: 'Category already exists' }, 409);
        }
        throw error;
    }

    const category = await first(db.select().from(menuCategories)
        .where(and(eq(menuCategories.id, categoryId), eq(menuCategories.businessId, businessId)))
    );
    return c.json({ id: category!.id, name: category!.name, items: [] }, 201);
});

restaurant.post('/menu/items', async (c) => {
    const body = await parseJson<{
        name?: unknown;
        description?: unknown;
        price?: unknown;
        categoryId?: unknown;
        category_id?: unknown;
        category?: unknown;
        isAvailable?: unknown;
        is_available?: unknown;
        prepTimeMinutes?: unknown;
        prep_time_minutes?: unknown;
    }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ error: 'Name is required' }, 400);
    if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price <= 0) {
        return c.json({ error: 'Price must be greater than 0' }, 400);
    }
    const prepTime = body.prepTimeMinutes ?? body.prep_time_minutes ?? 0;
    if (typeof prepTime !== 'number' || !Number.isSafeInteger(prepTime) || prepTime < 0) {
        return c.json({ error: 'Prep time must be a non-negative integer' }, 400);
    }
    const categoryId = body.categoryId ?? body.category_id;
    if (categoryId !== undefined && typeof categoryId !== 'string') {
        return c.json({ error: 'Invalid category id' }, 400);
    }
    if (body.category !== undefined && typeof body.category !== 'string') {
        return c.json({ error: 'Invalid category name' }, 400);
    }

    const businessId = c.get('businessId');
    let itemId = '';
    try {
        await db.transaction(async (tx) => {
            const category = await ensureCategory(
                tx,
                businessId,
                categoryId as string | undefined,
                body.category as string | undefined,
            );
            if (!category) throw new Error('CATEGORY_NOT_FOUND');
            itemId = randomUUID();
            const availability = body.isAvailable ?? body.is_available;
            await tx.insert(menuItems).values({
                id: itemId,
                businessId,
                categoryId: category.id,
                name,
                description: typeof body.description === 'string' ? body.description.trim() || null : null,
                price: Math.round(body.price as number * 100),
                isAvailable: typeof availability === 'boolean' ? availability : true,
                prepTimeMinutes: prepTime,
            });
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'CATEGORY_NOT_FOUND') {
            return c.json({ error: 'Category not found' }, 404);
        }
        throw error;
    }

    return c.json(await first(db.select().from(menuItems)
        .where(and(eq(menuItems.id, itemId), eq(menuItems.businessId, businessId)))
    ), 201);
});

restaurant.get('/tables', async (c) => {
    return c.json(await db.select().from(restaurantTables)
        .where(eq(restaurantTables.businessId, c.get('businessId')))
        .orderBy(asc(restaurantTables.label)));
});

restaurant.post('/tables', async (c) => {
    const body = await parseJson<{ label?: unknown; capacity?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label) return c.json({ error: 'Label is required' }, 400);
    if (label.length > 24) return c.json({ error: 'Label must be 24 characters or fewer' }, 400);
    if (
        typeof body.capacity !== 'number' ||
        !Number.isSafeInteger(body.capacity) ||
        body.capacity < 1 ||
        body.capacity > 30
    ) {
        return c.json({ error: 'Capacity must be a whole number from 1 to 30' }, 400);
    }

    const businessId = c.get('businessId');
    const duplicate = await first(db.select().from(restaurantTables)
        .where(and(eq(restaurantTables.businessId, businessId), eq(restaurantTables.label, label)))
    );
    if (duplicate) return c.json({ error: 'Table label already exists' }, 409);

    const id = randomUUID();
    await db.insert(restaurantTables).values({
        id,
        businessId,
        label,
        capacity: body.capacity,
        status: 'available',
    });
    return c.json(await first(db.select().from(restaurantTables)
        .where(and(eq(restaurantTables.id, id), eq(restaurantTables.businessId, businessId)))
    ), 201);
});

restaurant.patch('/tables/:id/status', async (c) => {
    const body = await parseJson<{ status?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    if (typeof body.status !== 'string' || !tableStatuses.includes(body.status as TableStatus)) {
        return c.json({ error: 'Invalid table status' }, 400);
    }

    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const result = await db.update(restaurantTables)
        .set({ status: body.status as TableStatus })
        .where(and(eq(restaurantTables.id, id), eq(restaurantTables.businessId, businessId)))
        .returning({ id: restaurantTables.id });
    if (result.length === 0) return c.json({ error: 'Table not found' }, 404);
    return c.json(await first(db.select().from(restaurantTables)
        .where(and(eq(restaurantTables.id, id), eq(restaurantTables.businessId, businessId)))
    ));
});

restaurant.post('/orders/pay-now', async (c) => {
    const requestStartedAt = timingNow();
    const correlationId = safeCorrelationId(c.req.header('X-Q360-Correlation-Id'));
    const authorizationStartedAt = timingNow();
    const actor = await restaurantActorFor(c);
    const authorized = canPerformRestaurantAction(actor, 'create_pay_now_takeaway_order');
    const authorizationDurationMs = durationSince(authorizationStartedAt);
    if (!authorized) return forbid(c);
    let orderWriteDurationMs = 0;
    let paymentWriteDurationMs = 0;
    let kdsWriteDurationMs = 0;

    const body = await parseJson<{
        tableId?: unknown;
        table_id?: unknown;
        orderType?: unknown;
        order_type?: unknown;
        paymentMethod?: unknown;
        payment_method?: unknown;
        cashReceived?: unknown;
        cash_received?: unknown;
        idempotencyKey?: unknown;
        idempotency_key?: unknown;
        items?: {
            menuItemId?: unknown;
            menu_item_id?: unknown;
            quantity?: unknown;
            notes?: unknown;
        }[];
    }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    if (!Array.isArray(body.items) || body.items.length === 0) {
        return c.json({ error: 'At least one item is required' }, 400);
    }
    const tableId = body.tableId ?? body.table_id;
    if (tableId !== undefined && tableId !== null) {
        return c.json({ error: 'Pay-now is only available for takeaway orders' }, 409);
    }
    const requestedOrderType = body.orderType ?? body.order_type;
    if (requestedOrderType !== undefined && requestedOrderType !== 'takeaway') {
        return c.json({ error: 'Dine-in pay-now is not allowed' }, 409);
    }
    const paymentMethodValue = body.paymentMethod ?? body.payment_method;
    if (
        typeof paymentMethodValue !== 'string' ||
        !['cash', 'card', 'manual'].includes(paymentMethodValue)
    ) {
        return c.json({ error: 'Payment method must be cash, card, or manual' }, 400);
    }
    const idempotencyKeyValue = body.idempotencyKey ?? body.idempotency_key;
    if (
        idempotencyKeyValue !== undefined &&
        idempotencyKeyValue !== null &&
        (typeof idempotencyKeyValue !== 'string' || idempotencyKeyValue.trim().length > 120)
    ) {
        return c.json({ error: 'Invalid idempotency key' }, 400);
    }
    const idempotencyKey = typeof idempotencyKeyValue === 'string'
        ? idempotencyKeyValue.trim() || null
        : null;
    for (const item of body.items) {
        const menuItemId = item.menuItemId ?? item.menu_item_id;
        if (
            typeof menuItemId !== 'string' ||
            typeof item.quantity !== 'number' ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0 ||
            (item.notes !== undefined && typeof item.notes !== 'string')
        ) {
            return c.json({ error: 'Each item requires a menu_item_id and positive integer quantity' }, 400);
        }
    }

    const businessId = c.get('businessId');
    if (idempotencyKey) {
        const existingOrder = await first(db.select().from(restaurantOrders)
            .where(and(
                eq(restaurantOrders.businessId, businessId),
                eq(restaurantOrders.idempotencyKey, idempotencyKey),
            ))
        );
        if (existingOrder) {
            const existingResponse = await payNowOrderResponse(businessId, existingOrder.id);
            if (existingResponse) return c.json(existingResponse);
            return c.json({ error: 'Idempotency key is already used by a non-pay-now order' }, 409);
        }
    }

    const orderId = randomUUID();
    let cashReceived: number | undefined;
    let changeDue: number | undefined;
    try {
        let created = false;
        for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
            try {
                await db.transaction(async (tx) => {
                    const requests = new Map<string, { quantity: number; notes: string | null }>();
                    for (const item of body.items!) {
                        const id = (item.menuItemId ?? item.menu_item_id) as string;
                        const previous = requests.get(id);
                        requests.set(id, {
                            quantity: (previous?.quantity || 0) + (item.quantity as number),
                            notes: typeof item.notes === 'string' ? item.notes.trim() || null : previous?.notes || null,
                        });
                    }
                    const canonicalItems = [];
                    for (const [id, request] of requests.entries()) {
                        const item = await first(tx.select().from(menuItems)
                            .where(and(eq(menuItems.id, id), eq(menuItems.businessId, businessId)))
                        );
                        if (!item) throw new Error('ITEM_NOT_FOUND');
                        if (!item.isAvailable) throw new Error('ITEM_UNAVAILABLE');
                        canonicalItems.push({ item, ...request });
                    }
                    const total = canonicalItems.reduce(
                        (sum, entry) => sum + entry.item.price * entry.quantity,
                        0,
                    );
                    const amount = total / 100;
                    const cashReceivedValue = body.cashReceived ?? body.cash_received;
                    if (paymentMethodValue === 'cash') {
                        if (typeof cashReceivedValue !== 'number' || !Number.isFinite(cashReceivedValue)) {
                            throw new Error('INVALID_CASH_RECEIVED');
                        }
                        if (cashReceivedValue + 0.005 < amount) {
                            throw new Error('SHORT_CASH_RECEIVED');
                        }
                        cashReceived = Math.round(cashReceivedValue * 100) / 100;
                        changeDue = Math.max(0, Math.round((cashReceived - amount) * 100) / 100);
                    } else if (cashReceivedValue !== undefined && cashReceivedValue !== null && typeof cashReceivedValue !== 'number') {
                        throw new Error('INVALID_CASH_RECEIVED');
                    }

                    const now = new Date();
                    const orderNumberDate = orderNumberDateFor(now);
                    await tx.execute(sql`
                        SELECT pg_advisory_xact_lock(hashtext(${businessId}), hashtext(${orderNumberDate}))
                    `);
                    const sequenceRows = await tx.select({
                        nextNumber: sql<number>`COALESCE(MAX(${restaurantOrders.visibleOrderNumber}), 0) + 1`,
                    }).from(restaurantOrders)
                        .where(and(
                            eq(restaurantOrders.businessId, businessId),
                            eq(restaurantOrders.orderNumberDate, orderNumberDate),
                        ));
                    const visibleOrderNumber = Number(sequenceRows[0]?.nextNumber ?? 1);

                    const orderWriteStartedAt = timingNow();
                    await tx.insert(restaurantOrders).values({
                        id: orderId,
                        businessId,
                        visibleOrderNumber,
                        orderNumberDate,
                        tableId: null,
                        status: 'pending',
                        orderType: 'takeaway',
                        serviceStatus: 'pending',
                        paymentStatus: 'paid',
                        paymentTiming: 'pay_before_service',
                        idempotencyKey,
                        createdBy: c.get('userId'),
                        total,
                        createdAt: now,
                        updatedAt: now,
                    });
                    await tx.insert(restaurantOrderItems).values(canonicalItems.map((entry) => ({
                        id: randomUUID(),
                        orderId,
                        menuItemId: entry.item.id,
                        name: entry.item.name,
                        quantity: entry.quantity,
                        unitPrice: entry.item.price,
                        notes: entry.notes,
                        status: 'pending' as const,
                    })));
                    orderWriteDurationMs += durationSince(orderWriteStartedAt);
                    const paymentWriteStartedAt = timingNow();
                    await tx.insert(restaurantPayments).values({
                        id: randomUUID(),
                        businessId,
                        orderId,
                        method: paymentMethodValue as 'cash' | 'card' | 'manual',
                        amount,
                        status: 'completed',
                        paidAt: now,
                    });
                    paymentWriteDurationMs += durationSince(paymentWriteStartedAt);
                    const kdsWriteStartedAt = timingNow();
                    await tx.insert(kdsTickets).values({
                        id: randomUUID(),
                        orderId,
                        businessId,
                        status: 'new',
                        createdAt: now,
                        completedAt: null,
                    });
                    kdsWriteDurationMs += durationSince(kdsWriteStartedAt);
                });
                created = true;
            } catch (error) {
                if (isUniqueOrderNumberConflict(error) && attempt < 4) continue;
                throw error;
            }
        }
        await logAudit(c, 'RESTAURANT_ORDER_CREATED', 'RESTAURANT_ORDER', orderId, {
            orderType: 'takeaway',
            paymentTiming: 'pay_before_service',
            tableId: null,
            idempotencyKey: Boolean(idempotencyKey),
        });
        const createdOrder = await orderWithItems(businessId, orderId);
        await logAudit(c, 'RESTAURANT_ORDER_PAYMENT_COMPLETED', 'RESTAURANT_ORDER', orderId, {
            method: paymentMethodValue,
            amount: createdOrder ? createdOrder.total / 100 : null,
            orderType: 'takeaway',
            paymentTiming: 'pay_before_service',
            integratedPayNow: true,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'ITEM_NOT_FOUND') return c.json({ error: 'Menu item not found' }, 404);
        if (message === 'ITEM_UNAVAILABLE') return c.json({ error: 'Menu item is unavailable' }, 409);
        if (message === 'INVALID_CASH_RECEIVED') return c.json({ error: 'Cash received must be a valid amount' }, 400);
        if (message === 'SHORT_CASH_RECEIVED') return c.json({ error: 'Cash received must be at least the order total' }, 400);
        if (message.includes('restaurant_orders_business_idempotency_key_idx') && idempotencyKey) {
            const existingOrder = await first(db.select().from(restaurantOrders)
                .where(and(
                    eq(restaurantOrders.businessId, businessId),
                    eq(restaurantOrders.idempotencyKey, idempotencyKey),
                ))
            );
            if (existingOrder) {
                const existingResponse = await payNowOrderResponse(businessId, existingOrder.id);
                if (existingResponse) return c.json(existingResponse);
            }
        }
        throw error;
    }

    const responsePreparationStartedAt = timingNow();
    const response = await payNowOrderResponse(businessId, orderId, cashReceived, changeDue);
    const responsePreparationDurationMs = durationSince(responsePreparationStartedAt);
    logRestaurantTiming({
        route: 'POST /restaurant/orders/pay-now',
        correlationId,
        requestDurationMs: durationSince(requestStartedAt),
        authorizationDurationMs,
        orderWriteDurationMs,
        paymentWriteDurationMs,
        kdsWriteDurationMs,
        responsePreparationDurationMs,
        orderType: 'takeaway',
    });
    return c.json(response, 201);
});

restaurant.post('/orders', async (c) => {
    const requestStartedAt = timingNow();
    const correlationId = safeCorrelationId(c.req.header('X-Q360-Correlation-Id'));
    let requestParsingDurationMs = 0;
    let authorizationDurationMs = 0;
    let idempotencyLookupDurationMs = 0;
    let transactionStartDelayDurationMs = 0;
    let transactionDurationMs = 0;
    let transactionCallbackDurationMs = 0;
    let transactionCommitFinalizationDurationMs = 0;
    let tableValidationDurationMs = 0;
    let menuValidationQueryDurationMs = 0;
    let orderNumberAllocationDurationMs = 0;
    let orderNumberLockDurationMs = 0;
    let orderNumberQueryDurationMs = 0;
    let orderWriteDurationMs = 0;
    let orderInsertDurationMs = 0;
    let orderItemInsertDurationMs = 0;
    let kdsWriteDurationMs = 0;
    let kdsInsertDurationMs = 0;
    let tableUpdateDurationMs = 0;
    let auditLogInsertDurationMs = 0;
    const responseTimings: Partial<Record<string, number>> = {};
    const requestParsingStartedAt = timingNow();
    const body = await parseJson<{
        tableId?: unknown;
        table_id?: unknown;
        orderType?: unknown;
        order_type?: unknown;
        paymentTiming?: unknown;
        payment_timing?: unknown;
        idempotencyKey?: unknown;
        idempotency_key?: unknown;
        items?: {
            menuItemId?: unknown;
            menu_item_id?: unknown;
            quantity?: unknown;
            notes?: unknown;
        }[];
    }>(c);
    requestParsingDurationMs = durationSince(requestParsingStartedAt);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    if (!Array.isArray(body.items) || body.items.length === 0) {
        return c.json({ error: 'At least one item is required' }, 400);
    }
    const tableId = body.tableId ?? body.table_id;
    if (tableId !== undefined && tableId !== null && typeof tableId !== 'string') {
        return c.json({ error: 'Invalid table id' }, 400);
    }
    const requestedOrderType = body.orderType ?? body.order_type;
    if (requestedOrderType !== undefined && typeof requestedOrderType !== 'string') {
        return c.json({ error: 'Invalid order type' }, 400);
    }
    if (typeof requestedOrderType === 'string' && !orderTypes.includes(requestedOrderType as OrderType)) {
        return c.json({ error: 'Order type must be dine_in or takeaway' }, 400);
    }
    const orderType: OrderType = typeof requestedOrderType === 'string'
        ? requestedOrderType as OrderType
        : typeof tableId === 'string' ? 'dine_in' : 'takeaway';
    if (orderType === 'takeaway' && typeof tableId === 'string') {
        return c.json({ error: 'Takeaway orders cannot have a table' }, 400);
    }
    if (orderType === 'dine_in' && tableId !== undefined && tableId !== null && typeof tableId !== 'string') {
        return c.json({ error: 'Dine-in table id is invalid' }, 400);
    }
    const authorizationStartedAt = timingNow();
    const actor = await restaurantActorFor(c);
    const authorized = canPerformRestaurantAction(actor, 'create_order', {
        businessId: c.get('businessId'),
        createdBy: c.get('userId'),
        orderType,
        tableId: typeof tableId === 'string' ? tableId : null,
        status: 'pending',
        serviceStatus: 'pending',
        paymentStatus: 'unpaid',
        paymentTiming: 'pay_after_service',
    });
    authorizationDurationMs = durationSince(authorizationStartedAt);
    if (!authorized) return forbid(c, 'You do not have permission to create orders');
    const requestedPaymentTiming = body.paymentTiming ?? body.payment_timing;
    if (requestedPaymentTiming !== undefined && typeof requestedPaymentTiming !== 'string') {
        return c.json({ error: 'Invalid payment timing' }, 400);
    }
    if (typeof requestedPaymentTiming === 'string' && !paymentTimings.includes(requestedPaymentTiming as PaymentTiming)) {
        return c.json({ error: 'Payment timing must be pay_before_service or pay_after_service' }, 400);
    }
    const paymentTiming: PaymentTiming = typeof requestedPaymentTiming === 'string'
        ? requestedPaymentTiming as PaymentTiming
        : 'pay_after_service';
    if (orderType === 'dine_in' && paymentTiming === 'pay_before_service') {
        return c.json({ error: 'Dine-in pay-now is not allowed' }, 409);
    }
    const idempotencyKeyValue = body.idempotencyKey ?? body.idempotency_key;
    if (
        idempotencyKeyValue !== undefined &&
        idempotencyKeyValue !== null &&
        (typeof idempotencyKeyValue !== 'string' || idempotencyKeyValue.trim().length > 120)
    ) {
        return c.json({ error: 'Invalid idempotency key' }, 400);
    }
    const idempotencyKey = typeof idempotencyKeyValue === 'string'
        ? idempotencyKeyValue.trim() || null
        : null;
    for (const item of body.items) {
        const menuItemId = item.menuItemId ?? item.menu_item_id;
        if (
            typeof menuItemId !== 'string' ||
            typeof item.quantity !== 'number' ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0 ||
            (item.notes !== undefined && typeof item.notes !== 'string')
        ) {
            return c.json({ error: 'Each item requires a menu_item_id and positive integer quantity' }, 400);
        }
    }

    const businessId = c.get('businessId');
    if (idempotencyKey) {
        const idempotencyLookupStartedAt = timingNow();
        const existingOrder = await first(db.select().from(restaurantOrders)
            .where(and(
                eq(restaurantOrders.businessId, businessId),
                eq(restaurantOrders.idempotencyKey, idempotencyKey),
            ))
        );
        idempotencyLookupDurationMs += durationSince(idempotencyLookupStartedAt);
        if (existingOrder) return c.json(await orderWithItems(businessId, existingOrder.id));
    }
    const orderId = randomUUID();
    try {
        let created = false;
        for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
            try {
                const transactionStartedAt = timingNow();
                let transactionStartDelayForAttempt = 0;
                let transactionCallbackDurationForAttempt = 0;
                await db.transaction(async (tx) => {
                    transactionStartDelayForAttempt = durationSince(transactionStartedAt);
                    const transactionCallbackStartedAt = timingNow();
                    try {
                    if (typeof tableId === 'string') {
                        const tableValidationStartedAt = timingNow();
                        const table = await first(tx.select().from(restaurantTables)
                            .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.businessId, businessId)))
                        );
                        tableValidationDurationMs += durationSince(tableValidationStartedAt);
                        if (!table) throw new Error('TABLE_NOT_FOUND');
                    }

                    const requests = new Map<string, { quantity: number; notes: string | null }>();
                    for (const item of body.items!) {
                        const id = (item.menuItemId ?? item.menu_item_id) as string;
                        const previous = requests.get(id);
                        requests.set(id, {
                            quantity: (previous?.quantity || 0) + (item.quantity as number),
                            notes: typeof item.notes === 'string' ? item.notes.trim() || null : previous?.notes || null,
                        });
                    }
                    const canonicalItems = [];
                    const requestedMenuItemIds = Array.from(requests.keys());
                    const menuValidationQueryStartedAt = timingNow();
                    const menuItemsForOrder = await tx.select().from(menuItems)
                        .where(and(
                            eq(menuItems.businessId, businessId),
                            inArray(menuItems.id, requestedMenuItemIds),
                        ));
                    menuValidationQueryDurationMs += durationSince(menuValidationQueryStartedAt);
                    const menuItemById = new Map(menuItemsForOrder.map((item) => [item.id, item]));
                    for (const [id, request] of requests.entries()) {
                        const item = menuItemById.get(id);
                        if (!item) throw new Error('ITEM_NOT_FOUND');
                        if (!item.isAvailable) throw new Error('ITEM_UNAVAILABLE');
                        canonicalItems.push({ item, ...request });
                    }
                    const total = canonicalItems.reduce(
                        (sum, entry) => sum + entry.item.price * entry.quantity,
                        0,
                    );
                    const now = new Date();
                    const orderNumberDate = orderNumberDateFor(now);
                    const orderNumberAllocationStartedAt = timingNow();
                    const orderNumberLockStartedAt = timingNow();
                    await tx.execute(sql`
                        SELECT pg_advisory_xact_lock(hashtext(${businessId}), hashtext(${orderNumberDate}))
                    `);
                    orderNumberLockDurationMs += durationSince(orderNumberLockStartedAt);
                    const orderNumberQueryStartedAt = timingNow();
                    const sequenceRows = await tx.select({
                        nextNumber: sql<number>`COALESCE(MAX(${restaurantOrders.visibleOrderNumber}), 0) + 1`,
                    }).from(restaurantOrders)
                        .where(and(
                            eq(restaurantOrders.businessId, businessId),
                            eq(restaurantOrders.orderNumberDate, orderNumberDate),
                        ));
                    orderNumberQueryDurationMs += durationSince(orderNumberQueryStartedAt);
                    orderNumberAllocationDurationMs += durationSince(orderNumberAllocationStartedAt);
                    const visibleOrderNumber = Number(sequenceRows[0]?.nextNumber ?? 1);

                    const orderWriteStartedAt = timingNow();
                    const orderInsertStartedAt = timingNow();
                    await tx.insert(restaurantOrders).values({
                        id: orderId,
                        businessId,
                        visibleOrderNumber,
                        orderNumberDate,
                        tableId: typeof tableId === 'string' ? tableId : null,
                        status: 'pending',
                        orderType,
                        serviceStatus: 'pending',
                        paymentStatus: 'unpaid',
                        paymentTiming,
                        idempotencyKey,
                        createdBy: c.get('userId'),
                        total,
                        createdAt: now,
                        updatedAt: now,
                    });
                    orderInsertDurationMs += durationSince(orderInsertStartedAt);
                    const orderItemInsertStartedAt = timingNow();
                    await tx.insert(restaurantOrderItems).values(canonicalItems.map((entry) => ({
                        id: randomUUID(),
                        orderId,
                        menuItemId: entry.item.id,
                        name: entry.item.name,
                        quantity: entry.quantity,
                        unitPrice: entry.item.price,
                        notes: entry.notes,
                        status: 'pending' as const,
                    })));
                    orderItemInsertDurationMs += durationSince(orderItemInsertStartedAt);
                    orderWriteDurationMs += durationSince(orderWriteStartedAt);
                    const kdsWriteStartedAt = timingNow();
                    await tx.insert(kdsTickets).values({
                        id: randomUUID(),
                        orderId,
                        businessId,
                        status: 'new',
                        createdAt: now,
                        completedAt: null,
                    });
                    const kdsInsertDuration = durationSince(kdsWriteStartedAt);
                    kdsWriteDurationMs += kdsInsertDuration;
                    kdsInsertDurationMs += kdsInsertDuration;
                    if (typeof tableId === 'string') {
                        const tableUpdateStartedAt = timingNow();
                        await tx.update(restaurantTables)
                            .set({ status: 'occupied' })
                            .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.businessId, businessId)));
                        tableUpdateDurationMs += durationSince(tableUpdateStartedAt);
                    }
                    } finally {
                        transactionCallbackDurationForAttempt = durationSince(transactionCallbackStartedAt);
                    }
                });
                const transactionDurationForAttempt = durationSince(transactionStartedAt);
                transactionStartDelayDurationMs += transactionStartDelayForAttempt;
                transactionCallbackDurationMs += transactionCallbackDurationForAttempt;
                transactionDurationMs += transactionDurationForAttempt;
                transactionCommitFinalizationDurationMs += Math.max(
                    0,
                    Math.round((
                        transactionDurationForAttempt -
                        transactionStartDelayForAttempt -
                        transactionCallbackDurationForAttempt
                    ) * 100) / 100,
                );
                created = true;
            } catch (error) {
                if (isUniqueOrderNumberConflict(error) && attempt < 4) continue;
                throw error;
            }
        }
        const auditLogInsertStartedAt = timingNow();
        await logAudit(c, 'RESTAURANT_ORDER_CREATED', 'RESTAURANT_ORDER', orderId, {
            orderType,
            paymentTiming,
            tableId: typeof tableId === 'string' ? tableId : null,
            idempotencyKey: Boolean(idempotencyKey),
        });
        auditLogInsertDurationMs += durationSince(auditLogInsertStartedAt);
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'TABLE_NOT_FOUND') return c.json({ error: 'Table not found' }, 404);
        if (message === 'ITEM_NOT_FOUND') return c.json({ error: 'Menu item not found' }, 404);
        if (message === 'ITEM_UNAVAILABLE') return c.json({ error: 'Menu item is unavailable' }, 409);
        if (message.includes('restaurant_orders_business_idempotency_key_idx') && idempotencyKey) {
            const existingOrder = await first(db.select().from(restaurantOrders)
                .where(and(
                    eq(restaurantOrders.businessId, businessId),
                    eq(restaurantOrders.idempotencyKey, idempotencyKey),
                ))
            );
            if (existingOrder) return c.json(await orderWithItems(businessId, existingOrder.id));
        }
        throw error;
    }
    const responsePreparationStartedAt = timingNow();
    const response = await orderWithItems(businessId, orderId, responseTimings);
    const responsePreparationDurationMs = durationSince(responsePreparationStartedAt);
    logRestaurantTiming({
        route: 'POST /restaurant/orders',
        correlationId,
        requestDurationMs: durationSince(requestStartedAt),
        requestParsingDurationMs,
        authorizationDurationMs,
        idempotencyLookupDurationMs,
        transactionStartDelayDurationMs,
        transactionDurationMs,
        transactionCallbackDurationMs,
        transactionCommitFinalizationDurationMs,
        tableValidationDurationMs,
        menuValidationQueryDurationMs,
        orderNumberAllocationDurationMs,
        orderNumberLockDurationMs,
        orderNumberQueryDurationMs,
        orderWriteDurationMs,
        orderInsertDurationMs,
        orderItemInsertDurationMs,
        kdsWriteDurationMs,
        kdsInsertDurationMs,
        tableUpdateDurationMs,
        auditLogInsertDurationMs,
        responsePreparationDurationMs,
        ...responseTimings,
        orderType,
    });
    return c.json(response, 201);
});

restaurant.get('/orders', async (c) => {
    const businessId = c.get('businessId');
    const { start, end } = todayBounds();
    const conditions = [
        eq(restaurantOrders.businessId, businessId),
        gte(restaurantOrders.createdAt, start),
        lt(restaurantOrders.createdAt, end),
    ];
    if (c.req.query('status') === 'active') {
        conditions.push(inArray(restaurantOrders.status, ['pending', 'in_kitchen', 'ready', 'delivered', 'served', 'collected']));
    }
    const orders = await db.select().from(restaurantOrders)
        .where(and(...conditions))
        .orderBy(sql`${restaurantOrders.createdAt} DESC`);
    if (!orders.length) return c.json([]);
    const items = await db.select().from(restaurantOrderItems)
        .where(inArray(restaurantOrderItems.orderId, orders.map((order) => order.id)));
    const payments = await db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            inArray(restaurantPayments.orderId, orders.map((order) => order.id)),
        ));
    return c.json(orders.map((order) => {
        const orderPayments = payments.filter((payment) => payment.orderId === order.id);
        const completedPayment = orderPayments.find((payment) => payment.status === 'completed') ?? null;
        const orderType = orderTypeFor(order);
        const serviceStatus = serviceStatusFor(order);
        const paymentStatus = paymentStatusFor(order, completedPayment);
        const paymentTiming = paymentTimingFor(order);
        return {
            ...order,
            displayOrderNumber: displayOrderNumberFor(order),
            orderType,
            serviceStatus,
            paymentStatus,
            paymentTiming,
            status: legacyStatusFor(orderType, serviceStatus, paymentStatus),
            items: items.filter((item) => item.orderId === order.id),
            payments: orderPayments,
        };
    }));
});

restaurant.get('/reports/daily', async (c) => {
    const bounds = dateBoundsFor(c.req.query('date'));
    if (!bounds) {
        return c.json({ error: 'date must use YYYY-MM-DD' }, 400);
    }

    const businessId = c.get('businessId');
    const orders = await db.select().from(restaurantOrders)
        .where(and(
            eq(restaurantOrders.businessId, businessId),
            gte(restaurantOrders.createdAt, bounds.start),
            lt(restaurantOrders.createdAt, bounds.end),
        ))
        .orderBy(sql`${restaurantOrders.createdAt} DESC`);

    const orderIds = orders.map((order) => order.id);
    const items = orderIds.length > 0
        ? await db.select().from(restaurantOrderItems)
            .where(inArray(restaurantOrderItems.orderId, orderIds))
        : [];
    const payments = orderIds.length > 0
        ? await db.select().from(restaurantPayments)
            .where(and(
                eq(restaurantPayments.businessId, businessId),
                inArray(restaurantPayments.orderId, orderIds),
            ))
        : [];

    const completedPaymentsForDay = payments.filter((payment) => (
        payment.status === 'completed' &&
        payment.paidAt &&
        payment.paidAt >= bounds.start &&
        payment.paidAt < bounds.end
    ));
    const paidOrderIds = new Set(completedPaymentsForDay.map((payment) => payment.orderId));
    const paidRevenueCents = completedPaymentsForDay.reduce(
        (sum, payment) => sum + Math.round(payment.amount * 100),
        0,
    );

    const reportOrders = orders.map((order) => {
        const orderPayments = payments.filter((payment) => payment.orderId === order.id);
        const completedPayment = orderPayments.find((payment) => payment.status === 'completed') ?? null;
        const orderType = orderTypeFor(order);
        const serviceStatus = serviceStatusFor(order);
        const paymentStatus = paymentStatusFor(order, completedPayment);
        const paymentTiming = paymentTimingFor(order);
        const status = legacyStatusFor(orderType, serviceStatus, paymentStatus);

        return {
            id: order.id,
            displayOrderNumber: displayOrderNumberFor(order),
            orderType,
            serviceStatus,
            paymentStatus,
            paymentTiming,
            status,
            total: order.total,
            createdAt: order.createdAt,
            payments: orderPayments,
            items: items.filter((item) => item.orderId === order.id),
        };
    });

    const statusBreakdown = reportOrders.reduce<Record<string, number>>((breakdown, order) => {
        breakdown[order.status] = (breakdown[order.status] ?? 0) + 1;
        return breakdown;
    }, {});

    return c.json({
        date: bounds.date,
        summary: {
            totalOrders: reportOrders.length,
            paidOrders: reportOrders.filter((order) => paidOrderIds.has(order.id) || order.paymentStatus === 'paid').length,
            unpaidOpenOrders: reportOrders.filter((order) => (
                order.status !== 'cancelled' &&
                order.paymentStatus !== 'paid' &&
                !paidOrderIds.has(order.id)
            )).length,
            paidRevenueCents,
            dineInOrders: reportOrders.filter((order) => order.orderType === 'dine_in').length,
            takeawayOrders: reportOrders.filter((order) => order.orderType === 'takeaway').length,
        },
        statusBreakdown,
        recentOrders: reportOrders.slice(0, 10),
    });
});

restaurant.patch('/orders/:id/status', async (c) => {
    const body = await parseJson<{ status?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    if (typeof body.status !== 'string' || !orderStatuses.includes(body.status as OrderStatus)) {
        return c.json({ error: 'Invalid order status' }, 400);
    }
    if (body.status === 'paid') {
        return c.json({ error: 'Use the payment endpoint to mark restaurant orders as paid' }, 409);
    }
    const actor = await restaurantActorFor(c);
    if (body.status === 'ready' && !canPerformRestaurantAction(actor, 'mark_ready')) return forbid(c);
    if (body.status === 'delivered' && !canPerformRestaurantAction(actor, 'mark_delivered')) return forbid(c);
    if (body.status !== 'ready' && body.status !== 'delivered') {
        return c.json({ error: 'Use the kitchen, delivery, or payment action for restaurant order workflow changes' }, 409);
    }

    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const order = await first(db.select().from(restaurantOrders)
        .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)))
    );
    if (!order) return c.json({ error: 'Order not found' }, 404);
    const currentServiceStatus = serviceStatusFor(order);
    const currentPaymentStatus = paymentStatusFor(order);
    if (body.status === 'ready' && !validateRestaurantOrderTransition(order, 'mark_ready').ok) {
        return c.json({ error: 'Only pending kitchen orders can be marked ready' }, 409);
    }
    if (body.status === 'delivered' && !validateRestaurantOrderTransition(order, 'mark_delivered').ok) {
        return c.json({ error: 'Only ready orders can be marked delivered' }, 409);
    }

    await db.transaction(async (tx) => {
        const nextServiceStatus = body.status === 'ready' ? 'ready' : 'delivered';
        const orderType = orderTypeFor(order);
        await tx.update(restaurantOrders)
            .set({
                status: legacyStatusFor(orderType, nextServiceStatus, currentPaymentStatus),
                serviceStatus: nextServiceStatus,
                updatedAt: new Date(),
            })
            .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)));
    });
    await logAudit(c, `RESTAURANT_ORDER_${body.status.toUpperCase()}`, 'RESTAURANT_ORDER', id, {
        previousServiceStatus: currentServiceStatus,
        nextServiceStatus: body.status,
    });
    return c.json(await orderWithItems(businessId, id));
});

restaurant.post('/orders/:id/deliver', async (c) => {
    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const order = await first(db.select().from(restaurantOrders)
        .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)))
    );
    if (!order) return c.json({ error: 'Order not found' }, 404);
    const orderType = orderTypeFor(order);
    const actor = await restaurantActorFor(c);
    if (orderType === 'dine_in' && !canPerformRestaurantAction(actor, 'mark_delivered', order)) return forbid(c);
    if (orderType === 'takeaway' && !canPerformRestaurantAction(actor, 'mark_collected', order)) return forbid(c);
    const currentServiceStatus = serviceStatusFor(order);
    if (currentServiceStatus === 'cancelled' || order.status === 'cancelled') {
        return c.json({ error: 'Cancelled orders cannot be delivered or collected' }, 409);
    }
    const currentPaymentStatus = paymentStatusFor(order);
    const nextServiceStatus: ServiceStatus = orderType === 'takeaway' ? 'collected' : 'delivered';
    if (currentServiceStatus === nextServiceStatus) {
        if (orderType === 'takeaway') return c.json({ error: 'Takeaway order is already collected' }, 409);
        return c.json(await orderWithItems(businessId, id));
    }
    if (orderType === 'dine_in' && currentPaymentStatus === 'paid') {
        return c.json({ error: 'Paid dine-in orders cannot be marked delivered before service delivery' }, 409);
    }
    if (currentServiceStatus !== 'ready') {
        return c.json({ error: orderType === 'takeaway' ? 'Only ready takeaway orders can be collected' : 'Only ready orders can be marked delivered' }, 409);
    }

    await db.transaction(async (tx) => {
        await tx.update(restaurantOrders)
            .set({
                status: legacyStatusFor(orderType, nextServiceStatus, currentPaymentStatus),
                serviceStatus: nextServiceStatus,
                updatedAt: new Date(),
            })
            .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)));
        if (orderType === 'dine_in' && order.tableId && nextServiceStatus === 'delivered' && currentPaymentStatus === 'paid') {
            await tx.update(restaurantTables)
                .set({ status: 'available' })
                .where(and(
                    eq(restaurantTables.id, order.tableId),
                    eq(restaurantTables.businessId, businessId),
                ));
        }
    });
    await logAudit(c, orderType === 'takeaway' ? 'RESTAURANT_ORDER_COLLECTED' : 'RESTAURANT_ORDER_DELIVERED', 'RESTAURANT_ORDER', id, {
        previousServiceStatus: currentServiceStatus,
        nextServiceStatus,
        orderType,
    });
    return c.json(await orderWithItems(businessId, id));
});

restaurant.post('/orders/:id/payments', async (c) => {
    const actor = await restaurantActorFor(c);
    if (!canPerformRestaurantAction(actor, 'record_payment')) return forbid(c);

    const body = await parseJson<{ method?: unknown; amount?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    if (typeof body.method !== 'string' || !paymentMethods.includes(body.method as typeof paymentMethods[number])) {
        return c.json({ error: 'Payment method must be cash, card, manual, or mobile' }, 400);
    }

    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const order = await first(db.select().from(restaurantOrders)
        .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)))
    );
    if (!order) return c.json({ error: 'Order not found' }, 404);
    const existingPayment = await first(db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            eq(restaurantPayments.orderId, id),
            eq(restaurantPayments.status, 'completed'),
        ))
    );
    if (order.status === 'paid' || existingPayment) {
        return c.json({ error: 'Order is already paid' }, 409);
    }
    if (order.status === 'cancelled') return c.json({ error: 'Cancelled orders cannot be paid' }, 409);
    const orderType = orderTypeFor(order);
    const paymentTiming = paymentTimingFor(order);
    const currentServiceStatus = serviceStatusFor(order);
    const mustCompleteServiceBeforePayment = orderType === 'dine_in' || paymentTiming === 'pay_after_service';
    if (mustCompleteServiceBeforePayment) {
        const isPayableAfterService = orderType === 'takeaway'
            ? currentServiceStatus === 'collected'
            : currentServiceStatus === 'delivered';
        if (!isPayableAfterService) {
            return c.json({ error: orderType === 'takeaway' ? 'Takeaway order must be collected before payment' : 'Order must be delivered before payment' }, 409);
        }
    }

    const total = order.total / 100;
    const amount = body.amount ?? total;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || Math.abs(amount - total) > 0.005) {
        return c.json({ error: `Payment amount must equal ${total.toFixed(2)}` }, 400);
    }

    try {
        await db.transaction(async (tx) => {
            await tx.execute(sql`
                SELECT id
                FROM restaurant_orders
                WHERE id = ${id} AND business_id = ${businessId}
                FOR UPDATE
            `);
            const lockedOrder = await first(tx.select().from(restaurantOrders)
                .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)))
            );
            if (!lockedOrder) throw new Error('ORDER_NOT_FOUND');
            const lockedOrderType = orderTypeFor(lockedOrder);
            const lockedPaymentTiming = paymentTimingFor(lockedOrder);
            const lockedServiceStatus = serviceStatusFor(lockedOrder);
            if (lockedOrder.status === 'paid' || lockedOrder.paymentStatus === 'paid') throw new Error('ORDER_ALREADY_PAID');
            if (lockedOrder.status === 'cancelled' || lockedServiceStatus === 'cancelled') throw new Error('ORDER_CANCELLED');
            const lockedMustCompleteServiceBeforePayment = lockedOrderType === 'dine_in' || lockedPaymentTiming === 'pay_after_service';
            if (lockedMustCompleteServiceBeforePayment) {
                const isPayableAfterService = lockedOrderType === 'takeaway'
                    ? lockedServiceStatus === 'collected'
                    : lockedServiceStatus === 'delivered';
                if (!isPayableAfterService) throw new Error('ORDER_NOT_DELIVERED');
            }
            const payment = await first(tx.select().from(restaurantPayments)
                .where(and(
                    eq(restaurantPayments.businessId, businessId),
                    eq(restaurantPayments.orderId, id),
                    eq(restaurantPayments.status, 'completed'),
                ))
            );
            if (payment) throw new Error('ORDER_ALREADY_PAID');

            const lockedTotal = lockedOrder.total / 100;
            if (Math.abs(amount - lockedTotal) > 0.005) {
                throw new Error('AMOUNT_CHANGED');
            }

            const now = new Date();
            await tx.insert(restaurantPayments).values({
                id: randomUUID(),
                businessId,
                orderId: id,
                method: body.method as typeof paymentMethods[number],
                amount,
                status: 'completed',
                paidAt: now,
            });
            const nextPaymentStatus: PaymentStatus = 'paid';
            const nextLegacyStatus = legacyStatusFor(lockedOrderType, lockedServiceStatus, nextPaymentStatus);
            await tx.update(restaurantOrders)
                .set({
                    status: nextLegacyStatus,
                    paymentStatus: nextPaymentStatus,
                    updatedAt: now,
                })
                .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)));
            if (lockedOrder.tableId && lockedOrderType === 'dine_in' && lockedServiceStatus === 'delivered') {
                await tx.update(restaurantTables)
                    .set({ status: 'available' })
                    .where(and(
                        eq(restaurantTables.id, lockedOrder.tableId),
                        eq(restaurantTables.businessId, businessId),
                    ));
            }
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === 'ORDER_NOT_FOUND') return c.json({ error: 'Order not found' }, 404);
            if (error.message === 'ORDER_ALREADY_PAID') return c.json({ error: 'Order is already paid' }, 409);
            if (error.message === 'ORDER_CANCELLED') return c.json({ error: 'Cancelled orders cannot be paid' }, 409);
            if (error.message === 'ORDER_NOT_DELIVERED') return c.json({ error: orderType === 'takeaway' ? 'Takeaway order must be collected before payment' : 'Order must be delivered before payment' }, 409);
            if (error.message === 'AMOUNT_CHANGED') return c.json({ error: `Payment amount must equal ${total.toFixed(2)}` }, 400);
        }
        throw error;
    }

    await logAudit(c, 'RESTAURANT_ORDER_PAYMENT_COMPLETED', 'RESTAURANT_ORDER', id, {
        method: body.method,
        amount,
        orderType,
        paymentTiming,
    });
    return c.json(await orderWithItems(businessId, id), 201);
});

restaurant.post('/orders/:id/cancel', async (c) => {
    const body = await parseJson<{ reason?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) return c.json({ error: 'Cancellation reason is required' }, 400);

    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const order = await first(db.select().from(restaurantOrders)
        .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)))
    );
    if (!order) return c.json({ error: 'Order not found' }, 404);
    const existingPayment = await first(db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            eq(restaurantPayments.orderId, id),
            eq(restaurantPayments.status, 'completed'),
        ))
    );
    const serviceStatus = serviceStatusFor(order);
    const paymentStatus = paymentStatusFor(order, existingPayment);
    if (isOrderPaid(order, existingPayment)) return c.json({ error: 'Paid orders cannot be cancelled' }, 409);
    if (isOrderClosedForCancellation(serviceStatus, order.status)) {
        return c.json({ error: 'Closed or cancelled orders cannot be cancelled' }, 409);
    }
    const actor = await restaurantActorFor(c);
    if (!canPerformRestaurantAction(actor, 'cancel_order', order)) return forbid(c);

    const now = new Date();
    await db.transaction(async (tx) => {
        await tx.update(restaurantOrders)
            .set({
                status: 'cancelled',
                serviceStatus: 'cancelled',
                cancellationReason: reason,
                cancelledBy: c.get('userId'),
                cancelledAt: now,
                updatedAt: now,
            })
            .where(and(eq(restaurantOrders.id, id), eq(restaurantOrders.businessId, businessId)));
        await tx.update(kdsTickets)
            .set({
                status: 'cancelled',
                completedAt: now,
            })
            .where(and(eq(kdsTickets.orderId, id), eq(kdsTickets.businessId, businessId)));
        if (order.tableId && orderTypeFor(order) === 'dine_in') {
            await tx.update(restaurantTables)
                .set({ status: 'available' })
                .where(and(
                    eq(restaurantTables.id, order.tableId),
                    eq(restaurantTables.businessId, businessId),
                ));
        }
    });
    await logAudit(c, 'RESTAURANT_ORDER_CANCELLED', 'RESTAURANT_ORDER', id, {
        actorUserId: c.get('userId'),
        businessId,
        reason,
        orderId: id,
        displayOrderNumber: displayOrderNumberFor(order),
        cancelledAt: now.toISOString(),
        previousServiceStatus: serviceStatus,
        previousPaymentStatus: paymentStatus,
    });
    return c.json(await orderWithItems(businessId, id));
});

restaurant.get('/kds', async (c) => {
    const requestStartedAt = timingNow();
    const correlationId = safeCorrelationId(c.req.header('X-Q360-Correlation-Id'));
    const businessId = c.get('businessId');
    const queryStartedAt = timingNow();
    const tickets = await db.select().from(kdsTickets)
        .where(and(
            eq(kdsTickets.businessId, businessId),
            or(eq(kdsTickets.status, 'new'), eq(kdsTickets.status, 'cooking')),
        ))
        .orderBy(asc(kdsTickets.createdAt));
    let queryDurationMs = durationSince(queryStartedAt);
    const responsePreparationStartedAt = timingNow();
    const payload = [];
    for (const ticket of tickets) {
        const ticketQueryStartedAt = timingNow();
        const order = await first(db.select().from(restaurantOrders)
            .where(and(
                eq(restaurantOrders.id, ticket.orderId),
                eq(restaurantOrders.businessId, businessId),
            ))
        );
        queryDurationMs += durationSince(ticketQueryStartedAt);
        if (order && serviceStatusFor(order) === 'cancelled') continue;
        const itemsQueryStartedAt = timingNow();
        const items = await db.select().from(restaurantOrderItems)
            .where(eq(restaurantOrderItems.orderId, ticket.orderId));
        queryDurationMs += durationSince(itemsQueryStartedAt);
        const tableId = order?.tableId ?? null;
        const table = tableId
            ? await (async () => {
                const tableQueryStartedAt = timingNow();
                const result = await first(db.select().from(restaurantTables)
                    .where(and(
                        eq(restaurantTables.id, tableId),
                        eq(restaurantTables.businessId, businessId),
                    ))
                );
                queryDurationMs += durationSince(tableQueryStartedAt);
                return result;
            })()
            : null;
        payload.push({
            ...ticket,
            order: order ? kitchenOrderPayload(order, items) : null,
            tableLabel: table?.label ?? null,
        });
    }
    const responsePreparationDurationMs = durationSince(responsePreparationStartedAt);
    logRestaurantTiming({
        route: 'GET /restaurant/kds',
        correlationId,
        requestDurationMs: durationSince(requestStartedAt),
        queryDurationMs,
        responsePreparationDurationMs,
        kdsTicketCount: tickets.length,
    });
    return c.json(payload);
});

restaurant.patch('/kds/:id/status', async (c) => {
    const actor = await restaurantActorFor(c);
    if (!canPerformRestaurantAction(actor, 'mark_ready')) return forbid(c);

    const body = await parseJson<{ status?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    if (typeof body.status !== 'string' || !ticketStatuses.includes(body.status as TicketStatus)) {
        return c.json({ error: 'Invalid KDS status' }, 400);
    }
    if (body.status !== 'done') {
        return c.json({ error: 'Kitchen may only mark orders ready' }, 409);
    }

    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const ticket = await first(db.select().from(kdsTickets)
        .where(and(eq(kdsTickets.id, id), eq(kdsTickets.businessId, businessId)))
    );
    if (!ticket) return c.json({ error: 'KDS ticket not found' }, 404);
    const order = await first(db.select().from(restaurantOrders)
        .where(and(eq(restaurantOrders.id, ticket.orderId), eq(restaurantOrders.businessId, businessId)))
    );
    if (!order) return c.json({ error: 'Order not found' }, 404);
    if (ticket.status === 'cancelled' || serviceStatusFor(order) === 'cancelled' || order.status === 'cancelled') {
        return c.json({ error: 'Cancelled orders cannot be marked ready' }, 409);
    }
    if (ticket.status === 'done' && serviceStatusFor(order) === 'ready') {
        return c.json(await kdsTicketWithOrder(businessId, id));
    }
    const currentServiceStatus = serviceStatusFor(order);
    if (currentServiceStatus !== 'pending' && currentServiceStatus !== 'in_kitchen') {
        return c.json({ error: 'Only pending kitchen orders can be marked ready' }, 409);
    }

    await db.transaction(async (tx) => {
        await tx.update(kdsTickets)
            .set({
                status: body.status as TicketStatus,
                completedAt: body.status === 'done' ? new Date() : null,
            })
            .where(and(eq(kdsTickets.id, id), eq(kdsTickets.businessId, businessId)));
        if (body.status === 'cooking' || body.status === 'done') {
            const nextServiceStatus: ServiceStatus = body.status === 'done' ? 'ready' : 'in_kitchen';
            const orderType = orderTypeFor(order);
            const paymentStatus = paymentStatusFor(order);
            await tx.update(restaurantOrders)
                .set({
                    status: legacyStatusFor(orderType, nextServiceStatus, paymentStatus),
                    serviceStatus: nextServiceStatus,
                    updatedAt: new Date(),
                })
                .where(and(
                    eq(restaurantOrders.id, ticket.orderId),
                    eq(restaurantOrders.businessId, businessId),
                ));
            await tx.update(restaurantOrderItems)
                .set({ status: body.status === 'done' ? 'done' : 'cooking' })
                .where(eq(restaurantOrderItems.orderId, ticket.orderId));
        }
    });
    await logAudit(c, 'RESTAURANT_KDS_TICKET_READY', 'RESTAURANT_KDS_TICKET', id, {
        orderId: ticket.orderId,
        previousServiceStatus: currentServiceStatus,
        nextServiceStatus: 'ready',
    });
    return c.json(await kdsTicketWithOrder(businessId, id));
});

restaurant.get('/dashboard', async (c) => {
    const businessId = c.get('businessId');
    const { start, end } = todayBounds();
    const orders = await db.select().from(restaurantOrders)
        .where(and(
            eq(restaurantOrders.businessId, businessId),
            gte(restaurantOrders.createdAt, start),
            lt(restaurantOrders.createdAt, end),
        ));
    const completedTickets = await db.select().from(kdsTickets)
        .where(and(
            eq(kdsTickets.businessId, businessId),
            eq(kdsTickets.status, 'done'),
            gte(kdsTickets.completedAt, start),
            lt(kdsTickets.completedAt, end),
        ));
    const tables = await db.select().from(restaurantTables)
        .where(eq(restaurantTables.businessId, businessId));
    const payments = await db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            eq(restaurantPayments.status, 'completed'),
            gte(restaurantPayments.paidAt, start),
            lt(restaurantPayments.paidAt, end),
        ));
    const prepTimes = completedTickets
        .filter((ticket) => ticket.completedAt)
        .map((ticket) => (ticket.completedAt!.getTime() - ticket.createdAt.getTime()) / 60_000);
    const occupiedTableCount = tables.filter((table) => table.status === 'occupied').length;
    const averageCapacity = tables.length
        ? tables.reduce((sum, table) => sum + table.capacity, 0) / tables.length
        : 0;
    return c.json({
        total_revenue_today: orders
            .reduce((sum, order) => {
                const orderPayments = payments.filter((payment) => payment.orderId === order.id);
                return sum + orderPayments.reduce(
                    (paymentSum, payment) => paymentSum + Math.round(payment.amount * 100),
                    0,
                );
            }, 0),
        active_orders_count: orders
            .filter((order) => (
                order.status === 'pending' ||
                order.status === 'in_kitchen' ||
                order.status === 'ready' ||
                order.status === 'delivered' ||
                order.status === 'served' ||
                order.status === 'collected'
            ))
            .length,
        avg_prep_time_minutes: prepTimes.length
            ? Math.round((prepTimes.reduce((sum, value) => sum + value, 0) / prepTimes.length) * 10) / 10
            : 0,
        live_diners_count: Math.round(occupiedTableCount * averageCapacity),
    });
});

export default restaurant;
