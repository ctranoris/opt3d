/**
 * Hull shell, decks and the plywood furniture of an Optimist.
 *
 * The shell is lofted as one closed ring per station - outside skin down
 * from the inwale, across the bottom, up the other side, then home along
 * the inside skin - so the hull is a single watertight mesh, the gunwale
 * reads as real plywood thickness, and vertex colours put white gelcoat
 * outside and bare plywood inside.
 */

import * as THREE from '../lib/three.module.js';
import {
  SPEC, range, loft, merge, fan, toGeometry,
  halfWidth, innerHalf, innerY, sheerY, deckY, cockpitHalf, skinY,
} from './opti-core.js';

const { loa, shell } = SPEC;

const N_SIDE = 10;    // points down each side, inwale -> baseline
const N_BOTTOM = 9;   // points across the bottom
const N_OUTER = 2 * N_SIDE + N_BOTTOM - 1;   // points in the outside skin ring

// white gelcoat outside, varnished plywood inside
const WHITE = [0.94, 0.94, 0.93];
const PLY = [0.80, 0.65, 0.42];

/* ------------------------------------------------------------------ *
 * shell
 * ------------------------------------------------------------------ */

/**
 * One closed section at station x: the outside skin from the inwale down
 * one side, across the bottom and up the other, then home along the
 * inside skin.  The inside skin is the outside profile pushed inward
 * along its own normal by the skin thickness, which keeps a real, even
 * thickness on the sloped topsides as well as the flat of the bottom, and
 * closes the gunwale over between the two.
 */
function ring(x) {
  const sy = sheerY(x);
  const outer = [];

  // starboard: inwale down to the baseline
  for (const y of range(sy, 0, N_SIDE + 1)) outer.push([y, halfWidth(x, y)]);
  // across the bottom
  const bh = halfWidth(x, 0);
  for (const z of range(bh, -bh, N_BOTTOM + 1).slice(1, -1)) outer.push([0, z]);
  // port: baseline back up to the inwale
  for (const y of range(0, sy, N_SIDE + 1).slice(1, -1)) outer.push([y, -halfWidth(x, y)]);

  // The bow closes to almost nothing, so ease the offset out there rather
  // than let the inside skin turn itself inside out.
  const t = Math.min(shell, halfWidth(x, sy * 0.5) * 0.4);
  const n = outer.length;
  const inner = [];
  for (let j = 0; j < n; j++) {
    // one-sided at the two inwale ends, centred everywhere else
    const a = outer[Math.max(0, j - 1)];
    const b = outer[Math.min(n - 1, j + 1)];
    const dy = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dy, dz) || 1;
    // the section runs clockwise in (y, z), so (-dz, dy) points inward
    inner.push([outer[j][0] + (-dz / l) * t, outer[j][1] + (dy / l) * t]);
  }

  return outer.concat(inner.reverse());
}

/** The hull as one watertight mesh, white outside and plywood inside. */
export function hullGeometry() {
  const xs = range(0, loa, 64);
  const profiles = xs.map(ring);
  let m = loft(profiles, xs, {
    closed: true,
    colorAt: (i, j) => (j < N_OUTER ? WHITE : PLY),
  });

  // close the bow (a near knife edge) and the transom
  m = merge(m, fan(profiles[0].slice(0, N_OUTER), xs[0], false, WHITE));
  m = merge(m, fan(profiles[profiles.length - 1].slice(0, N_OUTER),
    xs[xs.length - 1], true, WHITE));

  return toGeometry(THREE, m);
}

/* ------------------------------------------------------------------ *
 * decks: foredeck, aft tank, side decks
 * ------------------------------------------------------------------ */

const inwaleIn = (x) => innerHalf(x, sheerY(x));

/** Deck surface height at (x, z): the deck, or the inner skin below it. */
export function deckSurface(x, z) {
  return Math.max(deckY(x), innerY(x, z) + 0.001);
}

function ribbon(xs, profileAt, color = PLY) {
  return toGeometry(THREE, loft(xs.map(profileAt), xs, {
    colorAt: () => color,
  }));
}

function deckProfile(x) {
  const h = inwaleIn(x) * 0.995;
  const n = 11;
  const prof = [];
  for (let i = 0; i <= n; i++) {
    const z = -h + 2 * h * (i / n);
    prof.push([deckSurface(x, z), z]);
  }
  return prof;
}

export function foredeckGeometry() {
  return ribbon(range(0.015, SPEC.cockpit.x0, 24), deckProfile);
}

export function aftdeckGeometry() {
  return ribbon(range(SPEC.cockpit.x1, loa - 0.012, 20), deckProfile);
}

/** One side deck: from the coaming out to the inwale. */
export function sideDeckGeometry(side) {
  const xs = [];
  for (const x of range(SPEC.cockpit.x0, SPEC.cockpit.x1, 44)) {
    if (cockpitHalf(x) !== null) xs.push(x);
  }
  return ribbon(xs, (x) => {
    const h = inwaleIn(x) * 0.995;
    const c = cockpitHalf(x);
    const mid = c + (h - c) * 0.5;
    return [
      [deckSurface(x, c * side) - 0.003, side * c],
      [deckSurface(x, mid * side) - 0.001, side * mid],
      [deckSurface(x, h * side) - 0.002, side * h],
    ];
  });
}

/** Low plywood rim round the cockpit. */
export function coamingGeometry() {
  const xs = [];
  for (const x of range(SPEC.cockpit.x0, SPEC.cockpit.x1, 64)) {
    if (cockpitHalf(x) !== null) xs.push(x);
  }
  const h = 0.055, t = 0.013;
  const rails = xs.map((x) => {
    const c = cockpitHalf(x);
    const y = deckSurface(x, c);
    return [[y + h, c], [y + h, c - t], [y, c - t], [y, c]];
  });
  return toGeometry(THREE, loft(rails, xs, { closed: true, colorAt: () => PLY }));
}

/* ------------------------------------------------------------------ *
 * spars and small parts
 * ------------------------------------------------------------------ */

/** A tapered spar running from the origin along +Y in its own frame. */
export function sparGeometry(len, rTop, rBot, radial = 16) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, radial, 1, false);
  g.translate(0, len / 2, 0);
  return g;
}

/** A flat plywood part from a 2D outline in the x-y plane, thick in z. */
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

/** A rounded bag or fender following a path. */
export function bagGeometry(path, r, radial = 14) {
  const curve = new THREE.CatmullRomCurve3(
    path.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const g = new THREE.TubeGeometry(curve, Math.max(12, path.length * 6), r, radial, false);
  g.computeVertexNormals();
  return g;
}

/** Centreline of a side air bag, seated in the side tank. */
export function airBagPath(side, r = 0.044) {
  const pts = [];
  for (const x of range(0.54, 1.92, 22)) {
    const c = cockpitHalf(x);
    if (c === null) continue;
    // The tank narrows to about 80 mm amidships, so the bag has to be
    // fitted to it: hard against the coaming, and never through the deck
    // edge.  It sits low, mostly bedded into the tank rather than perched
    // on top of the deck.
    const h = innerHalf(x, deckY(x)) - 0.005;
    const out = Math.min(r * 1.05, Math.max(r * 0.55, (h - c) - r - 0.006));
    pts.push([x, deckSurface(x, side * (c + out)) + r * 0.72, side * (c + out)]);
  }
  return pts;
}

/** Centreline of a buoyancy bag across the boat at station x. */
export function crossBagPath(x, r) {
  const h = inwaleIn(x) * 0.88;
  return [
    [x, deckSurface(x, -h) + r * 0.95, -h * 0.82],
    [x, deckSurface(x, 0) + r * 1.25, 0],
    [x, deckSurface(x, h) + r * 0.95, h * 0.82],
  ];
}
