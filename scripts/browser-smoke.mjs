import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.PREVIEW_URL ?? 'http://localhost:5175');
  await page.getByRole('button', { name: 'Get started with Taus' }).click();
  await page.getByRole('button', { name: 'Explore offline demo', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'My care space', exact: true }).click();
  assert.equal(await page.locator('tavus-embed').count(), 0, 'Video must not load before consent');
  await page.getByRole('button', { name: 'Yes, I took this dose', exact: true }).click();
  await page
    .getByText('Recorded as taken. Thank you. Say next to review another medicine.', {
      exact: true,
    })
    .waitFor();
  await page.getByRole('textbox', { name: 'Ask Taus', exact: true }).fill('What is my name?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByText(/I am helping Dadaji/).waitFor();
  await page.getByRole('button', { name: /Medication Schedule \(/ }).click();
  await page.getByRole('button', { name: '+ Add Medication', exact: true }).click();
  assert.equal(await page.getByRole('dialog').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: 'हिन्दी', exact: true }).click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'hi');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    'Mobile layout must not overflow',
  );
  assert.deepEqual(errors, []);
  console.log(
    'Browser smoke passed: explicit demo, consent gate, dose write, patient context, modal Escape, Hindi, mobile layout. No paid API calls.',
  );
} finally {
  await browser.close();
}
