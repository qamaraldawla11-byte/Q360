// Load environment variables from .env file
import 'dotenv/config';

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
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/user.js';
import restaurantRoutes from './routes/restaurant.js';

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
const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? envOrigins
    : [...developmentOrigins, ...envOrigins];

app.use('*', cors({
    origin: allowedOrigins,
    credentials: true,
}));

const healthResponse = () => ({
        name: 'One OS Backend',
        version: '0.0.1',
        status: 'running',
        timestamp: new Date().toISOString(),
});

// Service metadata and deployment health check
app.get('/', (c) => c.json(healthResponse()));
app.get('/health', (c) => c.json(healthResponse()));

// Mount routes
app.route('/api/auth', authRoutes);
app.route('/api/inventory', inventoryRoutes);
app.route('/api', ordersRoutes); // /api/orders and /api/products/search
app.route('/api/suppliers', suppliersRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/user', userRoutes);
app.route('/api/restaurant', restaurantRoutes);

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
║           One OS Backend API                  ║
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
