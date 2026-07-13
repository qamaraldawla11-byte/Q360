import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { Hono } from 'hono';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, first } from '../db/client.js';
import { businesses, otpCodes, staffInvitations, staffMembers, users } from '../db/schema.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { sendOtpEmail } from '../services/email.js';
import type { AppEnv } from '../types/app.js';
import { ensureBusinessRecord, isWorkspaceRoute, resolveJwtBusinessId } from '../utils/tenant.js';
import { resolveEffectiveBusinessRole } from '../services/businessOwnership.js';

const auth = new Hono<AppEnv>();
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OtpRow = {
    id: string;
    codeHash: string;
    expiresAt: Date;
    attempts: number;
};

const normalizeEmail = (email: unknown) =>
    typeof email === 'string' ? email.trim().toLowerCase() : '';

const hashOtp = (email: string, code: string) =>
    createHmac('sha256', process.env.JWT_SECRET!).update(`${email}:${code}`).digest('hex');

const otpMatches = (expectedHash: string, actualHash: string) => {
    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(actualHash, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
};

// Request a one-time sign-in code.
auth.post('/login', async (c) => {
    const body = await c.req.json<{ email?: string }>();
    const email = normalizeEmail(body.email);

    if (!EMAIL_PATTERN.test(email)) {
        return c.json({ error: 'A valid email address is required' }, 400);
    }

    const user = await first(db.select().from(users).where(eq(users.email, email)));
    if (user?.isLocked || user?.status === 'inactive') {
        return c.json({ error: 'Account is not available' }, 403);
    }

    const now = Date.now();
    const latest = await first(db.select({ createdAt: otpCodes.createdAt })
        .from(otpCodes)
        .where(and(eq(otpCodes.email, email), isNull(otpCodes.usedAt)))
        .orderBy(desc(otpCodes.createdAt))
        .limit(1));

    if (latest && now - latest.createdAt.getTime() < OTP_RESEND_DELAY_MS) {
        return c.json({
            error: 'Please wait before requesting another code',
            retryAfter: Math.ceil((OTP_RESEND_DELAY_MS - (now - latest.createdAt.getTime())) / 1000),
        }, 429);
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const id = randomUUID();

    await db.transaction(async (tx) => {
        await tx.update(otpCodes)
            .set({ usedAt: new Date(now) })
            .where(and(eq(otpCodes.email, email), isNull(otpCodes.usedAt)));
        await tx.insert(otpCodes).values({
            id,
            email,
            codeHash: hashOtp(email, code),
            expiresAt: new Date(now + OTP_TTL_MS),
            attempts: 0,
            createdAt: new Date(now),
        });
    });

    const developmentMode = !process.env.RESEND_API_KEY;

    if (developmentMode) {
        console.log(`[DEV OTP] Code for ${email}: ${code}`);
    } else {
        try {
            await sendOtpEmail(email, code);
        } catch (error) {
            await db.delete(otpCodes).where(eq(otpCodes.id, id));
            console.error('[AUTH] Failed to send OTP email:', error);
            return c.json({ error: 'Unable to send sign-in code.' }, 503);
        }
    }

    return c.json({ success: true, expiresIn: OTP_TTL_MS / 1000, developmentMode });
});

// Exchange a valid one-time code for a JWT session.
auth.post('/verify', async (c) => {
    const body = await c.req.json<{ email?: string; code?: string }>();
    const email = normalizeEmail(body.email);
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(code)) {
        return c.json({ error: 'Email and a 6-digit code are required' }, 400);
    }

    const otp = await first(db.select({
        id: otpCodes.id,
        codeHash: otpCodes.codeHash,
        expiresAt: otpCodes.expiresAt,
        attempts: otpCodes.attempts,
    })
        .from(otpCodes)
        .where(and(eq(otpCodes.email, email), isNull(otpCodes.usedAt)))
        .orderBy(desc(otpCodes.createdAt))
        .limit(1)) as OtpRow | undefined;

    if (!otp) {
        return c.json({ error: 'No active sign-in code. Request a new code.' }, 400);
    }

    const now = Date.now();
    if (otp.expiresAt.getTime() <= now) {
        await db.update(otpCodes).set({ usedAt: new Date(now) }).where(eq(otpCodes.id, otp.id));
        return c.json({ error: 'This code has expired. Request a new code.' }, 400);
    }

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
        await db.update(otpCodes).set({ usedAt: new Date(now) }).where(eq(otpCodes.id, otp.id));
        return c.json({ error: 'Too many attempts. Request a new code.' }, 429);
    }

    if (!otpMatches(otp.codeHash, hashOtp(email, code))) {
        const attempts = otp.attempts + 1;
        await db.update(otpCodes)
            .set({
                attempts,
                usedAt: attempts >= OTP_MAX_ATTEMPTS ? new Date(now) : null,
            })
            .where(eq(otpCodes.id, otp.id));
        return c.json({
            error: attempts >= OTP_MAX_ATTEMPTS
                ? 'Too many attempts. Request a new code.'
                : 'Invalid sign-in code',
        }, attempts >= OTP_MAX_ATTEMPTS ? 429 : 400);
    }

    const claimed = await db.update(otpCodes)
        .set({ usedAt: new Date(now) })
        .where(and(eq(otpCodes.id, otp.id), isNull(otpCodes.usedAt)))
        .returning({ id: otpCodes.id });

    if (claimed.length !== 1) {
        return c.json({ error: 'This code has already been used' }, 400);
    }

    const invitation = await first(db.select().from(staffInvitations).where(and(eq(staffInvitations.email, email), eq(staffInvitations.status, 'pending'))).orderBy(desc(staffInvitations.createdAt)));
    let user = await first(db.select().from(users).where(eq(users.email, email)));
    if (!user) {
        const newUserId = `usr_${randomUUID()}`;
        const businessId = invitation?.businessId || `biz_${randomUUID()}`;
        if (!invitation) await ensureBusinessRecord(businessId, `${email.split('@')[0]}'s Business`, 'retail', newUserId);
        const invitedBusiness = invitation ? await first(db.select().from(businesses).where(eq(businesses.id, businessId))) : undefined;
        await db.insert(users).values({
            id: newUserId,
            email,
            name: email.split('@')[0],
            role: invitation?.role || 'owner',
            businessId,
            moduleAccess: invitation?.moduleAccess || null,
            userType: invitation ? 'sme' : null,
            segment: invitation ? 'restaurant' : null,
            businessName: invitedBusiness?.name || null,
            onboardingCompleted: Boolean(invitation),
            primaryWorkspace: invitation ? '/app/restaurant' : null,
        });
        user = await first(db.select().from(users).where(eq(users.id, newUserId)));
    }

    if (!user) {
        return c.json({ error: 'Failed to create user' }, 500);
    }

    if (invitation && (!user.onboardingCompleted || user.businessId === invitation.businessId)) {
        const invitedBusiness = await first(db.select().from(businesses).where(eq(businesses.id, invitation.businessId)));
        await db.transaction(async tx => {
            await tx.update(users).set({ businessId: invitation.businessId, role: invitation.role, moduleAccess: invitation.moduleAccess, userType: 'sme', segment: 'restaurant', businessName: invitedBusiness?.name || user!.businessName, onboardingCompleted: true, primaryWorkspace: '/app/restaurant' }).where(eq(users.id, user!.id));
            await tx.update(staffInvitations).set({ status: 'accepted', acceptedAt: new Date() }).where(eq(staffInvitations.id, invitation.id));
            await tx.update(staffMembers).set({ userId: user!.id, status: 'active', updatedAt: new Date() }).where(and(eq(staffMembers.id, invitation.staffMemberId), eq(staffMembers.businessId, invitation.businessId)));
        });
        user = await first(db.select().from(users).where(eq(users.id, user.id)));
    }

    if (!user) {
        return c.json({ error: 'Failed to activate invited user' }, 500);
    }

    if (user.isLocked || user.status === 'inactive') {
        return c.json({ error: 'Account is not available' }, 403);
    }

    if (!user.businessId || isWorkspaceRoute(user.businessId)) {
        const businessId = resolveJwtBusinessId(user);
        await ensureBusinessRecord(businessId, user.businessName || `${user.name || user.email}'s Business`, user.segment || 'retail');
        await db.update(users)
            .set({ businessId })
            .where(eq(users.id, user.id));
        user = { ...user, businessId };
    }

    const effectiveRole = await resolveEffectiveBusinessRole({
        userId: user.id,
        businessId: resolveJwtBusinessId(user),
        tokenRole: user.role,
    });
    if (effectiveRole !== user.role) user = { ...user, role: effectiveRole };

    const token = await generateToken({
        sub: user.id,
        email: user.email,
        role: user.role || 'user',
        businessId: resolveJwtBusinessId(user),
    });

    return c.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            userType: user.userType,
            segment: user.segment,
            businessName: user.businessName,
            country: user.country,
            currency: user.currency,
            onboardingCompleted: user.onboardingCompleted,
            primaryWorkspace: user.primaryWorkspace,
            moduleAccess: user.moduleAccess,
            workspaces: [],
        },
    });
});

auth.post('/logout', (c) => {
    return c.json({ success: true });
});

auth.get('/session', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const user = await first(db.select().from(users).where(eq(users.id, userId)));

    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        userType: user.userType,
        segment: user.segment,
        businessName: user.businessName,
        country: user.country,
        currency: user.currency,
        onboardingCompleted: user.onboardingCompleted,
        primaryWorkspace: user.primaryWorkspace,
        workspaces: [],
    });
});

export default auth;
