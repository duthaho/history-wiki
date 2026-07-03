import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync } from 'fs';

const files = {
  '/': readFileSync('dist/index.html'),
  '/index.html': readFileSync('dist/index.html'),
  '/city.html': readFileSync('dist/city.html'),
};
const server = createServer((req, res) => {
  const body = files[req.url.split('?')[0]];
  if (!body) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(body);
}).listen(8125);

const browser = await chromium.launch();
const errors = [];
let failures = 0;
const check = (ok, label) => {
  console.log((ok ? '  ✓ ' : '  ✗ ') + label);
  if (!ok) failures++;
};

// ── desktop: drive-tour mode ──
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:8125/city.html');
await page.waitForTimeout(7000);
check(await page.locator('#driveHud').isVisible(), 'drive HUD visible on load (drive mode default)');
await page.screenshot({ path: 'city-1-intro.png' });

// manual driving: hold W, expect a near-prompt while passing houses
await page.keyboard.down('w');
let sawPrompt = false;
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(400);
  if (await page.locator('#nearPrompt.on').count()) { sawPrompt = true; break; }
}
await page.keyboard.up('w');
check(sawPrompt, 'passing a house shows its prompt');
await page.screenshot({ path: 'city-2-driving-manual.png' });

// E opens the building panel
if (sawPrompt) {
  await page.keyboard.press('e');
  await page.waitForTimeout(700);
  check(await page.locator('#sidePanel.open').count() > 0, 'E opens the building panel');
  await page.screenshot({ path: 'city-3-e-open.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

// M toggles aerial mode
await page.keyboard.press('m');
await page.waitForTimeout(1600);
check(!(await page.locator('#driveHud').isVisible()), 'M switches to aerial (HUD hidden)');
await page.screenshot({ path: 'city-4-aerial.png' });

// search → auto-drive tour → arrival panel + back in drive mode
await page.fill('#searchBox', 'tran hung');
await page.waitForTimeout(600);
await page.press('#searchBox', 'Enter');
await page.waitForTimeout(5500);
check(await page.locator('#sidePanel.open').count() > 0, 'search auto-drives and opens panel');
check((await page.textContent('#pageTitle') || '').includes('Trần'), 'panel shows Trần Hưng Đạo');
check(await page.locator('#driveHud').isVisible(), 'arrival hands back the wheel (drive mode)');
await page.screenshot({ path: 'city-5-arrived.png' });

// ── reduced motion: aerial default, instant arrivals ──
const rmCtx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1200, height: 800 } });
const rm = await rmCtx.newPage();
rm.on('pageerror', e => errors.push('RM: ' + e));
await rm.goto('http://localhost:8125/city.html');
await rm.waitForTimeout(5000);
await rm.fill('#searchBox', 'hung vuong');
await rm.press('#searchBox', 'Enter');
await rm.waitForTimeout(900);
check(await rm.locator('#sidePanel.open').count() > 0, 'reduced-motion arrival is instant');
await rmCtx.close();

// ── index cross-link ──
const idx = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await idx.goto('http://localhost:8125/index.html');
await idx.waitForTimeout(1500);
check(await idx.locator('a.view-link[href="city.html"]').count() > 0, 'index.html links to city');

// ── mobile: joystick visible in drive mode ──
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
mob.on('pageerror', e => errors.push('MOBILE: ' + e));
await mob.goto('http://localhost:8125/city.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
await mob.waitForTimeout(9000);
check(await mob.locator('#joystick').isVisible(), 'mobile shows virtual joystick');
await mob.screenshot({ path: 'city-6-mobile.png' });

check(errors.length === 0, 'no console/page errors' + (errors.length ? ' — ' + errors.join(' | ').slice(0, 400) : ''));

await browser.close();
server.close();
if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
console.log('smoke OK');
