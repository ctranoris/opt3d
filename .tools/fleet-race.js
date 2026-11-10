// Headless check of the fleet on the sailing model: lays the course in the
// real page and sails the fleet round it without rendering (so it is fast
// under a software GL), from a standing start head to wind, in gusts and
// shifts.  Prints where each boat got to and how it went.
// usage: node .tools/fleet-race.js [optimist|laser] [wind kn, default 8]
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
  const kn = +(process.argv[3] || 8);

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

  const out = await page.evaluate((kn) => {
    const O = window.OPTi, wind = kn / 18, from = O.state.windFrom;
    O.setCourse(true);
    O.course.race.phase = 'countdown';
    O.fleet.reset(O.course, from);
    O.jury.reset(O.course, from);
    const hr = from * Math.PI / 180, flow = { x: -Math.sin(hr), z: Math.cos(hr) };
    const bodies = O.fleet.boats.map((s) => s.body);
    let bumps = 0, juryBumps = 0, hard = 0;
    O.course.race.phase = 'started';              // the gun: they start stopped, head to wind
    const flat = () => 0;
    const dt = 0.05, T = 900;
    const st = O.fleet.boats.map(() => ({ maxKn: 0, capsizes: 0, planing: 0, minBoard: 1, stuck: 0, was: false }));
    for (let t = 0; t < T; t += dt) {
      O.course.race.clock = t;
      const felt = {
        gust: 1 + 0.10 * Math.sin(t * 0.23) + 0.06 * Math.sin(t * 0.61 + 1.3) + 0.03 * Math.sin(t * 1.7 + 0.4),
        shift: 4 * Math.sin(t * 0.11 + 0.7) + 2 * Math.sin(t * 0.37),
      };
      O.fleet.update(dt, t, O.course, from, wind, flat, felt);
      // the jury boats, and every hull solid
      O.jury.update(dt, t, O.course, from, wind, flat, flow, bodies);
      O.jury.loadBodies();
      for (const c of O.fleet.collide(dt, O.course, from, O.jury.bodies)) {
        bumps++;
        if (c.a.kind === 'jury' || c.b.kind === 'jury') juryBumps++;
        if (c.speed > 1) hard++;
      }
      O.jury.storeBodies();
      O.fleet.boats.forEach((s, i) => {
        const r = st[i], H = s.hull;
        r.maxKn = Math.max(r.maxKn, H.u / 0.5144);
        if (H.capsized && !r.was) r.capsizes++;
        r.was = H.capsized;
        if (H.plane > 0.5) r.planing += dt;
        r.minBoard = Math.min(r.minBoard, H.board);
        if (!s.done && Math.abs(H.u) < 0.15) r.stuck += dt;
      });
      if (O.fleet.boats.every((s) => s.done)) break;
    }
    const legs = O.course.route('P').length;
    const jr = O.jury.boats.map((s) => `${s.role} ${Math.hypot(s.w.x - O.fleet.boats[0].w.x, s.w.y - O.fleet.boats[0].w.y).toFixed(0)} m off, ${s.speed.toFixed(1)} m/s`).join('; ');
    return [`bumps ${bumps} (hard ${hard}, with a jury boat ${juryBumps}); jury: ${jr}`].concat(O.fleet.boats.map((s, i) => {
      const r = st[i];
      return `${s.marks.number.padEnd(5)} perf ${s.perf.toFixed(2)}  ` +
        (s.done ? `finished ${s.finish.toFixed(0).padStart(4)} s` : `at waypoint ${s.tgt}/${legs - 1}    `) +
        `  max ${r.maxKn.toFixed(1)} kn  stopped ${r.stuck.toFixed(0).padStart(3)} s  planing ${r.planing.toFixed(0).padStart(3)} s  ` +
        `board min ${r.minBoard.toFixed(2)}  capsizes ${r.capsizes}  bumps ${s.contacts}  360s ${s.penalties}${s.started ? '' : ' NOT STARTED'}`;
    }));
  }, kn);
  console.log(`${process.argv[2] || 'optimist'}, ${kn} kn`);
  console.log(out.join('\n'));
  console.log(msgs.length ? 'ERRORS:\n' + msgs.join('\n') : 'no console errors');
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
