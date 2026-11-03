/**
 * Hull moulding and the fixed parts inside it, as BufferGeometries in the
 * boat frame (+X aft from the bow transom top, +Y up, +Z starboard).
 *
 * A modern GRP Optimist is an open pram: no decks, just a moulded shell
 * with a rolled gunwale, two moulded thwarts (the mast thwart forward and
 * the centre thwart amidships), a daggerboard case between them, and
 * three inflatable buoyancy bags strapped in - one down each side forward
 * of the centre thwart, one across the stern.
 */

import * as THREE from '../lib/three.module.js';
import {
  SPEC, range, loft, fan, merge, toGeometry,
  sheerY, sheerHalf, bottomY, floorY, insideHalf, halfSection, BOW_KNUCKLE,
} from './opti-core.js';

const { loa, shell } = SPEC;

// vertex colours
const WHITE = [0.965, 0.967, 0.962];
const INSIDE = [0.90, 0.905, 0.91];
const FLOOR = [0.80, 0.81, 0.825];
const THWART = [0.94, 0.945, 0.948];

/* ------------------------------------------------------------------ *
 * hull shell
 * ------------------------------------------------------------------ */

/** A full section, port sheer -> bottom -> starboard sheer, as [y, z]. */
export function fullSection(x, inset = 0) {
  const half = halfSection(x, inset);
  const port = half.map(([y, z]) => [y, -z]);
  const stbd = half.slice(0, -1).reverse();
  return port.concat(stbd);
}

/** Stations: dense round the bow transom knuckle, even elsewhere. */
function stations() {
  const kx = BOW_KNUCKLE[0];
  const xs = range(0, kx - 0.04, 8)
    .concat(range(kx - 0.03, kx + 0.05, 9))
    .concat(range(kx + 0.07, loa, 44));
  return xs;
}

const HALF_N = halfSection(1).length;
const FULL_N = HALF_N * 2 - 1;

export function hullGeometry() {
  const xs = stations();

  // outside skin
  const outer = loft(xs.map((x) => fullSection(x)), xs, {
    colorAt: () => WHITE,
  });

  // inside skin - it stops a shell short of the stern transom, whose
  // inside face closes it; the floor is a shade darker than the sides
  const inLoa = loa - shell * 1.5;
  const xi = xs.map((x) => Math.min(x, inLoa));
  const flat0 = HALF_N - 7;          // first flat-bottom point on a half
  const inner = loft(xs.map((x, i) => fullSection(xi[i], shell)), xi, {
    flip: true,
    colorAt: (i, j) => {
      const k = j < HALF_N ? j : FULL_N - 1 - j;   // index along a half
      return k >= flat0 ? FLOOR : INSIDE;
    },
  });
  merge(outer, inner);

  // stern transom: outside face and inside face
  merge(outer, fan(fullSection(loa), loa, true, WHITE));
  merge(outer, fan(fullSection(inLoa, shell), inLoa, false, INSIDE));

  return toGeometry(THREE, outer);
}

/* ------------------------------------------------------------------ *
 * gunwale: a rolled lip swept round the whole sheer, sides and both
 * transom tops, with its corners rounded off
 * ------------------------------------------------------------------ */

function sheerLoop() {
  const pts = [];
  const xs = range(0, loa, 36);
  for (const x of xs) pts.push([x, sheerY(x), sheerHalf(x)]);            // stbd, fwd->aft
  for (const z of range(sheerHalf(loa), -sheerHalf(loa), 12).slice(1, -1)) {
    pts.push([loa, sheerY(loa), z]);                                     // stern top
  }
  for (const x of xs.slice().reverse()) pts.push([x, sheerY(x), -sheerHalf(x)]);
  for (const z of range(-sheerHalf(0), sheerHalf(0), 12).slice(1, -1)) {
    pts.push([0, sheerY(0), z]);                                         // bow top
  }
  // Chaikin: rounds the four corners into the radius the moulding has
  let p = pts;
  for (let k = 0; k < 2; k++) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push(a.map((v, c) => 0.75 * v + 0.25 * b[c]));
      q.push(a.map((v, c) => 0.25 * v + 0.75 * b[c]));
    }
    p = q;
  }
  return p;
}

// lip section: [out, up] relative to the sheer line - out is horizontal,
// away from the boat
const LIP = (() => {
  const pts = [];
  const add = (o, u) => pts.push([o, u]);
  add(-0.016, -0.028);          // inside, under the lip
  add(-0.018, -0.004);
  for (const a of range(Math.PI, 0, 7)) {              // rolled top
    add(0.003 + Math.cos(a) * 0.020, 0.0 + Math.sin(a) * 0.013);
  }
  add(0.024, -0.010);
  add(0.022, -0.030);           // outside, rubbing face
  add(0.006, -0.034);           // under it, back to the skin
  return pts;
})();

export function gunwaleGeometry() {
  const path = sheerLoop();
  const n = path.length;
  const cx = loa / 2;
  const rings = [];
  for (let i = 0; i <= n; i++) {
    const p = path[i % n];
    const a = path[(i - 1 + n) % n], b = path[(i + 1) % n];
    let ox = b[2] - a[2], oz = -(b[0] - a[0]);
    const l = Math.hypot(ox, oz) || 1;
    ox /= l; oz /= l;
    if (ox * (p[0] - cx) + oz * p[2] < 0) { ox = -ox; oz = -oz; }
    rings.push(LIP.map(([o, u]) => [p[0] + ox * o, p[1] + u, p[2] + oz * o]));
  }
  const m = loft(rings, null, { xyz: true, closed: true, flip: true, colorAt: () => WHITE });
  return toGeometry(THREE, m);
}

/* ------------------------------------------------------------------ *
 * thwarts: moulded boxes running side to side, their ends following the
 * flare of the hull
 * ------------------------------------------------------------------ */

/**
 * A box from x0 to x1, top at yTop, `depth` deep, spanning the boat.  The
 * fore and aft faces are slightly rounded over at the top edge.
 */
export function thwartGeometry(x0, x1, yTop, depth) {
  const yBot = yTop - depth;
  const rr = Math.min(0.018, (x1 - x0) * 0.2);
  // outline in (x, y), clockwise from the bottom fore corner
  const out = [[x0, yBot]];
  for (const a of range(Math.PI, Math.PI / 2, 5)) out.push([x0 + rr + Math.cos(a) * rr, yTop - rr + Math.sin(a) * rr]);
  for (const a of range(Math.PI / 2, 0, 5)) out.push([x1 - rr + Math.cos(a) * rr, yTop - rr + Math.sin(a) * rr]);
  out.push([x1, yBot]);

  // each outline point is a ring across the boat: port end -> starboard end
  const ring = ([x, y]) => {
    const h = insideHalf(x, y) + 0.002;
    return [[x, y, -h], [x, y, h]];
  };
  const prof = out.map(ring);
  // loft along the outline, across the boat
  const m = loft(prof, null, { xyz: true, flip: true, colorAt: () => THWART });
  // the two ends against the hull are hidden; close the underside
  const under = loft([ring([x1, yBot]), ring([x0, yBot])], null, { xyz: true, colorAt: () => INSIDE });
  merge(m, under);
  return toGeometry(THREE, m);
}

/* ------------------------------------------------------------------ *
 * daggerboard case: a narrow trunk with a rounded forward end, standing
 * on the floor and closed on top except for the slot
 * ------------------------------------------------------------------ */

export function boardCaseGeometry(yTop) {
  const [x0, x1, w] = SPEC.boardCase;
  const hw = w / 2;
  const s = new THREE.Shape();
  s.moveTo(x1, -hw);
  s.lineTo(x0 + hw, -hw);
  s.absarc(x0 + hw, 0, hw, -Math.PI / 2, -3 * Math.PI / 2, true);
  s.lineTo(x1, hw);
  s.closePath();
  const yBot = floorY(x1) - 0.01;
  const g = new THREE.ExtrudeGeometry(s, {
    depth: yTop - yBot, curveSegments: 10, steps: 1,
    bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2,
  });
  // shape (x, Y) extruded along z  ->  (x, up, -Y)
  g.rotateX(-Math.PI / 2);
  g.translate(0, yBot, 0);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ *
 * buoyancy bags
 * ------------------------------------------------------------------ */

/**
 * A capsule along a centre line.  `at(u)` -> {c: [x,y,z], ry, rz, col}
 * for u in [0, 1]; the ends are domed.  The axis runs mainly along `axis`
 * ('x' or 'z').
 */
function capsule(at, axis, n = 40, radial = 18, flip = false) {
  const rings = [];
  const dome = 6;
  const us = [];
  for (let i = 0; i <= dome; i++) us.push({ u: 0, e: -1 + i / dome });
  for (let i = 1; i < n; i++) us.push({ u: i / n, e: 0 });
  for (let i = 0; i <= dome; i++) us.push({ u: 1, e: i / dome });
  for (const { u, e } of us) {
    const s = at(u);
    // e in [-1, 0) is the fore dome, (0, 1] the aft one
    const ang = Math.abs(e) * Math.PI / 2;
    const f = Math.cos(ang);
    const along = Math.sin(ang) * Math.sign(e);
    const ring = [];
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = [...s.c];
      if (axis === 'x') {
        c[0] += along * s.ry * 0.9;
        c[1] += Math.sin(a) * s.ry * f;
        c[2] += Math.cos(a) * s.rz * f;
      } else {
        c[2] += along * s.rz * 0.9;
        c[1] += Math.sin(a) * s.ry * f;
        c[0] += Math.cos(a) * s.rx * f;
      }
      ring.push(c);
    }
    rings.push({ ring, col: s.col });
  }
  const m = loft(rings.map((r) => r.ring), null, {
    xyz: true, closed: true, flip, colorAt: (i) => rings[i].col,
  });
  return toGeometry(THREE, m);
}

const BAG = [0.56, 0.58, 0.60];
const BAG_STRAP = [0.86, 0.87, 0.88];

function bagColour(d, bands) {
  for (const b of bands) if (Math.abs(d - b) < 0.016) return BAG_STRAP;
  return BAG;
}

/** Side bag: forward of the centre thwart, on the floor against the side. */
export function sideBagGeometry(side) {
  const [x0, x1] = SPEC.sideBags;
  const L = x1 - x0;
  return capsule((u) => {
    const x = x0 + 0.09 + (L - 0.18) * u;
    const r = 0.095 + 0.02 * u;
    const ry = r * 0.95, rz = r * 0.98;
    const y = floorY(x) + ry + 0.004;
    const z = side * (insideHalf(x, y) - rz * 0.97);
    return { c: [x, y, z], ry, rz, col: bagColour(x, [0.62, 0.84, 1.04]) };
  }, 'x');
}

/** Stern bag: across the boat, lying on the floor against the transom. */
export function sternBagGeometry() {
  const { x, r } = SPEC.sternBag;
  const ry = r * 0.92, rx = r;
  const y = floorY(x) + ry + 0.004;
  const half = insideHalf(x, y) - ry * 0.9;
  return capsule((u) => {
    const z = -half + 2 * half * u;
    return { c: [x, y, z], ry, rz: ry, rx, col: bagColour(z, [-0.18, 0, 0.18]) };
  }, 'z', 30, 18, true);
}

/* ------------------------------------------------------------------ *
 * floor strips: the light non-slip pads either side, aft of the thwart
 * ------------------------------------------------------------------ */

export function floorStripGeometry(side) {
  const xs = range(1.38, 2.08, 16);
  const w = 0.035, zc = side * 0.38;
  const prof = xs.map((x) => {
    const y = floorY(x) + 0.0025;
    return [[x, y, zc - w], [x, y, zc + w]];
  });
  const m = loft(prof, null, { xyz: true, flip: true, colorAt: () => [0.93, 0.94, 0.95] });
  return toGeometry(THREE, m);
}

/* ------------------------------------------------------------------ *
 * generic helpers used by the boat and the rig
 * ------------------------------------------------------------------ */

/** Cylinder of length `len` from y = 0 up, tapering rBot -> rTop. */
export function sparGeometry(len, rTop, rBot, radial = 16) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, radial, 1, false);
  g.translate(0, len / 2, 0);
  return g;
}

/** Flat plate from an [a, b] outline in the xy plane, centred on z = 0. */
export function plateGeometry(outline, thickness) {
  const shape = new THREE.Shape();
  outline.forEach(([a, b], i) => (i ? shape.lineTo(a, b) : shape.moveTo(a, b)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: false, curveSegments: 1, steps: 1,
  });
  g.translate(0, 0, -thickness / 2);
  g.computeVertexNormals();
  return g;
}

/** Round tube along a Catmull-Rom path of [x, y, z]. */
export function tubeGeometry(path, r, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(
    path.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.TubeGeometry(curve, Math.max(12, path.length * 8), r, radial, false);
}

/**
 * Flat webbing from a to b: `w` wide, lying in the plane that contains
 * the strap and `across` (a unit vector), sagging by `sag`.
 */
export function webbingGeometry(a, b, w, across, sag = 0, n = 16) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const X = new THREE.Vector3(...across).normalize().multiplyScalar(w / 2);
  const rows = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = A.clone().lerp(B, t);
    p.y -= Math.sin(Math.PI * t) * sag;
    rows.push([[p.x - X.x, p.y - X.y, p.z - X.z], [p.x + X.x, p.y + X.y, p.z + X.z]]);
  }
  // face up: normal (B - A) x across must point up
  const D = B.clone().sub(A);
  const m = loft(rows, null, { xyz: true, flip: D.z * X.x - D.x * X.z < 0 });
  return toGeometry(THREE, m);
}

export { bottomY };
