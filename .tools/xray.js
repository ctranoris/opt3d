// Debug render: hide the sail so the spars underneath can be inspected.
import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://127.0.0.1:8137/index.html';
const browser = await puppeteer.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox',
    '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(
  () => document.getElementById('boot').classList.contains('hide')
    || document.getElementById('boot').dataset.err,
  { timeout: 120000 });

// freeze the animation and stop the auto-trimmer so the pose is stable
await page.evaluate(() => {
  const st = window.OPTi.state;
  st.autoSail = false;
  st.seaMotion = false;
  st.sheet = 0.45;
  st.wind = 0.5;
});
await new Promise((r) => setTimeout(r, 600));

// hide the sail cloth
await page.evaluate(() => {
  const b = window.OPTi.boat;
  b.rig.sail.visible = false;
});
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: '/home/ubuntu/opt3d/build/xray_sailspar.png' });

await page.evaluate(() => { window.OPTi.boat.rig.sail.visible = true; });
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: '/home/ubuntu/opt3d/build/xray_normal.png' });
await browser.close();
console.log('ok');
