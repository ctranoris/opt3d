// Steady-state polar of the sailing model, next to the fleet's own polar.
//   node .tools/polar.mjs [optimist|laser]
import { sailParams, newHullState, stepBoat, bestBoom, KN } from '../sailing.js';

const key = process.argv[2] || 'optimist';
const P = sailParams(key);
const speedK = key === 'laser' ? 1.25 : 1;
const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const fleet = (twa) => 0.42 * speedK * ss(32, 75, twa) * (1 - 0.12 * ss(110, 180, twa));

for (const kn of [4, 8, 14, 18]) {
  const W = kn * KN;
  console.log(`\n${key}, true wind ${kn} kn\n TWA  speed  fleet   VMG  boom  heel  hike leeway`);
  for (let twa = 30; twa <= 180; twa += 10) {
    const B = newHullState();
    let boom = 0;
    const r = twa * Math.PI / 180;
    for (let i = 0; i < 3000; i++) {
      // wind from starboard: the air moves aft and to port
      const ax = W * Math.cos(r) + B.u, az = W * Math.sin(r) - B.v;
      boom = -bestBoom(P, ax, az);
      stepBoat(B, P, ax, az, boom, 0, 0.02);
    }
    const f = (v, n = 5, d = 2) => v.toFixed(d).padStart(n);
    console.log(`${f(twa, 4, 0)} ${f(B.u / KN, 6)} ${f(fleet(twa) * kn, 6)} ${f(B.u / KN * Math.cos(r), 5)} ` +
      `${f(-boom, 5, 0)} ${f(B.heel, 5, 1)} ${f(B.hike, 5)} ${f(Math.atan2(B.v, Math.max(B.u, 1e-3)) * 180 / Math.PI, 6, 1)}`);
  }
}
