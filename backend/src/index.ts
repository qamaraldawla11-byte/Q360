// Load environment variables from .env file
import 'dotenv/config';

import path from 'path';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimiter } from './middleware/rateLimit.js';

// Import routes
import authRoutes from './routes/auth.js';
import inventoryRoutes from './routes/inventory.js';
import ordersRoutes from './routes/orders.js';
import suppliersRoutes from './routes/suppliers.js';
import customersRoutes from './routes/customers.js';
import quotesRoutes from './routes/quotes.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/user.js';
import restaurantRoutes from './routes/restaurant.js';
import businessRoutes from './routes/business.js';
import staffRoutes from './routes/staff.js';
import publicRoutes from './routes/public.js';
import purchasesExpensesRoutes from './routes/purchasesExpenses.js';
import { getQGuestBriefDeps, qGuestBriefRoutes } from './routes/qGuestBriefs.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', rateLimiter);
const developmentOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:3000',
];
// Platform origins are first-class, versioned configuration (ADR:
// docs/adr/ADR_PLATFORM_OPERATIONS_EXPERIENCE.md, Phase 0). admin.q360.app is
// the Platform Operations origin. Explicit origins only — never a wildcard.
const platformOrigins = [
    'https://admin.q360.app',
];
const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
// Every previously valid origin is preserved: deploy-time CORS_ORIGINS entries
// remain authoritative, platform origins are additive. Nothing is weakened.
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [...platformOrigins, ...envOrigins]
    : [...developmentOrigins, ...platformOrigins, ...envOrigins];

app.use('*', cors({
    origin: allowedOrigins,
    credentials: true,
}));

const healthResponse = () => ({
        name: 'Q360 Backend API',
        version: '0.0.1',
        status: 'running',
        timestamp: new Date().toISOString(),
});

// Service metadata and deployment health check
app.get('/', (c) => c.json(healthResponse()));
app.get('/health', (c) => c.json(healthResponse()));

// Readiness probe: confirms the backend can serve traffic (e.g., database is reachable
// and the migration baseline is present). This is intentionally separate from /health,
// which only confirms the process is alive.
app.get('/readyz', async (c) => {
    const started = Date.now();
    try {
        const { queryClient } = await import('./db/client.js');
        const { performReadinessChecks } = await import('./services/readiness.js');
        const { defaultSnapshotPaths } = await import('./services/baseline_catalog.js');
        const paths = defaultSnapshotPaths(process.cwd());

        const timeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('readiness check timed out')), 5000);
        });

        const result = await Promise.race([
            performReadinessChecks(queryClient, {
                snapshot0000Path: paths.snapshot0000Path,
                snapshot0001Path: paths.snapshot0001Path,
                migration0000SqlPath: paths.migration0000SqlPath,
                migration0001SqlPath: path.join(paths.migration0000SqlPath, '..', '0001_restaurant_partial_index_adoption.sql'),
                journalPath: path.join(paths.snapshot0000Path, '..', '_journal.json'),
            }),
            timeout,
        ]);

        const responseMs = Date.now() - started;
        const status = result.ok ? 'ready' : 'not_ready';
        const code = result.ok ? 200 : 503;
        return c.json(
            {
                status,
                timestamp: new Date().toISOString(),
                responseMs,
                checks: result.checks,
            },
            code,
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return c.json(
            {
                status: 'not_ready',
                timestamp: new Date().toISOString(),
                responseMs: Date.now() - started,
                checks: [{ name: 'readiness', status: 'fail', error: message }],
            },
            503,
        );
    }
});

// Mount routes
app.route('/api/public', publicRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/inventory', inventoryRoutes);
app.route('/api', ordersRoutes); // /api/orders and /api/products/search
app.route('/api/suppliers', suppliersRoutes);
app.route('/api/customers', customersRoutes);
app.route('/api/quotes', quotesRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/user', userRoutes);
app.route('/api/restaurant', restaurantRoutes);
app.route('/api/business', businessRoutes);
app.route('/api/staff', staffRoutes);
app.route('/api/purchases-expenses', purchasesExpensesRoutes);
// Q guest-brief lifecycle routes mount ONLY behind the fail-closed flag:
// Q_GUEST_BRIEF_ENABLED=true plus Q_GUEST_BRIEF_TOKEN_SECRET (≥ 32 bytes).
// The public brief-create route (/api/public/q-concierge/brief) self-gates
// on the same check at request time.
if (getQGuestBriefDeps()) app.route('/api/q/guest-briefs', qGuestBriefRoutes);

// 404 handler
app.notFound((c) => {
    return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
    const requestId = `req_${Date.now()}`;
    console.error(`[ERROR] ${requestId} ${c.req.method} ${c.req.path}:`, err.message);
    if (err.stack) {
        console.error(`[ERROR] Stack:`, err.stack);
    }
    return c.json({
        error: 'Internal server error',
        requestId, // Include for debugging
    }, 500);
});

// Start server
const port = Number(process.env.PORT) || 3001;

console.log(`
╔═══════════════════════════════════════════════╗
║           Q360 Backend API                    ║
║                                               ║
║   🚀 Server running on http://localhost:${port}  ║
║                                               ║
║   Endpoints:                                  ║
║   • POST /api/auth/login                      ║
║   • GET  /api/auth/session                    ║
║   • GET  /api/inventory                       ║
║   • PATCH /api/inventory/:id/stock            ║
║   • GET  /api/products/search?barcode=        ║
║   • POST /api/orders                          ║
║   • GET  /api/suppliers                       ║
║   • POST /api/suppliers/procurement/orders    ║
╚═══════════════════════════════════════════════╝
`);

serve({
    fetch: app.fetch,
    port,
});
