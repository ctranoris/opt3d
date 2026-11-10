// Steady-state polar of the sailing model (sailing.js), which your boat and
// the fleet both sail: speed with the daggerboard down, how far she planes,
// and the speed with the board raised.
//   node .tools/polar.mjs [optimist|laser]
import { sailParams, newHullState, stepBoat, bestBoom, KN } from '../sailing.js';

const key = process.argv[2] || 'optimist';
const P = sailParams(key);

function settle(W, twa, board) {
  const B = newHullState();
  B.board = board;
  let boom = 0;
  const r = twa * Math.PI / 180;
  for (let i = 0; i < 4000; i++) {
    // wind from starboard: the air moves aft and to port
    const ax = W * Math.cos(r) + B.u, az = W * Math.sin(r) - B.v;
    boom = -bestBoom(P, ax, az);
    stepBoat(B, P, ax, az, boom, 0, 0.02);
  }
  return { B, boom };
}

for (const kn of [4, 8, 11, 14, 18]) {
  const W = kn * KN;
  console.log(`\n${key}, true wind ${kn} kn\n TWA  speed   VMG  boom  heel  hike leeway plane  board up`);
  for (let twa = 30; twa <= 180; twa += 10) {
    const { B, boom } = settle(W, twa, 1);
    const up = settle(W, twa, 0).B;
    const r = twa * Math.PI / 180;
    const f = (v, n = 5, d = 2) => v.toFixed(d).padStart(n);
    console.log(`${f(twa, 4, 0)} ${f(B.u / KN, 6)} ${f(B.u / KN * Math.cos(r), 5)} ` +
      `${f(-boom, 5, 0)} ${f(B.heel, 5, 1)} ${f(B.hike, 5)} ${f(Math.atan2(B.v, Math.max(B.u, 1e-3)) * 180 / Math.PI, 6, 1)} ` +
      `${f(B.plane, 5)} ${f(up.u / KN, 7)}${B.capsized || up.capsized ? '  CAPSIZED' : ''}`);
  }
}
