// Quick mobile-viewport verification against the live deployment (both locales).
// Usage: SHOT_URL=... SHOT_EMAIL=... SHOT_PASSWORD=... npx tsx scripts/mobile-check.ts
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.SHOT_URL!;
const OUT = 'docs/screenshots';

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  for (const locale of ['zh-CN', 'en']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, // iPhone-ish
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: locale, domain: new URL(BASE).hostname, path: '/' },
    ]);
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', process.env.SHOT_EMAIL!);
    await page.fill('input[type="password"]', process.env.SHOT_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/upload', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    // Wait for the deployment that ships the mobile bottom tab bar
    for (let i = 0; i < 20; i++) {
      if ((await page.locator('nav.fixed').count()) > 0) break;
      console.log('old build still live, waiting 15s…');
      await page.waitForTimeout(15000);
      await page.reload({ waitUntil: 'networkidle' });
    }
    await page.screenshot({ path: `${OUT}/mobile-upload-${locale}.png` });
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${OUT}/mobile-dashboard-${locale}.png` });
    console.log(`${locale} captured`);
    await context.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
