/**
 * Q Guest Brief Provisioning — approved restaurant workspace executor.
 *
 * This is the ONLY trusted executor that turns a confirmed guest brief into
 * real workspace state. It runs exclusively after an authenticated owner
 * confirmed the brief through the route layer (qGuestBriefs.ts); it never
 * sees a raw token, never reads environment variables, and never accepts a
 * businessId, destination, or role from the payload — identity comes from the
 * authenticated userId and the canonical tenant helpers.
 *
 * Scope discipline (approved):
 *   - ONE workspace: restaurant. Any other recommendedWorkspace fails closed
 *     with 'not_implemented'.
 *   - The user profile write mirrors the canonical onboarding write in
 *     routes/user.ts exactly (same ownership-claim rule, same fields).
 *   - Restaurant data created here is limited to the deterministic table set
 *     (Table 1..N, capacity 4). No menu items, orders, customers, or staff.
 *   - Q memory + one welcome conversation are written per business; both are
 *     upserts/deterministic-id inserts, so re-running with the same brief
 *     never duplicates businesses, tables, memory rows, or conversations.
 *   - Nothing here writes tokens, emails, or auth material into Q memory or
 *     conversation content.
 */

import { randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import {
    businesses,
    qAssistantConversations,
    qAssistantMessages,
    qBusinessMemories,
    restaurantTables,
    staffMembers,
    users,
} from '../db/schema.js';
import { ensureUserBusiness } from '../utils/tenant.js';
import { DESTINATION_ALLOWLIST } from './qOrchestration.js';
import type { QGuestBriefView } from './qGuestBriefService.js';

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export type QGuestBriefProvisioningInput = {
    userId: string;
    brief: QGuestBriefView;
    corrections?: { businessName?: string; country?: string; currency?: string };
};

export type QGuestBriefProvisioningResult =
    | { ok: true; businessId: string; workspace: 'restaurant'; destination: '/app/restaurant'; tablesEnsured: number; tablesCreated: number }
    | { ok: false; code: 'not_implemented' | 'invalid_payload'; message: string };

const RESTAURANT_DESTINATION = DESTINATION_ALLOWLIST.restaurant;

const TABLE_CAPACITY = 4;
const MAX_TABLES = 30;
const MEMORY_TEXT_MAX = 1200;

/** Canonical Q operating-priority vocabulary (routes/restaurant.ts allowlist). */
const OPERATING_PRIORITY_ALLOWLIST = [
    'service_speed',
    'guest_experience',
    'cost_control',
    'sales_growth',
    'waste_reduction',
    'team_development',
] as const;

const fail = (code: 'not_implemented' | 'invalid_payload', message: string): QGuestBriefProvisioningResult => ({
    ok: false,
    code,
    message,
});

const cleanRequiredText = (value: string | undefined, max: number): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > max) return null;
    return trimmed;
};

const answerFor = (brief: QGuestBriefView, question: string): string | undefined =>
    brief.payload.answers.find(answer => answer.question === question)?.answer;

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export const provisionRestaurantWorkspaceFromBrief = async (
    input: QGuestBriefProvisioningInput,
): Promise<QGuestBriefProvisioningResult> => {
    const { userId, brief, corrections } = input;
    const payload = brief.payload;

    // Fail closed: the restaurant workspace is the only approved destination.
    if (payload.recommendation.recommendedWorkspace !== 'restaurant') {
        return fail('not_implemented', 'Only the Restaurant workspace can be provisioned from a Q guest brief right now.');
    }

    // Effective field values: explicit owner corrections win over the
    // sanitized prefill candidates. All bounds mirror the A2.1 contract.
    const businessName = cleanRequiredText(corrections?.businessName ?? payload.prefill.businessName, 120);
    const country = cleanRequiredText(corrections?.country ?? payload.prefill.country, 100);
    const rawCurrency = corrections?.currency ?? payload.prefill.currency;
    const currency = typeof rawCurrency === 'string' ? rawCurrency.trim().toUpperCase() : '';
    if (!businessName) return fail('invalid_payload', 'A business name of 120 characters or fewer is required.');
    if (!country) return fail('invalid_payload', 'A country of 100 characters or fewer is required.');
    if (!/^[A-Z]{3}$/.test(currency)) return fail('invalid_payload', 'A valid three-letter currency code is required.');

    // Confirmed onboarding answers drive the deterministic table set and the
    // restaurant service format. table_count is required and bounded.
    const rawTableCount = answerFor(brief, 'table_count')?.trim() ?? '';
    const tableCount = /^\d{1,2}$/.test(rawTableCount) ? Number.parseInt(rawTableCount, 10) : Number.NaN;
    if (!Number.isSafeInteger(tableCount) || tableCount < 1 || tableCount > MAX_TABLES) {
        return fail('invalid_payload', 'A table count from 1 to 30 is required.');
    }
    const serviceModes = (answerFor(brief, 'service_modes') ?? '')
        .split(',')
        .map(mode => mode.trim().toLowerCase())
        .filter(Boolean);
    const hasDineIn = serviceModes.includes('dine-in') || serviceModes.includes('dine_in');
    const hasTakeaway = serviceModes.includes('takeaway');
    const restaurantType = hasDineIn && hasTakeaway ? 'both'
        : hasDineIn ? 'dine_in'
        : hasTakeaway ? 'takeaway'
        : null;
    const modesSummary = serviceModes.join(', ') || 'standard';

    // Tenant: configure the claiming user's existing tenant (never a payload id).
    const businessId = await ensureUserBusiness(userId, { businessName, segment: 'restaurant' });
    if (!businessId) return fail('invalid_payload', 'The confirming user no longer exists.');

    // Canonical profile write — mirrors routes/user.ts PUT /profile exactly,
    // pinned to userType 'sme' + segment 'restaurant'.
    const currentUser = await first(db.select().from(users).where(eq(users.id, userId)));
    if (!currentUser) return fail('invalid_payload', 'The confirming user no longer exists.');
    const staffMembership = await first(db.select({ id: staffMembers.id }).from(staffMembers).where(and(
        eq(staffMembers.businessId, businessId), eq(staffMembers.userId, userId),
    )));
    const business = await first(db.select().from(businesses).where(eq(businesses.id, businessId)));
    const creatorRole = currentUser.role === 'user' || currentUser.role === 'owner';
    const canClaimOwnership = creatorRole && !staffMembership && (!business?.ownerUserId || business.ownerUserId === userId);
    if (canClaimOwnership && !business?.ownerUserId) {
        await db.update(businesses).set({ ownerUserId: userId, updatedAt: new Date() })
            .where(and(eq(businesses.id, businessId), isNull(businesses.ownerUserId)));
    }

    await db.update(users)
        .set({
            userType: 'sme',
            segment: 'restaurant',
            businessName,
            country,
            currency,
            onboardingCompleted: true,
            businessId,
            primaryWorkspace: RESTAURANT_DESTINATION,
            role: canClaimOwnership ? 'owner' : currentUser.role,
        })
        .where(eq(users.id, userId));

    // Business record: confirmed locale + service format. restaurantType only
    // changes when the confirmed service modes map to a known value.
    await db.update(businesses)
        .set({
            country,
            currency,
            ...(restaurantType ? { restaurantType: restaurantType as 'dine_in' | 'takeaway' | 'both' } : {}),
            updatedAt: new Date(),
        })
        .where(eq(businesses.id, businessId));

    // Deterministic table set: check-then-insert on (businessId, label), the
    // same app-level duplicate guard as routes/restaurant.ts POST /tables.
    let tablesCreated = 0;
    for (let index = 1; index <= tableCount; index += 1) {
        const label = `Table ${index}`;
        const existing = await first(db.select({ id: restaurantTables.id }).from(restaurantTables)
            .where(and(eq(restaurantTables.businessId, businessId), eq(restaurantTables.label, label))));
        if (existing) continue;
        await db.insert(restaurantTables).values({
            id: randomUUID(),
            businessId,
            label,
            capacity: TABLE_CAPACITY,
            status: 'available',
        });
        tablesCreated += 1;
    }

    // Q memory: one owner-managed row per business (unique on businessId).
    // Content is deterministic, payload-derived, and free of tokens/auth data.
    const priorities = payload.recommendation.priorities;
    const joinedGoals = priorities.join(', ').trim();
    const ownerSummary = `${businessName} is a restaurant in ${country}. Currency: ${currency}. Service modes: ${modesSummary}. Tables: ${tableCount}. Prepared by Q from the owner-confirmed onboarding brief.`.slice(0, MEMORY_TEXT_MAX);
    const businessGoals = joinedGoals.length > 0 ? joinedGoals.slice(0, MEMORY_TEXT_MAX) : null;
    const operatingPriorities = priorities.filter(priority =>
        (OPERATING_PRIORITY_ALLOWLIST as readonly string[]).includes(priority));
    const existingMemory = await first(db.select().from(qBusinessMemories).where(eq(qBusinessMemories.businessId, businessId)));
    const memoryRecord = {
        id: existingMemory?.id ?? randomUUID(),
        businessId,
        ownerSummary,
        businessGoals,
        operatingPriorities,
        updatedBy: userId,
        updatedAt: new Date(),
    };
    if (existingMemory) {
        await db.update(qBusinessMemories).set(memoryRecord).where(eq(qBusinessMemories.id, existingMemory.id));
    } else {
        await db.insert(qBusinessMemories).values({ ...memoryRecord, createdAt: new Date() });
    }

    // Welcome conversation: deterministic id, inserted at most once per business.
    const conversationId = `qconv_onboarding_${businessId}`;
    const existingConversation = await first(db.select({ id: qAssistantConversations.id }).from(qAssistantConversations)
        .where(eq(qAssistantConversations.id, conversationId)));
    if (!existingConversation) {
        const at = new Date();
        await db.insert(qAssistantConversations).values({
            id: conversationId,
            businessId,
            createdBy: userId,
            title: 'Welcome from Q',
            createdAt: at,
            updatedAt: at,
        });
        await db.insert(qAssistantMessages).values({
            id: `qmsg_onboarding_${businessId}`,
            conversationId,
            businessId,
            userId: null,
            role: 'assistant' as const,
            content: `Welcome to ${businessName}. I prepared your Restaurant workspace with ${tableCount} tables and ${modesSummary} service. Let's finish your menu and opening setup.`,
            evidenceCards: [] as Array<{ id: string; label: string; facts: string[] }>,
            feedback: null,
            createdAt: at,
        });
    }

    return {
        ok: true,
        businessId,
        workspace: 'restaurant',
        destination: RESTAURANT_DESTINATION,
        tablesEnsured: tableCount,
        tablesCreated,
    };
};
