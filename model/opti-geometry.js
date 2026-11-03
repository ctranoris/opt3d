/**
 * Optimist sailing dinghy - parametric model.
 *
 * Coordinate frame (boat local):
 *   +X aft   (bow at x = 0, transom at x = LOA)
 *   +Y up    (y = 0 is the baseline / keel line)
 *   +Z transverse
 *
 * Rig: classic Optimist sprit rig. The four sail corners are
 *   tack   - at the gooseneck (origin of the rig group)
 *   head   - up the mast, luff length from the tack
 *   peak   - up the sprit, sprit length from the tack (highest point of the rig)
 *   corner - out the boom, foot length from the tack
 * and the leech is a curved edge from peak to corner.
 */

export const SPEC = {
  loa: 2.30,          // length overall (m)
  beam: 1.13,         // maximum beam (m)
  draftBoardDown: 0.69,
  shell: 0.008,       // hull skin thickness

  // rig (from the SBM plan: luff 5'-6", head-peak 4'-0", sprit 8'-1",
  // leech 6'-9", foot 6'-4")
  mastFromBow: 0.35,
  mastRake: 6.0,      // deg aft of vertical
  luff: 1.68,
  headToPeak: 1.22,
  sprit: 2.46,
  leech: 2.06,
  foot: 1.93,
  boomRise: 11.0,     // deg above horizontal
  tackHeight: 0.40,   // gooseneck height above the baseline
  mastDia: 0.062,
  boomDia: 0.038,
  spritDia: 0.032,
};

const D2R = Math.PI / 180;

/* ------------------------------------------------------------------ *
 * small helpers
 * ------------------------------------------------------------------ */

function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

/** Sample a table [[x, v0, v1, ...], ...] at x with a Catmull-Rom spline. */
function sampleTable(table, x) {
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

/* ------------------------------------------------------------------ *
 * hull surface
 *
 * Station table, x measured from the bow (m).
 *   [x, sheerY, deckZ, chineX, chineZ, bilgeY, bilgeZ, flatFrac]
 * ------------------------------------------------------------------ */

const STATIONS = [
  [0.00, 0.330, 0.010, 0.100, 0.250, 0.070, 0.000, 0.55],
  [0.15, 0.345, 0.150, 0.200, 0.290, 0.150, 0.000, 0.45],
  [0.35, 0.365, 0.300, 0.340, 0.320, 0.260, 0.000, 0.35],
  [0.55, 0.385, 0.430, 0.440, 0.350, 0.360, 0.000, 0.30],
  [0.80, 0.405, 0.560, 0.510, 0.380, 0.450, 0.000, 0.25],
  [1.10, 0.425, 0.650, 0.545, 0.400, 0.510, 0.000, 0.22],
  [1.40, 0.445, 0.700, 0.555, 0.405, 0.545, 0.000, 0.20],
  [1.70, 0.465, 0.710, 0.555, 0.400, 0.560, 0.000, 0.20],
  [1.95, 0.485, 0.700, 0.550, 0.390, 0.555, 0.000, 0.20],
  [2.15, 0.500, 0.660, 0.540, 0.375, 0.540, 0.000, 0.22],
  [2.30, 0.510, 0.620, 0.530, 0.360, 0.520, 0.000, 0.25],
];

/** Half-breadth of the hull at (x, y): 0 = baseline, 1 = sheer. */
function halfWidth(x, y) {
  const s = sampleTable(STATIONS, Math.min(Math.max(x, 0), SPEC.loa));
  const [sheerY, , chineX, chineZ, bilgeY, bilgeZ, flatFrac] = s;
  if (y <= 0) return s[7] * 0.0 + 0;
  if (y >= sheerY) return chineX;
  if (y >= chineZ) {
    const t = (y - chineZ) / Math.max(1e-6, sheerY - chineZ);
    return chineX + (1 - chineX) * Math.pow(t, 0.78);
  }
  const t = y / Math.max(1e-6, chineZ);
  const k = Math.max(0.05, flatFrac);
  return bilgeY + (chineX - bilgeY) * Math.pow(Math.max(0, t), k);
}

/** Bottom (inner skin) height of the hull at (x, z). */
function bottomY(x, z) {
  const s = sampleTable(STATIONS, Math.min(Math.max(x, 0), SPEC.loa));
  const [, , chineX, chineZ, bilgeY, bilgeZ] = s;
  const zz = Math.min(Math.abs(z), chineX);
  const t = bilgeY > 1e-6 ? zz / bilgeY : 0;
  if (zz <= bilgeY) {
    const k = 1.0 / Math.max(0.2, 2.0 * 0.5);
    return bilgeZ * (1 - Math.pow(Math.max(0, 1 - t), 1.6)) * 0 +
      bilgeZ - (bilgeZ - 0) * Math.pow(Math.max(0, 1 - t), 1.6);
  }
  const u = (zz - bilgeY) / Math.max(1e-6, chineX - bilgeY);
  return chineZ * Math.pow(Math.max(0, u), 0.35) + bilgeZ * (1 - Math.pow(Math.max(0, u), 0.35)) * 0;
}
