import { Hono } from 'hono';
import { requireDatabaseUrl } from '../utils/env.js';

requireDatabaseUrl();

process.env.JWT_SECRET ||= 'otp-verification-secret-with-sufficient-length';
delete process.env.RESEND_API_KEY;
process.env.NODE_ENV = 'test';

const { default: authRoutes } = await import('../routes/auth.js');

const app = new Hono();
app.route('/api/auth', authRoutes);
const { closeDatabase } = await import('../db/client.js');

const email = `otp-test-${Date.now()}@example.com`;
let otpOutput = '';
const originalLog = console.log;
console.log = (...args: unknown[]) => {
    otpOutput += args.map(String).join(' ');
};

try {
    const requestResponse = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    const requestBody = await requestResponse.json() as { success?: boolean };

    if (requestResponse.status !== 200 || !requestBody.success) {
        throw new Error(`OTP request failed with status ${requestResponse.status}`);
    }

    const code = otpOutput.match(new RegExp(`\\[DEV OTP\\] Code for ${email}: (\\d{6})`))?.[1];
    if (!code) {
        throw new Error('OTP was not present in the development console output');
    }

    const wrongCode = code === '000000' ? '000001' : '000000';
    const wrongResponse = await app.request('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: wrongCode }),
    });
    if (wrongResponse.status !== 400) {
        throw new Error(`Wrong OTP returned status ${wrongResponse.status}`);
    }

    const verifyResponse = await app.request('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
    });
    const verifyBody = await verifyResponse.json() as { token?: string };
    if (verifyResponse.status !== 200 || !verifyBody.token) {
        throw new Error(`Valid OTP returned status ${verifyResponse.status}`);
    }

    const sessionResponse = await app.request('/api/auth/session', {
        headers: { Authorization: `Bearer ${verifyBody.token}` },
    });
    const sessionBody = await sessionResponse.json() as { email?: string };
    if (sessionResponse.status !== 200 || sessionBody.email !== email) {
        throw new Error(`Session validation returned status ${sessionResponse.status}`);
    }

    const reuseResponse = await app.request('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
    });
    if (reuseResponse.status !== 400) {
        throw new Error(`Reused OTP returned status ${reuseResponse.status}`);
    }

    originalLog('OTP verification passed: request, reject, verify, session, consume.');
} catch (error) {
    originalLog('OTP verification failed:', error);
    process.exitCode = 1;
} finally {
    console.log = originalLog;
    await closeDatabase();
}
