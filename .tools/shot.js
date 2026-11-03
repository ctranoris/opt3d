// Screenshot + console capture for the Optimist viewer.
// usage: node shot.js [url] [outPrefix]
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = process.argv[2] || 'http://127.0.0.1:8137/index.html';
const out = process.argv[3] || path.join(__dirname, '..', 'build', 'shot');
const W = 1440, H = 900;

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.CHROME || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox',
      '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  const msgs = [];
  page.on('console', (m) => msgs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => msgs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
  page.on('requestfailed', (r) =>
    msgs.push(`[requestfailed] ${r.url()} ${r.failure() && r.failure().errorText}`));

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

  // software GL is slow; wait for the boot overlay to clear rather than a fixed delay
  let boot = null;
  try {
    await page.waitForFunction(() => {
      const b = document.getElementById('boot');
      return b && (b.classList.contains('hide') || b.classList.contains('err'));
    }, { timeout: 120000, polling: 500 });
  } catch (e) { /* report state below */ }
  await new Promise((r) => setTimeout(r, 3000));

  boot = await page.evaluate(() => {
    const b = document.getElementById('boot');
    return {
      hidden: b.classList.contains('hide'),
      err: b.classList.contains('err'),
      text: document.getElementById('bootMsg').textContent.slice(0, 600),
      canvas: !!document.querySelector('canvas'),
    };
  });
  console.log('BOOT', JSON.stringify(boot));
  if (boot.err) {
    fs.writeFileSync(path.join(__dirname, '..', 'build', 'console.log'), msgs.join('\n'));
    console.log(msgs.join('\n'));
    await browser.close();
    process.exit(2);
  }

  /**
   * Wait until the camera has stopped moving.  The fly-to is eased inside
   * the render loop and software GL runs at a few frames a second, so a
   * fixed delay either wastes time or catches the camera mid-flight.
   */
  async function settle(timeout = 30000) {
    await page.waitForFunction(() => {
      const c = window.OPTi && window.OPTi.camera;
      if (!c) return false;
      const k = c.position.toArray().map((v) => v.toFixed(4)).join(',');
      const same = window.__camLast === k;
      window.__camLast = k;
      return same;
    }, { timeout, polling: 250 });
    await new Promise((r) => setTimeout(r, 400));
  }

  /** Wait for a few rendered frames, so a slider change has taken effect. */
  async function frames(n = 4) {
    await page.evaluate((k) => new Promise((res) => {
      let i = 0;
      const step = () => (++i >= k ? res() : requestAnimationFrame(step));
      requestAnimationFrame(step);
    }), n);
  }

  const shots = [
    ['quarter', {}],
  ];
  for (const [name, action] of shots) {
    await page.screenshot({ path: `${out}_${name}.png` });
  }

  // camera presets
  for (const cam of ['windward', 'leeward', 'bow', 'stern', 'top', 'sail']) {
    await page.click(`#cams button[data-cam="${cam}"]`);
    await settle();
    await page.screenshot({ path: `${out}_cam_${cam}.png` });
  }
  await page.click('#cams button[data-cam="quarter"]');
  await settle();

  // stop the auto sail so the trim is deterministic, then sheet in / out
  await page.evaluate(() => {
    const a = document.getElementById('autoSail');
    a.checked = false;
    a.dispatchEvent(new Event('change'));
    const s = document.getElementById('sheet');
    s.value = 85; s.dispatchEvent(new Event('input'));
    const w = document.getElementById('wind');
    w.value = 70; w.dispatchEvent(new Event('input'));
  });
  await frames();
  await page.screenshot({ path: `${out}_sheeted_in.png` });

  await page.evaluate(() => {
    const s = document.getElementById('sheet');
    s.value = 6; s.dispatchEvent(new Event('input'));
    const w = document.getElementById('wind');
    w.value = 20; w.dispatchEvent(new Event('input'));
  });
  await frames();
  await page.screenshot({ path: `${out}_eased.png` });

  // labels
  await page.evaluate(() => {
    const a = document.getElementById('autoSail');
    a.checked = false; a.dispatchEvent(new Event('change'));
    const s = document.getElementById('sheet');
    s.value = 40; s.dispatchEvent(new Event('input'));
    const c = document.getElementById('labelsChk');
    c.checked = true; c.dispatchEvent(new Event('change'));
  });
  await frames();
  await page.screenshot({ path: `${out}_labels.png` });
  await page.evaluate(() => {
    const c = document.getElementById('labelsChk');
    c.checked = false; c.dispatchEvent(new Event('change'));
  });

  // interior / plan view with water off
  await page.evaluate(() => {
    const c = document.getElementById('waterChk');
    c.checked = false; c.dispatchEvent(new Event('change'));
    const m = document.getElementById('seaMotion');
    m.checked = false; m.dispatchEvent(new Event('change'));
  });
  await frames();
  await page.click('#cams button[data-cam="top"]');
  await new Promise((r) => setTimeout(r, 1600));
  await page.screenshot({ path: `${out}_plan_nowater.png` });
  await page.click('#cams button[data-cam="stern"]');
  await new Promise((r) => setTimeout(r, 1600));
  await page.screenshot({ path: `${out}_stern_nowater.png` });

  // readout / diagnostics
  const diag = await page.evaluate(() => {
    const r = document.getElementById('readout');
    return r ? r.textContent : null;
  });
  console.log('READOUT', diag);

  fs.writeFileSync(path.join(__dirname, '..', 'build', 'console.log'), msgs.join('\n'));
  console.log('--- console (' + msgs.length + ' messages) ---');
  console.log(msgs.slice(0, 60).join('\n'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
