/**
 * Optimist dinghy - shared constants, math and lofting tables.
 *
 * Boat-local frame (right handed):
 *   +X aft   (bow at x = 0, transom at x = SPEC.loa)
 *   +Y up    (y = 0 is the baseline, i.e. the keel line amidships)
 *   +Z to starboard
 */

export const SPEC = {
  loa: 2.30,          // length overall, m
  beam: 1.13,         // maximum beam, m
  shell: 0.008,       // hull skin thickness
  waterline: 0.17,    // baseline below the water surface

  // --- rig: class-rule / SBM plan dimensions ------------------------
  mastFromBow: 0.35,  // mast centreline distance aft of the bow
  rigRake: 7.0,       // deg - mast rake aft
  luff: 1.68,         // 5'-6"  tack -> head
  headToPeak: 1.22,   // 4'-0"  head -> peak
  sprit: 2.46,        // 8'-1"  the sprit spar, tack end -> peak
  leech: 2.59,        // 8'-6"  peak -> corner, measured along the cloth
  foot: 1.93,         // 6'-4"  tack -> corner, along the boom
  spritHook: 0.15,    // the sprit's lower end hooks this far below the tack
  boomRise: 2.5,      // deg - the boom sits nearly level, as on the plan
  mastAboveHead: 0.16,
  tackHeight: 0.45,   // gooseneck height above the baseline
  mastDia: 0.062,
  boomDia: 0.040,
  spritDia: 0.032,

  // --- hull furniture -----------------------------------------------
  boardCase: [0.80, 1.10, 0.15],   // case x0, x1, inside width
  boardDepth: 0.52,
  cockpit: { x0: 0.44, x1: 1.98 },
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

/* ------------------------------------------------------------------ *
 * Hull lofting tables.
 *
 * Station table, x measured aft of the bow:
 *   [x, sheerY, sheerHalf, chineZ, chineHalf, bilgeHalf, roundK]
 *
 * sheerY     height of the inwale
 * sheerHalf  half breadth at the inwale (max 0.565 amidships = 1.13 m beam)
 * chineZ     height of the turn of the bilge
 * chineHalf  half breadth at the turn of the bilge
 * bilgeHalf  half breadth of the flat of the bottom
 * roundK     exponent controlling how hard the turn is
 * ------------------------------------------------------------------ */

export const STATIONS = [
  [0.00, 0.330, 0.022, 0.150, 0.014, 0.005, 0.55],
  [0.12, 0.345, 0.175, 0.200, 0.120, 0.055, 0.42],
  [0.35, 0.365, 0.360, 0.280, 0.285, 0.195, 0.34],
  [0.55, 0.385, 0.480, 0.330, 0.405, 0.315, 0.28],
  [0.80, 0.405, 0.545, 0.360, 0.482, 0.418, 0.24],
  [1.10, 0.425, 0.565, 0.375, 0.516, 0.470, 0.22],
  [1.40, 0.445, 0.565, 0.382, 0.520, 0.486, 0.21],
  [1.70, 0.465, 0.556, 0.380, 0.515, 0.482, 0.21],
  [1.95, 0.485, 0.545, 0.372, 0.505, 0.472, 0.22],
  [2.15, 0.500, 0.534, 0.362, 0.494, 0.458, 0.24],
  [2.30, 0.512, 0.522, 0.352, 0.484, 0.446, 0.26],
];

const BEAM_HALF = SPEC.beam / 2;

function station(x) {
  return sampleTable(STATIONS, Math.min(Math.max(x, 0), SPEC.loa));
}

/** Height of the inwale at station x. */
export function sheerY(x) { return station(x)[0]; }

/** Half breadth of the outside skin at station x, height y. */
export function halfWidth(x, y) {
  const [sy, sh, cz, ch, bh, k] = station(x);
  if (y <= 0) return bh;
  if (y >= sy) return sh;
  if (y >= cz) {
    const t = (y - cz) / Math.max(1e-6, sy - cz);
    return ch + (sh - ch) * Math.pow(t, 0.85);
  }
  const t = y / Math.max(1e-6, cz);
  return bh + (ch - bh) * Math.pow(t, Math.max(0.08, k));
}

/** Height of the outside skin at station x, half breadth z. */
export function skinY(x, z) {
  const [sy, sh, cz, ch, bh, k] = station(x);
  const zz = Math.min(Math.abs(z), sh);
  if (zz <= bh) return 0;
  if (zz <= ch) {
    const t = (zz - bh) / Math.max(1e-6, ch - bh);
    return cz * Math.pow(t, Math.max(0.35, k));
  }
  const t = (zz - ch) / Math.max(1e-6, sh - ch);
  return cz + (sy - cz) * Math.pow(t, 0.85);
}

/** Half breadth / height of the inside skin (offset inboard by the skin). */
export function innerHalf(x, y) { return Math.max(0, halfWidth(x, y) - SPEC.shell * 1.3); }
export function innerY(x, z) { return skinY(x, z) - SPEC.shell * 1.3; }

/** Height of the side deck: a constant drop below the inwale. */
export function deckY(x) { return sheerY(x) - 0.062; }

/* ------------------------------------------------------------------ *
 * Cockpit outline: half breadth of the coaming at station x, or null
 * outside the cockpit.
 * ------------------------------------------------------------------ */

const COCKPIT = [
  [0.44, 0.060], [0.50, 0.235], [0.60, 0.330], [0.78, 0.372],
  [1.05, 0.385], [1.35, 0.388], [1.62, 0.380], [1.82, 0.352],
  [1.93, 0.250], [1.98, 0.060],
];

export function cockpitHalf(x) {
  if (x <= COCKPIT[0][0] || x >= COCKPIT[COCKPIT.length - 1][0]) return null;
  return sampleTable(COCKPIT, x)[0];
}

/* ------------------------------------------------------------------ *
 * Lofting
 * ------------------------------------------------------------------ */

/**
 * Grid surface.  `profiles[i]` is an array of [y, z] for station
 * `xs[i]`.  Returns {pos, norm, uv, idx} ready for `shade()` and
 * `toGeometry()`.
 */
export function loft(profiles, xs, opts = {}) {
  const { closed = false, capStart = false, capEnd = false, colorAt = null } = opts;
  const pos = [], norm = [], uv = [], col = [], idx = [];
  const rows = [];

  for (let i = 0; i < profiles.length; i++) {
    const u = i / (profiles.length - 1);
    const prof = profiles[i];
    const start = pos.length / 3;
    for (let j = 0; j < prof.length; j++) {
      pos.push(xs[i], prof[j][0], prof[j][1]);
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
      idx.push(a0, b0, a1, a1, b0, b1);
    }
  }

  const cap = (row, flip) => {
    let cy = 0, cz = 0;
    for (let j = 0; j < row.count; j++) {
      cy += pos[row.start * 3 + 1 + j * 3];
      cz += pos[row.start * 3 + 2 + j * 3];
    }
    cy /= row.count; cz /= row.count;
    const c = pos.length / 3;
    pos.push(pos[row.start * 3], cy, cz); norm.push(0, 0, 0); uv.push(0.5, 0.5);
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
