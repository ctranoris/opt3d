/**
 * The ILCA 4 / Laser 4.7: hull, deck, foils and the una rig with the
 * pre-bent 4.7 lower mast, in the same boat frame as the Optimist:
 *
 *   +X aft (stem head at 0), +Y up (baseline 0), +Z to port.
 *
 * Built from init_assets/laser4.7: the side view (proportions, mast and
 * foil positions, the bent mast), the parts diagram and the exploded
 * diagrams (two-piece mast, gooseneck, vang, outhaul, mid-boom and
 * boom-end blocks, traveller rope between the transom fairleads,
 * ratchet block on a spring in the cockpit, hiking strap, tiller and
 * extension, bailer), and the class sail measurements.
 *
 *   LOA 4.23 m, beam 1.37 m, LWL ~3.8 m.  The sail drawn here, roach
 *   included, comes to ~5.2 m2 (the class quotes 4.7 m2 nominal).
 *
 * createLaser() returns the same shape of object as createBoat() for the
 * Optimist, so the viewer, the fleet and the sailor can drive either.
 * The class logo and wordmark are left off the sail on purpose: it
 * carries the sail number, the national letters and the grey "4.7".
 */

import * as THREE from '../lib/three.module.js';
import { D2R } from './opti-core.js';
import { plateGeometry, tubeGeometry, webbingGeometry } from './opti-hull.js';
import { makeMaterials } from './opti-boat.js';
import { SAIL_MARKS } from './opti-rig.js';

const PI = Math.PI;
const LOA = 4.23;

/** What the viewer needs to know about this hull. */
export const LASER_SPEC = {
  key: 'laser',
  name: 'ILCA 4 / Laser 4.7',
  sub: 'Single-handed una-rig dinghy',
  loa: LOA,
  beam: 1.37,
  waterline: 0.125,       // floats this deep below the baseline datum
  mastFromBow: 1.15,
  mid: 2.05,              // the heading turns about this station
  speedK: 1.25,           // quicker than an Optimist for the same trim
  courseScale: 1.6,      // start slots, legs and mark radius
  camScale: 1.55,         // camera presets pulled back for the bigger boat
  sailorSize: 1.1,        // an older, taller sailor
  glb: 'ilca4-laser47.glb',
};

/* ------------------------------------------------------------------ *
 * hull lines
 * ------------------------------------------------------------------ */

/** Sheer height (hull-deck joint), rising toward the bow. */
export function sheerY(x) { return 0.315 + 0.085 * Math.pow(1 - x / LOA, 1.8); }

/** Keel line: a raked forefoot, flat run, a little rocker up to the transom. */
export function keelY(x) {
  if (x < 1.35) return 0.395 * Math.pow(1 - x / 1.35, 2.1);
  if (x > 2.9) return 0.07 * Math.pow((x - 2.9) / (LOA - 2.9), 1.5);
  return 0;
}

/** Half breadth at the sheer: fine bow, widest aft of midships, wide transom. */
export function halfB(x) {
  if (x < 2.5) return 0.685 * Math.pow(Math.sin(PI / 2 * Math.max(0, x) / 2.5), 0.78);
  const u = (x - 2.5) / (LOA - 2.5);
  return 0.685 - 0.205 * Math.pow(u, 1.8);
}

/** Section fullness: round forward, flat-floored and hard-bilged aft. */
function mExp(x) {
  const u = Math.min(1, x / 2.4);
  return 2.0 + 0.9 * u * u * (3 - 2 * u);
}

/** Deck crown above the sheer on the centreline. */
function crown(x) { return 0.045 + 0.02 * (1 - x / LOA); }

/** Deck height at station x, z off the centreline. */
export function deckY(x, z) {
  const hb = Math.max(halfB(x), 1e-4);
  const v = Math.min(1, Math.abs(z) / hb);
  return sheerY(x) + crown(x) * (1 - v * v);
}

/**
 * A point on the hull section at station x: u = 0 on the keel, 1 at the
 * sheer; side +1 port, -1 starboard.  A superellipse quadrant.
 */
function sect(x, u, side) {
  const hb = halfB(x), ys = sheerY(x), yk = keelY(x), m = mExp(x);
  const a = u * PI / 2;
  const z = hb * Math.pow(Math.sin(a), 2 / m);
  const y = yk + (ys - yk) * (1 - Math.pow(Math.cos(a), 2 / m));
  return [x, y, side * z];
}

/** Half breadth of the hull at height y (for the water mask). */
function halfAtY(x, y) {
  const hb = halfB(x), ys = sheerY(x), yk = keelY(x), m = mExp(x);
  if (y <= yk) return 0;
  const k = Math.min(1, (ys - y) / Math.max(ys - yk, 1e-4));
  return hb * Math.pow(Math.max(0, 1 - Math.pow(k, m)), 1 / m);
}

/**
 * (sheer y, sheer half, bottom y, bottom half) at a station, for the
 * water shader's mask: the side between them is taken as straight.
 * The bottom point is a little above the keel so the straight line stays
 * inside this round-bilged section.
 */
export function laserStation(x) {
  const yk = keelY(x), ys = sheerY(x);
  const yb = yk + 0.02;
  return [ys, halfB(x), yb, halfAtY(x, yb) * 0.9];
}

// the cockpit
const CX0 = 2.06, CX1 = 3.20;                 // fore and aft walls
const CW = (x) => 0.27 + 0.04 * (x - CX0) / (CX1 - CX0);   // half width at the deck
const FLOOR = (x) => 0.19 - 0.025 * (x - CX0) / (CX1 - CX0);

/* ------------------------------------------------------------------ *
 * mesh helpers
 * ------------------------------------------------------------------ */

/** Rows of points (each [x,y,z]) stitched into a grid; uvFn(p) optional. */
function gridGeometry(rows, uvFn = null, flip = false) {
  const pos = [], uv = [], idx = [];
  const n = rows[0].length;
  for (const r of rows) {
    if (r.length !== n) throw new Error('ragged grid');
    for (const p of r) {
      pos.push(p[0], p[1], p[2]);
      if (uvFn) uv.push(...uvFn(p));
    }
  }
  for (let j = 0; j < rows.length - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uvFn) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Triangle fan from a centre over a closed loop of points. */
function fanGeometry(centre, loop) {
  const pos = [...centre];
  for (const p of loop) pos.push(...p);
  const idx = [];
  for (let i = 0; i < loop.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % loop.length));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);

/** Stations, closer together toward the bow where the shape changes. */
function stations(a, b, n, bias = 1) {
  return Array.from({ length: n + 1 }, (_, i) => a + (b - a) * Math.pow(i / n, bias));
}

/* ------------------------------------------------------------------ *
 * materials
 * ------------------------------------------------------------------ */

/** A light non-slip speckle for the deck and cockpit. */
function nonSlipTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#eef0f0';
  g.fillRect(0, 0, 256, 256);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 5200; i++) {
    const v = 200 + Math.floor(rnd() * 40);
    g.fillStyle = `rgb(${v},${v + 2},${v + 3})`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.name = 'non-slip';
  return t;
}

function laserMaterials(M) {
  M.gelcoat = new THREE.MeshPhysicalMaterial({
    color: 0xf7f8f8, roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25,
    side: THREE.DoubleSide,
  });
  M.deck = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: nonSlipTexture(), roughness: 0.78, side: THREE.DoubleSide,
  });
  M.flange = new THREE.MeshStandardMaterial({ color: 0xdfe2e4, roughness: 0.45 });
  M.foil = new THREE.MeshPhysicalMaterial({
    color: 0xf3f3ef, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.3,
  });
  M.alu = new THREE.MeshStandardMaterial({ color: 0xc4c8cd, roughness: 0.3, metalness: 0.8 });
  M.strap = new THREE.MeshStandardMaterial({ color: 0x1d3f7a, roughness: 0.8, side: THREE.DoubleSide });
  M.gelcoat.name = 'hull-gelcoat'; M.deck.name = 'deck-nonslip'; M.flange.name = 'hull-deck-flange';
  M.foil.name = 'foil'; M.alu.name = 'aluminium'; M.strap.name = 'hiking-strap';
  return M;
}

/* ------------------------------------------------------------------ *
 * hull and deck
 * ------------------------------------------------------------------ */

function hullAndDeck(M) {
  const g = new THREE.Group();
  g.name = 'Hull';
  const add = (geo, name, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name; m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };

  // ---- hull shell: port sheer, round the keel, to the starboard sheer
  const NU = 22;
  const xs = stations(0.004, LOA, 72, 1.35);
  const us = range(0, 1, NU);
  const hullRows = xs.map((x) => [
    ...us.slice().reverse().map((u) => sect(x, u, 1)),
    ...us.slice(1).map((u) => sect(x, u, -1)),
  ]);
  add(gridGeometry(hullRows), 'Hull shell', M.gelcoat);

  // ---- transom: the section closed by the deck camber
  const tl = [];
  for (const u of us) tl.push(sect(LOA, u, -1));               // keel to starboard sheer
  for (const v of range(-1, 1, 16).slice(1, -1)) {               // across the deck
    const z = v * halfB(LOA);
    tl.push([LOA, deckY(LOA, z), z]);
  }
  for (const u of us.slice(1).reverse()) tl.push(sect(LOA, u, 1));   // port sheer to keel
  const tc = [LOA, (sheerY(LOA) + keelY(LOA)) / 2, 0];
  add(fanGeometry(tc, tl), 'Transom', M.gelcoat);

  // ---- deck, in three pieces round the cockpit hole
  const deckUV = (p) => [p[0] * 3, p[2] * 3];
  const deckRow = (x, v0, v1, n) => range(v0, v1, n).map((v) => {
    const z = v * halfB(x);
    return [x, deckY(x, z) + 0.002, z];
  });
  add(gridGeometry(stations(0.004, CX0, 40, 1.3).map((x) => deckRow(x, 1, -1, 24)), deckUV),
    'Fore deck', M.deck);
  add(gridGeometry(range(CX1, LOA, 14).map((x) => deckRow(x, 1, -1, 24)), deckUV),
    'Aft deck', M.deck);
  for (const s of [1, -1]) {
    const rows = range(CX0, CX1, 14).map((x) => {
      const v0 = CW(x) / halfB(x);
      return deckRow(x, s, s * v0, 8);
    });
    add(gridGeometry(rows, deckUV, s < 0), s > 0 ? 'Side deck (port)' : 'Side deck (starboard)', M.deck);
  }

  // ---- cockpit: walls sloping in to a flat floor
  const lip = (x, s) => [x, deckY(x, s * CW(x)) + 0.002, s * CW(x)];
  const foot = (x, s) => [x, FLOOR(x), s * (CW(x) - 0.035)];
  for (const s of [1, -1]) {
    const rows = range(CX0, CX1, 10).map((x) => [lip(x, s), foot(x, s)]);
    add(gridGeometry(rows, deckUV, s < 0), 'Cockpit side', M.deck);
  }
  for (const [x, name] of [[CX0, 'Cockpit fore wall'], [CX1, 'Cockpit aft wall']]) {
    const zs = range(1, -1, 12);
    const top = zs.map((v) => { const z = v * CW(x); return [x, deckY(x, z) + 0.002, z]; });
    const bot = zs.map((v) => [x, FLOOR(x), v * (CW(x) - 0.035)]);
    add(gridGeometry([top, bot], deckUV, x === CX1), name, M.deck);
  }
  const floorRows = range(CX0, CX1, 6).map((x) => range(1, -1, 6).map((v) => [x, FLOOR(x), v * (CW(x) - 0.035)]));
  add(gridGeometry(floorRows, deckUV), 'Cockpit floor', M.deck);

  // ---- the hull-deck flange: a lip all round the sheer
  const path = [];
  for (const x of stations(LOA, 0.02, 40, 1).map((x) => x)) path.push([x, sheerY(x) - 0.004, halfB(x) + 0.006]);
  path.push([-0.006, sheerY(0) - 0.004, 0]);
  for (const x of stations(0.02, LOA, 40, 1)) path.push([x, sheerY(x) - 0.004, -halfB(x) - 0.006]);
  add(tubeGeometry(path, 0.011, 8), 'Hull-deck flange', M.flange);

  // ---- deck fittings
  const fit = (geo, mat, name, x, y, z, rot = null) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name; m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const xm = LASER_SPEC.mastFromBow;
  fit(new THREE.CylinderGeometry(0.05, 0.055, 0.012, 22), M.black, 'Mast step collar', xm, deckY(xm, 0) + 0.004, 0);
  fit(new THREE.CylinderGeometry(0.065, 0.065, 0.012, 24), M.black, 'Inspection port', 1.72, deckY(1.72, 0.0) + 0.004, 0);
  for (const s of [1, -1]) {
    fit(new THREE.BoxGeometry(0.07, 0.022, 0.03), M.black, 'Control line cleat', 1.95, deckY(1.95, s * 0.13) + 0.01, s * 0.13);
    fit(new THREE.BoxGeometry(0.06, 0.035, 0.035), M.black, 'Traveller fairlead', 4.12, deckY(4.12, s * 0.42) + 0.017, s * 0.42);
  }
  fit(new THREE.TorusGeometry(0.018, 0.005, 8, 16), M.steel, 'Bow eye', 0.10, deckY(0.1, 0) + 0.012, 0, [0, PI / 2, 0]);
  fit(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16), M.black, 'Bailer', 3.10, FLOOR(3.10) + 0.005, -0.14);
  fit(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 14), M.black, 'Drain bung', LOA - 0.004, 0.2, 0.15, [0, 0, PI / 2]);

  return g;
}

/* ------------------------------------------------------------------ *
 * centreboard, strap, ratchet block, rudder
 * ------------------------------------------------------------------ */

function centreboard(M) {
  const g = new THREE.Group();
  g.name = 'Daggerboard';
  const outline = [
    [2.08, 0.40], [2.37, 0.40], [2.37, -0.58], [2.31, -0.72], [2.15, -0.73], [2.08, -0.63],
  ];
  const board = new THREE.Mesh(plateGeometry(outline, 0.019), M.foil);
  board.name = 'Daggerboard blade';
  board.castShadow = true;
  g.add(board);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.024), M.black);
  handle.name = 'Daggerboard handle';
  handle.position.set(2.2, 0.40, 0);
  g.add(handle);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.006, 0.03), M.black);
  slot.name = 'Daggerboard slot';
  slot.position.set(2.225, FLOOR(2.225) + 0.003, 0);
  g.add(slot);
  return { group: g, board };
}

function hikingStrap(M) {
  const a = [2.42, FLOOR(2.42) + 0.015, 0], b = [3.19, 0.30, 0];
  const m = new THREE.Mesh(webbingGeometry(a, b, 0.055, [0, 0, 1], -0.05), M.strap);
  m.name = 'Hiking strap';
  m.castShadow = true;
  return m;
}

function ratchetBlock(M) {
  const g = new THREE.Group();
  g.name = 'Mainsheet ratchet block';
  const x = 2.48, y = FLOOR(2.48);
  const spring = new THREE.Mesh(tubeGeometry(
    range(0, 1, 24).map((t) => [x + 0.012 * Math.cos(t * PI * 12), y + 0.01 + t * 0.09, 0.012 * Math.sin(t * PI * 12)]),
    0.0025, 5), M.steel);
  spring.name = 'Ratchet spring';
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.012, 18), M.black);
  base.position.set(x, y + 0.006, 0);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.075, 0.055), M.black);
  shell.position.set(x, y + 0.14, 0);
  const sheave = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.036, 18), M.gold);
  sheave.rotation.z = PI / 2;
  sheave.position.set(x, y + 0.145, 0);
  g.add(spring, base, shell, sheave);
  return { group: g, top: new THREE.Vector3(x, y + 0.18, 0) };
}

/** Tiller extension length, joint to grip. */
export const LASER_EXTENSION = 0.78;

function rudderAssembly(M) {
  const g = new THREE.Group();
  g.name = 'Rudder';
  for (const y of [0.30, 0.13]) {
    const gud = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.06), M.steel);
    gud.name = 'Gudgeon';
    gud.position.set(LOA + 0.012, y, 0);
    g.add(gud);
  }
  const px = LOA + 0.035, py = 0.22;
  const pivot = new THREE.Group();
  pivot.name = 'Rudder pivot';
  pivot.position.set(px, py, 0);

  // the head: an aluminium stock that the blade hangs in
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 0.055), M.alu);
  head.name = 'Rudder head';
  head.position.set(0.05, 0.10, 0);
  head.castShadow = true;
  pivot.add(head);
  const outline = [
    [4.25, 0.12], [4.52, 0.12], [4.52, -0.52], [4.46, -0.64], [4.32, -0.65], [4.26, -0.55],
  ].map(([x, y]) => [x - px, y - py]);
  const blade = new THREE.Mesh(plateGeometry(outline, 0.024), M.foil);
  blade.name = 'Rudder blade';
  blade.castShadow = true;
  pivot.add(blade);

  // tiller forward under the traveller, then the extension
  const tiller = new THREE.Group();
  tiller.name = 'Tiller';
  const tY = 0.405 - py, tAft = 4.36 - px, tFwd = 3.30 - px;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(tAft - tFwd, 0.032, 0.026), M.alu);
  bar.position.set((tAft + tFwd) / 2, tY, 0);
  bar.castShadow = true;
  tiller.add(bar);
  const joint = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), M.black);
  joint.position.set(tFwd, tY, 0);
  tiller.add(joint);
  const extension = new THREE.Group();
  extension.name = 'Tiller extension';
  extension.position.set(tFwd, tY, 0);
  const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, LASER_EXTENSION, 10)
    .rotateZ(PI / 2).translate(-LASER_EXTENSION / 2, 0, 0), M.black);
  ext.name = 'Tiller extension tube';
  ext.castShadow = true;
  extension.add(ext);
  const grip = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 10), M.black);
  grip.position.set(-LASER_EXTENSION, 0, 0);
  extension.add(grip);
  extension.userData.rest = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-1, -0.2, 0.02).normalize());
  extension.quaternion.copy(extension.userData.rest);
  tiller.add(extension);
  pivot.add(tiller);
  g.add(pivot);
  return { group: g, pivot, tiller, extension };
}

/* ------------------------------------------------------------------ *
 * the rig
 * ------------------------------------------------------------------ */

// Rig-group frame: origin at the tack (on the mast at the gooseneck),
// +y up, +x aft, +z port.  The 4.7 lower section is pre-bent, so the mast
// curves aft above the gooseneck.
const TACK_ABOVE_DECK = 0.50;
const MAST_TOP = 4.20;          // above the tack
const MAST_BEND = 0.30;         // aft offset of the masthead
const MAST_R0 = 0.0325, MAST_R1 = 0.0255;
const LOWER_TOP = 2.05;         // where the top section sleeves in
const HEAD_Y = 4.02;            // sail head on the mast
const TACK = { x: 0.035, y: 0.03 };
const CLEW = { x: 2.33, y: 0.07 };
const BOOM_LEN = 2.62;
const BOOM_Y = -0.03, BOOM_R = 0.024;
const ROACH = 0.16;
const LUFF_OFF = 0.032;         // the luff sleeve's offset aft of the mast axis
const MID_BLOCK = 1.33, END_BLOCK = 2.53;
const SAIL_T = 26, SAIL_S = 14;

/** Mast axis, aft offset at height y above the tack. */
export function mastX(y) {
  return y <= 0 ? 0 : MAST_BEND * Math.pow(Math.min(y, MAST_TOP) / MAST_TOP, 1.7);
}

/** The flat sail (boom amidships): luff and leech points at height fraction t. */
function flatEdges(t, aRad = 0) {
  const ly = TACK.y + (HEAD_Y - TACK.y) * t;
  const mx = mastX(ly);
  // pivot frame: the mast point turned back by the boom angle, plus the
  // sleeve's offset along the boom
  const L = { x: mx * Math.cos(aRad) + (TACK.x - 0.0) * (1 - t) + LUFF_OFF * t, y: ly, z: mx * Math.sin(aRad) };
  const hx = mastX(HEAD_Y);
  const H = { x: hx * Math.cos(aRad) + LUFF_OFF, y: HEAD_Y, z: hx * Math.sin(aRad) };
  const dx = H.x - CLEW.x, dy = H.y - CLEW.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;      // in-plane normal, aft side
  const sgn = nx > 0 ? 1 : -1;
  const r = ROACH * Math.pow(Math.sin(PI * Math.pow(t, 0.9)), 1.1);
  const R = {
    x: CLEW.x + dx * t + sgn * nx * r,
    y: CLEW.y + dy * t + sgn * ny * r,
    z: H.z * t,
  };
  return { L, R };
}

/** Sail outline (flat, boom amidships), for painting and measuring. */
function sailOutline(n = 40) {
  const luff = [], leech = [];
  for (let j = 0; j <= n; j++) {
    const { L, R } = flatEdges(j / n);
    luff.push(L); leech.push(R);
  }
  return { luff, leech };
}

/* ---- sail cloth texture: two faces side by side ------------------ */

const TX0 = -0.12, TY0 = -0.10, TW = 2.75, TH = 4.30;   // metres
const TK = 300;                                        // px per metre
const TPW = Math.round(TW * TK), TPH = Math.round(TH * TK);

function laserUV(x, y) { return [0.5 * (x - TX0) / TW, (y - TY0) / TH]; }

const SAIL_LAYOUT = {
  battens: [[0.30, 0.56], [0.54, 0.56], [0.77, 0.40]],   // leech fraction, length
  window: [[0.42, 0.50], [1.08, 0.50], [1.065, 0.655], [0.435, 0.655]],
  telltales: [[0.42, 1.55], [0.38, 2.45]],
  // the class rule puts the starboard marks higher than the port ones
  marks: { port: 1.42, starboard: 2.12, h: 0.30, gap: 0.08 },
  classMark: { y: 3.30, h: 0.24 },
};

function paintLaserFace(g, ox, marks, mirror) {
  const X = (x) => ox + (x - TX0) * TK;
  const Y = (y) => TPH - (y - TY0) * TK;
  const { luff, leech } = sailOutline(60);
  const leechAt = (y) => {
    for (let i = 1; i < leech.length; i++) {
      if (leech[i].y >= y) {
        const a = leech[i - 1], b = leech[i];
        return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y || 1);
      }
    }
    return leech[leech.length - 1].x;
  };
  const luffAt = (y) => mastX(y) + LUFF_OFF;

  g.save();
  g.beginPath(); g.rect(ox, 0, TPW, TPH); g.clip();
  const grad = g.createLinearGradient(X(0), Y(3.5), X(2.3), Y(0));
  grad.addColorStop(0, '#fbfbf8'); grad.addColorStop(1, '#ebebe5');
  g.fillStyle = grad;
  g.fillRect(ox, 0, TPW, TPH);

  const outline = () => {
    g.beginPath();
    g.moveTo(X(TACK.x), Y(TACK.y));
    for (const p of luff) g.lineTo(X(p.x), Y(p.y));
    for (let i = leech.length - 1; i >= 0; i--) g.lineTo(X(leech[i].x), Y(leech[i].y));
    g.closePath();
  };
  outline();
  g.clip();

  // cross-cut panels, square to the leech chord
  const H = leech[leech.length - 1];
  const cdx = H.x - CLEW.x, cdy = H.y - CLEW.y, cl = Math.hypot(cdx, cdy);
  const inw = { x: -cdy / cl, y: cdx / cl };   // toward the luff
  if (inw.x > 0) { inw.x = -inw.x; inw.y = -inw.y; }
  g.strokeStyle = 'rgba(120,120,112,0.32)';
  g.lineWidth = Math.max(1.5, 0.006 * TK);
  for (let f = 0.085; f < 0.97; f += 0.085) {
    const p = leech[Math.round(f * (leech.length - 1))];
    g.beginPath();
    g.moveTo(X(p.x), Y(p.y));
    g.lineTo(X(p.x + inw.x * 3), Y(p.y + inw.y * 3));
    g.stroke();
  }

  // luff sleeve and foot tape
  g.strokeStyle = 'rgba(95,95,88,0.16)';
  g.lineWidth = 0.09 * TK;
  g.beginPath();
  for (const p of luff) g.lineTo(X(p.x), Y(p.y));
  g.stroke();
  g.lineWidth = 0.05 * TK;
  g.beginPath(); g.moveTo(X(TACK.x), Y(TACK.y)); g.lineTo(X(CLEW.x), Y(CLEW.y)); g.stroke();

  // corner patches
  g.fillStyle = 'rgba(110,110,100,0.07)';
  g.strokeStyle = 'rgba(120,120,112,0.28)';
  g.lineWidth = Math.max(1.5, 0.005 * TK);
  for (const [p, r] of [[TACK, 0.32], [CLEW, 0.36], [H, 0.30]]) {
    g.beginPath(); g.arc(X(p.x), Y(p.y), r * TK, 0, PI * 2); g.fill(); g.stroke();
  }

  // batten pockets
  g.lineCap = 'round';
  for (const [f, len] of SAIL_LAYOUT.battens) {
    const p = leech[Math.round(f * (leech.length - 1))];
    const a = { x: p.x + inw.x * 0.02, y: p.y + inw.y * 0.02 };
    g.strokeStyle = 'rgba(80,80,74,0.40)';
    g.lineWidth = 0.045 * TK;
    g.beginPath(); g.moveTo(X(a.x), Y(a.y));
    g.lineTo(X(a.x + inw.x * len), Y(a.y + inw.y * len)); g.stroke();
  }
  g.lineCap = 'butt';

  // window: cut out of the cloth, with its tape
  const win = () => {
    g.beginPath();
    for (const [x, y] of SAIL_LAYOUT.window) g.lineTo(X(x), Y(y));
    g.closePath();
  };
  g.save();
  g.globalCompositeOperation = 'destination-out';
  win(); g.fillStyle = '#000'; g.fill();
  g.restore();
  win();
  g.fillStyle = 'rgba(214,228,236,0.30)'; g.fill();
  g.strokeStyle = 'rgba(150,150,142,0.9)'; g.lineWidth = 0.02 * TK; g.stroke();

  const printed = (cx, cy, draw) => {
    g.save(); g.translate(X(cx), Y(cy));
    if (mirror) g.scale(-1, 1);
    draw(); g.restore();
  };
  const text = (str, cx, base, h, color, maxW) => {
    if (!str) return;
    const px = Math.round((h / 0.72) * TK);
    g.font = `bold ${px}px Arial, Helvetica, sans-serif`;
    const w = g.measureText(str).width;
    const sx = Math.min(1, (maxW * TK) / w);
    printed(cx, base, () => {
      g.scale(sx, 1);
      g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText(str, 0, 0);
    });
  };

  // national letters over the sail number, centred in the cloth's width
  const { h, gap } = SAIL_LAYOUT.marks;
  const base = mirror ? SAIL_LAYOUT.marks.starboard : SAIL_LAYOUT.marks.port;
  const lineAt = (str, y) => {
    const l = luffAt(y + h) + 0.14, r = leechAt(y + h / 2) - 0.12;
    text(str, (l + r) / 2, y, h, '#1b1d22', r - l);
  };
  lineAt(marks.number, base);
  lineAt(marks.country, base + h + gap);

  // the class numerals, grey, high in the sail
  const cy = SAIL_LAYOUT.classMark.y;
  const cl0 = luffAt(cy) + 0.1, cr0 = leechAt(cy) - 0.12;
  text('4.7', (cl0 + cr0) / 2, cy, SAIL_LAYOUT.classMark.h, '#8b9097', cr0 - cl0);

  // tell-tales
  for (const [x, y] of SAIL_LAYOUT.telltales) {
    const w = Math.max(2, 0.008 * TK), L = 0.17 * TK;
    g.save(); g.translate(X(x), Y(y));
    g.strokeStyle = '#b3261e'; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 0);
    for (let i = 1; i <= 12; i++) { const s = i / 12; g.lineTo(L * s, Math.sin(s * PI * 2.2) * 0.012 * TK * s); }
    g.stroke();
    g.fillStyle = '#c62828'; g.beginPath(); g.arc(0, 0, 0.017 * TK, 0, PI * 2); g.fill();
    g.restore();
  }
  g.restore();
}

export function laserSailTexture(marks = SAIL_MARKS) {
  const c = document.createElement('canvas');
  c.width = TPW * 2; c.height = TPH;
  const g = c.getContext('2d');
  paintLaserFace(g, 0, marks, false);
  paintLaserFace(g, TPW, marks, true);
  const tex = new THREE.CanvasTexture(c);
  tex.name = 'sail-cloth';
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Flat sail area, m2 (the shoelace over the outline). */
export function laserSailArea() {
  const { luff, leech } = sailOutline(80);
  const pts = [TACK, ...luff, ...leech.slice().reverse()];
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function createLaserRig(M) {
  const { black, steel, gold, alu, rope } = M;
  const group = new THREE.Group();
  group.name = 'Rig';
  const pivot = new THREE.Group();
  pivot.name = 'Boom pivot';
  group.add(pivot);

  // ---- mast: the bent lower section and the straight top sleeved in
  const lower = -(TACK_ABOVE_DECK + 0.36);
  const mastPath = (y0, y1, n) => range(y0, y1, n).map((y) => [mastX(y), y, 0]);
  const lowerM = new THREE.Mesh(tubeGeometry(mastPath(lower, LOWER_TOP, 20), MAST_R0, 16), alu);
  lowerM.name = 'Mast lower section';
  lowerM.castShadow = true;
  group.add(lowerM);
  const topM = new THREE.Mesh(tubeGeometry(mastPath(LOWER_TOP - 0.05, MAST_TOP, 20), MAST_R1, 14), alu);
  topM.name = 'Mast top section';
  topM.castShadow = true;
  group.add(topM);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(MAST_R0 + 0.002, MAST_R0 + 0.002, 0.03, 16), black);
  collar.name = 'Mast joint';
  collar.position.set(mastX(LOWER_TOP), LOWER_TOP, 0);
  group.add(collar);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(MAST_R1 * 1.1, 12, 8), black);
  cap.name = 'Mast cap';
  cap.position.set(mastX(MAST_TOP), MAST_TOP, 0);
  group.add(cap);

  // gooseneck and the vang tang
  const goose = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 0.045), black);
  goose.name = 'Gooseneck';
  goose.position.set(0.035, BOOM_Y, 0);
  pivot.add(goose);
  const tang = new THREE.Mesh(new THREE.CylinderGeometry(MAST_R0 + 0.004, MAST_R0 + 0.004, 0.04, 16), black);
  tang.name = 'Vang tang';
  tang.position.set(0, -TACK_ABOVE_DECK + 0.12, 0);
  group.add(tang);

  // ---- boom
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(BOOM_R, BOOM_R, BOOM_LEN, 14)
    .rotateZ(PI / 2).translate(BOOM_LEN / 2 + 0.04, BOOM_Y, 0), alu);
  boom.name = 'Boom';
  boom.castShadow = true;
  pivot.add(boom);
  const boomEnd = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.055, 0.052), black);
  boomEnd.name = 'Boom end';
  boomEnd.position.set(BOOM_LEN + 0.04, BOOM_Y, 0);
  pivot.add(boomEnd);

  // outhaul: clew to the boom end and forward along the top of the boom
  const out = new THREE.Mesh(tubeGeometry([
    [CLEW.x, CLEW.y, 0], [BOOM_LEN + 0.03, BOOM_Y + 0.02, 0],
    [BOOM_LEN - 0.4, BOOM_Y + BOOM_R + 0.004, 0.0], [0.5, BOOM_Y + BOOM_R + 0.004, 0],
  ], 0.003, 5), rope);
  out.name = 'Outhaul';
  pivot.add(out);

  // blocks hanging under the boom
  const blockAt = (x, name) => {
    const b = new THREE.Group();
    b.name = name;
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, 0.028), black);
    const sv = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.032, 14), gold);
    sv.rotation.x = PI / 2;
    b.add(sh, sv);
    b.position.set(x, BOOM_Y - BOOM_R - 0.04, 0);
    pivot.add(b);
    return b;
  };
  const midBlock = blockAt(MID_BLOCK, 'Mid-boom block');
  const endBlock = blockAt(END_BLOCK, 'Boom-end block');

  // vang: a tackle from the tang to the boom, with its block
  const vA = [0.04, -TACK_ABOVE_DECK + 0.12, 0], vB = [0.58, BOOM_Y - BOOM_R, 0];
  const vang = new THREE.Mesh(tubeGeometry([vA, [(vA[0] + vB[0]) / 2, (vA[1] + vB[1]) / 2, 0], vB], 0.006, 6), black);
  vang.name = 'Vang';
  pivot.add(vang);
  const vBlock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.03), black);
  vBlock.name = 'Vang block';
  vBlock.position.set(vA[0] + (vB[0] - vA[0]) * 0.35, vA[1] + (vB[1] - vA[1]) * 0.35, 0);
  vBlock.rotation.z = Math.atan2(vB[0] - vA[0], vB[1] - vA[1]) * -1;
  pivot.add(vBlock);

  // ---- sail
  const sailMat = new THREE.MeshPhysicalMaterial({
    map: laserSailTexture(SAIL_MARKS), side: THREE.DoubleSide, transparent: true,
    forceSinglePass: true, roughness: 0.85, metalness: 0,
    sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff),
  });
  sailMat.name = 'sail-cloth';
  sailMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec2 sailUv = vMapUv;
        if ( gl_FrontFacing ) sailUv.x += 0.5;
        vec4 sampledDiffuseColor = texture2D( map, sailUv );
        diffuseColor *= sampledDiffuseColor;
      #endif`);
  };
  const row = SAIL_S + 1;
  const pos = new Float32Array((SAIL_T + 1) * row * 3);
  const uv = [];
  const idx = [];
  for (let j = 0; j <= SAIL_T; j++) {
    const { L, R } = flatEdges(j / SAIL_T);
    for (let i = 0; i <= SAIL_S; i++) {
      const s = i / SAIL_S;
      uv.push(...laserUV(L.x + (R.x - L.x) * s, L.y + (R.y - L.y) * s));
    }
  }
  for (let j = 0; j < SAIL_T; j++) {
    for (let i = 0; i < SAIL_S; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sailGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  sailGeo.setIndex(idx);
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.name = 'Sail';
  sail.castShadow = true;
  sail.frustumCulled = false;
  pivot.add(sail);

  // ---- wind indicator on the masthead
  const vaneMat = new THREE.MeshStandardMaterial({ color: 0xd8322a, roughness: 0.5 });
  vaneMat.name = 'wind-indicator';
  const top = new THREE.Vector3(mastX(MAST_TOP), MAST_TOP, 0);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.24, 6), steel);
  rod.position.copy(top).add(new THREE.Vector3(0, 0.12, 0));
  group.add(rod);
  const vane = new THREE.Group();
  vane.name = 'Wind indicator';
  vane.position.copy(top).add(new THREE.Vector3(0, 0.23, 0));
  group.add(vane);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.34, 6), black);
  arm.rotation.z = PI / 2; arm.position.x = 0.05;
  vane.add(arm, new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), steel));
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.04, 10), vaneMat);
  point.rotation.z = PI / 2; point.position.x = -0.13;
  vane.add(point);
  const fs = new THREE.Shape();
  fs.moveTo(0, 0); fs.lineTo(0.09, 0); fs.lineTo(0.09, 0.055); fs.lineTo(0.03, 0.012); fs.closePath();
  const finMat = new THREE.MeshStandardMaterial({ color: 0xd8322a, roughness: 0.5, side: THREE.DoubleSide });
  finMat.name = 'wind-indicator-fin';
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.ShapeGeometry(fs), finMat);
    fin.position.x = 0.13; fin.rotation.x = s * 0.45;
    vane.add(fin);
  }

  // ---- the mainsheet and the traveller rope (rebuilt every frame)
  const lineOf = (n, name) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xefe9d6 });
    mat.name = name.toLowerCase() + '-rope';
    const l = new THREE.Line(geo, mat);
    l.name = name; l.frustumCulled = false;
    group.add(l);
    return l;
  };
  const sheet = lineOf(5 + 2 * 8, 'Mainsheet');
  const traveller = lineOf(3, 'Traveller');
  const travBlock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.03), black);
  travBlock.name = 'Traveller block';
  group.add(travBlock);

  const corners = {
    tack: { x: TACK.x, y: TACK.y },
    head: { x: mastX(HEAD_Y) + LUFF_OFF, y: HEAD_Y },
    peak: { x: mastX(HEAD_Y) + LUFF_OFF, y: HEAD_Y },
    corner: { x: CLEW.x, y: CLEW.y },
    snotter: { x: 0.58, y: BOOM_Y },
    boomBlock: { x: MID_BLOCK, y: BOOM_Y - 0.1 },
  };

  const rig = {
    group, pivot, sail, sheet, traveller, travBlock, boom, mast: lowerM, vane, corners, BOOM_Z: 0,
    midBlock, endBlock,
    materials: { wood: alu, carbon: alu, black, steel, gold, sailMat },
    travRig: null,          // traveller fairleads, rig frame (set by createLaser)
    boomDeg: 0, boomOut: 0,
  };

  // ---- trim: the same parameters as the Optimist's updateRig()
  rig.update = (p = {}) => {
    const { camber = 1, twist = 1, wind = 0.5, fill = 1, t = 0 } = p;
    const boomDeg = p.boomDeg ?? -(p.boomOut ?? 0.35) * 74;
    const a = boomDeg * D2R;
    pivot.rotation.y = a;
    rig.boomDeg = boomDeg;
    const eased = Math.min(1, Math.abs(boomDeg) / 74);
    rig.boomOut = eased;
    const sheetedIn = 1 - eased;
    const full = Math.min(1, Math.abs(fill));
    const side = fill < 0 ? -1 : 1;
    const cam = 0.09 * camber * (0.6 + 0.4 * sheetedIn) * (0.55 + 0.6 * wind) * (0.2 + 0.8 * full);
    const tw = 0.13 * twist * (0.45 + 0.8 * eased) * (0.6 + 0.7 * wind) * (0.3 + 0.7 * full);
    const flutter = (1 - full) * (0.012 + 0.04 * wind);
    const ph = t * 14;

    for (let j = 0; j <= SAIL_T; j++) {
      const tt = j / SAIL_T;
      const { L, R } = flatEdges(tt, a);
      const chord = Math.hypot(R.x - L.x, R.y - L.y);
      // loose-footed: some draft right down to the foot, none at the head
      const belly = (0.55 + 0.45 * Math.sin(PI * Math.min(1, tt / 0.8) * 0.5 + 0.2))
        * Math.min(1, (1 - tt) / 0.12);
      for (let i = 0; i <= SAIL_S; i++) {
        const s = i / SAIL_S;
        const env = Math.sin(PI * Math.pow(s, 0.62)) * (1 - 0.3 * s);
        let x = L.x + (R.x - L.x) * s;
        const y = L.y + (R.y - L.y) * s;
        let z = L.z + (R.z - L.z) * s;
        const draft = side * cam * chord * env * belly * 1.6;
        // the leech falls off to leeward, more up high
        const off = side * tw * chord * Math.pow(s, 1.3) * Math.pow(tt, 1.3);
        z += draft + off;
        x -= Math.abs(draft) * 0.15 * (1 - s);
        if (flutter) {
          z += flutter * Math.sin(PI * s) * Math.min(1, tt / 0.1) * Math.min(1, (1 - tt) / 0.1)
            * Math.sin(11 * s + 5 * tt - ph);
        }
        const k = (j * row + i) * 3;
        pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      }
    }
    sailGeo.attributes.position.needsUpdate = true;
    sailGeo.computeVertexNormals();
  };

  // ---- the multi-part mainsheet, in the rig group's frame
  const vm = new THREE.Vector3(), ve = new THREE.Vector3(), vt = new THREE.Vector3();
  rig.updateSheet = (cleatRig) => {
    pivot.updateMatrix();
    vm.set(MID_BLOCK, BOOM_Y - BOOM_R - 0.07, 0).applyMatrix4(pivot.matrix);
    ve.set(END_BLOCK, BOOM_Y - BOOM_R - 0.07, 0).applyMatrix4(pivot.matrix);
    const [fP, fS] = rig.travRig || [new THREE.Vector3(1.9, -0.6, 0.42), new THREE.Vector3(1.9, -0.6, -0.42)];
    // the traveller block slides toward the leeward fairlead
    const zt = Math.max(-0.34, Math.min(0.34, ve.z * 0.55));
    const lift = 0.12 + 0.05 * (1 - Math.abs(zt) / 0.42);
    vt.set((fP.x + fS.x) / 2, (fP.y + fS.y) / 2 + lift, zt);
    travBlock.position.copy(vt).add(new THREE.Vector3(0, 0.03, 0));
    travBlock.rotation.x = Math.atan2(ve.z - vt.z, ve.y - vt.y) * -1;

    const tr = traveller.geometry.attributes.position;
    tr.setXYZ(0, fP.x, fP.y, fP.z); tr.setXYZ(1, vt.x, vt.y, vt.z); tr.setXYZ(2, fS.x, fS.y, fS.z);
    tr.needsUpdate = true;

    // cleat -> mid-boom block, then along the boom (8 pts) -> boom end ->
    // traveller block -> back up to the boom end
    const sh = sheet.geometry.attributes.position;
    let n = 0;
    const put = (x, y, z) => sh.setXYZ(n++, x, y, z);
    const sag = 0.008 + 0.05 * rig.boomOut;
    const seg = (a, b, k, droop) => {
      for (let i = 1; i <= k; i++) {
        const u = i / k;
        put(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u - Math.sin(PI * u) * droop, a.z + (b.z - a.z) * u);
      }
    };
    put(cleatRig.x, cleatRig.y, cleatRig.z);
    seg(cleatRig, vm, 8, sag * 0.6);
    seg(vm, ve, 8, 0.004);
    put(vt.x, vt.y + 0.03, vt.z);
    put(ve.x + 0.02, ve.y, ve.z);
    put(ve.x + 0.02, ve.y + 0.05, ve.z);
    put(ve.x - 0.25, ve.y + 0.06, ve.z);
    while (n < sh.count) put(ve.x - 0.25, ve.y + 0.06, ve.z);
    sh.needsUpdate = true;
  };

  rig.paint = (marks) => {
    const old = sailMat.map;
    sailMat.map = laserSailTexture(marks);
    sailMat.needsUpdate = true;
    if (old) old.dispose();
  };

  rig.update({ boomDeg: -20 });
  return rig;
}

/* ------------------------------------------------------------------ *
 * the boat
 * ------------------------------------------------------------------ */

// Where the sailor sits and puts their feet (see sailor.js).  Values are
// [on the side, ducking across] or [base, hiking extra, ...] as noted
// there; the Optimist's are its defaults.
const POSE = {
  seatX: [3.00, 2.92], seatY: [0.41, 0.40, 0.30], seatZ: [0.63, 0.16],
  footX: [2.66, 0.06, 2.70], footY: [0.27, 0.21], footZ: [0.06, 0.09],
};

export function createLaser(M = makeMaterials()) {
  laserMaterials(M);
  const boat = new THREE.Group();
  boat.name = 'ILCA 4 / Laser 4.7';

  boat.add(hullAndDeck(M));
  const cb = centreboard(M);
  boat.add(cb.group);
  boat.add(hikingStrap(M));
  const rud = rudderAssembly(M);
  boat.add(rud.group);
  const ratchet = ratchetBlock(M);
  boat.add(ratchet.group);

  const xm = LASER_SPEC.mastFromBow;
  const tack = new THREE.Vector3(xm, deckY(xm, 0) + TACK_ABOVE_DECK, 0);
  const rig = createLaserRig(M);
  rig.group.position.copy(tack);
  boat.add(rig.group);
  rig.group.updateMatrix();
  const toRig = rig.group.matrix.clone().invert();
  rig.travRig = [1, -1].map((s) => new THREE.Vector3(4.12, deckY(4.12, s * 0.42) + 0.035, s * 0.42).applyMatrix4(toRig));
  const frame = { tack, rake: 0, base: new THREE.Vector3(xm, 0.05, 0) };

  const out = {
    group: boat, rig, rudder: rud, board: cb.board,
    cleatLocal: ratchet.top, frame, corners: rig.corners, materials: M,
    spec: LASER_SPEC, pose: POSE, extensionLen: LASER_EXTENSION,
    sailArea: laserSailArea(),
  };
  out.parts = laserParts(out);
  return out;
}

/** Part labels: [name, () => world point]. */
function laserParts(b) {
  const bp = (x, y, z) => () => b.group.localToWorld(new THREE.Vector3(x, y, z));
  const gp = (x, y) => () => b.rig.group.localToWorld(new THREE.Vector3(x, y, 0));
  const pp = (x, y, z = 0.02) => () => b.rig.pivot.localToWorld(new THREE.Vector3(x, y, z));
  return [
    ['Mast (top section)', gp(mastX(3.0), 3.0)],
    ['Mast (bent lower section)', gp(mastX(1.2), 1.2)],
    ['Luff sleeve', pp(mastX(2.2) + 0.05, 2.2)],
    ['Leech', pp(1.35, 2.2)],
    ['Battens', pp(1.6, 1.25)],
    ['Window', pp(0.75, 0.58)],
    ['Sail number', pp(0.9, SAIL_LAYOUT.marks.port + 0.15)],
    ['Class numerals', pp(0.75, SAIL_LAYOUT.classMark.y + 0.1)],
    ['Foot of sail', pp(1.2, 0.08)],
    ['Boom', pp(1.9, BOOM_Y)],
    ['Gooseneck', pp(0.035, BOOM_Y)],
    ['Vang', pp(0.3, -0.25, 0)],
    ['Outhaul', pp(2.2, BOOM_Y + 0.03, 0)],
    ['Mid-boom block', pp(MID_BLOCK, BOOM_Y - 0.09, 0)],
    ['Boom-end block', pp(END_BLOCK, BOOM_Y - 0.09, 0)],
    ['Wind indicator', () => b.rig.vane.getWorldPosition(new THREE.Vector3())],
    ['Traveller', () => b.rig.travBlock.getWorldPosition(new THREE.Vector3())],
    ['Ratchet block', bp(2.48, 0.34, 0)],
    ['Daggerboard', bp(2.22, -0.4, 0)],
    ['Cockpit', bp(2.9, 0.22, -0.2)],
    ['Hiking strap', bp(2.85, 0.28, 0)],
    ['Tiller', bp(3.8, 0.41, 0)],
    ['Rudder', bp(4.40, -0.3, 0)],
    ['Deck (non-slip)', bp(0.9, 0.42, -0.2)],
    ['Hull-deck flange', bp(1.6, 0.35, -0.6)],
    ['Transom', bp(LOA, 0.2, 0.3)],
    ['Bow', bp(0.05, 0.38, 0)],
  ];
}
