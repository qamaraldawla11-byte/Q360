import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import {
    auditLogs,
    businesses,
    businessModules,
    customers,
    kdsTickets,
    purchaseExpenseRecords,
    qAssistantDrafts,
    qBusinessMemories,
    qUsageEvents,
    quoteItems,
    quotes,
    restaurantOrders,
    restaurantPayments,
    restaurantTables,
    users,
} from '../db/schema.js';
import type {
    BriefConfidence,
    BriefSensitivity,
    FounderBriefEvidence,
    FounderBriefSection,
    FounderDailyBrief,
} from '../types/founderBrief.js';

// Q360-QB-M4-S2: deterministic Founder Daily Brief aggregation.
//
// Guarantees:
// - tenant scope is the server-derived businessId argument on EVERY query;
// - read-only: this module performs SELECT queries only;
// - deterministic: same data produces the same facts; no AI-provider call,
//   no randomness, no model-generated prose;
// - unavailable sources become explicit unknowns, never fabricated zeros;
// - text from business data is sanitized (control/format characters removed,
//   whitespace normalized, length-capped) and carried only in displayText.

export const FOUNDER_BRIEF_SOURCE_CATEGORIES = [
    'business_profile',
    'users_staff',
    'customers',
    'quotes',
    'restaurant_operations',
    'purchases_expenses',
    'q_usage',
    'q_assistant_drafts',
    'q_business_memories',
    'audit_metadata',
] as const;

const NAME_MAX = 120;
const TEXT_MAX = 280;
const DAY_MS = 24 * 60 * 60 * 1000;

// C0/C1 controls, soft hyphen, zero-width characters, bidi control characters,
// word joiners, BOM and interlinear annotation anchors. These can smuggle
// invisible instructions or flip display order, so they are always removed.
// eslint-disable-next-line no-control-regex
const UNSAFE_TEXT_CHARS = /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]/g;

type SanitizedText = { text: string | null; truncated: boolean };

const sanitizeText = (raw: string | null | undefined, max: number): SanitizedText => {
    if (raw == null) return { text: null, truncated: false };
    const cleaned = raw.replace(UNSAFE_TEXT_CHARS, '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return { text: null, truncated: false };
    if (cleaned.length <= max) return { text: cleaned, truncated: false };
    return { text: `${cleaned.slice(0, max)}…`, truncated: true };
};

const sanitizeName = (raw: string | null | undefined) => sanitizeText(raw, NAME_MAX);
const sanitizeFreeText = (raw: string | null | undefined) => sanitizeText(raw, TEXT_MAX);

// --- Money normalization ----------------------------------------------------
// This baseline mixes money representations. They are never combined across
// sources; every money fact is labelled with the representation it came from.
// - quotes.*                     -> major-unit doubles
// - restaurant_payments.amount   -> major-unit doubles
// - restaurant_orders.total      -> integer minor units
// - purchase_expense_records     -> integer minor units (amount_minor)
// - q_usage_events cost          -> USD micros, explicitly estimated

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const majorUnitsLabel = (amount: number, currency: string) =>
    `${currency} ${round2(amount).toFixed(2)} (major units)`;

const minorUnitsLabel = (amountMinor: number, currency: string) =>
    `${currency} ${(amountMinor / 100).toFixed(2)} (converted from minor units)`;

const estimatedCostLabel = (usd: number) => `USD ${usd.toFixed(6)} (estimated)`;

// --- Internal helpers --------------------------------------------------------

type BriefContext = {
    businessId: string;
    observedAt: string;
};

type EvidenceDraft = {
    sourceType: string;
    fact: string;
    provenance: string;
    sourceId?: string | null;
    value?: number | string | null;
    sensitivity?: BriefSensitivity;
    confidence?: BriefConfidence;
    displayText?: string | null;
    truncated?: boolean;
};

const makeEvidence = (ctx: BriefContext, draft: EvidenceDraft): FounderBriefEvidence => ({
    sourceType: draft.sourceType,
    sourceId: draft.sourceId ?? null,
    businessId: ctx.businessId,
    observedAt: ctx.observedAt,
    fact: draft.fact,
    value: draft.value ?? null,
    sensitivity: draft.sensitivity ?? 'low',
    confidence: draft.confidence ?? 'high',
    provenance: draft.provenance,
    displayText: draft.displayText ?? undefined,
    truncated: draft.truncated || undefined,
});

const newSection = (key: string, title: string): FounderBriefSection => ({
    key,
    title,
    status: 'supported',
    facts: [],
    unknowns: [],
});

// 'unavailable' and 'postponed' are set explicitly by section builders and are
// never overridden here; anything else degrades to 'partial' when unknowns exist.
const withDerivedStatus = (section: FounderBriefSection): FounderBriefSection => {
    if (section.status !== 'unavailable' && section.status !== 'postponed') {
        section.status = section.unknowns.length > 0 ? 'partial' : 'supported';
    }
    return section;
};

const SOURCE_FAILURE_REASON = 'Source unavailable; reported as unknown instead of a fabricated zero.';

const noteSourceFailure = (section: FounderBriefSection, sourceLabel: string, error: unknown) => {
    console.error(`[FOUNDER_BRIEF] Source unavailable: ${sourceLabel}`, error);
    section.unknowns.push({ fact: sourceLabel, unknownReason: SOURCE_FAILURE_REASON });
};

type BusinessProfileRow = {
    id: string;
    name: string;
    type: string | null;
    currency: string | null;
    timezone: string | null;
    status: string | null;
};

const fetchBusinessProfile = async (businessId: string) => {
    try {
        const profile = await first(db.select({
            id: businesses.id,
            name: businesses.name,
            type: businesses.type,
            currency: businesses.currency,
            timezone: businesses.timezone,
            status: businesses.status,
        }).from(businesses).where(eq(businesses.id, businessId)));
        return { profile, failed: false };
    } catch (error) {
        console.error('[FOUNDER_BRIEF] Source unavailable: business_profile', error);
        return { profile: undefined, failed: true };
    }
};

// --- Section builders ---------------------------------------------------------

const buildBusinessHealthSection = async (
    ctx: BriefContext,
    profile: BusinessProfileRow | undefined,
    profileFailed: boolean,
): Promise<FounderBriefSection> => {
    const section = newSection('business_platform_health', 'Business and Platform Health');

    if (profileFailed) {
        section.unknowns.push({ fact: 'business_profile', unknownReason: SOURCE_FAILURE_REASON });
    } else if (!profile) {
        section.unknowns.push({ fact: 'business_profile', unknownReason: 'No business profile row exists for this tenant.' });
    } else {
        const name = sanitizeName(profile.name);
        if (name.text) {
            section.facts.push(makeEvidence(ctx, {
                sourceType: 'business_profile',
                sourceId: profile.id,
                fact: 'business_name',
                provenance: 'db:businesses.row',
                sensitivity: 'medium',
                displayText: name.text,
                truncated: name.truncated,
            }));
        }
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'business_profile', sourceId: profile.id,
            fact: 'business_type', value: profile.type ?? 'unknown', provenance: 'db:businesses.row',
        }));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'business_profile', sourceId: profile.id,
            fact: 'business_status', value: profile.status ?? 'unknown', provenance: 'db:businesses.row',
        }));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'business_profile', sourceId: profile.id,
            fact: 'business_currency', value: profile.currency ?? 'USD', provenance: 'db:businesses.row',
        }));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'business_profile', sourceId: profile.id,
            fact: 'business_timezone', value: profile.timezone ?? 'UTC', provenance: 'db:businesses.row',
        }));
    }

    try {
        const rows = await db.select({
            id: users.id,
            role: users.role,
            status: users.status,
            isLocked: users.isLocked,
        }).from(users).where(eq(users.businessId, ctx.businessId));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'users_staff', fact: 'users_total', value: rows.length, provenance: 'db:users.count',
        }));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'users_staff',
            fact: 'users_active',
            value: rows.filter((row) => row.status === 'active').length,
            provenance: 'db:users.count',
        }));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'users_staff',
            fact: 'users_locked',
            value: rows.filter((row) => row.isLocked === true).length,
            provenance: 'db:users.count',
        }));
        const byRole = new Map<string, number>();
        for (const row of rows) {
            const role = row.role ?? 'unknown';
            byRole.set(role, (byRole.get(role) ?? 0) + 1);
        }
        const roleSummary = [...byRole.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([role, count]) => `${role}:${count}`)
            .join(' ');
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'users_staff',
            fact: 'users_by_role',
            value: roleSummary || 'none',
            provenance: 'db:users.count',
        }));
    } catch (error) {
        noteSourceFailure(section, 'users_staff', error);
    }

    try {
        const enabledModules = await db.select({ id: businessModules.id })
            .from(businessModules)
            .where(and(eq(businessModules.businessId, ctx.businessId), eq(businessModules.enabled, true)));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'business_profile',
            fact: 'enabled_modules',
            value: enabledModules.length,
            provenance: 'db:business_modules.count',
        }));
    } catch (error) {
        noteSourceFailure(section, 'business_modules', error);
    }

    try {
        const memory = await first(db.select({
            id: qBusinessMemories.id,
            updatedAt: qBusinessMemories.updatedAt,
        }).from(qBusinessMemories).where(eq(qBusinessMemories.businessId, ctx.businessId)));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'q_business_memories',
            fact: 'q_business_memory_present',
            value: memory ? 'yes' : 'no',
            provenance: 'db:q_business_memories.row',
        }));
        if (memory?.updatedAt) {
            section.facts.push(makeEvidence(ctx, {
                sourceType: 'q_business_memories',
                sourceId: memory.id,
                fact: 'q_business_memory_updated_at',
                value: memory.updatedAt.toISOString(),
                provenance: 'db:q_business_memories.row',
            }));
        }
    } catch (error) {
        noteSourceFailure(section, 'q_business_memories', error);
    }

    // Real infrastructure readiness (uptime, host health, deployment state) has
    // no structured source in this baseline and must remain unknown.
    section.unknowns.push({
        fact: 'infrastructure_readiness',
        unknownReason: 'No structured infrastructure readiness source is integrated at this baseline.',
    });

    return withDerivedStatus(section);
};

const buildCustomerSignalsSection = async (ctx: BriefContext, since30d: Date): Promise<FounderBriefSection> => {
    const section = newSection('customer_signals', 'Customer Signals');
    try {
        // Explicit non-PII columns only: identifiers, lifecycle status and timestamps.
        // status is the single source of truth for active vs archived; archivedAt is
        // not used as a count filter because status already captures the lifecycle.
        const rows = await db.select({
            id: customers.id,
            status: customers.status,
            createdAt: customers.createdAt,
        }).from(customers).where(eq(customers.businessId, ctx.businessId));

        const activeRows = rows.filter((row) => row.status === 'active');
        const archivedRows = rows.filter((row) => row.status === 'archived');
        const unrecognizedRows = rows.filter(
            (row) => row.status !== 'active' && row.status !== 'archived',
        );

        section.facts.push(makeEvidence(ctx, {
            sourceType: 'customers', fact: 'customers_active_total', value: activeRows.length, provenance: 'db:customers.count',
        }));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'customers', fact: 'customers_archived_total', value: archivedRows.length, provenance: 'db:customers.count',
        }));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'customers',
            fact: 'customers_new_active_last_30d',
            value: activeRows.filter((row) => row.createdAt >= since30d).length,
            provenance: 'db:customers.count',
        }));

        if (unrecognizedRows.length > 0) {
            section.unknowns.push({
                fact: 'customers_status_unrecognized',
                unknownReason: `${unrecognizedRows.length} customer(s) have a missing or unrecognized status and were excluded from active/archived counts.`,
            });
        }
    } catch (error) {
        noteSourceFailure(section, 'customers', error);
    }
    return withDerivedStatus(section);
};

const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] as const;

const buildQuoteSignalsSection = async (ctx: BriefContext, now: Date): Promise<FounderBriefSection> => {
    const section = newSection('quote_commercial_signals', 'Quote and Commercial Signals');
    try {
        const rows = await db.select({
            id: quotes.id,
            status: quotes.status,
            total: quotes.total,
            currency: quotes.currency,
            validUntil: quotes.validUntil,
        }).from(quotes).where(eq(quotes.businessId, ctx.businessId));

        section.facts.push(makeEvidence(ctx, {
            sourceType: 'quotes', fact: 'quotes_total', value: rows.length, provenance: 'db:quotes.count',
        }));
        // The baseline lifecycle is draft -> sent -> accepted/rejected/expired/converted.
        for (const status of QUOTE_STATUSES) {
            section.facts.push(makeEvidence(ctx, {
                sourceType: 'quotes',
                fact: `quotes_status_${status}`,
                value: rows.filter((row) => row.status === status).length,
                provenance: 'db:quotes.count',
            }));
        }

        // Quotes store major-unit doubles at this baseline; sums are computed
        // per currency and never mixed with minor-unit sources.
        const sumByCurrency = (status: QuoteStatusFilter) => {
            const sums = new Map<string, number>();
            for (const row of rows) {
                if (row.status !== status) continue;
                sums.set(row.currency, round2((sums.get(row.currency) ?? 0) + row.total));
            }
            return [...sums.entries()].sort(([a], [b]) => a.localeCompare(b));
        };
        for (const [currency, sum] of sumByCurrency('accepted')) {
            section.facts.push(makeEvidence(ctx, {
                sourceType: 'quotes',
                fact: `quotes_accepted_total_${currency}`,
                value: sum,
                provenance: 'db:quotes.sum',
                displayText: majorUnitsLabel(sum, currency),
            }));
        }
        for (const [currency, sum] of sumByCurrency('sent')) {
            section.facts.push(makeEvidence(ctx, {
                sourceType: 'quotes',
                fact: `quotes_sent_total_${currency}`,
                value: sum,
                provenance: 'db:quotes.sum',
                displayText: majorUnitsLabel(sum, currency),
            }));
        }

        const in7d = new Date(now.getTime() + 7 * DAY_MS);
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'quotes',
            fact: 'quotes_sent_expiring_next_7d',
            value: rows.filter((row) => row.status === 'sent'
                && row.validUntil != null && row.validUntil >= now && row.validUntil <= in7d).length,
            provenance: 'db:quotes.valid_until',
        }));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'quotes',
            fact: 'quotes_sent_past_valid_until',
            value: rows.filter((row) => row.status === 'sent'
                && row.validUntil != null && row.validUntil < now).length,
            provenance: 'db:quotes.valid_until',
        }));
    } catch (error) {
        noteSourceFailure(section, 'quotes', error);
    }

    try {
        const items = await db.select({ id: quoteItems.id })
            .from(quoteItems)
            .where(eq(quoteItems.businessId, ctx.businessId));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'quotes', fact: 'quote_items_total', value: items.length, provenance: 'db:quote_items.count',
        }));
    } catch (error) {
        noteSourceFailure(section, 'quote_items', error);
    }
    return withDerivedStatus(section);
};

type QuoteStatusFilter = (typeof QUOTE_STATUSES)[number];

const buildRestaurantSection = async (
    ctx: BriefContext,
    profile: BusinessProfileRow | undefined,
    profileFailed: boolean,
    since24h: Date,
): Promise<FounderBriefSection> => {
    const section = newSection('restaurant_operations', 'Restaurant Operations');

    if (profileFailed) {
        section.status = 'unavailable';
        section.unknowns.push({
            fact: 'restaurant_operations',
            unknownReason: 'Business profile is unavailable; restaurant tenancy cannot be confirmed.',
        });
        return section;
    }
    if (profile?.type !== 'restaurant') {
        section.status = 'unavailable';
        section.unknowns.push({
            fact: 'restaurant_operations',
            unknownReason: 'Restaurant operations apply to restaurant tenants only; this tenant is not a restaurant.',
        });
        return section;
    }

    const currency = profile.currency ?? 'USD';
    try {
        const recentOrders = await db.select({
            id: restaurantOrders.id,
            status: restaurantOrders.status,
            total: restaurantOrders.total,
        }).from(restaurantOrders).where(and(
            eq(restaurantOrders.businessId, ctx.businessId),
            gte(restaurantOrders.createdAt, since24h),
        ));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'restaurant_operations',
            fact: 'restaurant_orders_last_24h',
            value: recentOrders.length,
            provenance: 'db:restaurant_orders.count',
        }));
        // restaurant_orders.total is integer minor units at this baseline.
        const totalMinor = recentOrders.reduce((sum, row) => sum + row.total, 0);
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'restaurant_operations',
            fact: 'restaurant_orders_last_24h_total_minor',
            value: totalMinor,
            provenance: 'db:restaurant_orders.sum',
            displayText: minorUnitsLabel(totalMinor, currency),
        }));
    } catch (error) {
        noteSourceFailure(section, 'restaurant_orders', error);
    }

    try {
        const openOrders = await db.select({
            id: restaurantOrders.id,
            paymentStatus: restaurantOrders.paymentStatus,
        }).from(restaurantOrders).where(and(
            eq(restaurantOrders.businessId, ctx.businessId),
            inArray(restaurantOrders.status, ['pending', 'in_kitchen', 'ready']),
        ));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'restaurant_operations',
            fact: 'restaurant_orders_open',
            value: openOrders.length,
            provenance: 'db:restaurant_orders.count',
        }));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'restaurant_operations',
            fact: 'restaurant_orders_open_unpaid',
            value: openOrders.filter((row) => row.paymentStatus === 'unpaid').length,
            provenance: 'db:restaurant_orders.count',
        }));
    } catch (error) {
        noteSourceFailure(section, 'restaurant_orders_open', error);
    }

    try {
        const activeTickets = await db.select({ id: kdsTickets.id })
            .from(kdsTickets)
            .where(and(
                eq(kdsTickets.businessId, ctx.businessId),
                inArray(kdsTickets.status, ['new', 'cooking']),
            ));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'restaurant_operations',
            fact: 'kds_active_tickets',
            value: activeTickets.length,
            provenance: 'db:kds_tickets.count',
        }));
    } catch (error) {
        noteSourceFailure(section, 'kds_tickets', error);
    }

    try {
        const tables = await db.select({
            id: restaurantTables.id,
            status: restaurantTables.status,
        }).from(restaurantTables).where(eq(restaurantTables.businessId, ctx.businessId));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'restaurant_operations',
            fact: 'restaurant_tables_total',
            value: tables.length,
            provenance: 'db:restaurant_tables.count',
        }));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'restaurant_operations',
            fact: 'restaurant_tables_occupied',
            value: tables.filter((row) => row.status === 'occupied').length,
            provenance: 'db:restaurant_tables.count',
        }));
    } catch (error) {
        noteSourceFailure(section, 'restaurant_tables', error);
    }

    try {
        // restaurant_payments.amount is a major-unit double at this baseline;
        // it is never summed with minor-unit order totals.
        const payments = await db.select({
            id: restaurantPayments.id,
            amount: restaurantPayments.amount,
        }).from(restaurantPayments).where(and(
            eq(restaurantPayments.businessId, ctx.businessId),
            eq(restaurantPayments.status, 'completed'),
            gte(restaurantPayments.paidAt, since24h),
        ));
        const total = round2(payments.reduce((sum, row) => sum + row.amount, 0));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'restaurant_operations',
            fact: 'restaurant_payments_last_24h_total',
            value: total,
            provenance: 'db:restaurant_payments.sum',
            displayText: majorUnitsLabel(total, currency),
        }));
    } catch (error) {
        noteSourceFailure(section, 'restaurant_payments', error);
    }

    return withDerivedStatus(section);
};

const buildFinancialSection = async (
    ctx: BriefContext,
    currency: string,
    recordDateFloor: string,
    since30d: Date,
): Promise<FounderBriefSection> => {
    const section = newSection('financial_ai_cost_signals', 'Financial and AI-Cost Signals');

    try {
        // purchase_expense_records.amount_minor is integer minor units; only
        // 'saved' records count. record_date is an ISO text date at this baseline.
        const rows = await db.select({
            id: purchaseExpenseRecords.id,
            recordType: purchaseExpenseRecords.recordType,
            amountMinor: purchaseExpenseRecords.amountMinor,
            currency: purchaseExpenseRecords.currency,
        }).from(purchaseExpenseRecords).where(and(
            eq(purchaseExpenseRecords.businessId, ctx.businessId),
            eq(purchaseExpenseRecords.status, 'saved'),
            gte(purchaseExpenseRecords.recordDate, recordDateFloor),
        ));

        const aggregate = (recordType: 'purchase' | 'expense') => {
            const matched = rows.filter((row) => row.recordType === recordType);
            const byCurrency = new Map<string, number>();
            for (const row of matched) {
                byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + row.amountMinor);
            }
            return { count: matched.length, byCurrency: [...byCurrency.entries()].sort(([a], [b]) => a.localeCompare(b)) };
        };

        for (const recordType of ['purchase', 'expense'] as const) {
            const { count, byCurrency } = aggregate(recordType);
            section.facts.push(makeEvidence(ctx, {
                sourceType: 'purchases_expenses',
                fact: `${recordType}s_last_30d_count`,
                value: count,
                provenance: 'db:purchase_expense_records.count',
            }));
            if (byCurrency.length === 0) {
                section.facts.push(makeEvidence(ctx, {
                    sourceType: 'purchases_expenses',
                    fact: `${recordType}s_last_30d_total_minor_${currency}`,
                    value: 0,
                    provenance: 'db:purchase_expense_records.sum',
                    displayText: minorUnitsLabel(0, currency),
                }));
            }
            for (const [rowCurrency, sumMinor] of byCurrency) {
                section.facts.push(makeEvidence(ctx, {
                    sourceType: 'purchases_expenses',
                    fact: `${recordType}s_last_30d_total_minor_${rowCurrency}`,
                    value: sumMinor,
                    provenance: 'db:purchase_expense_records.sum',
                    displayText: minorUnitsLabel(sumMinor, rowCurrency),
                }));
            }
        }
    } catch (error) {
        noteSourceFailure(section, 'purchases_expenses', error);
    }

    try {
        const usageRows = await db.select({
            id: qUsageEvents.id,
            estimatedCostUsdMicros: qUsageEvents.estimatedCostUsdMicros,
        }).from(qUsageEvents).where(and(
            eq(qUsageEvents.businessId, ctx.businessId),
            gte(qUsageEvents.createdAt, since30d),
        ));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'q_usage',
            fact: 'q_usage_events_last_30d',
            value: usageRows.length,
            provenance: 'db:q_usage_events.count',
        }));
        const totalMicros = usageRows.reduce((sum, row) => sum + row.estimatedCostUsdMicros, 0);
        const usd = Number((totalMicros / 1_000_000).toFixed(6));
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'q_usage',
            fact: 'q_estimated_cost_last_30d_usd',
            value: usd,
            confidence: 'estimated',
            provenance: 'db:q_usage_events.sum',
            displayText: estimatedCostLabel(usd),
        }));
    } catch (error) {
        noteSourceFailure(section, 'q_usage', error);
    }

    section.unknowns.push({
        fact: 'consolidated_revenue_pnl',
        unknownReason: 'No unified revenue ledger exists across verticals at this baseline.',
    });

    return withDerivedStatus(section);
};

const buildSecuritySection = async (ctx: BriefContext, since7d: Date): Promise<FounderBriefSection> => {
    const section = newSection('security_backup_operations_risks', 'Security, Backup and Operations Risks');
    try {
        // Safe audit metadata only: action names and timestamps, never details.
        const rows = await db.select({
            action: auditLogs.action,
            timestamp: auditLogs.timestamp,
        }).from(auditLogs)
            .where(eq(auditLogs.businessId, ctx.businessId))
            .orderBy(desc(auditLogs.timestamp))
            .limit(100);
        const withTimestamp = rows.filter((row) => row.timestamp != null);
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'audit_metadata',
            fact: 'audit_events_last_7d',
            value: withTimestamp.filter((row) => (row.timestamp as Date) >= since7d).length,
            provenance: 'db:audit_logs.recent_metadata',
        }));
        const latest = withTimestamp[0];
        if (latest) {
            const action = sanitizeName(latest.action);
            if (action.text) {
                section.facts.push(makeEvidence(ctx, {
                    sourceType: 'audit_metadata',
                    fact: 'audit_latest_action',
                    value: action.text,
                    provenance: 'db:audit_logs.recent_metadata',
                    truncated: action.truncated,
                }));
            }
            section.facts.push(makeEvidence(ctx, {
                sourceType: 'audit_metadata',
                fact: 'audit_latest_at',
                value: (latest.timestamp as Date).toISOString(),
                provenance: 'db:audit_logs.recent_metadata',
            }));
        }
    } catch (error) {
        noteSourceFailure(section, 'audit_metadata', error);
    }

    // No structured backup/restore or readiness source exists in this baseline.
    section.unknowns.push({
        fact: 'backup_status',
        unknownReason: 'No structured backup status source is integrated at this baseline.',
    });

    return withDerivedStatus(section);
};

const PENDING_DRAFTS_LIST_LIMIT = 10;

const buildDecisionsSection = async (ctx: BriefContext): Promise<FounderBriefSection> => {
    const section = newSection('decisions_waiting', 'Decisions Waiting for Founder');
    try {
        const totalRow = await first(db.select({ count: sql<number>`count(*)` })
            .from(qAssistantDrafts)
            .where(and(
                eq(qAssistantDrafts.businessId, ctx.businessId),
                eq(qAssistantDrafts.status, 'pending'),
            )));
        const total = Number(totalRow?.count ?? 0);
        section.facts.push(makeEvidence(ctx, {
            sourceType: 'q_assistant_drafts',
            fact: 'pending_decisions_count',
            value: total,
            provenance: 'db:q_assistant_drafts.count',
        }));

        const drafts = await db.select({
            id: qAssistantDrafts.id,
            type: qAssistantDrafts.type,
            title: qAssistantDrafts.title,
        }).from(qAssistantDrafts)
            .where(and(
                eq(qAssistantDrafts.businessId, ctx.businessId),
                eq(qAssistantDrafts.status, 'pending'),
            ))
            .orderBy(desc(qAssistantDrafts.createdAt), qAssistantDrafts.id)
            .limit(PENDING_DRAFTS_LIST_LIMIT);

        for (const draft of drafts) {
            const title = sanitizeName(draft.title);
            const type = sanitizeName(draft.type);
            const combined = sanitizeFreeText(`${type.text ?? 'draft'}: ${title.text ?? '(untitled)'}`);
            section.facts.push(makeEvidence(ctx, {
                sourceType: 'q_assistant_drafts',
                sourceId: draft.id,
                fact: 'pending_decision',
                provenance: 'db:q_assistant_drafts.list',
                sensitivity: 'medium',
                displayText: combined.text,
                truncated: combined.truncated || title.truncated,
            }));
        }
        if (total > drafts.length) {
            section.facts.push(makeEvidence(ctx, {
                sourceType: 'q_assistant_drafts',
                fact: 'pending_decisions_not_listed',
                value: total - drafts.length,
                provenance: 'db:q_assistant_drafts.count',
            }));
        }
    } catch (error) {
        noteSourceFailure(section, 'q_assistant_drafts', error);
    }
    return withDerivedStatus(section);
};

// --- Public entry point --------------------------------------------------------

export const buildFounderDailyBrief = async (businessId: string): Promise<FounderDailyBrief> => {
    const generatedAtDate = new Date();
    const generatedAt = generatedAtDate.toISOString();
    const ctx: BriefContext = { businessId, observedAt: generatedAt };

    const since24h = new Date(generatedAtDate.getTime() - DAY_MS);
    const since7d = new Date(generatedAtDate.getTime() - 7 * DAY_MS);
    const since30d = new Date(generatedAtDate.getTime() - 30 * DAY_MS);
    const recordDateFloor = since30d.toISOString().slice(0, 10);

    const { profile, failed: profileFailed } = await fetchBusinessProfile(businessId);
    const currency = profile?.currency ?? 'USD';
    const timezone = profile?.timezone ?? 'UTC';

    const dataSections = await Promise.all([
        buildBusinessHealthSection(ctx, profile, profileFailed),
        buildCustomerSignalsSection(ctx, since30d),
        buildQuoteSignalsSection(ctx, generatedAtDate),
        buildRestaurantSection(ctx, profile, profileFailed, since24h),
        buildFinancialSection(ctx, currency, recordDateFloor, since30d),
        buildSecuritySection(ctx, since7d),
        buildDecisionsSection(ctx),
    ]);

    const recommendationsSection: FounderBriefSection = {
        key: 'recommendations',
        title: 'Recommendations',
        status: 'postponed',
        facts: [],
        unknowns: [{
            fact: 'recommendations',
            unknownReason: 'Recommendations are postponed to a later milestone; none are generated in this slice.',
        }],
    };

    const changesSection: FounderBriefSection = {
        key: 'changes_since_previous_brief',
        title: 'Changes Since Previous Brief',
        status: 'unavailable',
        facts: [],
        unknowns: [{
            fact: 'previous_brief_comparison',
            unknownReason: 'Brief history is not persisted in this milestone; no previous brief exists for comparison.',
        }],
    };

    // Executive summary is a deterministic rollup of the other sections — no prose.
    const rollupSections = [...dataSections, recommendationsSection, changesSection];
    const factsTotal = rollupSections.reduce((sum, section) => sum + section.facts.length, 0);
    const unknownsTotal = rollupSections.reduce((sum, section) => sum + section.unknowns.length, 0);
    const executiveSummary = newSection('executive_summary', 'Executive Summary');
    const businessName = dataSections[0].facts.find((fact) => fact.fact === 'business_name');
    if (businessName?.displayText) {
        executiveSummary.facts.push(makeEvidence(ctx, {
            sourceType: 'derived_rollup',
            fact: 'business_name',
            provenance: 'derived:sections.rollup',
            sensitivity: 'medium',
            displayText: businessName.displayText,
            truncated: businessName.truncated,
        }));
    }
    executiveSummary.facts.push(makeEvidence(ctx, {
        sourceType: 'derived_rollup', fact: 'facts_total', value: factsTotal, provenance: 'derived:sections.rollup',
    }));
    executiveSummary.facts.push(makeEvidence(ctx, {
        sourceType: 'derived_rollup', fact: 'unknowns_total', value: unknownsTotal, provenance: 'derived:sections.rollup',
    }));
    executiveSummary.facts.push(makeEvidence(ctx, {
        sourceType: 'derived_rollup',
        fact: 'sections_supported',
        value: rollupSections.filter((section) => section.status === 'supported').length,
        provenance: 'derived:sections.rollup',
    }));
    executiveSummary.facts.push(makeEvidence(ctx, {
        sourceType: 'derived_rollup',
        fact: 'sections_unavailable_or_postponed',
        value: rollupSections.filter((section) => section.status === 'unavailable' || section.status === 'postponed').length,
        provenance: 'derived:sections.rollup',
    }));

    // Unknown and unavailable sources are a first-class section.
    const unknownSection = newSection('unknown_unavailable_sources', 'Unknown and Unavailable Sources');
    unknownSection.facts.push(makeEvidence(ctx, {
        sourceType: 'derived_rollup',
        fact: 'unknown_or_unavailable_total',
        value: unknownsTotal,
        provenance: 'derived:sections.rollup',
    }));
    for (const section of rollupSections) {
        for (const unknown of section.unknowns) {
            unknownSection.unknowns.push({
                fact: `${section.key}:${unknown.fact}`,
                unknownReason: unknown.unknownReason,
            });
        }
    }

    return {
        businessId,
        generatedAt,
        timezone,
        sections: [
            executiveSummary,
            ...dataSections,
            recommendationsSection,
            unknownSection,
            changesSection,
        ],
    };
};
