/**
 * How the boat sails: a small force model in the horizontal plane, in SI
 * units, with no three.js in it so it can be run and tuned from Node.
 *
 *   sail     lift and drag from the angle the apparent wind meets the cloth
 *            (luffing below a few degrees, stalled past about 22)
 *   hull     resistance growing with the square of the speed, more with the
 *            rudder over or the boat heeled; windage on hull and sailor
 *   foils    the daggerboard holds her against the side force once she is
 *            moving; stopped, she slides sideways
 *   heel     side force on the sail against the hull's stiffness and the
 *            sailor's weight, who hikes as hard as is needed (with a lag)
 *   rudder   turns her in proportion to the water flowing past it, so there
 *            is no steering without way on, bar a little sculling
 *   board    the daggerboard can be raised: less drag and less heeling, but
 *            less grip on the water, so she slips to leeward
 *   planing  resistance humps up near hull speed; with wind enough and the
 *            boat flat she climbs over it and planes
 *   capsize  the hull's stiffness falls away past about 12 degrees of heel;
 *            overpowered beyond that she goes over, and the sailor has to
 *            right her
 *
 * Boat frame: forward and port components.  Angles in degrees.  Heel is +
 * to port; the boom angle is + to starboard; rudder + turns her to
 * starboard (the heading increases).
 */

const D2R = Math.PI / 180;
const RHO_AIR = 1.225;
export const KN = 0.5144;                    // m/s in a knot
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };

export const RUDDER_MAX = 35;                // degrees, hard over

/** The numbers for one boat type. */
const PARAMS = {
  optimist: {
    mass: 80,          // boat 35 kg + a young sailor
    sail: 3.5,         // m2
    kHull: 12,         // N per (m/s)^2
    kLin: 4,           // N per m/s: skin friction at a crawl
    windage: 0.15,     // drag area of hull and sailor, m2
    cFoil: 440,        // N per (m/s forward x m/s sideways): board and rudder lift
    cCross: 330,       // N per (m/s)^2 sideways: the hull pushed broadside
    lever: 1.4,        // m, centre of effort above the centre of lateral resistance
    kForm: 570,        // N m per radian: the hull's own stiffness
    mHike: 250,        // N m: a 40 kg sailor fully hiked
    turnR: 1.9,        // m, turning radius hard over
    scull: 12,         // deg/s she can be sculled round when stopped
    wHelm: 0.30,       // deg/s of luffing per degree of heel per m/s
    vHull: 1.85,       // m/s: hull speed, where the wave-making humps up
  },
  laser: {
    mass: 135, sail: 4.7, kHull: 10, kLin: 5, windage: 0.2,
    cFoil: 700, cCross: 480, lever: 1.9, kForm: 900, mHike: 480,
    turnR: 3.3, scull: 9, wHelm: 0.25, vHull: 2.5,
  },
};
export const sailParams = (key) => PARAMS[key] || PARAMS.optimist;

export const CAPSIZE_AT = 45;                // degrees of heel: past this she goes over
const RIGHT_AFTER = 5;                       // s on her side before the sailor has her coming up

/**
 * A boat at rest.  `board` is the daggerboard, 1 down .. 0 raised (the
 * caller sets it); `plane` 0..1 is how far she is planing; `capsized`
 * while she is on her side, `down` for how long.
 */
export function newHullState() {
  return { u: 0, v: 0, heel: 0, hike: 0, yawRate: 0, rudder: 0, board: 1, plane: 0, capsized: false, down: 0 };
}

/** The hull's own righting moment (N m) at `heelDeg`: it falls away as the gunwale goes under. */
const formRighting = (P, heelDeg) =>
  P.kForm * Math.sin(heelDeg * D2R) * (1 - 0.9 * smoothstep(8, 35, Math.abs(heelDeg)));

/** Lift and drag coefficients of the sail at angle of attack `alpha` (0..180 deg). */
export function sailCoef(alpha) {
  let back = 1;
  if (alpha > 90) { alpha = 180 - alpha; back = 0.6; }   // wind from the leech
  const s = Math.sin(alpha * D2R);
  const pre = 1.35 * Math.sin(Math.min(1, alpha / 22) * 90 * D2R);
  const post = 0.95 * Math.sin(2 * alpha * D2R);
  let cl = alpha < 22 ? pre : pre + (post - pre) * smoothstep(22, 50, alpha);
  cl *= smoothstep(4, 12, alpha) * back;                 // soft cloth: it luffs
  // form drag, the drag that comes with the lift, and the cloth square on
  return { cl, cd: 0.08 + 0.11 * cl * cl + 1.37 * s * s };
}

const _f = { drive: 0, side: 0, across: 0, alpha: 0 };

/**
 * Force of the wind on the sail.  `ax`, `az` are the apparent wind in the
 * boat frame, m/s: the air moving aft, and toward port.  Returns the drive
 * (N, forward), the side force (N, to port), `across` (the share of the
 * wind crossing the chord, signed: + pushes the cloth to the side that is
 * to port with the boom amidships) and the angle of attack.
 */
export function sailForce(P, ax, az, boomDeg, out = _f) {
  const app = Math.hypot(ax, az);
  out.drive = out.side = out.across = out.alpha = 0;
  if (app < 1e-4) return out;
  const a = boomDeg * D2R;
  const ux = ax / app, uz = az / app;
  const nx = Math.sin(a), nz = Math.cos(a);              // normal to the chord
  const across = ux * nx + uz * nz;
  const along = ux * Math.cos(a) - uz * Math.sin(a);     // luff to leech
  const alpha = Math.atan2(Math.abs(across), along) / D2R;
  const { cl, cd } = sailCoef(alpha);
  // lift: square to the wind, on the side the cloth is pushed to
  const sg = across >= 0 ? 1 : -1;
  let lx = sg * nx - sg * across * ux, lz = sg * nz - sg * across * uz;
  const ll = Math.hypot(lx, lz);
  if (ll > 1e-4) { lx /= ll; lz /= ll; } else { lx = lz = 0; }
  const q = 0.5 * RHO_AIR * P.sail * app * app;
  out.drive = -q * (cd * ux + cl * lx);
  out.side = q * (cd * uz + cl * lz);
  out.across = across;
  out.alpha = alpha;
  return out;
}

const _t = { drive: 0, side: 0, across: 0, alpha: 0 };

/**
 * The boom angle (unsigned, 0..90 off the centreline, to leeward) that
 * drives her hardest in this apparent wind without more heeling moment
 * than the sailor can hold down.
 */
export function bestBoom(P, ax, az) {
  const side = az > 0 ? -1 : 1;
  const hold = P.mHike + P.kForm * Math.sin(5 * D2R);
  const STEP = 1.5;
  const scoreAt = (b) => {
    const f = sailForce(P, ax, az, side * b, _t);
    const over = Math.max(0, Math.abs(f.side) * P.lever - hold);
    return f.drive - 2.5 * over / P.lever;
  };
  let best = 0, bestScore = -Infinity;
  for (let b = 0; b <= 90; b += STEP) {
    const score = scoreAt(b);
    if (score > bestScore) { bestScore = score; best = b; }
  }
  // The scan lands on whole steps; fit a parabola through the peak and its
  // neighbours so the answer moves smoothly as the wind does.
  if (best > 0 && best < 90) {
    const lo = scoreAt(best - STEP), hi = scoreAt(best + STEP);
    const den = lo - 2 * bestScore + hi;
    if (den < -1e-9) best += clamp(0.5 * (lo - hi) / den, -0.5, 0.5) * STEP;
  }
  // Well off the wind the sail works as much by drag as by lift, and the
  // best angle jumps between the two; keep the boom going out instead.
  const awa = Math.atan2(Math.abs(az), ax) / D2R;
  return Math.max(best, clamp((awa - 100) * 4, 0, 90));
}

const _s = { drive: 0, side: 0, across: 0, alpha: 0 };

/**
 * Advance the boat by `dt`.  `B` is her state (newHullState), `ax`/`az` the
 * apparent wind in her frame (m/s), `helm` the tiller input -1..1 (+ turns
 * to starboard).  Returns the sail force this step.  The caller turns the
 * heading by B.yawRate and moves her by B.u (forward) and B.v (to port).
 */
export function stepBoat(B, P, ax, az, boomDeg, helm, dt) {
  if (B.capsized) return lieCapsized(B, az, dt);
  const board = clamp(B.board, 0, 1);
  const cFoil = P.cFoil * (0.3 + 0.7 * board);            // the rudder and hull still grip a little
  const lever = P.lever * (0.82 + 0.18 * board);          // less board, less to trip over
  // What the rudder can do: it bites with the flow past it, plus a little
  // sculling when she is stopped.  Going astern the flow is the other way
  // and the rudder works backwards; the sailor knows it, and puts the
  // tiller over the other way (and sculls that way), so `helm` is always
  // the way she is to turn.  Heeled, she wants to luff up.
  const au = Math.abs(B.u);
  if (B.u < -0.12) B.astern = true; else if (B.u > -0.04) B.astern = false;
  const auth = (B.astern ? -1 : 1) * (au / P.turnR / D2R + P.scull * (1 - smoothstep(0, 0.8, au)));   // deg/s hard over
  const luff = P.wHelm * B.heel * B.u;

  // The rudder goes over, and comes back, at a hand's speed.  Hands off
  // the keys, the sailor holds her course: just enough helm to meet the luff.
  let want = clamp(helm, -1, 1) * (B.astern ? -1 : 1) * RUDDER_MAX;
  if (!helm) want = Math.abs(auth) > 1 ? clamp(-luff / auth, -1, 1) * RUDDER_MAX : 0;
  const rate = (helm ? 110 : 150) * dt;
  B.rudder += clamp(want - B.rudder, -rate, rate);
  const rn = B.rudder / RUDDER_MAX;

  const f = sailForce(P, ax, az, boomDeg, _s);
  const upright = Math.cos(B.heel * D2R);                // a heeled sail spills
  let drive = f.drive * upright, side = f.side * upright;
  const app = Math.hypot(ax, az);
  const wq = 0.5 * RHO_AIR * P.windage * app;            // windage, along the wind
  drive -= wq * ax;
  side += wq * az;

  // sideways: the foils' lift needs way on; without it only the hull broadside
  B.v =(B.v + dt * side / P.mass) / (1 + dt * (cFoil * au + P.cCross * Math.abs(B.v)) / P.mass);
  // ... and the lift costs drag
  const induced = cFoil * au * Math.abs(B.v) * Math.min(Math.abs(B.v) / Math.max(au, 0.5), 0.3);

  // ahead: hull resistance, more with the rudder over and with heel.  Near
  // hull speed she digs a hole in the water; flat, and driven hard enough,
  // she climbs out of it and planes.
  const h30 = Math.min(1.5, Math.abs(B.heel) / 30);
  const vh = P.vHull;
  const flat = 1 - smoothstep(8, 18, Math.abs(B.heel));
  B.plane = flat * smoothstep(1.35 * vh, 1.75 * vh, au);
  const hump = 0.55 * smoothstep(0.9 * vh, 1.25 * vh, au) * (1 - B.plane);
  const k = P.kHull * (1 + 0.6 * rn * rn + 0.5 * h30 * h30 + hump) * (0.93 + 0.07 * board);
  B.u = (B.u + dt * (drive - Math.sign(B.u) * induced) / P.mass)
      / (1 + dt * (k * au + P.kLin) / P.mass);

  // heel: the sailor's weight goes out as far as the moment asks, a little late
  const mHeel = f.side * lever;                          // + to port
  const hikeT = clamp((Math.abs(mHeel) - P.kForm * Math.sin(4 * D2R)) / P.mHike, 0, 1);
  B.hike += (hikeT - B.hike) * Math.min(1, dt / 0.7);
  const mNet = mHeel - Math.sign(mHeel) * Math.min(Math.abs(mHeel), B.hike * P.mHike);
  const hr = B.heel * D2R;
  B.heel += (mNet * Math.cos(hr) - formRighting(P, B.heel)) / (P.kForm * 0.45) * dt / D2R;
  if (Math.abs(B.heel) > CAPSIZE_AT) { B.capsized = true; B.down = 0; }

  // turning, with a little inertia
  const rT = rn * auth + luff;
  B.yawRate += (rT - B.yawRate) * Math.min(1, dt / 0.3);
  return f;
}

const _z = { drive: 0, side: 0, across: 0, alpha: 0 };

/**
 * On her side: the sail is in the water and she only drifts to leeward.
 * After a few seconds the sailor is on the board and she comes up, stopped.
 */
function lieCapsized(B, az, dt) {
  B.down += dt;
  const sg = B.heel < 0 ? -1 : 1;
  const want = B.down < RIGHT_AFTER ? 88 : 0;
  const rate = (B.down < RIGHT_AFTER ? 70 : 40) * dt;
  const h = Math.abs(B.heel);
  B.heel = sg * (h + clamp(want - h, -rate, rate));
  B.u *= Math.exp(-dt / 0.6);
  B.v += (0.03 * az - B.v) * Math.min(1, dt / 1.5);      // drifting with the wind
  B.yawRate *= Math.exp(-dt / 0.4);
  B.rudder *= Math.exp(-dt / 0.3);
  B.hike = 0; B.plane = 0;
  if (B.down >= RIGHT_AFTER && h < 10) { B.capsized = false; B.down = 0; }
  return _z;
}
