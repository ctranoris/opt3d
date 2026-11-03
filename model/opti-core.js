/**
 * Optimist dinghy - class dimensions, hull lines and the lofting maths.
 *
 * Boat-local frame (right handed):
 *   +X aft   (bow transom top at x = 0, stern transom at x = SPEC.loa)
 *   +Y up    (y = 0 is the baseline: the lowest point of the bottom)
 *   +Z to port
 *
 * Where the numbers come from (init_assets/):
 *   Optimist_dinghy.png       class side profile, to scale - sheer, rocker,
 *                             transom heights and rake, mast, board and rig
 *                             positions (2.30 m = 341 px, 6.745 mm/px)
 *   Opti Model.stl            a print-plate model whose hull half is an
 *                             accurate plan view - half breadths at the sheer
 *                             and the floor, and the interior layout
 *   Optimist_dinghy_02.png    photo, top down - confirms the layout
 *   SBM125 plan               sail lengths (luff, head, foot, leech)
 */

export const SPEC = {
  loa: 2.30,          // hull length, m
  beam: 1.13,         // maximum beam at the sheer
  shell: 0.008,       // GRP skin thickness
  waterline: 0.10,    // baseline below the water surface, sailing trim

  // --- rig ------------------------------------------------------------
  mastFromBow: 0.30,  // mast centreline aft of the bow transom top
  rigRake: 1.5,       // deg - the mast stands near vertical
  tackHeight: 0.70,   // boom jaws above the baseline
  luff: 1.68,         // 5'-6"  tack -> throat, along the mast
  headToPeak: 1.22,   // 4'-0"  throat -> peak
  foot: 1.93,         // 6'-4"  tack -> clew, along the boom
  leech: 2.67,        // 8'-9"  peak -> clew
  snotter: 0.40,      // sprit heel: this far up the mast above the tack
  spritOver: 0.04,    // sprit tip reaches past the peak
  boomRise: 0,        // deg - the boom sits level
  mastAboveHead: 0.05,
  mastDia: 0.050,
  boomDia: 0.040,
  spritDia: 0.032,

  // --- interior (x from the bow) ------------------------------------
  mastThwart: [0.22, 0.41],     // fore and aft edges
  centreThwart: [1.22, 1.34],
  boardCase: [0.92, 1.28, 0.08], // x0, x1, outside width
  board: { x0: 0.955, chord: 0.29, below: 0.50 },
  sideBags: [0.43, 1.21],
  sternBag: { x: 2.19, r: 0.09 },
};

export const D2R = Math.PI / 180;

/* ------------------------------------------------------------------ *
 * math helpers
 * ------------------------------------------------------------------ */

function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Catmull-Rom sample of [[x, a, b, ...], ...] at x -> [a, b, ...]. */
export function sampleTable(table, x) {
  let i = 0;
  while (i < table.length - 2 && table[i + 1][0] < x) i++;
  const i0 = Math.max(0, i - 1);
  const i1 = i;
  const i2 = Math.min(table.length - 1, i + 1);
  const i3 = Math.min(table.length - 1, i + 2);
  const span = table[i2][0] - table[i1][0];
  const t = span > 1e-9 ? Math.min(1, Math.max(0, (x - table[i1][0]) / span)) : 0;
  const out = [];
  for (let c = 1; c < table[0].length; c++) {
    out.push(cr(table[i0][c], table[i1][c], table[i2][c], table[i3][c], t));
  }
  return out;
}

/** `n` evenly spaced values across [a, b]. */
export function range(a, b, n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = a + (b - a) * (i / (n - 1));
  return out;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

/* ------------------------------------------------------------------ *
 * Hull lines.
 *
 * An Optimist is a pram: a flat, rockered bottom, flared straight sides,
 * a raked bow transom about half the beam wide and a vertical stern
 * transom.  Four curves define it:
 *
 *   SHEER        [x, height of the sheer]                 class profile
 *   ROCKER       [x, height of the bottom]                class profile
 *   SHEER_HALF   [x, half breadth at the sheer]           STL plan
 *   BOTTOM_HALF  [x, half breadth where the flat bottom   STL plan
 *                     turns up into the side]
 *
 * Forward of BOW_KNUCKLE the "bottom" is the raked bow transom itself: it
 * runs straight from the sheer at x = 0 down to the knuckle, so the
 * section there is a strip of transom, and the loft draws the transom as
 * part of the same surface.
 * ------------------------------------------------------------------ */

const SHEER = [
  [0.00, 0.410], [0.40, 0.400], [0.80, 0.393], [1.20, 0.390],
  [1.60, 0.392], [2.00, 0.398], [2.30, 0.405],
];

export const BOW_KNUCKLE = [0.155, 0.108];   // bow transom foot, x and y

const ROCKER = [
  [0.155, 0.108], [0.34, 0.067], [0.51, 0.045], [0.67, 0.027],
  [0.84, 0.012], [1.00, 0.004], [1.15, 0.000], [1.35, 0.000],
  [1.69, 0.018], [2.02, 0.045], [2.30, 0.081],
];

const SHEER_HALF = [
  [0.00, 0.291], [0.10, 0.325], [0.20, 0.359], [0.30, 0.391],
  [0.40, 0.418], [0.50, 0.445], [0.60, 0.469], [0.70, 0.489],
  [0.80, 0.506], [0.90, 0.521], [1.00, 0.535], [1.10, 0.546],
  [1.20, 0.554], [1.30, 0.560], [1.40, 0.564], [1.50, 0.565],
  [1.60, 0.564], [1.70, 0.560], [1.80, 0.554], [1.90, 0.547],
  [2.00, 0.538], [2.10, 0.526], [2.20, 0.511], [2.30, 0.496],
];

const BOTTOM_HALF = [
  [0.00, 0.272], [0.155, 0.262], [0.30, 0.302], [0.50, 0.368],
  [0.70, 0.413], [0.90, 0.446], [1.10, 0.466], [1.30, 0.477],
  [1.50, 0.481], [1.70, 0.479], [1.90, 0.471], [2.10, 0.459],
  [2.30, 0.446],
];

const at = (table, x) => sampleTable(table, clamp(x, table[0][0], table[table.length - 1][0]))[0];

/** Height of the sheer at station x. */
export function sheerY(x) { return at(SHEER, x); }

/** Half breadth at the sheer. */
export function sheerHalf(x) { return at(SHEER_HALF, x); }

/** Half breadth of the flat of the bottom. */
export function bottomHalf(x) { return at(BOTTOM_HALF, x); }

/**
 * Height of the outside bottom at station x.  Forward of the knuckle it
 * is the raked bow transom, blended into the rocker over a short radius
 * so the two read as one moulding rather than a crease.
 */
export function bottomY(x) {
  const [kx, ky] = BOW_KNUCKLE;
  const y0 = sheerY(0);
  const transom = y0 + (ky - y0) * clamp(x / kx, 0, 1.5);
  const rocker = at(ROCKER, Math.max(x, kx));
  const b = 0.035;   // blend half-width either side of the knuckle
  if (x <= kx - b) return transom;
  if (x >= kx + b) return rocker;
  const t = smooth((x - (kx - b)) / (2 * b));
  // the blend sits slightly inside both lines, like a moulded radius
  return transom + (rocker - transom) * t;
}

/** Bilge radius at station x: how hard the bottom turns up into the side. */
export function bilgeR(x) {
  const depth = sheerY(x) - bottomY(x);
  return Math.min(0.065, depth * 0.35, bottomHalf(x) * 0.5);
}

/** Height of the inside of the floor. */
export function floorY(x) { return bottomY(x) + SPEC.shell; }

/**
 * Half breadth of the inside skin at station x, height y (above the
 * bilge).  The sides are straight between the bilge and the sheer.
 */
export function insideHalf(x, y) {
  const sy = sheerY(x), sh = sheerHalf(x);
  const by = bottomY(x), bh = bottomHalf(x);
  const t = clamp((y - by) / Math.max(1e-6, sy - by), 0, 1);
  return bh + (sh - bh) * t - SPEC.shell * 1.15;
}

/* ------------------------------------------------------------------ *
 * The hull section: one starboard half, sheer -> bottom centreline.
 * ------------------------------------------------------------------ */

const N_SIDE = 9;     // points down the straight side
const N_BILGE = 7;    // points round the bilge
const N_FLAT = 6;     // points across the half bottom

export const HALF_POINTS = N_SIDE + N_BILGE + N_FLAT;

/**
 * Skin of the starboard half at station x, as [y, z] pairs from the sheer
 * down the side, round the bilge and in to the centreline.  `inset` > 0
 * gives the inside skin: the bottom moves up by the shell measured square
 * to it (which on the raked bow transom is much more than vertically), and
 * the sides move in.
 */
export function halfSection(x, inset = 0) {
  const sy = sheerY(x);
  let sh = sheerHalf(x), by = bottomY(x), bh = bottomHalf(x);
  let r = bilgeR(x);
  if (inset > 0) {
    const e = 0.002;
    const slope = (bottomY(x + e) - bottomY(x - e)) / (2 * e);
    by = Math.min(sy, by + inset * Math.hypot(1, slope));
    sh -= inset * 1.1;
    bh -= inset * 1.1;
    r = Math.max(0, r - inset);
    r = Math.min(r, (sy - by) * 0.35);
  }

  // corner C where the side line meets the bottom line
  const C = [by, bh];
  const S = [sy, sh];
  const sideLen = Math.hypot(S[0] - C[0], S[1] - C[1]) || 1e-6;
  const P1 = [C[0] + (S[0] - C[0]) * (r / sideLen), C[1] + (S[1] - C[1]) * (r / sideLen)];
  const P2 = [by, bh - r];

  const pts = [];
  for (let i = 0; i < N_SIDE; i++) {
    const t = i / N_SIDE;
    pts.push([S[0] + (P1[0] - S[0]) * t, S[1] + (P1[1] - S[1]) * t]);
  }
  for (let i = 0; i < N_BILGE; i++) {
    const t = i / (N_BILGE - 1);
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    pts.push([a * P1[0] + b * C[0] + c * P2[0], a * P1[1] + b * C[1] + c * P2[1]]);
  }
  for (let i = 1; i <= N_FLAT; i++) {
    const t = i / N_FLAT;
    pts.push([by, (bh - r) * (1 - t)]);
  }
  return pts;
}

/* ------------------------------------------------------------------ *
 * Lofting
 * ------------------------------------------------------------------ */

/**
 * Grid surface.  `profiles[i]` is an array of [y, z] for station
 * `xs[i]` (or [x, y, z] when `xyz` is set).  `flip` reverses the winding,
 * and so the normals - which matter even on double-sided materials,
 * because the shadow normal bias follows the stored normal.  Returns
 * {pos, norm, uv, col, idx} ready for `toGeometry()`.
 */
export function loft(profiles, xs, opts = {}) {
  const {
    closed = false, capStart = false, capEnd = false, colorAt = null, xyz = false, flip = false,
  } = opts;
  const pos = [], norm = [], uv = [], col = [], idx = [];
  const rows = [];

  for (let i = 0; i < profiles.length; i++) {
    const u = i / (profiles.length - 1);
    const prof = profiles[i];
    const start = pos.length / 3;
    for (let j = 0; j < prof.length; j++) {
      if (xyz) pos.push(prof[j][0], prof[j][1], prof[j][2]);
      else pos.push(xs[i], prof[j][0], prof[j][1]);
      norm.push(0, 0, 0);
      uv.push(u, j / Math.max(1, prof.length - 1));
      const c = colorAt ? colorAt(i, j, profiles.length, prof.length) : null;
      col.push(c ? c[0] : 1, c ? c[1] : 1, c ? c[2] : 1);
    }
    rows.push({ start, count: prof.length });
  }

  const stride = closed ? 0 : 1;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    const cols = Math.min(a.count, b.count);
    for (let j = 0; j < cols - stride; j++) {
      const j2 = closed ? (j + 1) % a.count : j + 1;
      const a0 = a.start + j, a1 = a.start + j2;
      const b0 = b.start + j, b1 = b.start + j2;
      if (flip) idx.push(a0, a1, b0, a1, b1, b0);
      else idx.push(a0, b0, a1, a1, b0, b1);
    }
  }

  const cap = (row, flip) => {
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < row.count; j++) {
      cx += pos[row.start * 3 + j * 3];
      cy += pos[row.start * 3 + 1 + j * 3];
      cz += pos[row.start * 3 + 2 + j * 3];
    }
    cx /= row.count; cy /= row.count; cz /= row.count;
    const c = pos.length / 3;
    pos.push(cx, cy, cz); norm.push(0, 0, 0); uv.push(0.5, 0.5);
    col.push(col[row.start * 3], col[row.start * 3 + 1], col[row.start * 3 + 2]);
    for (let j = 0; j < row.count; j++) {
      const p0 = row.start + j, p1 = row.start + (j + 1) % row.count;
      if (flip) idx.push(c, p1, p0); else idx.push(c, p0, p1);
    }
  };
  if (capStart) cap(rows[0], false);
  if (capEnd) cap(rows[rows.length - 1], true);

  return { pos, norm, uv, col, idx };
}

/** A flat polygon in the plane x = const, normal -x (flip: +x). */
export function fan(points, x, flip, color = [1, 1, 1]) {
  const pos = [], norm = [], uv = [], col = [], idx = [];
  let cy = 0, cz = 0;
  for (const [y, z] of points) { cy += y; cz += z; }
  cy /= points.length; cz /= points.length;
  pos.push(x, cy, cz); norm.push(0, 0, 0); uv.push(0.5, 0.5);
  col.push(color[0], color[1], color[2]);
  for (let j = 0; j < points.length; j++) {
    const a = points[j], b = points[(j + 1) % points.length];
    pos.push(x, a[0], a[1], x, b[0], b[1]);
    norm.push(0, 0, 0, 0, 0, 0);
    uv.push(0, 0, 1, 1);
    col.push(color[0], color[1], color[2], color[0], color[1], color[2]);
    const k = 1 + j * 2;
    if (flip) idx.push(0, k + 1, k); else idx.push(0, k, k + 1);
  }
  return { pos, norm, uv, col, idx };
}

/** Append `b` onto `a`. */
export function merge(a, b) {
  const off = a.pos.length / 3;
  for (let i = 0; i < b.pos.length; i++) a.pos.push(b.pos[i]);
  for (let i = 0; i < b.norm.length; i++) a.norm.push(b.norm[i]);
  for (let i = 0; i < b.uv.length; i++) a.uv.push(b.uv[i]);
  for (let i = 0; i < b.col.length; i++) a.col.push(b.col[i]);
  for (let i = 0; i < b.idx.length; i++) a.idx.push(b.idx[i] + off);
  return a;
}

/** Accumulate per-vertex normals over an indexed mesh. */
export function shade(mesh) {
  const { pos, norm, idx } = mesh;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const wx = pos[c] - pos[a], wy = pos[c + 1] - pos[a + 1], wz = pos[c + 2] - pos[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    for (const k of [a, b, c]) { norm[k] += nx; norm[k + 1] += ny; norm[k + 2] += nz; }
  }
  for (let i = 0; i < norm.length; i += 3) {
    const l = Math.hypot(norm[i], norm[i + 1], norm[i + 2]) || 1;
    norm[i] /= l; norm[i + 1] /= l; norm[i + 2] /= l;
  }
  return mesh;
}

/** THREE.BufferGeometry from {pos, norm, uv, col, idx}. */
export function toGeometry(THREE, mesh) {
  shade(mesh);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(mesh.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.norm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(mesh.uv, 2));
  if (mesh.col && mesh.col.length === mesh.pos.length) {
    g.setAttribute('color', new THREE.Float32BufferAttribute(mesh.col, 3));
  }
  g.setIndex(mesh.idx);
  return g;
}
