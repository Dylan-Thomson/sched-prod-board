import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BOARD = process.env.BOARD_URL ?? 'http://localhost:4173';
let browser;

before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function open(options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(BOARD);
  return { context, page };
}

test('loader shows, then the list replaces it', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('**/incidents?**', async (route) => { await held; await route.continue(); });
  await page.goto(BOARD);
  await page.getByTestId('loader').waitFor({ state: 'visible' });
  release();
  await page.locator('[data-testid="incident-row"]').first().waitFor();
  assert.equal(await page.getByTestId('loader').count(), 0);
  await context.close();
});

test('footer sha matches the build meta', async () => {
  const { context, page } = await open();
  const meta = await page.locator('meta[name="build"]').getAttribute('content');
  assert.match(meta, /^[0-9a-f]{40}$/);
  assert.equal(await page.getByTestId('build-sha').textContent(), meta);
  await context.close();
});

test('a new incident appears at the top without a reload', async () => {
  const { context, page } = await open();
  const rows = page.locator('[data-testid="incident-row"]');
  await rows.first().waitFor();
  const firstId = await rows.first().getAttribute('data-id');
  await page.waitForFunction(
    (id) => document.querySelector('[data-testid="incident-row"]').dataset.id !== id,
    firstId,
    { timeout: 30_000 },
  );
  assert.notEqual(await rows.first().getAttribute('data-id'), firstId);
  await context.close();
});

test('Ack acks that incident and marks the row', async () => {
  const { context, page } = await open();
  const row = page.locator('[data-testid="incident-row"]').last();
  await row.waitFor();
  const id = await row.getAttribute('data-id');
  const reply = page.waitForResponse((r) => r.url().includes('/ack'));
  await row.getByTestId('ack').click();
  const body = await (await reply).json();
  assert.equal(body.id, id);
  await page.locator(`[data-id="${id}"] [data-testid="acked"]`).waitFor();
  await context.close();
});

test('Auckland and Berlin each see their own zone and order', async () => {
  for (const [timezoneId, locale] of [['Pacific/Auckland', 'en-NZ'], ['Europe/Berlin', 'de-DE']]) {
    const { context, page } = await open({ timezoneId, locale });
    const time = page.locator('[data-testid="incident-row"] time').first();
    await time.waitFor();
    const iso = await time.getAttribute('datetime');
    const expected = await page.evaluate(
      ([value, tz, loc]) => new Intl.DateTimeFormat(loc, {
        timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
      }).format(new Date(value)),
      [iso, timezoneId, locale],
    );
    assert.equal(await time.textContent(), expected);
    await context.close();
  }
});
