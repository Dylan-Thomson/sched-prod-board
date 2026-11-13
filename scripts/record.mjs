// Records the board in use. Usage: node scripts/record.mjs <board url> <out dir>
import { chromium } from 'playwright';
import fs from 'node:fs';

const [url, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: out, size: { width: 1280, height: 720 } },
  locale: 'en-GB',
  timezoneId: 'Europe/London',
});
const page = await context.newPage();
const t0 = Date.now();
const mmss = () => {
  const s = Math.floor((Date.now() - t0) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const marks = [];
const mark = (what, extra = {}) => { const m = { at: mmss(), what, ...extra }; marks.push(m); console.log(JSON.stringify(m)); };

const overlay = () => page.evaluate(() => {
  if (document.getElementById('rec-note')) return;
  const note = document.createElement('div');
  note.id = 'rec-note';
  note.style.cssText = 'position:fixed;left:0;right:0;bottom:0;padding:10px 24px;background:#111;color:#fff;font:15px system-ui;z-index:9';
  document.body.append(note);
  const dot = document.createElement('div');
  dot.id = 'rec-cursor';
  dot.style.cssText = 'position:fixed;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,0,80,.6);pointer-events:none;z-index:10;left:-50px;top:-50px';
  document.body.append(dot);
  addEventListener('mousemove', (e) => { dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px`; });
});
const say = async (text) => { await overlay(); await page.evaluate((t) => { document.getElementById('rec-note').textContent = `recording note · ${t}`; }, text); };

const acks = [];
page.on('response', async (r) => { if (r.url().includes('/ack?')) acks.push({ at: mmss(), ...(await r.json()) }); });

// open-board
await page.route('**/incidents?**', async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); }, { times: 1 });
await page.goto(url);
await say('open-board: loader shows while the first incidents load (first call held 1.5s to make it visible)');
mark('loader visible');
await page.locator('[data-testid="incident-row"]').first().waitFor();
mark('incidents loaded', { rows: await page.getByTestId('incident-row').count() });
await say(`open-board: incidents listed, newest first; times in viewer's zone (en-GB, dd/mm); build ${await page.getByTestId('build-sha').textContent()}`);
await page.waitForTimeout(3000);

// watch-board
const rows = page.getByTestId('incident-row');
const topBefore = await rows.first().getAttribute('data-id');
await say(`watch-board: no reload; top row is ${topBefore}. Waiting for the next incident…`);
await page.waitForFunction((id) => document.querySelector('[data-testid="incident-row"]').dataset.id !== id, topBefore, { timeout: 60000 });
const topAfter = await rows.first().getAttribute('data-id');
mark('new incident on top', { topBefore, topAfter });
await say(`watch-board: ${topAfter} arrived at the top without a reload`);
await page.waitForTimeout(2500);

// ack-incident: right after an arrival, so the list is still
await page.waitForFunction((id) => document.querySelector('[data-testid="incident-row"]').dataset.id !== id, topAfter, { timeout: 60000 });
const target = rows.nth(2);
const targetId = await target.getAttribute('data-id');
await say(`ack-incident: acking ${targetId}`);
const box = await target.getByTestId('ack').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
await page.waitForTimeout(600);
mark('ack click', { aimedAt: targetId });
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.locator(`[data-id="${targetId}"] [data-testid="acked"]`).waitFor();
mark('acked mark shown', { id: targetId });
await say(`ack-incident: ${targetId} acked; the row shows "acked"`);
await page.waitForTimeout(3000);

// hazard: the list moves under the pointer
const aimRow = rows.nth(6);
const acksBefore = acks.length;
const aimId = await aimRow.getAttribute('data-id');
const aimBox = await aimRow.getByTestId('ack').boundingBox();
const top = await rows.first().getAttribute('data-id');
await say(`risk: pointer on Ack for ${aimId}. A new incident arrives while the user is about to click…`);
await page.mouse.move(aimBox.x + aimBox.width / 2, aimBox.y + aimBox.height / 2, { steps: 15 });
await page.waitForFunction((id) => document.querySelector('[data-testid="incident-row"]').dataset.id !== id, top, { timeout: 60000 });
await page.waitForTimeout(250);
mark('hazard click', { aimedAt: aimId });
await page.mouse.click(aimBox.x + aimBox.width / 2, aimBox.y + aimBox.height / 2);
await page.waitForTimeout(1200);
const hitId = acks.length > acksBefore ? acks.at(-1).id : 'nothing';
mark('hazard result', { aimedAt: aimId, acked: hitId });
await say(`risk: aimed at ${aimId}, but the list moved one row down and ${hitId} was acked instead`);
await page.waitForTimeout(4000);

await say(`end · build ${await page.getByTestId('build-sha').textContent()}`);
await page.waitForTimeout(2000);
const video = page.video();
await context.close();
await browser.close();
fs.renameSync(await video.path(), `${out}/raw.webm`);
fs.writeFileSync(`${out}/marks.json`, JSON.stringify({ marks, acks }, null, 2));
