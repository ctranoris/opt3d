// Debug: hide named parts so the rest can be identified.
// usage: node parts.js <hideExpr> <outName>
//   hideExpr is JS evaluated against window.OPTi.boat, e.g. "rig.sail"
import puppeteer from 'puppeteer';

const expr = process.argv[2];
const name = process.argv[3] || 'hide';
const url = 'http://127.0.0.1:8137/index.html';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(
  () => document.getElementById('boot').classList.contains('hide')
    || document.getElementById('boot').dataset.err, { timeout: 120000 });

await page.evaluate(() => {
  const st = window.OPTi.state;
  st.autoSail = false; st.seaMotion = false; st.sheet = 0.45; st.wind = 0.5;
});
if (expr) {
  await page.evaluate((e) => {
    const t = new Function('boat', `return boat.${e}`)(window.OPTi.boat);
    if (t) t.visible = false;
  }, expr);
}
await page.evaluate(() => window.OPTi.frames(6));
await page.screenshot({ path: `/home/ubuntu/opt3d/build/dbg_${name}.png` });
await browser.close();
console.log('ok');
