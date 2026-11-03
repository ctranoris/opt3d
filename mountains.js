/**
 * A few islands far off on the horizon.
 *
 * Each island is a strip on its own arc round the scene: the top edge is
 * the island's profile, a smooth hump roughened with ridged noise, and the
 * foot sits just below the horizon.  They are not lit by the scene's lights
 * and the scene fog does not touch them; instead each vertex is coloured
 * once, here:
 * - rock, lighter on the slopes that turn toward the sun;
 * - mixed toward the horizon haze, more for the farther islands;
 * - the foot is the horizon colour itself, so it melts into the sea haze.
 *
 * The islands are fixed in the world like the sky and do not drift with the sea.
 */

import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const D2R = Math.PI / 180;

function hash(x, s) {
  const v = Math.sin(x * 127.1 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
}
function noise(x, s) {
  const i = Math.floor(x);
  let f = x - i; f = f * f * (3 - 2 * f);
  return hash(i, s) + (hash(i + 1, s) - hash(i, s)) * f;
}
/** Ridged fbm: sharp crests, rounded valleys. */
function ridged(x, s) {
  let v = 0, amp = 0.55, f = 1;
  for (let o = 0; o < 4; o++) {
    const n = 1 - Math.abs(2 * noise(x * f, s + o) - 1);
    v += amp * n * n;
    f *= 2.1; amp *= 0.48;
  }
  return v;
}

// bearing (deg, three.js angle round +Y from +x), distance (m), width (deg),
// peak height (m), lean of the hump (-1..1), haze
const ISLANDS = [
  { az: 205, r: 820, w: 14, peak: 26, skew: 0.35, haze: 0.60, seed: 3 },
  { az: 228, r: 640, w: 5, peak: 16, skew: -0.3, haze: 0.42, seed: 7 },
  { az: 318, r: 760, w: 9, peak: 22, skew: -0.2, haze: 0.52, seed: 11 },
  { az: 75, r: 700, w: 7, peak: 16, skew: 0.25, haze: 0.48, seed: 19 },
];
const FOOT = -8;               // below the horizon, so no gap shows under the islands
const COLS_PER_DEG = 24;

const ROCK = new THREE.Color(0.22, 0.25, 0.27);
const ROCK_LIT = new THREE.Color(0.45, 0.44, 0.40);

/**
 * `horizon`: the sky colour at the horizon (linear).  `sunDir`: unit
 * vector toward the sun.  Returns the group.
 */
export function createMountains({ horizon, sunDir }) {
  const group = new THREE.Group();
  group.name = 'Islands';
  const sunH = new THREE.Vector2(sunDir.x, sunDir.z).normalize();

  ISLANDS.forEach((L, li) => {
    const cols = Math.max(8, Math.round(L.w * COLS_PER_DEG));
    const H = new Float32Array(cols + 1);
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;                                   // 0..1 across the island
      // a hump that leans to one side, falling to the sea at both ends
      const k = clamp(u + L.skew * u * (1 - u) * 1.6, 0, 1);
      const hump = Math.pow(Math.sin(Math.PI * k), 1.6);
      const rough = 0.78 + 0.32 * ridged(u * (2 + L.w * 0.25) + 3, L.seed);
      H[i] = FOOT + (L.peak * hump * rough + 3 * Math.sin(Math.PI * u)) * Math.min(1, hump * 4);
    }

    const pos = new Float32Array((cols + 1) * 2 * 3);
    const col = new Float32Array((cols + 1) * 2 * 3);
    const idx = [];
    const c = new THREE.Color();
    const ds = (L.w * D2R * L.r) / cols;                     // metres between columns
    for (let i = 0; i <= cols; i++) {
      const th = (L.az - L.w / 2 + L.w * i / cols) * D2R;
      const cx = Math.cos(th), cz = Math.sin(th);
      pos.set([cx * L.r, H[i], cz * L.r, cx * L.r, FOOT, cz * L.r], i * 6);

      // the face toward the viewer, swung by the profile's slope: lit when
      // it turns toward the sun
      const slope = (H[Math.min(cols, i + 1)] - H[Math.max(0, i - 1)]) / (2 * ds);
      const nx = -cx + slope * cz * 1.6, nz = -cz - slope * cx * 1.6;
      const nl = Math.hypot(nx, nz) || 1;
      const lit = clamp(0.35 + 0.65 * ((nx / nl) * sunH.x + (nz / nl) * sunH.y), 0, 1);
      c.copy(ROCK).lerp(ROCK_LIT, lit).lerp(horizon, L.haze);
      col.set([c.r, c.g, c.b, horizon.r, horizon.g, horizon.b], i * 6);
      if (i < cols) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    // Unlit, unfogged and not tone mapped, like the sky behind it, so the
    // haze colour matches the sky exactly.
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true, fog: false, toneMapped: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `Island ${li + 1}`;
    mesh.frustumCulled = false;
    group.add(mesh);
  });
  return group;
}
