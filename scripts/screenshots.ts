// Capture English-locale README screenshots from the live deployment.
// Usage: SHOT_URL=https://... SHOT_EMAIL=... SHOT_PASSWORD=... npx tsx scripts/screenshots.ts
// Uses the system Chrome (channel: 'chrome') — no Playwright browser download needed.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.SHOT_URL ?? 'https://fnb-invoice-manager.vercel.app';
const EMAIL = process.env.SHOT_EMAIL;
const PASSWORD = process.env.SHOT_PASSWORD;
const OUT = 'docs/screenshots';

async function main() {
  if (!EMAIL || !PASSWORD) throw new Error('SHOT_EMAIL / SHOT_PASSWORD env vars required');
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await context.addCookies([
    { name: 'NEXT_LOCALE', value: 'en', domain: new URL(BASE).hostname, path: '/' },
  ]);
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/login.png` });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/upload', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  console.log('logged in');

  // Upload screen (pick phase with mode toggle + dropzone)
  await page.screenshot({ path: `${OUT}/upload.png` });
  console.log('upload.png');

  // Invoices list
  await page.goto(`${BASE}/invoices`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/invoices.png` });
  console.log('invoices.png');

  // First invoice detail (original photo + extracted data side by side)
  const firstRow = page.locator('tbody a[href*="/invoices/"]').first();
  if (await firstRow.count()) {
    await firstRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // let the signed-url image render
    await page.screenshot({ path: `${OUT}/invoice-detail.png`, fullPage: true });
    console.log('invoice-detail.png');
  } else {
    console.log('no invoices found — skipping detail shot');
  }

  // Dashboard (admin) — generate the AI report if not cached yet
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  const generate = page.getByRole('button', { name: 'Generate', exact: true });
  if (await generate.count()) {
    console.log('generating AI insights (may take ~1 min)…');
    await generate.click();
    try {
      await page.getByText('中文分析').waitFor({ timeout: 120000 });
      console.log('insights generated');
    } catch {
      console.log('insights generation timed out — capturing dashboard as-is');
    }
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: true });
  console.log('dashboard.png');

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
