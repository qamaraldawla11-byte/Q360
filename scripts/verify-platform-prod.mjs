// Production browser verification for the Platform Operations experience.
// Run: node scripts/verify-platform-prod.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const PLATFORM = 'https://admin.q360.app';
const TENANT = 'https://q360.vercel.app';
const OUT = 'tmp/platform-verification';
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, pass, detail) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();

// 1. Signed-out visit to Platform origin root → Platform sign-in
await page.goto(PLATFORM + '/', { waitUntil: 'networkidle' });
const heading = await page.textContent('h1').catch(() => null);
check('signed-out / shows Platform sign-in', heading?.includes('Platform Operations') ?? false, `h1="${heading}", title="${await page.title()}"`);
await page.screenshot({ path: `${OUT}/01-platform-login.png` });

// 2. Signed-out deep link /people → redirect to /login (deep link preserved)
await page.goto(PLATFORM + '/people', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const url2 = page.url();
check('signed-out /people redirects to /login', url2.startsWith(PLATFORM + '/login'), `final URL=${url2}`);
await page.screenshot({ path: `${OUT}/02-deeplink-redirect.png` });

// 3. /no-access renders the explicit denial surface
await page.goto(PLATFORM + '/no-access', { waitUntil: 'networkidle' });
const h1_3 = await page.textContent('h1').catch(() => null);
check('/no-access renders denial screen', h1_3?.includes('No Platform Access') ?? false, `h1="${h1_3}"`);
await page.screenshot({ path: `${OUT}/03-no-access.png` });

// 4. Legacy /admin/users → maps to /people → guard bounces to /login
await page.goto(PLATFORM + '/admin/users', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const url4 = page.url();
check('legacy /admin/users resolves via /people to /login', url4.startsWith(PLATFORM + '/login'), `final URL=${url4}`);

// 5. No marketing/landing content on Platform origin
const bodyText = await page.textContent('body');
check('no landing-page marketing on Platform origin', !(bodyText?.includes('calm, Q-guided') ?? false), 'landing copy absent');

// 6. Tenant origin unchanged: still the public/tenant experience
await page.goto(TENANT + '/', { waitUntil: 'networkidle' });
const h1Tenant = await page.textContent('h1').catch(() => null);
const tenantBody = await page.textContent('body');
const isTenantLanding = !tenantBody?.includes('Platform Operations');
check('tenant origin still serves tenant/public experience', isTenantLanding, `h1="${h1Tenant?.slice(0, 60)}"`);
await page.screenshot({ path: `${OUT}/06-tenant-landing.png` });

// 7. Tenant origin /admin/* forwards cross-origin to the Platform origin
await page.goto(TENANT + '/admin/users', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const url7 = page.url();
check('tenant /admin/users forwards to Platform origin', url7.startsWith(PLATFORM), `final URL=${url7}`);
await page.screenshot({ path: `${OUT}/07-cross-origin-handoff.png` });

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
