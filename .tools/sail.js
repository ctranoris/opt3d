// Headless check of the sailing model in the real page: serves the repo,
// sails her on a reach, puts the helm over, tacks and takes the sheet in
// hand, printing the state after each step.
// usage: node .tools/sail.js [optimist|laser]
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

(async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html?boat=${process.argv[2] || 'optimist'}`;

  const browser = await puppeteer.launch({
    headless: 'new',
    protocolTimeout: 0,
    executablePath: process.env.CHROME || undefined,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 320, height: 200, deviceScaleFactor: 1 });
  const msgs = [];
  page.on('console', (m) => { if (m.type() === 'error') msgs.push(m.text()); });
  page.on('pageerror', (e) => msgs.push('pageerror ' + e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.OPTi && window.OPTi.boat, { timeout: 120000 });

  const run = (label, frames, keys = []) => page.evaluate(async (label, frames, keys) => {
    const O = window.OPTi, s = O.state;
    keys.forEach((k) => O.keys.add(k));
    await O.frames(frames);
    keys.forEach((k) => O.keys.delete(k));
    const f = (v, d = 1) => (+v).toFixed(d);
    return `${label.padEnd(34)} t ${f(s.t)}  hdg ${f(s.heading, 0)}  twa ${f(s.twa, 0)}  boom ${f(s.boom, 0)}  ` +
      `kn ${f(s.speed * 18, 2)}  lee ${f(s.leewaySpeed * 18, 2)}  heel ${f(s.heel)}  hike ${f(s.hike, 2)}  ` +
      `rud ${f(s.rudder, 0)}  fill ${f(s.fill, 2)}  auto ${s.autoSail}  free ${s.freeBoom}  out ${f(s.sheetOut, 0)}`;
  }, label, frames, keys);

  const steps = [
    ['beam reach, hands off', 250],
    ['helm to starboard (luff), 40 frames', 40, ['d']],
    ['hands off', 120],
    ['helm to starboard: tack', 90, ['d']],
    ['hands off on the new tack', 200],
    ['sheet in hand, haul in', 30, ['w']],
    ['let it right out', 60, ['s']],
    ['coast with the sail flagging', 120],
    ['haul in again', 40, ['w']],
    ['sail on', 150],
  ];
  for (const [label, n, keys] of steps) console.log(await run(label, n, keys));
  console.log(msgs.length ? 'ERRORS:\n' + msgs.join('\n') : 'no console errors');
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
