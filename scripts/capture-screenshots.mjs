import { chromium } from 'playwright';
import { existsSync, writeFileSync } from 'node:fs';
const base = process.env.PREVIEW_URL ?? 'http://localhost:5175';
const live = process.argv.includes('--tavus-once');
if (live && existsSync('.env.tavus-test-called'))
  throw new Error('The one permitted Tavus attempt has already been used.');
const browser = await chromium.launch({
  channel: 'chrome',
  headless: !live,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    permissions: ['microphone'],
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('Page error:', e.message));
  await page.goto(base);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/images/home.jpg', type: 'jpeg', quality: 75 });
  await page.getByRole('button', { name: 'Sign in', exact: false }).first().click();
  await page.screenshot({ path: 'docs/images/sign-in.jpg', type: 'jpeg', quality: 75 });
  await page.getByRole('button', { name: 'हिन्दी', exact: true }).click();
  await page.screenshot({ path: 'docs/images/sign-in-hindi.jpg', type: 'jpeg', quality: 75 });
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: 'Explore offline demo', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'My care space', exact: true }).click();
  await page.getByRole('heading', { name: 'A familiar face. Your own care context.' }).waitFor();
  await page.screenshot({
    path: 'docs/images/taus-workspace.jpg',
    type: 'jpeg',
    quality: 75,
    fullPage: true,
  });
  if (live) {
    await page.getByRole('checkbox', { name: /I agree to share/ }).check();
    await page.getByRole('button', { name: 'Open video conversation', exact: true }).click();
    await page.waitForFunction(
      () => typeof document.querySelector('tavus-embed')?.startConversation === 'function',
      { timeout: 30000 },
    );
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      window.__tavusEvents = [];
      const el = document.querySelector('tavus-embed');
      for (const type of [
        'tavus:conversation-started',
        'tavus:conversation-ended',
        'tavus:error',
        'tavus:state-change',
        'tavus:protocol-message',
      ])
        el.addEventListener(type, (e) => {
          const d = e.detail;
          if (type !== 'tavus:protocol-message' || d.event_type?.includes('utterance'))
            window.__tavusEvents.push({ type, detail: d });
        });
    });
    writeFileSync('.env.tavus-test-called', new Date().toISOString(), { mode: 0o600 });
    await page.evaluate(() => {
      document.querySelector('tavus-embed').startConversation();
    });
    await page.waitForTimeout(25000);
    const connected = await page.evaluate(() =>
      window.__tavusEvents.some((e) => e.type === 'tavus:conversation-started'),
    );
    if (connected) {
      await page.evaluate(() =>
        document
          .querySelector('tavus-embed')
          .sendMessage(
            'Please tell me the patient name and one medicine from the current care snapshot. Do not make any changes.',
          ),
      );
      await page.waitForTimeout(14000);
      await page
        .locator('tavus-embed')
        .screenshot({ path: 'docs/images/taus-live.jpg', type: 'jpeg', quality: 80 });
    }
    console.log(
      JSON.stringify({ connected, events: await page.evaluate(() => window.__tavusEvents) }),
    );
    await page.evaluate(() => document.querySelector('tavus-embed')?.endConversation());
  }
  console.log(
    'Screenshots saved from the actual app; care workspace uses fictional offline fixtures.',
  );
} finally {
  await browser.close();
}
