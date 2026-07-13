import { createHmac, randomUUID } from 'crypto';
import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { requireDatabaseUrl, requireQ360StagingDatabaseGuard } from '../utils/env.js';

requireQ360StagingDatabaseGuard('verify:restaurant-delivery'); requireDatabaseUrl();
process.env.JWT_SECRET ||= 'restaurant-delivery-verification-secret'; process.env.NODE_ENV = 'test';
const { db, closeDatabase } = await import('../db/client.js');
const { auditLogs, businesses, customers, kdsTickets, menuCategories, menuItems, restaurantMenus, restaurantOrderItems, restaurantOrders, restaurantPayments, users } = await import('../db/schema.js');
const { default: restaurantRoutes } = await import('../routes/restaurant.js');
const app = new Hono(); app.route('/api/restaurant', restaurantRoutes);
const runId = Date.now(), businessIds = [`biz_verify_delivery_a_${runId}`, `biz_verify_delivery_b_${runId}`], userIds = [`usr_verify_delivery_a_${runId}`, `usr_verify_delivery_b_${runId}`];
const token = (userId: string, businessId: string) => { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url'), now = Math.floor(Date.now() / 1000), header = encode({ alg: 'HS256', typ: 'JWT' }), payload = encode({ sub: userId, email: `${userId}@example.com`, role: 'admin', businessId, iat: now, exp: now + 3600 }), signature = createHmac('sha256', process.env.JWT_SECRET!).update(`${header}.${payload}`).digest('base64url'); return `${header}.${payload}.${signature}`; };
const request = (auth: string, path: string, init?: RequestInit) => app.request(path, { ...init, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json', ...init?.headers } });
const cleanup = async () => { await db.delete(auditLogs).where(inArray(auditLogs.businessId, businessIds)); await db.delete(restaurantPayments).where(inArray(restaurantPayments.businessId, businessIds)); const orders = await db.select({ id: restaurantOrders.id }).from(restaurantOrders).where(inArray(restaurantOrders.businessId, businessIds)); const ids = orders.map(row => row.id); if (ids.length) await db.delete(restaurantOrderItems).where(inArray(restaurantOrderItems.orderId, ids)); await db.delete(kdsTickets).where(inArray(kdsTickets.businessId, businessIds)); await db.delete(restaurantOrders).where(inArray(restaurantOrders.businessId, businessIds)); await db.delete(menuItems).where(inArray(menuItems.businessId, businessIds)); await db.delete(menuCategories).where(inArray(menuCategories.businessId, businessIds)); await db.delete(restaurantMenus).where(inArray(restaurantMenus.businessId, businessIds)); await db.delete(customers).where(inArray(customers.businessId, businessIds)); await db.delete(users).where(inArray(users.id, userIds)); await db.delete(businesses).where(inArray(businesses.id, businessIds)); };
try {
    await cleanup();
    await db.insert(businesses).values(businessIds.map((id, index) => ({ id, name: `Delivery ${index}`, type: 'restaurant' })));
    await db.insert(users).values(userIds.map((id, index) => ({ id, email: `${id}@example.com`, role: 'admin', businessId: businessIds[index] })));
    const menuId = randomUUID(), categoryId = randomUUID(), itemId = randomUUID(), customerAId = randomUUID(), customerBId = randomUUID();
    await db.insert(restaurantMenus).values({ id: menuId, businessId: businessIds[0], name: 'Delivery Menu', isActive: true });
    await db.insert(menuCategories).values({ id: categoryId, businessId: businessIds[0], menuId, name: 'Meals' });
    await db.insert(menuItems).values({ id: itemId, businessId: businessIds[0], categoryId, name: 'Delivery Meal', price: 1250, isAvailable: true });
    await db.insert(customers).values([{ id: customerAId, businessId: businessIds[0], name: 'Delivery Customer', phone: '+201000000000', address: '12 Test Street' }, { id: customerBId, businessId: businessIds[1], name: 'Other Tenant', phone: '+201111111111', address: 'Other Address' }]);
    const adminA = token(userIds[0], businessIds[0]), adminB = token(userIds[1], businessIds[1]);
    const missing = await request(adminA, '/api/restaurant/orders', { method: 'POST', body: JSON.stringify({ order_type: 'delivery', items: [{ menu_item_id: itemId, quantity: 1 }] }) });
    if (missing.status !== 400) throw new Error(`Missing delivery fields returned ${missing.status}`);
    const crossCustomer = await request(adminA, '/api/restaurant/orders', { method: 'POST', body: JSON.stringify({ order_type: 'delivery', customer_id: customerBId, items: [{ menu_item_id: itemId, quantity: 1 }] }) });
    if (crossCustomer.status !== 404) throw new Error(`Cross-tenant customer returned ${crossCustomer.status}`);
    const createdResponse = await request(adminA, '/api/restaurant/orders', { method: 'POST', body: JSON.stringify({ order_type: 'delivery', customer_id: customerAId, delivery_notes: 'Ring bell', items: [{ menu_item_id: itemId, quantity: 1 }] }) });
    if (createdResponse.status !== 201) throw new Error(`Delivery create failed ${createdResponse.status}: ${await createdResponse.text()}`);
    const created = await createdResponse.json() as { id: string; orderType: string; customerId: string; customerName: string; customerPhone: string; deliveryAddress: string; deliveryNotes: string; serviceStatus: string; paymentStatus: string };
    if (created.orderType !== 'delivery' || created.customerId !== customerAId || created.customerName !== 'Delivery Customer' || created.customerPhone !== '+201000000000' || created.deliveryAddress !== '12 Test Street' || created.deliveryNotes !== 'Ring bell') throw new Error('Delivery snapshots were not persisted');
    const ticketsResponse = await request(adminA, '/api/restaurant/kds'); const tickets = await ticketsResponse.json() as { id: string; orderId: string; order: { orderType: string; deliveryAddress: string } }[]; const ticket = tickets.find(row => row.orderId === created.id);
    if (!ticket || ticket.order.orderType !== 'delivery' || ticket.order.deliveryAddress !== '12 Test Street') throw new Error('Delivery KDS serialization failed');
    for (const status of ['cooking', 'done']) { const response = await request(adminA, `/api/restaurant/kds/${ticket.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); if (response.status !== 200) throw new Error(`KDS ${status} failed ${response.status}`); }
    const deliveredResponse = await request(adminA, `/api/restaurant/orders/${created.id}/deliver`, { method: 'POST', body: '{}' }); const delivered = await deliveredResponse.json() as { serviceStatus: string };
    if (deliveredResponse.status !== 200 || delivered.serviceStatus !== 'delivered') throw new Error('Delivery transition failed');
    const paidResponse = await request(adminA, `/api/restaurant/orders/${created.id}/payments`, { method: 'POST', body: JSON.stringify({ method: 'cash', amount: 12.5 }) }); const paid = await paidResponse.json() as { paymentStatus: string; status: string };
    if (paidResponse.status !== 201 || paid.paymentStatus !== 'paid' || paid.status !== 'closed') throw new Error('Delivery pay-after completion failed');
    const payNowResponse = await request(adminA, '/api/restaurant/orders/pay-now', { method: 'POST', body: JSON.stringify({ order_type: 'delivery', payment_method: 'manual', customer_name: 'Guest Delivery', customer_phone: '+20222222222', delivery_address: 'Guest Address', items: [{ menu_item_id: itemId, quantity: 1 }] }) });
    if (payNowResponse.status !== 201) throw new Error(`Delivery pay-now failed ${payNowResponse.status}: ${await payNowResponse.text()}`);
    const payNow = await payNowResponse.json() as { order: { id: string; orderType: string; paymentStatus: string; deliveryAddress: string } };
    if (payNow.order.orderType !== 'delivery' || payNow.order.paymentStatus !== 'paid' || payNow.order.deliveryAddress !== 'Guest Address') throw new Error('Pay-now delivery response failed');
    const date = new Date().toISOString().slice(0, 10); const reportResponse = await request(adminA, `/api/restaurant/reports/daily?date=${date}`); const report = await reportResponse.json() as { summary: { deliveryOrders: number }; recentOrders: { orderType: string; customerName: string }[] };
    if (reportResponse.status !== 200 || report.summary.deliveryOrders !== 2 || !report.recentOrders.some(order => order.orderType === 'delivery' && order.customerName)) throw new Error('Delivery report serialization failed');
    const otherOrders = await request(adminB, '/api/restaurant/orders'); const other = await otherOrders.json() as { id: string }[];
    if (other.some(order => order.id === created.id)) throw new Error('Cross-tenant delivery order visibility failed');
    console.log(JSON.stringify({ requiredFields: true, customerTenantIsolation: true, snapshotsPersisted: true, kdsSerialized: true, deliveredThenPaid: true, payNowDelivery: true, reportsCountDelivery: true, orderTenantIsolation: true }, null, 2));
} catch (error) { console.error('Restaurant delivery verification failed:', error); process.exitCode = 1; }
finally { await cleanup(); await closeDatabase(); }
