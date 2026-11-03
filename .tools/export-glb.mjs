/**
 * Export the boat as .glb without a browser window.
 *
 * The viewer's "Download .glb" button is the normal way to get the model out;
 * this is for scripting - CI, a batch of trims, or a machine with no display.
 * It loads the real page, waits for the boat to build, and runs the same
 * exporter with the same options, so the two cannot drift apart.
 *
 *   node .tools/export-glb.mjs [out.glb] [--sheet 0..1] [--camber 0..1]
 *
 * The boat needs a server (the page uses ES modules), so start one first:
 *   python3 -m http.server 8137
 */
import puppeteer from 'puppeteer';
import fs from 'fs';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
};
const out = argv.find((a) => !a.startsWith('--')) || 'optimist-dinghy.glb';
const PORT = arg('port', 8137);

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`http://127.0.0.1:${PORT}/index.html`, {
  waitUntil: 'domcontentloaded', timeout: 120000,
});
await page.waitForFunction(() => {
  const b = document.getElementById('boot');
  return b && (b.classList.contains('hide') || b.dataset.err);
}, { timeout: 120000, polling: 500 });

// Settle on the requested trim, and stop the boat moving, so the exported
// mesh is the pose asked for rather than wherever the sea had it.
await page.evaluate((sheet, camber) => {
  const st = window.OPTi.state;
  st.autoSail = false; st.seaMotion = false;
  if (sheet !== null) st.sheet = sheet;
  if (camber !== null) st.camber = camber;
}, arg('sheet', null) === null ? null : +arg('sheet'),
   arg('camber', null) === null ? null : +arg('camber'));
await page.evaluate(() => window.OPTi.frames(6));

const glb = await page.evaluate(() => new Promise((res, rej) => {
  const g = window.OPTi.boat.group;
  const pq = g.quaternion.clone(), pp = g.position.clone();
  // export upright on the baseline, not floating and heeled
  g.quaternion.identity(); g.position.set(0, 0, 0); g.updateMatrixWorld(true);
  const restore = () => {
    g.quaternion.copy(pq); g.position.copy(pp); g.updateMatrixWorld(true);
  };
  import('/lib/GLTFExporter.js').then(({ GLTFExporter }) => {
    new GLTFExporter().parse(g, (buf) => {
      restore();
      const u = new Uint8Array(buf);
      let s = '';
      for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
      res({ b64: btoa(s), bytes: u.length });
    }, (e) => { restore(); rej(new Error(String(e))); },
    { binary: true, onlyVisible: true });
  }).catch(rej);
}));

fs.writeFileSync(out, Buffer.from(glb.b64, 'base64'));
console.log(`wrote ${out} (${glb.bytes} bytes)`);
if (errors.length) { console.error('page errors:', errors); process.exitCode = 1; }
await browser.close();
