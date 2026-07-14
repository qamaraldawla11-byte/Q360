import { randomUUID } from 'crypto';
import { Hono, type Context } from 'hono';
import { and, asc, desc, eq, gt, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import {
    customers,
    kdsTickets,
    menuCategories,
    menuItemAssets,
    menuItems,
    qAssistantDrafts,
    qUsageEvents,
    restaurantBookings,
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
    isLegacyRestaurantOwnerCompatible,
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
import { isBusinessModuleEnabled } from '../services/businessModules.js';

const restaurant = new Hono<AppEnv>();
const tableStatuses = ['available', 'occupied', 'reserved', 'cleaning'] as const;
const bookingStatuses = ['pending', 'confirmed', 'arrived', 'seated', 'completed', 'cancelled', 'no_show'] as const;
const orderStatuses = ['pending', 'in_kitchen', 'ready', 'delivered', 'served', 'collected', 'closed', 'paid', 'cancelled'] as const;
const ticketStatuses = ['new', 'cooking', 'done', 'cancelled'] as const;
const paymentMethods = ['cash', 'card', 'manual', 'mobile'] as const;
const orderTypes = ['dine_in', 'takeaway', 'delivery'] as const;
const paymentTimings = ['pay_before_service', 'pay_after_service'] as const;
type TableStatus = typeof tableStatuses[number];
type BookingStatus = typeof bookingStatuses[number];
type OrderStatus = typeof orderStatuses[number];
type TicketStatus = typeof ticketStatuses[number];
const delayedKdsThresholdMinutes = 15;
const priorityTypes = ['kds_delay', 'unpaid_orders', 'table_attention', 'sales_summary', 'top_items'] as const;
const priorityUrgencies = ['info', 'attention', 'urgent'] as const;
const evidenceTypes = ['kds', 'orders', 'tables', 'payments', 'menu_items', 'sales'] as const;
const maxMenuImageBytes = 2 * 1024 * 1024;
const menuImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
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

const qDraftTypes = ['daily_report', 'manager_task'] as const;
type QDraftType = typeof qDraftTypes[number];
type QEvidenceCard = {
    id: string;
    type: 'kds_ticket' | 'order' | 'table' | 'payment' | 'menu_item' | 'daily_summary';
    label: string;
    facts: string[];
    sourceIds: string[];
    freshness: { generatedAt: string; dataWindowStart: string | null; dataWindowEnd: string | null };
};
type QPulseResponse = {
    requestId: string;
    summary: string;
    insights: Array<{
        id: string;
        severity: PriorityUrgency;
        title: string;
        recommendation: string;
        evidenceIds: string[];
        allowedActions: ['prepare_draft'] | [];
    }>;
    evidenceCards: QEvidenceCard[];
    drafts: [];
    generatedAt: string;
};

restaurant.use('/*', authMiddleware);

const parseJson = async <T>(c: Context<AppEnv>) => {
    try {
        return await c.req.json<T>();
    } catch {
        return null;
    }
};

type CustomerSnapshotBody = {
    customerId?: unknown; customer_id?: unknown;
    customerName?: unknown; customer_name?: unknown;
    customerPhone?: unknown; customer_phone?: unknown;
    deliveryAddress?: unknown; delivery_address?: unknown;
    deliveryNotes?: unknown; delivery_notes?: unknown;
};

const customerSnapshotFor = async (body: CustomerSnapshotBody, businessId: string, orderType: OrderType) => {
    const value = (camel: unknown, snake: unknown) => camel ?? snake;
    const text = (raw: unknown, maximum: number) => {
        if (raw === undefined || raw === null) return { value: null as string | null };
        if (typeof raw !== 'string') return { error: 'Customer and delivery fields must be text' };
        const normalized = raw.trim() || null;
        if (normalized && normalized.length > maximum) return { error: `Customer or delivery field exceeds ${maximum} characters` };
        return { value: normalized };
    };
    const rawCustomerId = value(body.customerId, body.customer_id);
    if (rawCustomerId !== undefined && rawCustomerId !== null && typeof rawCustomerId !== 'string') return { error: 'Invalid customer id', status: 400 as const };
    const customerId = typeof rawCustomerId === 'string' ? rawCustomerId.trim() || null : null;
    const customer = customerId ? await first(db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.businessId, businessId)))) : null;
    if (customerId && !customer) return { error: 'Customer not found', status: 404 as const };
    const name = text(value(body.customerName, body.customer_name), 160);
    const phone = text(value(body.customerPhone, body.customer_phone), 60);
    const address = text(value(body.deliveryAddress, body.delivery_address), 500);
    const notes = text(value(body.deliveryNotes, body.delivery_notes), 1000);
    const fieldError = name.error || phone.error || address.error || notes.error;
    if (fieldError) return { error: fieldError, status: 400 as const };
    const snapshot = {
        customerId,
        customerName: name.value ?? customer?.name ?? null,
        customerPhone: phone.value ?? customer?.phone ?? null,
        deliveryAddress: address.value ?? customer?.address ?? null,
        deliveryNotes: notes.value,
    };
    if (orderType === 'delivery' && (!snapshot.customerName || !snapshot.customerPhone || !snapshot.deliveryAddress)) {
        return { error: 'Delivery orders require customer name, phone, and delivery address', status: 400 as const };
    }
    return { snapshot };
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
    customerId: order.customerId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryNotes: order.deliveryNotes,
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

const activeBookingStatuses: BookingStatus[] = ['pending', 'confirmed', 'arrived', 'seated'];
const bookingText = (value: unknown, maximum: number) => {
    if (value === undefined || value === null) return { value: null as string | null };
    if (typeof value !== 'string') return { error: 'Booking text fields must be text' };
    const normalized = value.trim() || null;
    if (normalized && normalized.length > maximum) return { error: `Booking field exceeds ${maximum} characters` };
    return { value: normalized };
};

const bookingPublic = (booking: typeof restaurantBookings.$inferSelect) => ({
    id: booking.id,
    businessId: booking.businessId,
    customerId: booking.customerId,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    partySize: booking.partySize,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    tableIds: booking.tableIds,
    status: booking.status,
    occasion: booking.occasion,
    notes: booking.notes,
    depositAmount: booking.depositAmount,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
});

const bookingsConflict = async (
    businessId: string,
    startsAt: Date,
    endsAt: Date,
    tableIds: string[],
    exceptId?: string,
) => {
    const candidates = await db.select().from(restaurantBookings).where(and(
        eq(restaurantBookings.businessId, businessId),
        inArray(restaurantBookings.status, activeBookingStatuses),
        lt(restaurantBookings.startsAt, endsAt),
        gt(restaurantBookings.endsAt, startsAt),
    ));
    return candidates.find((booking) => booking.id !== exceptId && booking.tableIds.some((tableId) => tableIds.includes(tableId))) || null;
};

const recordQUsage = async (
    actor: RestaurantActor,
    feature: string,
    requestStatus: 'completed' | 'failed' | 'blocked',
    metadata: Record<string, string | number | boolean> = {},
) => db.insert(qUsageEvents).values({
    id: randomUUID(),
    businessId: actor.businessId,
    userId: actor.userId,
    feature,
    provider: 'q360-rules-v1',
    model: 'structured-pulse-v1',
    requestStatus,
    metadata,
});

const qEvidenceTypeFor = (type: EvidenceType): QEvidenceCard['type'] => ({
    kds: 'kds_ticket',
    orders: 'order',
    tables: 'table',
    payments: 'payment',
    menu_items: 'menu_item',
    sales: 'daily_summary',
}[type] as QEvidenceCard['type']);

const qRecommendationFor = (type: PriorityType) => ({
    kds_delay: 'Open Kitchen and review the delayed tickets.',
    unpaid_orders: 'Open Order History and review the unpaid orders.',
    table_attention: 'Check the listed tables before closing their orders.',
    sales_summary: 'Use this verified summary for the daily manager review.',
    top_items: 'Use the top items when planning menu availability and preparation.',
}[type]);

const buildQPulseResponse = (snapshot: BusinessPulseSnapshot, prompt?: string): QPulseResponse => {
    const evidenceCards = snapshot.priorities.map((priority, index): QEvidenceCard => ({
        id: `evidence-${priority.type}-${index + 1}`,
        type: qEvidenceTypeFor(priority.evidence.type),
        label: priority.evidence.label,
        facts: Object.entries(priority.evidence.facts).map(([key, value]) => `${key}: ${value ?? 'none'}`),
        sourceIds: [],
        freshness: {
            generatedAt: priority.dataFreshnessTimestamp,
            dataWindowStart: null,
            dataWindowEnd: snapshot.generatedAt,
        },
    }));
    const insights = snapshot.priorities.map((priority, index) => ({
        id: `insight-${priority.type}-${index + 1}`,
        severity: priority.urgency,
        title: priority.title,
        recommendation: qRecommendationFor(priority.type),
        evidenceIds: [evidenceCards[index].id],
        allowedActions: (priority.type === 'sales_summary' || priority.type === 'kds_delay' || priority.type === 'unpaid_orders')
            ? ['prepare_draft'] as ['prepare_draft']
            : [] as [],
    }));

    const normalizedPrompt = prompt?.trim().toLowerCase() ?? '';
    let summary = snapshot.priorities.some((priority) => priority.urgency === 'urgent')
        ? 'Your restaurant has urgent items that need review.'
        : snapshot.unpaidOrderCount || snapshot.delayedKdsTicketCount
            ? 'Your restaurant has a few operational items that need attention.'
            : 'No urgent restaurant issues are visible in the current snapshot.';
    if (normalizedPrompt.includes('sold') || normalizedPrompt.includes('top')) {
        const top = snapshot.topSellingMenuItems[0];
        summary = top
            ? `${top.name} is the top-selling item today with ${top.quantitySold} sold.`
            : 'There are no completed item sales in today\'s snapshot yet.';
    } else if (normalizedPrompt.includes('delay') || normalizedPrompt.includes('kitchen')) {
        summary = snapshot.delayedKdsTicketCount
            ? `${snapshot.delayedKdsTicketCount} kitchen ticket${snapshot.delayedKdsTicketCount === 1 ? ' is' : 's are'} delayed.`
            : 'No kitchen tickets are beyond the delay threshold.';
    } else if (normalizedPrompt.includes('payment') || normalizedPrompt.includes('unpaid') || normalizedPrompt.includes('open')) {
        summary = snapshot.unpaidOrderCount
            ? `${snapshot.unpaidOrderCount} order${snapshot.unpaidOrderCount === 1 ? ' remains' : 's remain'} unpaid.`
            : 'No unpaid orders are visible in today\'s snapshot.';
    } else if (normalizedPrompt.includes('sales') || normalizedPrompt.includes('revenue') || normalizedPrompt.includes('today')) {
        summary = `Today has ${snapshot.todaySalesSummary.paidOrderCount} paid orders and ${(snapshot.todaySalesSummary.grossSales / 100).toFixed(2)} in paid revenue.`;
    }

    return {
        requestId: randomUUID(),
        summary,
        insights,
        evidenceCards,
        drafts: [],
        generatedAt: snapshot.generatedAt,
    };
};

const canUseQ = (actor: RestaurantActor) => (
    actor.role === 'owner' || actor.role === 'admin' || actor.role === 'manager' || isLegacyRestaurantOwnerCompatible(actor)
);

const canReviewQDraft = (actor: RestaurantActor) => (
    actor.role === 'owner' || actor.role === 'admin' || isLegacyRestaurantOwnerCompatible(actor)
);

const qDraftContent = (type: QDraftType, snapshot: BusinessPulseSnapshot) => {
    if (type === 'manager_task') {
        const attention = [
            snapshot.delayedKdsTicketCount ? `Review ${snapshot.delayedKdsTicketCount} delayed kitchen ticket(s).` : null,
            snapshot.unpaidOrderCount ? `Review ${snapshot.unpaidOrderCount} unpaid order(s).` : null,
            snapshot.tablePaymentAttentionCount ? `Check ${snapshot.tablePaymentAttentionCount} table(s) awaiting payment attention.` : null,
        ].filter(Boolean);
        return {
            title: 'Restaurant attention task',
            body: attention.length ? attention.join('\n') : 'No urgent operational follow-up is visible in the current snapshot.',
        };
    }
    const top = snapshot.topSellingMenuItems[0];
    return {
        title: 'Daily restaurant report',
        body: [
            `Paid revenue: ${(snapshot.todaySalesSummary.grossSales / 100).toFixed(2)}`,
            `Paid orders: ${snapshot.todaySalesSummary.paidOrderCount}`,
            `Open orders: ${snapshot.openOrderCount}`,
            `Unpaid orders: ${snapshot.unpaidOrderCount}`,
            `Delayed kitchen tickets: ${snapshot.delayedKdsTicketCount}`,
            `Top item: ${top ? `${top.name} (${top.quantitySold})` : 'No completed sales yet'}`,
        ].join('\n'),
    };
};

const publicQDraft = (draft: typeof qAssistantDrafts.$inferSelect | (typeof qAssistantDrafts.$inferInsert & { createdAt?: Date })) => ({
    id: draft.id,
    type: draft.type,
    title: draft.title,
    body: draft.body,
    evidenceIds: draft.evidenceIds,
    status: draft.status,
    ownerEditedBody: draft.ownerEditedBody ?? null,
    approvalNote: draft.approvalNote ?? null,
    createdAt: draft.createdAt ?? null,
    reviewedAt: draft.reviewedAt ?? null,
    requiresApproval: draft.status === 'pending',
});

const orderResponse = (
    order: typeof restaurantOrders.$inferSelect,
    items: typeof restaurantOrderItems.$inferSelect[],
    payments: typeof restaurantPayments.$inferSelect[],
) => {
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
        .where(eq(restaurantOrderItems.orderId, orderId));
    addTimingDuration(timings, 'responseItemsRefetchDurationMs', durationSince(itemsRefetchStartedAt));
    const paymentsRefetchStartedAt = timingNow();
    const payments = await db.select().from(restaurantPayments)
        .where(and(
            eq(restaurantPayments.businessId, businessId),
            eq(restaurantPayments.orderId, orderId),
        ));
    addTimingDuration(timings, 'responsePaymentsRefetchDurationMs', durationSince(paymentsRefetchStartedAt));
    return orderResponse(order, items, payments);
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
    const [order, payment, ticket] = await Promise.all([
        orderWithItems(businessId, orderId),
        first(db.select().from(restaurantPayments)
            .where(and(
                eq(restaurantPayments.businessId, businessId),
                eq(restaurantPayments.orderId, orderId),
                eq(restaurantPayments.status, 'completed'),
            ))
        ),
        first(db.select().from(kdsTickets)
            .where(and(eq(kdsTickets.businessId, businessId), eq(kdsTickets.orderId, orderId)))
        ),
    ]);
    if (!order) return null;
    if (!payment) return null;
    return {
        order,
        payment: integratedPaymentSummary(payment, cashReceived, changeDue),
        kitchen: {
            ticket: ticket ? {
                ...ticket,
                order: kitchenOrderPayload(order, order.items),
                tableLabel: null,
            } : null,
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

restaurant.get('/business-pulse', async (c) => {
    const actor = await restaurantActorFor(c);
    if (!canUseQ(actor)) return forbid(c, 'Q Assistant is available to restaurant management');
    try {
        const snapshot = await buildBusinessPulseSnapshot(actor.businessId);
        const response = buildQPulseResponse(snapshot);
        await logAudit(c, 'Q_PULSE_REQUESTED', 'Q_BUSINESS_PULSE', response.requestId, {
            userRole: actor.role,
            provider: 'q360-rules-v1',
            model: 'structured-pulse-v1',
            evidenceIds: response.evidenceCards.map((card) => card.id),
            validationStatus: 'passed',
        });
        await logAudit(c, 'Q_INSIGHT_GENERATED', 'Q_BUSINESS_PULSE', response.requestId, {
            insightCount: response.insights.length,
            evidenceIds: response.evidenceCards.map((card) => card.id),
            validationStatus: 'passed',
        });
        await recordQUsage(actor, 'business_pulse', 'completed', { insightCount: response.insights.length });
        return c.json(response);
    } catch {
        await recordQUsage(actor, 'business_pulse', 'failed', { safeReason: 'pulse_generation_failed' }).catch(() => undefined);
        await logAudit(c, 'Q_PROVIDER_ERROR', 'Q_BUSINESS_PULSE', null, { safeReason: 'pulse_generation_failed' });
        return c.json({ error: 'Q could not generate the Restaurant Pulse' }, 500);
    }
});

restaurant.post('/business-pulse/ask', async (c) => {
    const actor = await restaurantActorFor(c);
    if (!canUseQ(actor)) return forbid(c, 'Q Assistant is available to restaurant management');
    const body = await parseJson<{ prompt?: unknown }>(c);
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return c.json({ error: 'A question is required' }, 400);
    if (prompt.length > 300) return c.json({ error: 'Question must be 300 characters or fewer' }, 400);
    try {
        const snapshot = await buildBusinessPulseSnapshot(actor.businessId);
        const response = buildQPulseResponse(snapshot, prompt);
        await logAudit(c, 'Q_PULSE_REQUESTED', 'Q_BUSINESS_PULSE', response.requestId, {
            userRole: actor.role,
            provider: 'q360-rules-v1',
            model: 'structured-pulse-v1',
            promptCategory: prompt.toLowerCase().includes('kitchen') ? 'kitchen' : 'restaurant_operations',
            evidenceIds: response.evidenceCards.map((card) => card.id),
            validationStatus: 'passed',
        });
        await logAudit(c, 'Q_INSIGHT_GENERATED', 'Q_BUSINESS_PULSE', response.requestId, {
            insightCount: response.insights.length,
            evidenceIds: response.evidenceCards.map((card) => card.id),
            validationStatus: 'passed',
        });
        await recordQUsage(actor, 'business_pulse_question', 'completed', {
            promptLength: prompt.length,
            insightCount: response.insights.length,
        });
        return c.json(response);
    } catch {
        await recordQUsage(actor, 'business_pulse_question', 'failed', { safeReason: 'question_generation_failed' }).catch(() => undefined);
        await logAudit(c, 'Q_PROVIDER_ERROR', 'Q_BUSINESS_PULSE', null, { safeReason: 'question_generation_failed' });
        return c.json({ error: 'Q could not answer from the current Restaurant records' }, 500);
    }
});

restaurant.get('/business-pulse/drafts', async (c) => {
    const actor = await restaurantActorFor(c);
    if (!canUseQ(actor)) return forbid(c, 'Q Assistant is available to restaurant management');
    const drafts = await db.select().from(qAssistantDrafts)
        .where(eq(qAssistantDrafts.businessId, actor.businessId))
        .orderBy(desc(qAssistantDrafts.createdAt));
    return c.json({ drafts: drafts.map(publicQDraft) });
});

restaurant.get('/business-pulse/usage', async (c) => {
    const actor = await restaurantActorFor(c);
    if (!canReviewQDraft(actor)) return forbid(c, 'Only an owner or admin can view Q usage');
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const events = await db.select().from(qUsageEvents).where(and(
        eq(qUsageEvents.businessId, actor.businessId),
        gte(qUsageEvents.createdAt, since),
    )).orderBy(desc(qUsageEvents.createdAt));
    const byFeature = events.reduce<Record<string, number>>((result, event) => {
        result[event.feature] = (result[event.feature] ?? 0) + 1;
        return result;
    }, {});
    return c.json({
        periodStart: since.toISOString(),
        requests: events.length,
        completed: events.filter((event) => event.requestStatus === 'completed').length,
        failed: events.filter((event) => event.requestStatus === 'failed').length,
        estimatedCostUsd: events.reduce((sum, event) => sum + event.estimatedCostUsdMicros, 0) / 1_000_000,
        tokens: events.reduce((sum, event) => sum + event.inputTokens + event.outputTokens + event.imageTokens, 0),
        byFeature,
    });
});

restaurant.post('/business-pulse/drafts', async (c) => {
    const actor = await restaurantActorFor(c);
    if (!canUseQ(actor)) return forbid(c, 'Q Assistant is available to restaurant management');
    const body = await parseJson<{ type?: unknown }>(c);
    const type = typeof body?.type === 'string' && qDraftTypes.includes(body.type as QDraftType)
        ? body.type as QDraftType
        : null;
    if (!type) return c.json({ error: 'Draft type must be daily_report or manager_task' }, 400);
    const snapshot = await buildBusinessPulseSnapshot(actor.businessId);
    const response = buildQPulseResponse(snapshot);
    const content = qDraftContent(type, snapshot);
    const draft = {
        id: randomUUID(),
        businessId: actor.businessId,
        createdBy: actor.userId,
        type,
        title: content.title,
        body: content.body,
        evidenceIds: response.evidenceCards.map((card) => card.id),
        status: 'pending',
    };
    await db.insert(qAssistantDrafts).values(draft);
    await logAudit(c, 'Q_DRAFT_PREPARED', 'Q_BUSINESS_PULSE', draft.id, {
        draftType: type,
        userRole: actor.role,
        evidenceIds: draft.evidenceIds,
        requiresApproval: true,
        validationStatus: 'passed',
    });
    return c.json({ draft: publicQDraft(draft) }, 201);
});

restaurant.post('/business-pulse/drafts/:id/decision', async (c) => {
    const actor = await restaurantActorFor(c);
    if (!canReviewQDraft(actor)) return forbid(c, 'Only an owner or admin can approve Q drafts');
    const body = await parseJson<{ decision?: unknown; ownerEditedBody?: unknown; approvalNote?: unknown }>(c);
    const decision = body?.decision === 'approve' || body?.decision === 'reject' ? body.decision : null;
    if (!decision) return c.json({ error: 'Decision must be approve or reject' }, 400);
    const ownerEditedBody = typeof body?.ownerEditedBody === 'string' ? body.ownerEditedBody.trim() : null;
    const approvalNote = typeof body?.approvalNote === 'string' ? body.approvalNote.trim() : null;
    if (ownerEditedBody && ownerEditedBody.length > 5000) return c.json({ error: 'Edited draft is too long' }, 400);
    if (approvalNote && approvalNote.length > 500) return c.json({ error: 'Approval note is too long' }, 400);
    const id = c.req.param('id');
    const draft = await first(db.select().from(qAssistantDrafts).where(and(
        eq(qAssistantDrafts.id, id),
        eq(qAssistantDrafts.businessId, actor.businessId),
    )));
    if (!draft) return c.json({ error: 'Draft not found' }, 404);
    if (draft.status !== 'pending') return c.json({ error: 'Draft has already been reviewed' }, 409);
    const status = decision === 'approve' ? 'approved' : 'rejected';
    const reviewedAt = new Date();
    await db.update(qAssistantDrafts).set({
        status,
        reviewedBy: actor.userId,
        ownerEditedBody: ownerEditedBody || null,
        approvalNote: approvalNote || null,
        reviewedAt,
    }).where(and(eq(qAssistantDrafts.id, id), eq(qAssistantDrafts.businessId, actor.businessId)));
    await logAudit(c, decision === 'approve' ? 'Q_DRAFT_APPROVED' : 'Q_DRAFT_REJECTED', 'Q_BUSINESS_PULSE', id, {
        userRole: actor.role,
        evidenceIds: draft.evidenceIds,
        decision,
        dispatchStatus: 'not_dispatched',
        validationStatus: 'passed',
    });
    return c.json({
        draft: publicQDraft({ ...draft, status, reviewedBy: actor.userId, reviewedAt, ownerEditedBody, approvalNote }),
        dispatched: false,
        message: 'Decision recorded. Q did not send or change anything.',
    });
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

const menuItemResponse = (item: typeof menuItems.$inferSelect, origin: string) => ({
    ...item,
    imageUrl: item.imageUrl === 'database'
        ? `${origin}/api/public/menu-items/${encodeURIComponent(item.id)}/image`
        : item.imageUrl,
});

restaurant.get('/menu', async (c) => {
    const businessId = c.get('businessId');
    const categories = await db.select().from(menuCategories)
        .where(eq(menuCategories.businessId, businessId))
        .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));
    const items = await db.select().from(menuItems)
        .where(eq(menuItems.businessId, businessId))
        .orderBy(asc(menuItems.name));
    const origin = new URL(c.req.url).origin;
    return c.json({
        categories: categories.map((category) => ({
            id: category.id,
            name: category.name,
            items: items.filter((item) => item.categoryId === category.id).map((item) => menuItemResponse(item, origin)),
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
                imageUrl: null,
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

restaurant.patch('/menu/categories/:id', async (c) => {
    const body = await parseJson<{ name?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 80) return c.json({ error: 'Category name is required and must be 80 characters or fewer' }, 400);
    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const current = await first(db.select().from(menuCategories).where(and(eq(menuCategories.id, id), eq(menuCategories.businessId, businessId))));
    if (!current) return c.json({ error: 'Category not found' }, 404);
    const duplicate = await first(db.select().from(menuCategories).where(and(
        eq(menuCategories.businessId, businessId), eq(menuCategories.menuId, current.menuId), eq(menuCategories.name, name),
    )));
    if (duplicate && duplicate.id !== id) return c.json({ error: 'Category already exists' }, 409);
    const rows = await db.update(menuCategories).set({ name }).where(and(eq(menuCategories.id, id), eq(menuCategories.businessId, businessId))).returning();
    await logAudit(c, 'RESTAURANT_MENU_CATEGORY_UPDATED', 'MENU_CATEGORY', id, { name });
    return c.json({ id: rows[0].id, name: rows[0].name, items: [] });
});

restaurant.delete('/menu/categories/:id', async (c) => {
    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const current = await first(db.select().from(menuCategories).where(and(
        eq(menuCategories.id, id), eq(menuCategories.businessId, businessId),
    )));
    if (!current) return c.json({ error: 'Category not found' }, 404);
    const item = await first(db.select({ id: menuItems.id }).from(menuItems).where(and(
        eq(menuItems.categoryId, id), eq(menuItems.businessId, businessId),
    )));
    if (item) return c.json({ error: 'Move or remove this category’s menu items first' }, 409);
    await db.delete(menuCategories).where(and(eq(menuCategories.id, id), eq(menuCategories.businessId, businessId)));
    await logAudit(c, 'RESTAURANT_MENU_CATEGORY_DELETED', 'MENU_CATEGORY', id, { name: current.name });
    return c.json({ deleted: true });
});

restaurant.patch('/menu/items/:id', async (c) => {
    const body = await parseJson<{ name?: unknown; description?: unknown; price?: unknown; categoryId?: unknown; isAvailable?: unknown; prepTimeMinutes?: unknown; imageUrl?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const current = await first(db.select().from(menuItems).where(and(eq(menuItems.id, id), eq(menuItems.businessId, businessId))));
    if (!current) return c.json({ error: 'Menu item not found' }, 404);
    const name = body.name === undefined ? current.name : typeof body.name === 'string' ? body.name.trim() : '';
    const price = body.price === undefined ? current.price : typeof body.price === 'number' && Number.isFinite(body.price) && body.price > 0 ? Math.round(body.price * 100) : 0;
    const prepTimeMinutes = body.prepTimeMinutes === undefined ? current.prepTimeMinutes : typeof body.prepTimeMinutes === 'number' ? body.prepTimeMinutes : Number.NaN;
    const categoryId = body.categoryId === undefined ? current.categoryId : typeof body.categoryId === 'string' ? body.categoryId : '';
    if (!name || name.length > 120) return c.json({ error: 'Item name is required and must be 120 characters or fewer' }, 400);
    if (price <= 0) return c.json({ error: 'Price must be greater than 0' }, 400);
    if (!Number.isSafeInteger(prepTimeMinutes) || prepTimeMinutes < 0 || prepTimeMinutes > 480) return c.json({ error: 'Preparation time must be from 0 to 480 minutes' }, 400);
    const category = await first(db.select().from(menuCategories).where(and(eq(menuCategories.id, categoryId), eq(menuCategories.businessId, businessId))));
    if (!category) return c.json({ error: 'Category not found' }, 404);
    const description = body.description === undefined ? current.description : typeof body.description === 'string' ? body.description.trim() || null : null;
    const imageUrl = body.imageUrl === undefined ? current.imageUrl : typeof body.imageUrl === 'string' ? body.imageUrl.trim() || null : null;
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) return c.json({ error: 'Item image must use an HTTPS URL' }, 400);
    const isAvailable = body.isAvailable === undefined ? current.isAvailable : body.isAvailable;
    if (typeof isAvailable !== 'boolean') return c.json({ error: 'Availability must be true or false' }, 400);
    const rows = await db.update(menuItems).set({ name, description, imageUrl, price, categoryId, isAvailable, prepTimeMinutes })
        .where(and(eq(menuItems.id, id), eq(menuItems.businessId, businessId))).returning();
    await logAudit(c, 'RESTAURANT_MENU_ITEM_UPDATED', 'MENU_ITEM', id, { isAvailable, categoryId });
    return c.json(menuItemResponse(rows[0], new URL(c.req.url).origin));
});

restaurant.post('/menu/items/:id/image', async (c) => {
    const businessId = c.get('businessId');
    const id = c.req.param('id');
    const item = await first(db.select().from(menuItems).where(and(
        eq(menuItems.id, id), eq(menuItems.businessId, businessId),
    )));
    if (!item) return c.json({ error: 'Menu item not found' }, 404);

    let form: FormData;
    try { form = await c.req.formData(); }
    catch { return c.json({ error: 'Invalid image upload' }, 400); }
    const image = form.get('image');
    if (!(image instanceof File)) return c.json({ error: 'Image file is required' }, 400);
    if (!menuImageTypes.has(image.type)) return c.json({ error: 'Use a PNG, JPEG, or WebP image' }, 400);
    if (image.size < 1 || image.size > maxMenuImageBytes) return c.json({ error: 'Image must be no larger than 2 MB' }, 400);

    const dataBase64 = Buffer.from(await image.arrayBuffer()).toString('base64');
    const existing = await first(db.select().from(menuItemAssets).where(and(
        eq(menuItemAssets.itemId, id), eq(menuItemAssets.businessId, businessId),
    )));
    if (existing) {
        await db.update(menuItemAssets).set({ mimeType: image.type, dataBase64, updatedAt: new Date() })
            .where(and(eq(menuItemAssets.itemId, id), eq(menuItemAssets.businessId, businessId)));
    } else {
        await db.insert(menuItemAssets).values({ itemId: id, businessId, mimeType: image.type, dataBase64 });
    }
    const rows = await db.update(menuItems).set({ imageUrl: 'database' })
        .where(and(eq(menuItems.id, id), eq(menuItems.businessId, businessId))).returning();
    await logAudit(c, 'RESTAURANT_MENU_ITEM_IMAGE_UPDATED', 'MENU_ITEM', id, { mimeType: image.type, size: image.size });
    return c.json(menuItemResponse(rows[0], new URL(c.req.url).origin));
});

restaurant.get('/tables', async (c) => {
    return c.json(await db.select().from(restaurantTables)
        .where(eq(restaurantTables.businessId, c.get('businessId')))
        .orderBy(asc(restaurantTables.label)));
});

restaurant.get('/bookings', async (c) => {
    if (!await isBusinessModuleEnabled(c.get('businessId'), 'restaurant', 'tables')) {
        return c.json({ error: 'Tables module is disabled for this business' }, 409);
    }
    const rawFrom = c.req.query('from');
    const rawTo = c.req.query('to');
    const from = rawFrom ? new Date(rawFrom) : new Date();
    const to = rawTo ? new Date(rawTo) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
        return c.json({ error: 'Use a valid booking date range' }, 400);
    }
    const rows = await db.select().from(restaurantBookings).where(and(
        eq(restaurantBookings.businessId, c.get('businessId')),
        gte(restaurantBookings.startsAt, from),
        lt(restaurantBookings.startsAt, to),
    )).orderBy(asc(restaurantBookings.startsAt));
    return c.json(rows.map(bookingPublic));
});

restaurant.post('/bookings', async (c) => {
    if (!await isBusinessModuleEnabled(c.get('businessId'), 'restaurant', 'tables')) {
        return c.json({ error: 'Tables module is disabled for this business' }, 409);
    }
    const actor = await restaurantActorFor(c);
    if (!(canUseQ(actor) || actor.role === 'waiter')) return forbid(c, 'Restaurant management or floor staff can create bookings');
    const body = await parseJson<{
        customerId?: unknown; customerName?: unknown; customerPhone?: unknown; partySize?: unknown;
        startsAt?: unknown; endsAt?: unknown; tableIds?: unknown; occasion?: unknown; notes?: unknown; depositAmount?: unknown;
    }>(c);
    if (!body) return c.json({ error: 'Invalid booking data' }, 400);
    const customerName = bookingText(body.customerName, 160);
    const customerPhone = bookingText(body.customerPhone, 60);
    const occasion = bookingText(body.occasion, 100);
    const notes = bookingText(body.notes, 1000);
    if (customerName.error || customerPhone.error || occasion.error || notes.error) {
        return c.json({ error: customerName.error || customerPhone.error || occasion.error || notes.error }, 400);
    }
    if (!customerName.value) return c.json({ error: 'Customer name is required' }, 400);
    if (typeof body.partySize !== 'number' || !Number.isSafeInteger(body.partySize) || body.partySize < 1 || body.partySize > 100) {
        return c.json({ error: 'Party size must be a whole number from 1 to 100' }, 400);
    }
    if (typeof body.startsAt !== 'string' || typeof body.endsAt !== 'string') return c.json({ error: 'Booking start and end time are required' }, 400);
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 12 * 60 * 60 * 1000) {
        return c.json({ error: 'Use a valid booking time of up to 12 hours' }, 400);
    }
    if (!Array.isArray(body.tableIds) || body.tableIds.length === 0 || body.tableIds.some((id) => typeof id !== 'string')) {
        return c.json({ error: 'Select at least one table' }, 400);
    }
    const tableIds = [...new Set(body.tableIds.map((id) => id.trim()).filter(Boolean))];
    if (tableIds.length === 0 || tableIds.length > 12) return c.json({ error: 'Select between 1 and 12 tables' }, 400);
    const businessId = actor.businessId;
    const tables = await db.select().from(restaurantTables).where(and(
        eq(restaurantTables.businessId, businessId), inArray(restaurantTables.id, tableIds),
    ));
    if (tables.length !== tableIds.length) return c.json({ error: 'One or more selected tables are unavailable' }, 400);
    if (tables.reduce((sum, table) => sum + table.capacity, 0) < body.partySize) return c.json({ error: 'Selected tables do not have enough seats' }, 400);
    const conflict = await bookingsConflict(businessId, startsAt, endsAt, tableIds);
    if (conflict) return c.json({ error: `Table conflict with ${conflict.customerName}'s ${conflict.startsAt.toISOString()} booking` }, 409);
    const depositAmount = typeof body.depositAmount === 'number' && Number.isFinite(body.depositAmount) && body.depositAmount >= 0 ? body.depositAmount : 0;
    const booking = {
        id: randomUUID(), businessId, customerId: typeof body.customerId === 'string' ? body.customerId : null,
        customerName: customerName.value, customerPhone: customerPhone.value, partySize: body.partySize,
        startsAt, endsAt, tableIds, status: 'pending' as const, occasion: occasion.value, notes: notes.value,
        depositAmount, createdBy: actor.userId, updatedBy: actor.userId,
    };
    await db.insert(restaurantBookings).values(booking);
    await logAudit(c, 'RESTAURANT_BOOKING_CREATED', 'RESTAURANT_BOOKING', booking.id, { partySize: booking.partySize, tableCount: tableIds.length, status: booking.status });
    const saved = await first(db.select().from(restaurantBookings).where(and(eq(restaurantBookings.id, booking.id), eq(restaurantBookings.businessId, businessId))));
    return c.json(bookingPublic(saved!), 201);
});

restaurant.patch('/bookings/:id', async (c) => {
    if (!await isBusinessModuleEnabled(c.get('businessId'), 'restaurant', 'tables')) {
        return c.json({ error: 'Tables module is disabled for this business' }, 409);
    }
    const actor = await restaurantActorFor(c);
    if (!(canUseQ(actor) || actor.role === 'waiter')) return forbid(c, 'Restaurant management or floor staff can update bookings');
    const body = await parseJson<{ status?: unknown; notes?: unknown; occasion?: unknown; depositAmount?: unknown }>(c);
    if (!body) return c.json({ error: 'Invalid booking data' }, 400);
    const id = c.req.param('id');
    const current = await first(db.select().from(restaurantBookings).where(and(eq(restaurantBookings.id, id), eq(restaurantBookings.businessId, actor.businessId))));
    if (!current) return c.json({ error: 'Booking not found' }, 404);
    const status = body.status === undefined ? current.status : typeof body.status === 'string' && bookingStatuses.includes(body.status as BookingStatus) ? body.status as BookingStatus : null;
    if (!status) return c.json({ error: 'Invalid booking status' }, 400);
    const notes = bookingText(body.notes, 1000);
    const occasion = bookingText(body.occasion, 100);
    if (notes.error || occasion.error) return c.json({ error: notes.error || occasion.error }, 400);
    const depositAmount = body.depositAmount === undefined ? current.depositAmount : typeof body.depositAmount === 'number' && Number.isFinite(body.depositAmount) && body.depositAmount >= 0 ? body.depositAmount : null;
    if (depositAmount === null) return c.json({ error: 'Deposit must be a positive amount' }, 400);
    await db.update(restaurantBookings).set({
        status, notes: body.notes === undefined ? current.notes : notes.value, occasion: body.occasion === undefined ? current.occasion : occasion.value,
        depositAmount, updatedBy: actor.userId, updatedAt: new Date(),
    }).where(and(eq(restaurantBookings.id, id), eq(restaurantBookings.businessId, actor.businessId)));
    await logAudit(c, 'RESTAURANT_BOOKING_UPDATED', 'RESTAURANT_BOOKING', id, { status, updatedByRole: actor.role ?? 'legacy_owner' });
    const saved = await first(db.select().from(restaurantBookings).where(and(eq(restaurantBookings.id, id), eq(restaurantBookings.businessId, actor.businessId))));
    return c.json(bookingPublic(saved!));
});

restaurant.post('/tables', async (c) => {
    if (!await isBusinessModuleEnabled(c.get('businessId'), 'restaurant', 'tables')) {
        return c.json({ error: 'Tables module is disabled for this business' }, 409);
    }
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
    if (!await isBusinessModuleEnabled(c.get('businessId'), 'restaurant', 'tables')) {
        return c.json({ error: 'Tables module is disabled for this business' }, 409);
    }
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
        customerId?: unknown; customer_id?: unknown;
        customerName?: unknown; customer_name?: unknown;
        customerPhone?: unknown; customer_phone?: unknown;
        deliveryAddress?: unknown; delivery_address?: unknown;
        deliveryNotes?: unknown; delivery_notes?: unknown;
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
        return c.json({ error: 'Pay-now takeaway and delivery orders cannot have a table' }, 409);
    }
    const requestedOrderType = body.orderType ?? body.order_type;
    if (requestedOrderType !== undefined && requestedOrderType !== 'takeaway' && requestedOrderType !== 'delivery') {
        return c.json({ error: 'Dine-in pay-now is not allowed' }, 409);
    }
    const orderType: OrderType = requestedOrderType === 'delivery' ? 'delivery' : 'takeaway';
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
    const customerResult = await customerSnapshotFor(body, businessId, orderType);
    if (!customerResult.snapshot) return c.json({ error: customerResult.error }, customerResult.status);
    const customerSnapshot = customerResult.snapshot;
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
    let createdTotalCents = 0;
    let createdOrderRecord: typeof restaurantOrders.$inferSelect | null = null;
    let createdItemRecords: typeof restaurantOrderItems.$inferSelect[] = [];
    let createdPaymentRecord: typeof restaurantPayments.$inferSelect | null = null;
    let createdTicketRecord: typeof kdsTickets.$inferSelect | null = null;
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
                    const requestedMenuItemIds = Array.from(requests.keys());
                    const menuItemsForOrder = await tx.select().from(menuItems)
                        .where(and(
                            eq(menuItems.businessId, businessId),
                            inArray(menuItems.id, requestedMenuItemIds),
                        ));
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
                    createdTotalCents = total;
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
                    const insertedOrders = await tx.insert(restaurantOrders).values({
                        id: orderId,
                        businessId,
                        visibleOrderNumber,
                        orderNumberDate,
                        tableId: null,
                        status: 'pending',
                        orderType,
                        ...customerSnapshot,
                        serviceStatus: 'pending',
                        paymentStatus: 'paid',
                        paymentTiming: 'pay_before_service',
                        idempotencyKey,
                        createdBy: c.get('userId'),
                        total,
                        createdAt: now,
                        updatedAt: now,
                    }).returning();
                    createdOrderRecord = insertedOrders[0] ?? null;
                    createdItemRecords = await tx.insert(restaurantOrderItems).values(canonicalItems.map((entry) => ({
                        id: randomUUID(),
                        orderId,
                        menuItemId: entry.item.id,
                        name: entry.item.name,
                        quantity: entry.quantity,
                        unitPrice: entry.item.price,
                        notes: entry.notes,
                        status: 'pending' as const,
                    }))).returning();
                    orderWriteDurationMs += durationSince(orderWriteStartedAt);
                    const paymentWriteStartedAt = timingNow();
                    const insertedPayments = await tx.insert(restaurantPayments).values({
                        id: randomUUID(),
                        businessId,
                        orderId,
                        method: paymentMethodValue as 'cash' | 'card' | 'manual',
                        amount,
                        status: 'completed',
                        paidAt: now,
                    }).returning();
                    createdPaymentRecord = insertedPayments[0] ?? null;
                    paymentWriteDurationMs += durationSince(paymentWriteStartedAt);
                    const kdsWriteStartedAt = timingNow();
                    const insertedTickets = await tx.insert(kdsTickets).values({
                        id: randomUUID(),
                        orderId,
                        businessId,
                        status: 'new',
                        createdAt: now,
                        completedAt: null,
                    }).returning();
                    createdTicketRecord = insertedTickets[0] ?? null;
                    kdsWriteDurationMs += durationSince(kdsWriteStartedAt);
                });
                created = true;
            } catch (error) {
                if (isUniqueOrderNumberConflict(error) && attempt < 4) continue;
                throw error;
            }
        }
        await Promise.all([
            logAudit(c, 'RESTAURANT_ORDER_CREATED', 'RESTAURANT_ORDER', orderId, {
                orderType,
                paymentTiming: 'pay_before_service',
                tableId: null,
                idempotencyKey: Boolean(idempotencyKey),
            }),
            logAudit(c, 'RESTAURANT_ORDER_PAYMENT_COMPLETED', 'RESTAURANT_ORDER', orderId, {
                method: paymentMethodValue,
                amount: createdTotalCents / 100,
                orderType,
                paymentTiming: 'pay_before_service',
                integratedPayNow: true,
            }),
        ]);
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
    if (!createdOrderRecord || !createdPaymentRecord) {
        throw new Error('Created pay-now records were not returned by the database');
    }
    const ticketRecord = createdTicketRecord as typeof kdsTickets.$inferSelect | null;
    const createdOrder = orderResponse(createdOrderRecord, createdItemRecords, [createdPaymentRecord]);
    const response = {
        order: createdOrder,
        payment: integratedPaymentSummary(createdPaymentRecord, cashReceived, changeDue),
        kitchen: {
            ticket: ticketRecord ? {
                ...ticketRecord,
                order: kitchenOrderPayload(createdOrderRecord, createdItemRecords),
                tableLabel: null,
            } : null,
        },
        visibleOrderNumber: createdOrder.visibleOrderNumber,
        displayOrderNumber: createdOrder.displayOrderNumber,
        nextAction: 'sent_to_kitchen' as const,
    };
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
        orderType,
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
        customerId?: unknown; customer_id?: unknown;
        customerName?: unknown; customer_name?: unknown;
        customerPhone?: unknown; customer_phone?: unknown;
        deliveryAddress?: unknown; delivery_address?: unknown;
        deliveryNotes?: unknown; delivery_notes?: unknown;
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
        return c.json({ error: 'Order type must be dine_in, takeaway, or delivery' }, 400);
    }
    const orderType: OrderType = typeof requestedOrderType === 'string'
        ? requestedOrderType as OrderType
        : typeof tableId === 'string' ? 'dine_in' : 'takeaway';
    if (orderType === 'dine_in' && !await isBusinessModuleEnabled(c.get('businessId'), 'restaurant', 'tables')) {
        return c.json({ error: 'Dine-in orders are unavailable while Tables is disabled' }, 409);
    }
    if ((orderType === 'takeaway' || orderType === 'delivery') && typeof tableId === 'string') {
        return c.json({ error: 'Takeaway and delivery orders cannot have a table' }, 400);
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
    const customerResult = await customerSnapshotFor(body, businessId, orderType);
    if (!customerResult.snapshot) return c.json({ error: customerResult.error }, customerResult.status);
    const customerSnapshot = customerResult.snapshot;
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
    let createdOrderRecord: typeof restaurantOrders.$inferSelect | null = null;
    let createdItemRecords: typeof restaurantOrderItems.$inferSelect[] = [];
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
                    const insertedOrders = await tx.insert(restaurantOrders).values({
                        id: orderId,
                        businessId,
                        visibleOrderNumber,
                        orderNumberDate,
                        tableId: typeof tableId === 'string' ? tableId : null,
                        status: 'pending',
                        orderType,
                        ...customerSnapshot,
                        serviceStatus: 'pending',
                        paymentStatus: 'unpaid',
                        paymentTiming,
                        idempotencyKey,
                        createdBy: c.get('userId'),
                        total,
                        createdAt: now,
                        updatedAt: now,
                    }).returning();
                    createdOrderRecord = insertedOrders[0] ?? null;
                    orderInsertDurationMs += durationSince(orderInsertStartedAt);
                    const orderItemInsertStartedAt = timingNow();
                    createdItemRecords = await tx.insert(restaurantOrderItems).values(canonicalItems.map((entry) => ({
                        id: randomUUID(),
                        orderId,
                        menuItemId: entry.item.id,
                        name: entry.item.name,
                        quantity: entry.quantity,
                        unitPrice: entry.item.price,
                        notes: entry.notes,
                        status: 'pending' as const,
                    }))).returning();
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
    const auditLogInsertStartedAt = timingNow();
    const auditPromise = logAudit(c, 'RESTAURANT_ORDER_CREATED', 'RESTAURANT_ORDER', orderId, {
        orderType,
        paymentTiming,
        tableId: typeof tableId === 'string' ? tableId : null,
        idempotencyKey: Boolean(idempotencyKey),
        customerLinked: Boolean(customerSnapshot.customerId),
    }).finally(() => {
        auditLogInsertDurationMs += durationSince(auditLogInsertStartedAt);
    });
    await auditPromise;
    if (!createdOrderRecord) throw new Error('Created order was not returned by the database');
    const response = orderResponse(createdOrderRecord, createdItemRecords, []);
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
            customerId: order.customerId,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            deliveryAddress: order.deliveryAddress,
            deliveryNotes: order.deliveryNotes,
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
            deliveryOrders: reportOrders.filter((order) => order.orderType === 'delivery').length,
        },
        statusBreakdown,
        recentOrders: reportOrders.slice(0, 10),
    });
});

restaurant.get('/reports/summary', async (c) => {
    const from = c.req.query('from') || '';
    const to = c.req.query('to') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return c.json({ error: 'From and to dates are required' }, 400);
    const start = new Date(`${from}T00:00:00.000Z`);
    const inclusiveEnd = new Date(`${to}T00:00:00.000Z`);
    const end = new Date(inclusiveEnd.getTime() + 86_400_000);
    const days = (end.getTime() - start.getTime()) / 86_400_000;
    if (!Number.isFinite(days) || days < 1 || days > 366) return c.json({ error: 'Date range must be from 1 to 366 days' }, 400);
    const businessId = c.get('businessId');
    const orders = await db.select().from(restaurantOrders).where(and(eq(restaurantOrders.businessId, businessId), gte(restaurantOrders.createdAt, start), lt(restaurantOrders.createdAt, end))).orderBy(desc(restaurantOrders.createdAt));
    const orderIds = orders.map(order => order.id);
    const items = orderIds.length ? await db.select().from(restaurantOrderItems).where(inArray(restaurantOrderItems.orderId, orderIds)) : [];
    const payments = orderIds.length ? await db.select().from(restaurantPayments).where(and(eq(restaurantPayments.businessId, businessId), inArray(restaurantPayments.orderId, orderIds), eq(restaurantPayments.status, 'completed'))) : [];
    const paidOrderIds = new Set(payments.map(payment => payment.orderId));
    const paidRevenueCents = Math.round(payments.reduce((sum, payment) => sum + payment.amount * 100, 0));
    const serviceBreakdown = { dineIn: 0, takeaway: 0, delivery: 0 };
    const statusBreakdown: Record<string, number> = {};
    const dailySales: Record<string, { date: string; orders: number; revenueCents: number }> = {};
    for (const order of orders) {
        const orderType = orderTypeFor(order); serviceBreakdown[orderType === 'dine_in' ? 'dineIn' : orderType === 'delivery' ? 'delivery' : 'takeaway'] += 1;
        const status = legacyStatusFor(orderType, serviceStatusFor(order), paymentStatusFor(order)); statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
        const date = order.createdAt.toISOString().slice(0, 10); dailySales[date] ||= { date, orders: 0, revenueCents: 0 }; dailySales[date].orders += 1;
        if (paidOrderIds.has(order.id)) dailySales[date].revenueCents += order.total;
    }
    const paymentBreakdown: Record<string, { method: string; count: number; amountCents: number }> = {};
    for (const payment of payments) { paymentBreakdown[payment.method] ||= { method: payment.method, count: 0, amountCents: 0 }; paymentBreakdown[payment.method].count += 1; paymentBreakdown[payment.method].amountCents += Math.round(payment.amount * 100); }
    const topItems: Record<string, { name: string; quantity: number; revenueCents: number }> = {};
    for (const item of items) { topItems[item.name] ||= { name: item.name, quantity: 0, revenueCents: 0 }; topItems[item.name].quantity += item.quantity; topItems[item.name].revenueCents += item.quantity * item.unitPrice; }
    return c.json({
        from, to,
        summary: { totalOrders: orders.length, paidOrders: paidOrderIds.size, openOrders: orders.filter(order => paymentStatusFor(order) !== 'paid' && serviceStatusFor(order) !== 'cancelled').length, cancelledOrders: orders.filter(order => serviceStatusFor(order) === 'cancelled').length, paidRevenueCents, averagePaidOrderCents: paidOrderIds.size ? Math.round(paidRevenueCents / paidOrderIds.size) : 0 },
        serviceBreakdown, statusBreakdown, paymentBreakdown: Object.values(paymentBreakdown), topItems: Object.values(topItems).sort((a,b)=>b.quantity-a.quantity).slice(0,10), dailySales: Object.values(dailySales).sort((a,b)=>a.date.localeCompare(b.date)),
        recentOrders: orders.slice(0,50).map(order => ({ id: order.id, displayOrderNumber: displayOrderNumberFor(order), orderType: orderTypeFor(order), status: legacyStatusFor(orderTypeFor(order), serviceStatusFor(order), paymentStatusFor(order)), paymentStatus: paymentStatusFor(order), total: order.total, createdAt: order.createdAt, customerId: order.customerId, customerName: order.customerName, customerPhone: order.customerPhone, deliveryAddress: order.deliveryAddress, deliveryNotes: order.deliveryNotes })),
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
    if (orderType === 'delivery' && !canPerformRestaurantAction(actor, 'mark_delivered', order)) return forbid(c);
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
    if (body.status !== 'cooking' && body.status !== 'done') {
        return c.json({ error: 'Kitchen status must be cooking or done' }, 409);
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
    if (body.status === 'cooking' && ticket.status === 'cooking' && currentServiceStatus === 'in_kitchen') {
        return c.json(await kdsTicketWithOrder(businessId, id));
    }
    if (body.status === 'cooking' && (ticket.status === 'done' || currentServiceStatus !== 'pending')) {
        return c.json({ error: 'Only new kitchen orders can start preparation' }, 409);
    }
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
    const nextServiceStatus = body.status === 'done' ? 'ready' : 'in_kitchen';
    await logAudit(c, body.status === 'done' ? 'RESTAURANT_KDS_TICKET_READY' : 'RESTAURANT_KDS_TICKET_PREPARING', 'RESTAURANT_KDS_TICKET', id, {
        orderId: ticket.orderId,
        previousServiceStatus: currentServiceStatus,
        nextServiceStatus,
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
