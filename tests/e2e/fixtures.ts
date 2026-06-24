import { expect, type Page, type Route } from '@playwright/test';

export type MockUser = {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  userType: 'sme' | 'personal' | null;
  segment: string | null;
  businessName: string | null;
  country: string | null;
  currency: string | null;
  onboardingCompleted: boolean;
  primaryWorkspace: string | null;
  workspaces: [];
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const resetStorage = (page: Page) =>
  page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

const isAuthorized = (route: Route) =>
  route.request().headers().authorization === 'Bearer e2e-token';

const mockProfile = async (page: Page, initialUser: MockUser) => {
  let currentUser = { ...initialUser };

  await page.route('**/api/user/profile', route => {
    if (!isAuthorized(route)) {
      return json(route, { error: 'Unauthorized' }, 401);
    }

    const method = route.request().method();
    if (method === 'GET') {
      return json(route, currentUser);
    }
    if (method === 'PUT') {
      const updates = route.request().postDataJSON() as Partial<MockUser>;
      currentUser = {
        ...currentUser,
        ...updates,
        onboardingCompleted: updates.onboardingCompleted ?? currentUser.onboardingCompleted,
        primaryWorkspace: updates.primaryWorkspace ?? currentUser.primaryWorkspace,
      };
      return json(route, currentUser);
    }

    return route.abort('blockedbyclient');
  });
};

export const newUser = (email = 'new.user@example.com'): MockUser => ({
  id: 'usr_new',
  email,
  name: 'New User',
  role: 'owner',
  userType: null,
  segment: null,
  businessName: null,
  country: null,
  currency: null,
  onboardingCompleted: false,
  primaryWorkspace: null,
  workspaces: [],
});

export const restaurantUser = (): MockUser => ({
  id: 'usr_restaurant',
  email: 'owner@q360.test',
  name: 'Alex Morgan',
  role: 'owner',
  userType: 'sme',
  segment: 'restaurant',
  businessName: 'Q360 Test Kitchen',
  country: 'US',
  currency: 'USD',
  onboardingCompleted: true,
  primaryWorkspace: '/app/restaurant',
  workspaces: [],
});

export const personalUser = (): MockUser => ({
  id: 'usr_personal',
  email: 'freelancer@q360.test',
  name: 'Jordan Lee',
  role: 'owner',
  userType: 'personal',
  segment: 'personal_freelancer',
  businessName: 'Jordan Studio',
  country: 'US',
  currency: 'USD',
  onboardingCompleted: true,
  primaryWorkspace: '/app/personal',
  workspaces: [],
});

export async function authenticate(page: Page, user: MockUser) {
  await resetStorage(page);
  await page.addInitScript(() => localStorage.setItem('auth_token', 'e2e-token'));
  await mockProfile(page, user);
  await page.route('**/api/auth/logout', route => json(route, { success: true }));
}

export async function mockOtp(page: Page, user: MockUser) {
  await resetStorage(page);
  await page.route('**/api/auth/login', route => {
    const body = route.request().postDataJSON() as { email?: string };
    if (body.email !== user.email) return json(route, { error: 'Unexpected email' }, 400);
    return json(route, { success: true, expiresIn: 600, developmentMode: true });
  });
  await page.route('**/api/auth/verify', async route => {
    const body = route.request().postDataJSON() as { email: string; code: string };
    if (body.email !== user.email || body.code !== '123456') {
      return json(route, { error: 'Invalid sign-in code' }, 400);
    }
    return json(route, { token: 'e2e-token', user: { ...user, email: body.email } });
  });
  await mockProfile(page, user);
}

export async function completeOtpLogin(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('button', { name: 'Continue with email' }).click();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
}

export async function mockRestaurantApi(page: Page) {
  const menuItem = {
    id: 'item_burger',
    businessId: 'biz_main',
    categoryId: 'cat_mains',
    name: 'Beef Burger',
    description: null,
    price: 1600,
    isAvailable: true,
    prepTimeMinutes: 10,
  };
  const table = {
    id: 'table_1',
    businessId: 'biz_main',
    label: 'T1',
    capacity: 2,
    status: 'available',
  };
  let order: Record<string, unknown> | null = null;
  let ticket: Record<string, unknown> | null = null;
  const paymentRequests: { orderId: string; amount: number; method: string }[] = [];

  await page.route('**/api/restaurant/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === 'GET' && path.endsWith('/menu')) {
      return json(route, { categories: [{ id: 'cat_mains', name: 'Mains', items: [menuItem] }] });
    }
    if (method === 'GET' && path.endsWith('/tables')) return json(route, [table]);
    if (method === 'POST' && path.endsWith('/orders')) {
      const body = request.postDataJSON() as {
        table_id?: string;
        items?: { menu_item_id?: string; quantity?: number }[];
      };
      if (
        body.table_id !== table.id
        || body.items?.length !== 1
        || body.items[0]?.menu_item_id !== menuItem.id
        || body.items[0]?.quantity !== 1
      ) {
        return json(route, { error: 'Unexpected order payload' }, 400);
      }
      order = {
        id: 'order_e2e_0001',
        businessId: 'biz_main',
        tableId: table.id,
        status: 'pending',
        createdBy: 'usr_restaurant',
        total: menuItem.price,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [{
          id: 'order_item_1',
          orderId: 'order_e2e_0001',
          menuItemId: menuItem.id,
          name: menuItem.name,
          quantity: 1,
          unitPrice: menuItem.price,
          notes: null,
          status: 'pending',
        }],
      };
      ticket = {
        id: 'ticket_e2e_0001',
        orderId: 'order_e2e_0001',
        businessId: 'biz_main',
        status: 'new',
        createdAt: new Date().toISOString(),
        completedAt: null,
        tableLabel: table.label,
        order,
      };
      table.status = 'occupied';
      return json(route, order, 201);
    }
    if (method === 'GET' && path.endsWith('/kds')) {
      return json(route, ticket && ticket.status !== 'done' ? [ticket] : []);
    }
    if (method === 'PATCH' && path.includes('/kds/')) {
      const body = request.postDataJSON() as { status?: string };
      if (!path.endsWith(`/kds/${ticket?.id}/status`) || body.status !== 'done') {
        return json(route, { error: 'Unexpected KDS transition' }, 400);
      }
      if (order) order.status = 'ready';
      if (ticket) ticket.status = 'done';
      return json(route, ticket);
    }
    if (method === 'GET' && path.endsWith('/orders')) return json(route, order ? [order] : []);
    if (method === 'POST' && path.includes('/orders/') && path.endsWith('/payments')) {
      const body = request.postDataJSON() as { amount?: number; method?: string };
      if (!path.endsWith(`/orders/${order?.id}/payments`)) {
        return json(route, { error: 'Unexpected payment order' }, 400);
      }
      if (body.amount !== menuItem.price / 100 || body.method !== 'cash') {
        return json(route, { error: 'Unexpected payment payload' }, 400);
      }
      const paymentAmount = body.amount as number;
      const paymentMethod = body.method as string;
      paymentRequests.push({
        orderId: String(order.id),
        amount: paymentAmount,
        method: paymentMethod,
      });
      if (order) {
        order.status = 'paid';
        order.payments = [{
          id: 'payment_e2e_0001',
          businessId: 'biz_main',
          orderId: order.id,
          method: paymentMethod,
          amount: paymentAmount,
          status: 'completed',
          paidAt: new Date().toISOString(),
        }];
      }
      table.status = 'available';
      return json(route, order, 201);
    }
    if (method === 'PATCH' && path.includes('/orders/')) {
      const body = request.postDataJSON() as { status?: string };
      if (!path.endsWith(`/orders/${order?.id}/status`) || body.status !== 'paid') {
        return json(route, { error: 'Unexpected order transition' }, 400);
      }
      if (order) order.status = 'paid';
      table.status = 'available';
      return json(route, order);
    }
    return json(route, { error: `Unhandled mock request: ${method} ${path}` }, 501);
  });

  return {
    getPaymentRequests: () => paymentRequests,
  };
}

export async function expectPath(page: Page, path: string) {
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
}
