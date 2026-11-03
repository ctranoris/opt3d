/**
 * The Optimist sprit rig: mast, boom, sprit and a sail that is rebuilt
 * from its four corners whenever the trim changes, so sheeting the
 * mainsheet swings the whole rig about the mast and reshapes the cloth.
 *
 * Rig-local frame, origin at the tack:
 *   +Y up the mast, +X aft, +Z to port (leeward).
 *
 * Sail corners, from the class sail lengths (SBM plan / class drawing):
 *   luff  1.68 (tack -> throat, on the mast)
 *   head  1.22 (throat -> peak)
 *   foot  1.93 (tack -> clew, on a level boom)
 *   leech 2.67 (peak -> clew)
 *
 *   clew = foot along the boom
 *   peak = circle(throat, head) x circle(clew, leech)
 *
 * The sprit is not one of the sail's edges: it runs from the snotter, a
 * rope loop on the mast about half a metre above the boom, diagonally up
 * to the peak, and is what holds the peak up.
 */

import * as THREE from '../lib/three.module.js';
import { SPEC, D2R } from './opti-core.js';
import { sparGeometry } from './opti-hull.js';

const PI = Math.PI;

/* ------------------------------------------------------------------ *
 * rig geometry
 * ------------------------------------------------------------------ */

function circleIntersect(c0, r0, c1, r1, sign) {
  const dx = c1.x - c0.x, dy = c1.y - c0.y;
  const d = Math.hypot(dx, dy) || 1e-9;
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const mx = c0.x + a * dx / d, my = c0.y + a * dy / d;
  return { x: mx + sign * h * (-dy / d), y: my + sign * h * (dx / d) };
}

/**
 * The corners, rig-local, +X aft and +Y up the mast: tack, head (throat),
 * peak, corner (clew), plus the sprit's heel (snotter) and tip.  Four sail
 * lengths fix a quadrilateral once the boom angle is chosen; solving it
 * this way gives the ~41 deg head edge and ~3.2 m2 of the class drawing.
 *
 * @param rake  mast rake in degrees; the boom's rise is quoted from the
 *              horizontal, and these corners are in the raked rig frame
 */
export function rigCorners(rake = SPEC.rigRake) {
  const tack = { x: 0, y: 0 };
  const head = { x: 0, y: SPEC.luff };

  // clew: the foot laid along a level boom (level in the boat, so it
  // rises by the rake in this frame)
  const rise = (rake + SPEC.boomRise) * D2R;
  const corner = { x: SPEC.foot * Math.cos(rise), y: SPEC.foot * Math.sin(rise) };

  // peak: head edge from the throat, leech from the clew; of the two
  // intersections take the one above the throat -> clew line, up and aft
  const peak = circleIntersect(head, SPEC.headToPeak, corner, SPEC.leech, 1);

  // the sprit: heel at the snotter, tip a little past the peak
  const snotter = { x: 0, y: SPEC.snotter };
  const dx = peak.x - snotter.x, dy = peak.y - snotter.y;
  const l = Math.hypot(dx, dy);
  const spritEnd = {
    x: peak.x + dx / l * SPEC.spritOver, y: peak.y + dy / l * SPEC.spritOver,
  };

  return { tack, head, peak, corner, snotter, spritEnd, spritLen: l + SPEC.spritOver };
}

/**
 * Mast axis and tack position in the boat frame.  The mast passes
 * through the mast thwart and steps on the floor; the tack (the boom's
 * gooseneck) sits SPEC.tackHeight above the baseline.
 */
export function mastFrame(stepY) {
  const rake = SPEC.rigRake * D2R;
  const base = new THREE.Vector3(SPEC.mastFromBow, stepY, 0);
  const dir = new THREE.Vector3(Math.sin(rake), Math.cos(rake), 0);
  const lower = Math.max(0.02, (SPEC.tackHeight - stepY) / Math.cos(rake));
  const tack = base.clone().addScaledVector(dir, lower);
  return { rake, base, dir, lower, tack };
}

/* ------------------------------------------------------------------ *
 * sail surface
 *
 * Grid over (s, t):  s = 0 luff -> 1 leech,  t = 0 foot -> 1 head.
 * Row t runs from L(t) on the luff to R(t) on the leech, so the four
 * grid corners are tack, corner, peak, head and the t = 1 row is the
 * sprit edge.
 * ------------------------------------------------------------------ */

const SAIL_S = 30;
const SAIL_T = 26;

// Where the spars sit relative to the cloth plane.  +z is port, which
// is leeward with the boom eased to port: the cloth bellies that way.
// The sprit lies across the starboard face of the sail (SPRIT_SIDE = -1), the
// face the reference drawing shows it on, and the boom, which the foot is
// laced into, sits just to port.  The sprit is a straight spar, so
// wherever the cloth would pass through it, it is held clear of the spar;
// sailGeometry() solves that contact below for either side.
const BOOM_Z = 0.004;
const SPRIT_SIDE = -1;      // -1 starboard face, +1 port face
const SPRIT_HOOK_Z = 0.024 * SPRIT_SIDE; // sprit centreline at the snotter
const SPRIT_PEAK_Z = 0.016 * SPRIT_SIDE; // ... and at the peak
const SPRIT_R0 = 0.016;     // spar radius at the heel
const SPRIT_R1 = 0.0135;    // ... and at the peak
const CLOTH = 0.006;        // half a skin, so the cloth lies over the spar
const SPRIT_W = 0.17;       // how wide a band of cloth the sprit flattens
const BRIDLE = [0.69, 1.26]; // bridle ends, m along the boom from the tack
const BRIDLE_DROP = 0.09;    // the block hangs this far under the boom

function leechPoint(corner, peak, t, hollow) {
  const dx = peak.x - corner.x, dy = peak.y - corner.y;
  const len = Math.hypot(dx, dy) || 1;
  // outward normal of the leech (away from the sail interior)
  const nx = dy / len, ny = -dx / len;
  const cx = (corner.x + peak.x) / 2 + nx * hollow;
  const cy = (corner.y + peak.y) / 2 + ny * hollow;
  const it = 1 - t;
  return {
    x: it * it * corner.x + 2 * it * t * cx + t * t * peak.x,
    y: it * it * corner.y + 2 * it * t * cy + t * t * peak.y,
  };
}

/**
 * @param corners  rig corners
 * @param o        { camber, twist, hollow, luffSag, footSag, side, flutter, phase }
 *                 side: +1 bellies to +z (port of the cloth), -1 to -z.
 *                 flutter: amplitude (m) of a luffing ripple, phase its time.
 */
export function sailGeometry(corners, o = {}) {
  const {
    camber = 0.085, twist = 0.16, hollow = -0.045,
    luffSag = 0.035, footSag = 0.012,
    side = 1, flutter = 0, phase = 0,
  } = o;

  const { tack, head, peak, corner } = corners;
  const pos = [], nor = [], uv = [], idx = [];

  // The sprit's trace across the face of the sail, in the same frame as
  // the corners: from the snotter on the mast to the peak.
  const spritA = corners.snotter;
  const sbx = peak.x - spritA.x, sby = peak.y - spritA.y;
  const slen2 = sbx * sbx + sby * sby;

  for (let j = 0; j <= SAIL_T; j++) {
    const t = j / SAIL_T;
    const L = { x: tack.x + (head.x - tack.x) * t, y: tack.y + (head.y - tack.y) * t };
    const R = leechPoint(corner, peak, t, hollow);

    // twist grows toward the head, easing out over the bottom third
    const tw = twist * Math.pow(Math.max(0, t - 0.12) / 0.88, 1.6);

    // Draft depth: deepest mid height, and dying out at both the foot and
    // the head, because the foot is laced into the boom and the head edge
    // is laced to the sprit - neither spar lets the cloth curve.
    const belly = Math.sin(PI * (0.14 + 0.72 * t))
      * Math.min(1, t / 0.16) * Math.min(1, (1 - t) / 0.13);

    for (let i = 0; i <= SAIL_S; i++) {
      const s = i / SAIL_S;
      let px = L.x + (R.x - L.x) * s;
      let py = L.y + (R.y - L.y) * s;
      let pz = 0;
      const flatX = px, flatY = py;   // the unsailed point, for the uv

      // Spanwise envelope: nil on the luff and the leech, full mid-chord.
      // Everything that pulls the cloth out of the rig plane goes through
      // this, so the four corners stay welded to the spars - the peak to
      // the sprit tip and the clew to the boom end, which is how a rigid
      // sprit and boom actually hold the cloth.  The peak of the draft is
      // eased forward of mid-chord, as on any drafty sail, which also
      // keeps the aft panel flat enough for the sprit to lie against the
      // leech instead of standing off it.
      const env = Math.sin(PI * Math.pow(s, 0.62)) * (1 - 0.35 * s);

      // Camber, to leeward (+z), and luff sag - both the cloth going to
      // leeward, both fading out at the leech so the edge stays on the
      // sprit.  The foot is laced into the boom, so it stays put.
      const chord = Math.hypot(R.x - L.x, R.y - L.y);
      const draft = side * camber * (chord / 2.2) * env * belly * 2.4;
      const sag = side * luffSag * Math.sin(PI * t) * Math.pow(Math.max(0, 1 - s), 1.7);
      pz += draft + sag;
      py -= footSag * Math.sin(PI * s) * Math.pow(Math.max(0, 1 - t), 2.0);

      // Twist: rotate the section about the luff so the leech falls off to
      // leeward.  Only the camber rotates - the luff sag belongs to the
      // mast, which does not twist.  Eased to nothing at the leech so the
      // peak and clew cannot drift off their spars.
      const tws = side * tw * env;
      const cosT = Math.cos(tws), sinT = Math.sin(tws);
      const rx = px - L.x, rz = draft;
      px = L.x + rx * cosT - rz * sinT;
      pz = rx * sinT + rz * cosT;

      // Luffing: with the wind along the cloth the sail shakes, a ripple
      // running aft from the luff.  Nil on the spars that hold the edges.
      if (flutter) {
        pz += flutter * Math.sin(PI * s) * Math.min(1, t / 0.12) * Math.min(1, (1 - t) / 0.1)
          * Math.sin(11 * s + 5 * t - phase);
      }

      // The sprit is a straight spar across one face of the sail, so the
      // cloth cannot pass through it.  Find how far this point sits from
      // the sprit's trace across the cloth, and where it would be inside
      // the spar, hold it against the spar's surface instead.  With the
      // sprit on the leeward face this gives the crease along the sprit;
      // on the windward face the cloth bellies away and rarely touches.
      const ax = px - spritA.x, ay = py - spritA.y;
      let u = (ax * sbx + ay * sby) / slen2;
      u = Math.min(1, Math.max(0, u));
      const dx = px - (spritA.x + sbx * u), dy = py - (spritA.y + sby * u);
      const near = Math.exp(-((dx * dx + dy * dy) / (SPRIT_W * SPRIT_W)));
      const face = SPRIT_HOOK_Z + (SPRIT_PEAK_Z - SPRIT_HOOK_Z) * u
        - SPRIT_SIDE * (SPRIT_R0 + (SPRIT_R1 - SPRIT_R0) * u + CLOTH);
      const proud = (pz - face) * SPRIT_SIDE;
      if (proud > 0) pz -= near * proud * SPRIT_SIDE;

      pos.push(px, py, pz);
      nor.push(0, 0, 1);
      uv.push(...sailUV(flatX, flatY));
    }
  }

  const row = SAIL_S + 1;
  for (let j = 0; j < SAIL_T; j++) {
    for (let i = 0; i < SAIL_S; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ *
 * sail cloth texture
 *
 * The cloth is mapped by a flat, uniform projection of the sail plane:
 * one texture unit is TEX_SPAN metres in both directions, so lettering
 * keeps its proportions whatever shape the four corners make.  Everything
 * painted on it is placed in metres in the rig frame (+x aft, +y up the
 * mast, origin at the tack).
 *
 * The canvas holds two copies of the cloth side by side.  The left half
 * is the port face and the right half the starboard face.  They share
 * everything sewn through the cloth: seams, batten pockets and
 * tell-tales sit in the same place on both.  Only the printed marks
 * differ.  The insignia, national letters and sail number are printed on
 * each face to read correctly from that side, so on the starboard half they
 * are mirrored about their own centres rather than the whole sheet being
 * flipped.  The geometry's u runs 0..0.5 across the port half, and
 * the cloth shader shifts the starboard face (the front face, by the grid's
 * winding) into the right half.
 * ------------------------------------------------------------------ */

/** The printed marks: national letters over the sail number. */
export const SAIL_MARKS = { country: 'GRE', number: '1060' };

const TEX_X0 = -0.06;   // rig-frame metres at texture u = 0 ...
const TEX_Y0 = -0.06;   // ... and v = 0
const TEX_SPAN = 2.66;  // metres covered by one half of the texture
const TEX_N = 1024;     // pixels per half

/** Flat (unsailed) rig-frame point -> geometry uv, port half. */
export function sailUV(x, y) {
  return [0.5 * (x - TEX_X0) / TEX_SPAN, (y - TEX_Y0) / TEX_SPAN];
}

// Layout after the class sail drawing (init_assets/S-OD_Optimist_R6_
// Mainsail_416x.webp): the insignia high in the sail between the head and
// the leech, national letters over the sail number tucked against the
// leech at mid height, two tell-tales a hand's width off the mast, one
// batten pocket in the upper leech, and a clear window low in the sail
// just above the foot.  Sizes are metres of cloth.
const MARK = {
  color: '#1d4f9e',    // the class drawing's blue
  letterH: 0.26,       // national letters, cap height
  numberH: 0.26,       // sail number, figure height
  gap: 0.07,           // between the two lines
  numberBase: 0.84,    // baseline of the number above the tack
  leechInset: 0.12,    // both lines end this far inside the leech
};

/** Batten pocket: fraction up the leech from the clew, and its length. */
export const BATTENS = [0.68];
const BATTEN_L = 0.42;
/** Class insignia: centre (rig frame) and ring radius. */
export const INSIGNIA = { x: 0.84, y: 2.06, r: 0.085 };
/** Tell-tales, near the luff: [x, y] of the stitch, rig frame. */
export const TELLTALES = [[0.22, 1.40], [0.24, 0.82]];
/** The window: along the foot from x0 to x1, from y0 to y1 above it. */
export const WINDOW = { x0: 0.34, x1: 1.00, y0: 0.15, y1: 0.31 };

function lerp2(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

/** x where the line a-b reaches height y (a, b not level). */
function xAtY(a, b, y) { return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y); }

/** Where the ray p + s*d first meets segment a-b, or null. */
function hitSegment(p, d, a, b) {
  const ex = b.x - a.x, ey = b.y - a.y;
  const den = d.x * ey - d.y * ex;
  if (Math.abs(den) < 1e-9) return null;
  const s = ((a.x - p.x) * ey - (a.y - p.y) * ex) / den;
  const u = ((a.x - p.x) * d.y - (a.y - p.y) * d.x) / den;
  return s > 0 && u >= 0 && u <= 1 ? { x: p.x + d.x * s, y: p.y + d.y * s } : null;
}

/**
 * Paint one face of the cloth into the canvas half starting at ox.
 * `mirror` flips each printed mark about its own centre.
 */
function paintFace(g, ox, corners, marks, mirror) {
  const { tack, head, peak, corner } = corners;
  const k = TEX_N / TEX_SPAN;               // px per metre
  const X = (x) => ox + (x - TEX_X0) * k;
  const Y = (y) => TEX_N - (y - TEX_Y0) * k;
  const P = (p) => [X(p.x), Y(p.y)];

  g.save();
  g.beginPath();
  g.rect(ox, 0, TEX_N, TEX_N);
  g.clip();

  // cloth: a soft tone change from luff to leech
  const grad = g.createLinearGradient(X(0), Y(2.4), X(1.9), Y(0));
  grad.addColorStop(0, '#fdfdfb');
  grad.addColorStop(0.55, '#f6f6f2');
  grad.addColorStop(1, '#ecece6');
  g.fillStyle = grad;
  g.fillRect(ox, 0, TEX_N, TEX_N);

  // woven feel
  g.globalAlpha = 0.04;
  g.strokeStyle = '#7e7e76';
  g.lineWidth = 1;
  for (let i = 0; i < 160; i++) {
    const y = (i / 160) * TEX_N;
    g.beginPath(); g.moveTo(ox, y); g.lineTo(ox + TEX_N, y + 5); g.stroke();
  }
  g.globalAlpha = 1;

  // everything from here is cut to the sail's outline
  const outline = () => {
    g.beginPath();
    for (const p of [tack, corner, peak, head]) g.lineTo(...P(p));
    g.closePath();
  };
  outline();
  g.clip();

  // leech direction and the inward normal (toward the luff)
  const lx = peak.x - corner.x, ly = peak.y - corner.y;
  const ll = Math.hypot(lx, ly);
  const nx = -ly / ll, ny = lx / ll;
  const inward = (nx * (tack.x - corner.x) + ny * (tack.y - corner.y)) > 0 ? 1 : -1;
  const inw = { x: nx * inward, y: ny * inward };

  const seam = (a, b) => {
    g.beginPath(); g.moveTo(...P(a)); g.lineTo(...P(b)); g.stroke();
  };
  const edges = [[tack, head], [head, peak], [tack, corner]];
  const across = (p) => {               // from p inward to the far edge
    for (const [a, b] of edges) {
      const h = hitSegment(p, inw, a, b);
      if (h) return h;
    }
    return { x: p.x + inw.x * 3, y: p.y + inw.y * 3 };
  };

  // Panels: cross-cut in the upper sail, square to the leech, and a fan
  // of radial panels from the clew below the lowest cross seam - the clew
  // takes the sheet load, so the cloth runs out from it.
  g.strokeStyle = 'rgba(120,120,112,0.30)';
  g.lineWidth = Math.max(1.5, 0.006 * k);
  const CROSS = [0.47, 0.60, 0.74, 0.87];
  for (const f of CROSS) {
    const p = lerp2(corner, peak, f);
    seam(p, across(p));
  }
  const s0 = across(lerp2(corner, peak, CROSS[0]));   // lowest cross seam
  const luffTop = Math.min(s0.y, head.y);
  for (const f of [0.80, 0.62, 0.45, 0.30, 0.16]) {
    const q = lerp2(tack, head, (luffTop * f) / head.y);
    seam(corner, q);
  }

  // corner reinforcement patches, an extra layer of cloth at each corner
  g.fillStyle = 'rgba(110,110,100,0.06)';
  g.strokeStyle = 'rgba(120,120,112,0.26)';
  g.lineWidth = Math.max(1.5, 0.005 * k);
  for (const [p, r] of [[tack, 0.20], [corner, 0.26], [head, 0.16], [peak, 0.22]]) {
    g.beginPath(); g.arc(X(p.x), Y(p.y), r * k, 0, PI * 2);
    g.fill(); g.stroke();
  }

  // tapes along the luff, head and foot, with the lacing eyelets
  g.save();
  outline();
  g.strokeStyle = 'rgba(95,95,88,0.10)';
  g.lineWidth = 0.07 * k;               // half of it inside the clip
  g.stroke();
  g.restore();
  g.fillStyle = 'rgba(120,124,130,0.85)';
  const eyelets = (a, b, step, off) => {
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(L / step));
    const ex = (b.x - a.x) / L, ey = (b.y - a.y) / L;
    // offset into the sail: the edge normal that points at the clew/tack side
    let ux = -ey, uy = ex;
    const mid = lerp2(a, b, 0.5), c = { x: (tack.x + corner.x + peak.x) / 3, y: (tack.y + corner.y + peak.y) / 3 };
    if ((c.x - mid.x) * ux + (c.y - mid.y) * uy < 0) { ux = -ux; uy = -uy; }
    for (let i = 1; i < n; i++) {
      const p = lerp2(a, b, i / n);
      g.beginPath();
      g.arc(X(p.x + ux * off), Y(p.y + uy * off), 0.009 * k, 0, PI * 2);
      g.fill();
    }
  };
  eyelets(tack, head, 0.21, 0.018);
  eyelets(head, peak, 0.21, 0.018);
  eyelets(tack, corner, 0.24, 0.018);

  // batten pocket, square to the leech, inward from the leech
  g.strokeStyle = 'rgba(80,80,74,0.45)';
  g.lineWidth = 0.03 * k;
  g.lineCap = 'round';
  for (const f of BATTENS) {
    const p = lerp2(corner, peak, f);
    const a = { x: p.x + inw.x * 0.03, y: p.y + inw.y * 0.03 };
    seam(a, { x: a.x + inw.x * BATTEN_L, y: a.y + inw.y * BATTEN_L });
  }
  g.lineCap = 'butt';

  // The window: a clear PVC panel low in the sail, sewn in with a tape.
  // It is cut right out of the canvas so the material's alpha shows it.
  const footY = (x) => tack.y + (corner.y - tack.y) * (x - tack.x) / (corner.x - tack.x);
  const win = [
    { x: WINDOW.x0, y: footY(WINDOW.x0) + WINDOW.y0 },
    { x: WINDOW.x1, y: footY(WINDOW.x1) + WINDOW.y0 },
    { x: WINDOW.x1, y: footY(WINDOW.x1) + WINDOW.y1 },
    { x: WINDOW.x0, y: footY(WINDOW.x0) + WINDOW.y1 },
  ];
  const winPath = () => {
    g.beginPath();
    for (const p of win) g.lineTo(...P(p));
    g.closePath();
  };
  g.save();
  g.globalCompositeOperation = 'destination-out';
  winPath(); g.fillStyle = '#000'; g.fill();
  g.restore();
  winPath();
  g.fillStyle = 'rgba(214,228,236,0.30)';
  g.fill();
  g.strokeStyle = 'rgba(150,150,142,0.9)';
  g.lineWidth = 0.016 * k;
  g.stroke();

  // printed marks, each mirrored about its own centre on the starboard face
  const printed = (cx, cy, draw) => {
    g.save();
    g.translate(X(cx), Y(cy));
    if (mirror) g.scale(-1, 1);
    draw();
    g.restore();
  };

  // class insignia: the ring with its upright stroke through it, standing
  // well clear of the ring below
  const r = INSIGNIA.r * k;
  printed(INSIGNIA.x, INSIGNIA.y, () => {
    g.strokeStyle = MARK.color;
    g.lineWidth = r * 0.30;
    g.beginPath(); g.arc(0, 0, r, 0, PI * 2); g.stroke();
    g.lineCap = 'butt';
    g.lineWidth = r * 0.24;
    g.beginPath(); g.moveTo(0, -r * 1.22); g.lineTo(0, r * 2.45); g.stroke();
  });

  // National letters over the sail number, both lines ending a set
  // distance inside the leech, as in the class drawing - the leech leans
  // aft lower down, so the number sits a little further aft.
  const leechX = (y) => xAtY(corner, peak, y);
  const spritX = (y) => xAtY(corners.snotter, peak, y);
  const line = (text, base, h) => {
    if (!text) return;
    const right = leechX(base + h / 2) - MARK.leechInset;
    const left = Math.max(0.12, spritX(base + h) + 0.08);
    markLine(g, printed, text, right, base, h, right - left, k);
  };
  const numBase = MARK.numberBase;
  line(marks.number, numBase, MARK.numberH);
  line(marks.country, numBase + MARK.numberH + MARK.gap, MARK.letterH);

  // Tell-tales: a red patch on the cloth with a strand of yarn streaming
  // aft.  Sewn through, so the same on both faces.
  for (const [x, y] of TELLTALES) {
    const w = Math.max(2, 0.008 * k), L = 0.17 * k;
    g.save();
    g.translate(X(x), Y(y));
    g.strokeStyle = '#b3261e';
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    for (let i = 1; i <= 12; i++) {
      const s = i / 12;
      g.lineTo(L * s, Math.sin(s * PI * 2.2) * 0.012 * k * s + s * 0.01 * k);
    }
    g.stroke();
    g.fillStyle = '#c62828';
    g.beginPath(); g.arc(0, 0, 0.017 * k, 0, PI * 2); g.fill();
    g.restore();
  }

  g.restore();
}

/**
 * One line of class lettering: cap height h metres, its right end at x
 * and its baseline at y, narrowed to fit maxW metres if the text is long.
 */
function markLine(g, printed, text, right, y, h, maxW, k) {
  const px = Math.round((h / 0.72) * k);      // bold sans caps ~0.72 em
  g.font = `bold ${px}px Arial, Helvetica, sans-serif`;
  const w = g.measureText(text).width;
  const sx = Math.min(1, (maxW * k) / w);    // squeeze long numbers sideways
  const cx = right - (w * sx) / 2 / k;       // centre, so mirroring keeps it in place
  printed(cx, y, () => {
    g.scale(sx, 1);
    g.fillStyle = MARK.color;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillText(text, 0, 0);
  });
}

export function sailTexture(marks = SAIL_MARKS, corners = rigCorners()) {
  const c = document.createElement('canvas');
  c.width = TEX_N * 2; c.height = TEX_N;
  const g = c.getContext('2d');
  paintFace(g, 0, corners, marks, false);      // port face
  paintFace(g, TEX_N, corners, marks, true);   // starboard face

  const tex = new THREE.CanvasTexture(c);
  tex.name = 'sail-cloth';
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Repaint the cloth with different marks.  `marks` may give `country`
 * and/or `number`; an empty string leaves that line off the sail.
 */
export function setSailMarks(rig, marks = {}) {
  Object.assign(SAIL_MARKS, marks);
  const old = rig.materials.sailMat.map;
  rig.materials.sailMat.map = sailTexture(SAIL_MARKS, rig.corners);
  rig.materials.sailMat.needsUpdate = true;
  if (old) old.dispose();
}

/* ------------------------------------------------------------------ *
 * the rig
 * ------------------------------------------------------------------ */

/**
 * A spar from a to b, tapering rA -> rB.  `z` offsets it out of the cloth
 * plane - +z is to leeward - and may be a pair [zA, zB] to give the spar
 * its own angle across the face of the sail.
 */
function sparBetween(a, b, rA, rB, mat, z = 0) {
  const [zA, zB] = Array.isArray(z) ? z : [z, z];
  const d = new THREE.Vector3(b.x - a.x, b.y - a.y, zB - zA);
  const m = new THREE.Mesh(sparGeometry(d.length(), rB, rA), mat);
  m.position.set(a.x, a.y, zA);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

export function createRig(corners = rigCorners(), frame = mastFrame(0.08)) {
  // anodised aluminium spars, as on every current class rig
  const wood = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.32, metalness: 0.75 });
  const carbon = wood;
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xbcc0c6, roughness: 0.28, metalness: 0.85 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.7 });
  wood.name = 'spar-aluminium'; black.name = 'rig-fitting';
  steel.name = 'rig-hardware'; gold.name = 'block-sheave';

  const group = new THREE.Group();   // at the tack, raked with the mast
  group.name = 'Rig';
  const pivot = new THREE.Group();   // yaws about the mast
  pivot.name = 'Boom pivot';
  group.add(pivot);

  // ---- mast: steps below the tack, so it starts at -frame.lower ----
  const mastLen = frame.lower + SPEC.luff + SPEC.mastAboveHead;
  const mastGeo = sparGeometry(mastLen, SPEC.mastDia / 2 * 0.72, SPEC.mastDia / 2);
  mastGeo.translate(0, -frame.lower, 0);
  const mast = new THREE.Mesh(mastGeo, wood);
  mast.name = 'Mast';
  mast.castShadow = true;
  group.add(mast);
  // masthead truck
  const truck = new THREE.Mesh(new THREE.SphereGeometry(SPEC.mastDia * 0.42, 14, 10), black);
  truck.name = 'Masthead truck';
  truck.position.y = SPEC.luff + SPEC.mastAboveHead;
  group.add(truck);

  // gooseneck: a collar round the mast with the boom jaws on it
  const gooseneck = new THREE.Mesh(
    new THREE.CylinderGeometry(SPEC.mastDia * 0.66, SPEC.mastDia * 0.66, 0.05, 16), black);
  gooseneck.name = 'Gooseneck';
  gooseneck.position.set(0, -0.005, 0);
  group.add(gooseneck);
  // mast heel plug where it lands on the step
  const heel = new THREE.Mesh(
    new THREE.CylinderGeometry(SPEC.mastDia * 0.55, SPEC.mastDia * 0.6, 0.04, 14), black);
  heel.name = 'Mast heel';
  heel.position.set(0, -frame.lower + 0.02, 0);
  group.add(heel);

  // ---- boom -------------------------------------------------------
  // The foot is laced into the boom, so the boom sits on the foot line
  // and shows below the cloth.  The sprit crosses the starboard face, where it
  // reads as a diagonal bar across the sail.
  const boom = sparBetween(corners.tack, corners.corner,
    SPEC.boomDia / 2, SPEC.boomDia / 2 * 0.82, carbon, BOOM_Z);
  boom.name = 'Boom';
  boom.castShadow = true;
  pivot.add(boom);

  const boomEnd = new THREE.Mesh(new THREE.SphereGeometry(SPEC.boomDia * 0.6, 14, 10), black);
  boomEnd.name = 'Boom end';
  boomEnd.position.set(corners.corner.x, corners.corner.y, BOOM_Z);
  pivot.add(boomEnd);

  // ---- sprit: from the snotter on the mast up to the peak ---------
  // it lies across the starboard face of the sail and pushes the peak up
  const spritTipZ = SPRIT_PEAK_Z;
  const sprit = sparBetween(corners.snotter, corners.spritEnd,
    SPRIT_R0, SPRIT_R1, wood, [SPRIT_HOOK_Z, spritTipZ]);
  sprit.name = 'Sprit';
  sprit.castShadow = true;
  pivot.add(sprit);

  const spritTip = new THREE.Mesh(new THREE.SphereGeometry(SPEC.spritDia * 0.58, 14, 10), black);
  spritTip.name = 'Sprit tip';
  spritTip.position.set(corners.spritEnd.x, corners.spritEnd.y, spritTipZ);
  pivot.add(spritTip);

  // ---- sail -------------------------------------------------------
  const sailMat = new THREE.MeshPhysicalMaterial({
    map: sailTexture(SAIL_MARKS, corners),
    side: THREE.DoubleSide,
    // the clear window low in the sail is cut out of the texture's alpha
    transparent: true,
    // one pass: three.js draws a two-sided transparent material back pass
    // first with the winding flipped, which swaps gl_FrontFacing and so
    // the two halves of the texture
    forceSinglePass: true,
    roughness: 0.9,
    metalness: 0,
    sheen: 0.7,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xffffff),
  });

  // The cloth is one double-sided surface.  Its texture holds both faces
  // side by side (see sailTexture): the geometry's uv addresses the
  // port half, and the front face - the starboard one, by the grid's
  // winding - samples the starboard half instead, where the printed marks are
  // mirrored so they read correctly from that side.  Seams, battens and
  // tell-tales are in the same place in both halves.
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
  const sail = new THREE.Mesh(sailGeometry(corners), sailMat);
  sail.name = 'Sail';
  sail.castShadow = true;
  pivot.add(sail);

  // corner fittings
  const tackFit = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 10), steel);
  tackFit.name = 'Tack fitting';
  pivot.add(tackFit);
  const headFit = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 10), steel);
  headFit.name = 'Head fitting';
  headFit.position.set(corners.head.x, corners.head.y, 0);
  pivot.add(headFit);

  // ---- mainsheet bridle and block ---------------------------------
  // A rope bridle under the boom; the mainsheet block rides on it,
  // right above the ratchet block on the centre thwart.
  const fx = corners.corner.x / SPEC.foot, fy = corners.corner.y / SPEC.foot;
  const onBoom = (d, drop = 0) => ({ x: fx * d + fy * drop, y: fy * d - fx * drop });
  const b0 = onBoom(BRIDLE[0], SPEC.boomDia / 2), b1 = onBoom(BRIDLE[1], SPEC.boomDia / 2);
  const bm = onBoom((BRIDLE[0] + BRIDLE[1]) / 2, BRIDLE_DROP);
  const bridleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(b0.x, b0.y, BOOM_Z),
    new THREE.Vector3((b0.x + bm.x) / 2, (b0.y + bm.y) / 2 - 0.01, BOOM_Z),
    new THREE.Vector3(bm.x, bm.y + 0.03, BOOM_Z),
    new THREE.Vector3((b1.x + bm.x) / 2, (b1.y + bm.y) / 2 - 0.01, BOOM_Z),
    new THREE.Vector3(b1.x, b1.y, BOOM_Z),
  ]);
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe9e4d4, roughness: 0.95 });
  ropeMat.name = 'rope';
  const bridle = new THREE.Mesh(new THREE.TubeGeometry(bridleCurve, 30, 0.003, 6, false), ropeMat);
  bridle.name = 'Mainsheet bridle';
  pivot.add(bridle);

  const block = new THREE.Group();
  block.name = 'Boom block';
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.026), black);
  const sheave = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 16), gold);
  sheave.rotation.x = PI / 2;
  block.add(shell, sheave);
  block.position.set(bm.x, bm.y, BOOM_Z);
  pivot.add(block);
  corners.boomBlock = { x: bm.x, y: bm.y - 0.03 };

  // ---- snotter: the sprit's heel in a rope loop on the mast -------
  const snot = new THREE.Mesh(new THREE.TorusGeometry(SPEC.mastDia * 0.62, 0.005, 6, 18), ropeMat);
  snot.name = 'Snotter';
  snot.rotation.x = PI / 2;
  snot.position.set(0, corners.snotter.y, 0);
  group.add(snot);
  const heelFit = new THREE.Mesh(new THREE.SphereGeometry(SPEC.spritDia * 0.62, 12, 10), black);
  heelFit.name = 'Sprit heel';
  heelFit.position.set(corners.snotter.x + 0.01, corners.snotter.y, SPRIT_HOOK_Z);
  pivot.add(heelFit);

  // ---- masthead wind indicator ------------------------------------
  // A vane on a short rod above the truck, free to yaw.  Its pointer
  // (local -X) faces into the apparent wind and the twin tail fins
  // (local +X) stream downwind; the viewer turns it every frame with
  // setWindVane().
  const mastTop = SPEC.luff + SPEC.mastAboveHead;
  const vaneMat = new THREE.MeshStandardMaterial({ color: 0xd8322a, roughness: 0.5 });
  vaneMat.name = 'wind-indicator';
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.26, 6), steel);
  rod.position.y = mastTop + 0.13;
  group.add(rod);
  const vane = new THREE.Group();
  vane.name = 'Wind indicator';
  vane.position.y = mastTop + 0.25;
  group.add(vane);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.34, 6), black);
  arm.rotation.z = PI / 2;
  arm.position.x = 0.05;
  vane.add(arm);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), steel);
  vane.add(hub);
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.04, 10), vaneMat);
  point.rotation.z = PI / 2;            // tip toward -X
  point.position.x = -0.13;
  vane.add(point);
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0); finShape.lineTo(0.09, 0.0);
  finShape.lineTo(0.09, 0.055); finShape.lineTo(0.03, 0.012); finShape.closePath();
  const finGeo = new THREE.ShapeGeometry(finShape);
  const finMat = new THREE.MeshStandardMaterial({ color: 0xd8322a, roughness: 0.5, side: THREE.DoubleSide });
  finMat.name = 'wind-indicator-fin';
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(0.13, 0, 0);
    fin.rotation.x = s * 0.45;          // the two fins open in a V
    vane.add(fin);
  }

  // ---- mainsheet line (updated every frame) -----------------------
  const SHEET_PTS = 26;
  const sheetGeo = new THREE.BufferGeometry();
  sheetGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SHEET_PTS * 3), 3));
  const sheetMat = new THREE.LineBasicMaterial({ color: 0xefe9d6, linewidth: 2 });
  sheetMat.name = 'mainsheet-rope';
  const sheet = new THREE.Line(sheetGeo, sheetMat);
  sheet.name = 'Mainsheet';
  sheet.frustumCulled = false;
  group.add(sheet);

  return {
    group, pivot, sail, sheet, boom, sprit, block, mast, vane, corners, BOOM_Z,
    materials: { wood, carbon, black, steel, gold, sailMat },
  };
}

/**
 * Trim the rig.
 * @param rig    createRig() result
 * @param p      { boomDeg, fill, camber, twist, wind, t }
 *   boomDeg  boom angle off the centreline, degrees: + to starboard (-z),
 *            - to port (+z), anywhere in -180..180.  (The old `boomOut`
 *            0..1, eased to port, is still accepted.)
 *   fill     how the wind fills the cloth, -1..1: the sign is the side it
 *            bellies to (+ = the pivot's +z, port with the boom amidships),
 *            the size how full it is.  Near 0 the sail luffs.
 *   t        time, for the luffing ripple.
 */
export function updateRig(rig, p = {}) {
  const { camber = 1, twist = 1, wind = 0.5, fill = 1, t = 0 } = p;
  const boomDeg = p.boomDeg ?? -(p.boomOut ?? 0.35) * 74;

  // rotation.y = a swings the boom end (+x) to (cos a, 0, -sin a)
  rig.pivot.rotation.y = boomDeg * D2R;
  rig.boomDeg = boomDeg;
  const eased = Math.min(1, Math.abs(boomDeg) / 74);
  rig.boomOut = eased;

  // Sheet her in and the leech tensions: the middle of the sail
  // deepens and the leech hooks in.  Ease her and the top twists off and
  // the leech relaxes toward straight.  A sail the wind only half fills
  // is flatter, and one it does not fill at all shakes.
  const sheetedIn = 1 - eased;
  const full = Math.min(1, Math.abs(fill));
  const c = camber * (0.55 + 0.45 * sheetedIn) * (0.55 + 0.6 * wind) * (0.2 + 0.8 * full);
  const tw = twist * (0.45 + 0.75 * eased) * (0.6 + 0.7 * wind) * (0.3 + 0.7 * full);

  rig.sail.geometry.dispose();
  rig.sail.geometry = sailGeometry(rig.corners, {
    camber: 0.085 * c,
    twist: 0.16 * tw,
    hollow: -0.045 - 0.03 * sheetedIn,
    luffSag: 0.035 * (0.4 + 0.9 * wind),
    side: fill < 0 ? -1 : 1,
    flutter: (1 - full) * (0.01 + 0.035 * wind),
    phase: t * 14,
  });
}

/**
 * Rebuild the mainsheet from the bridle block down to the ratchet block
 * on the centre thwart.  The line
 * is a child of the boat group; `cleatBoat` is in boat coordinates.
 */
export function updateMainsheet(rig, cleatBoat) {
  const attr = rig.sheet.geometry.attributes.position;
  const arr = attr.array;
  const n = attr.count;

  const bb = rig.corners.boomBlock;
  const a = new THREE.Vector3(bb.x, bb.y, rig.BOOM_Z ?? 0.004);
  rig.pivot.localToWorld(a);
  if (rig.sheet.parent) rig.sheet.parent.worldToLocal(a);
  const b = cleatBoat;

  // rig.boomOut is how far the boom is eased.  Sheet her in and the line
  // pulls taut; ease her and there is slack to hang in.
  const eased = Math.min(1, Math.max(0, rig.boomOut ?? 0.4));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const slack = 0.01 + 0.05 * eased;
    const sag = Math.sin(PI * t) * slack;
    arr[i * 3] = a.x + (b.x - a.x) * t;
    arr[i * 3 + 1] = a.y + (b.y - a.y) * t - sag;
    arr[i * 3 + 2] = a.z + (b.z - a.z) * t;
  }
  attr.needsUpdate = true;
  rig.sheet.geometry.computeBoundingSphere();
}

const _q = new THREE.Quaternion();
const _d = new THREE.Vector3();

/**
 * Turn the masthead wind indicator so its tail streams along `flowWorld`,
 * the direction the apparent wind blows (world frame).  `t` adds a small
 * flutter.
 */
export function setWindVane(rig, flowWorld, t = 0) {
  const v = rig.vane;
  if (!v || !v.parent) return;
  v.parent.getWorldQuaternion(_q).invert();
  _d.copy(flowWorld).applyQuaternion(_q);
  // rotation.y = a maps local +X to (cos a, 0, -sin a)
  const yaw = Math.atan2(-_d.z, _d.x);
  v.rotation.y = yaw + 0.05 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 13.1);
}
