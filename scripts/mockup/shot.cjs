#!/usr/bin/env node
/*
 * mockup/shot.cjs — screenshot a Claude-Design / HTML mockup for the mockup-to-epics skill.
 *
 * Usage:
 *   node scripts/mockup/shot.cjs <abs-path-to-html> <out-dir> [tour.json]
 *
 * - <html>     absolute path to the prototype (single-file offline HTML loads via file://;
 *              a multi-file prototype should be served first: `python3 -m http.server` then
 *              pass the http URL as <html>).
 * - <out-dir>  where PNGs are written (created if missing).
 * - [tour.json] optional array of steps to "play" the SPA before/with each shot:
 *     [
 *       { "name": "01-dashboard" },                              // shoot landing
 *       { "name": "02-items",    "clickText": "項目" },           // click nav, then shoot
 *       { "name": "03-settings", "clickText": "設定" },
 *       { "name": "04-modal",    "clickSelector": "button:has-text('新增')" },
 *       { "name": "05-mobile",   "viewport": [390, 844] }        // re-open at mobile size
 *     ]
 *   With no tour.json, a single landing screenshot "01-landing.png" is taken.
 *
 * Reuses the Playwright + Chromium already installed under next-app/ (no extra install).
 */
const fs = require('fs');
const path = require('path');

function resolvePlaywright() {
  const root = path.resolve(__dirname, '..', '..', 'next-app');
  const candidates = [
    path.join(root, 'node_modules', 'playwright-core', 'index.js'),
    path.join(root, 'node_modules', 'playwright', 'index.js'),
  ];
  // pnpm layout
  const pnpmDir = path.join(root, 'node_modules', '.pnpm');
  if (fs.existsSync(pnpmDir)) {
    for (const d of fs.readdirSync(pnpmDir)) {
      if (d.startsWith('playwright-core@')) {
        candidates.push(path.join(pnpmDir, d, 'node_modules', 'playwright-core', 'index.js'));
      }
    }
  }
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('playwright-core not found under next-app/. Run `pnpm install` in next-app first.');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const [, , htmlArg, outArg, tourArg] = process.argv;
  if (!htmlArg || !outArg) {
    console.error('usage: node scripts/mockup/shot.cjs <abs-path-to-html> <out-dir> [tour.json]');
    process.exit(2);
  }
  const url = htmlArg.startsWith('http') ? htmlArg : 'file://' + path.resolve(htmlArg);
  const outDir = path.resolve(outArg);
  fs.mkdirSync(outDir, { recursive: true });
  const tour = tourArg && fs.existsSync(tourArg)
    ? JSON.parse(fs.readFileSync(tourArg, 'utf8'))
    : [{ name: '01-landing' }];

  const { chromium } = require(resolvePlaywright());
  const browser = await chromium.launch();
  const log = [];

  const open = async (w, h) => {
    const p = await browser.newPage({ viewport: { width: w || 1440, height: h || 900 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    await p.goto(url, { waitUntil: 'load', timeout: 30000 }).catch((e) => errs.push('goto:' + e));
    await sleep(3500); // let React/Babel bootstrap
    return { p, errs };
  };

  let { p, errs } = await open(1440, 900);
  if (errs.length) log.push('page-errors: ' + errs.slice(0, 3).join(' | '));

  for (const step of tour) {
    try {
      if (step.viewport) { await p.close(); ({ p } = await open(step.viewport[0], step.viewport[1])); }
      if (step.clickText) await p.getByText(step.clickText, { exact: step.exact !== false }).first().click({ timeout: 8000 });
      if (step.clickSelector) await p.locator(step.clickSelector).first().click({ timeout: 8000 });
      await sleep(step.wait || 1100);
      await p.screenshot({ path: path.join(outDir, step.name + '.png'), fullPage: step.fullPage !== false });
      log.push(step.name + ' OK');
    } catch (e) {
      log.push(step.name + ' ERR ' + String(e).slice(0, 70));
    }
  }
  await browser.close();
  console.log(log.join('\n'));
})();
