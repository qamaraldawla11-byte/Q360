
import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';

// SECURITY: JWT_SECRET must be set in environment. No fallback allowed.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('🔴 FATAL: JWT_SECRET environment variable is not set.');
    console.error('   Set JWT_SECRET in your .env file before starting the server.');
    process.exit(1);
}

export interface JWTPayload {
    sub: string;      // User ID
    email: string;
    role: string;
    businessId: string; // Multi-tenancy context
    iat: number;
    exp: number;
    [key: string]: any; // Allow other claims
}

// Middleware to verify JWT token
export const authMiddleware = async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const token = authHeader.substring(7);

    try {
        const payload = await verify(token, JWT_SECRET) as unknown as JWTPayload;

        // Attach user info to context
        c.set('userId', payload.sub);
        c.set('userEmail', payload.email);
        c.set('userRole', payload.role);
        // Default to 'biz_main' if missing in legacy tokens, assuming they are admin/demo. 
        // Ideally should reject, but for smooth transition:
        c.set('businessId', payload.businessId || 'biz_main');

        await next();
    } catch (error) {
        return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }
};

// Helper to generate JWT
export const generateToken = async (payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> => {
    const { sign } = await import('hono/jwt');

    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JWTPayload = {
        ...payload,
        iat: now,
        exp: now + (24 * 60 * 60), // 24 hours
    } as JWTPayload;

    return sign(fullPayload, JWT_SECRET);
};

// RBAC Middleware generator
export const requireRole = (allowedRoles: string[]) => {
    return async (c: Context, next: Next) => {
        const userRole = c.get('userRole') as string;

        // Owner/Admin always have access? Or strict check?
        // Usually Admin/Owner implies access to most things, but let's be explicit in usage or implicit here.
        // Let's implicit: if strict check desired, pass only specific roles.
        // But for hierarchy: Owner > Admin > Manager > Staff > Viewer.
        // It's better to pass *all* allowed roles in the definition.

        if (!userRole || !allowedRoles.includes(userRole)) {
            return c.json({ error: 'Forbidden: Insufficient permissions' }, 403);
        }
        await next();
    };
};

export { JWT_SECRET };
