/**
 * Boats bumping into each other.
 *
 * Seen from above each hull is a capsule: a line down the middle of the
 * boat with a radius of about half her beam.  Two hulls touch when their
 * lines come closer than the two radii; they are then pushed apart, the
 * lighter one further, and whatever speed they had toward each other is
 * knocked out of them (a soft bump: little bounce).
 *
 * Pure JS, no three.js: positions in water coordinates (x east, z south,
 * metres), headings in compass degrees, speeds in m/s.
 */

const D2R = Math.PI / 180;
const BOUNCE = 0.15;
const SCRUB = 0.85;       // a touch takes this much of her speed along the other hull

/**
 * A body for a boat `len` long and `beam` wide.  `off` is how far her
 * middle (of length) lies forward of the point her position is given by.
 */
export function makeBody(name, len, beam, mass, kind = 'dinghy', off = 0) {
  const r = beam * 0.45;
  return {
    name, kind, mass, r, half: Math.max(0.05, len / 2 - r), off,
    x: 0, z: 0, bx: 0, bz: -1, vx: 0, vz: 0,
    x0: 0, z0: 0, tack: 0, held: false, cool: 0, hit: null,
  };
}

/**
 * Put a boat's present state into her body: position (wx, wz), heading,
 * and her speed ahead `u` and to port `v`.
 */
export function loadBody(b, wx, wz, hdg, u, v) {
  const h = hdg * D2R;
  b.bx = Math.sin(h); b.bz = -Math.cos(h);
  const px = -Math.cos(h), pz = -Math.sin(h);
  b.x = b.x0 = wx + b.bx * b.off;
  b.z = b.z0 = wz + b.bz * b.off;
  b.vx = b.bx * u + px * v;
  b.vz = b.bz * u + pz * v;
  b.hit = null;
}

/** Her speed ahead and to port after the bumps (the heading is as loaded). */
export const bodyU = (b) => b.vx * b.bx + b.vz * b.bz;
export const bodyV = (b) => b.vx * b.bz - b.vz * b.bx;       // port is (bz, -bx)

const _c = { nx: 0, nz: 0, d: 0 };

/** Closest approach of two segments p + s*d1 (|s|<=1) and q + t*d2: the vector between them. */
function between(a, b) {
  const d1x = a.bx * a.half, d1z = a.bz * a.half, d2x = b.bx * b.half, d2z = b.bz * b.half;
  const rx = a.x - b.x, rz = a.z - b.z;
  const A = d1x * d1x + d1z * d1z, E = d2x * d2x + d2z * d2z;
  const F = d2x * rx + d2z * rz, C = d1x * rx + d1z * rz, B = d1x * d2x + d1z * d2z;
  const den = A * E - B * B;
  let s = den > 1e-9 ? Math.min(1, Math.max(-1, (B * F - C * E) / den)) : 0;
  let t = (B * s + F) / E;
  if (t < -1) { t = -1; s = Math.min(1, Math.max(-1, (-B - C) / A)); }
  else if (t > 1) { t = 1; s = Math.min(1, Math.max(-1, (B - C) / A)); }
  const nx = (b.x + d2x * t) - (a.x + d1x * s), nz = (b.z + d2z * t) - (a.z + d1z * s);
  _c.d = Math.hypot(nx, nz);
  if (_c.d > 1e-6) { _c.nx = nx / _c.d; _c.nz = nz / _c.d; }
  else { _c.nx = -a.bz; _c.nz = a.bx; }
  return _c;
}

/**
 * Push apart every pair of `bodies` that overlap and take the closing
 * speed out of them.  Returns the bumps worth telling about (closing at
 * more than a crawl, and not the same pair again within a second or two):
 * [{ a, b, speed }].
 */
export function resolveContacts(bodies, dt, out = []) {
  out.length = 0;
  for (const b of bodies) b.cool = Math.max(0, b.cool - dt);
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      const reach = a.half + a.r + b.half + b.r;
      const ex = b.x - a.x, ez = b.z - a.z;
      if (ex * ex + ez * ez > reach * reach) continue;
      const c = between(a, b);
      const depth = a.r + b.r - c.d;
      if (depth <= 0) continue;
      const nx = c.nx, nz = c.nz;                    // from a to b
      const wa = 1 / a.mass, wb = 1 / b.mass, w = wa + wb;
      a.x -= nx * depth * wa / w; a.z -= nz * depth * wa / w;
      b.x += nx * depth * wb / w; b.z += nz * depth * wb / w;
      const vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;   // closing speed
      if (vn > 0) {
        const jn = (1 + BOUNCE) * vn / w;
        a.vx -= jn * wa * nx; a.vz -= jn * wa * nz;
        b.vx += jn * wb * nx; b.vz += jn * wb * nz;
        if (vn > 0.25) {
          // rubbing along each other slows them too, the lighter one more
          const ka = 1 - (1 - SCRUB) * wa / w * 2, kb = 1 - (1 - SCRUB) * wb / w * 2;
          a.vx *= Math.max(SCRUB, ka); a.vz *= Math.max(SCRUB, ka);
          b.vx *= Math.max(SCRUB, kb); b.vz *= Math.max(SCRUB, kb);
          if (a.cool <= 0 || b.cool <= 0) out.push({ a, b, speed: vn });
          a.cool = b.cool = 1.5;
        }
      }
      a.hit = b; b.hit = a;
    }
  }
  return out;
}
