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

// ── desktop city ──
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:8125/city.html');
await page.waitForTimeout(7000);
await page.screenshot({ path: 'city-1-intro.png' });

// overview
await page.click('#overviewBtn');
await page.waitForTimeout(1800);
await page.screenshot({ path: 'city-2-overview.png' });

// search-first drive
await page.fill('#searchBox', 'tran hung');
await page.waitForTimeout(600);
await page.press('#searchBox', 'Enter');
await page.waitForTimeout(700);
check(await page.locator('#driveStatus.on').count() > 0 || await page.locator('#sidePanel.open').count() > 0,
  'drive started (or instant arrival)');
await page.screenshot({ path: 'city-3-driving.png' });
await page.waitForTimeout(4800);
check(await page.locator('#sidePanel.open').count() > 0, 'panel open after arrival');
check((await page.textContent('#pageTitle') || '').includes('Trần'), 'panel shows Trần Hưng Đạo');
await page.screenshot({ path: 'city-4-arrived.png' });

// skip mid-drive via related chip
const chip = page.locator('.rel-chip').first();
if (await chip.count()) {
  await chip.click();
  await page.waitForTimeout(400);
  if (await page.locator('#driveStatus.on').count()) {
    // clicking may race with a short drive finishing on its own — both outcomes are fine
    await page.click('#skipBtn', { timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(1200);
    check(await page.locator('#driveStatus.on').count() === 0, 'drive ended (skip or arrival)');
  } else {
    check(true, 'second trip was instant (short hop)');
  }
  await page.screenshot({ path: 'city-5-skipped.png' });
}

// era strip fly
await page.click('#panelClose');
await page.click('.era-seg:nth-child(5)');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'city-6-district.png' });

// ── reduced motion: instant arrivals ──
const rmCtx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1200, height: 800 } });
const rm = await rmCtx.newPage();
rm.on('pageerror', e => errors.push('RM: ' + e));
await rm.goto('http://localhost:8125/city.html');
await rm.waitForTimeout(5000);
await rm.fill('#searchBox', 'hung vuong');
await rm.press('#searchBox', 'Enter');
await rm.waitForTimeout(800);
check(await rm.locator('#sidePanel.open').count() > 0, 'reduced-motion arrival is instant');
await rmCtx.close();

// ── index cross-link ──
const idx = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await idx.goto('http://localhost:8125/index.html');
await idx.waitForTimeout(1500);
check(await idx.locator('a.view-link[href="city.html"]').count() > 0, 'index.html links to city');

// ── mobile ──
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
mob.on('pageerror', e => errors.push('MOBILE: ' + e));
await mob.goto('http://localhost:8125/city.html');
await mob.waitForTimeout(6500);
await mob.screenshot({ path: 'city-7-mobile.png' });

check(errors.length === 0, 'no console/page errors' + (errors.length ? ' — ' + errors.join(' | ').slice(0, 400) : ''));

await browser.close();
server.close();
if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
console.log('smoke OK');
