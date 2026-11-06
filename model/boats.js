/**
 * The boat types the viewer can show, and which one this page load uses.
 *
 * The type is picked once, before the scene is built (the water shader
 * bakes the hull length in): from ?boat=laser|optimist in the address,
 * else the "opt3d_boat" cookie, else the Optimist.  The panel's selector
 * writes the cookie and reloads.
 */

import { SPEC, sheerY, sheerHalf, bottomY, bottomHalf } from './opti-core.js';
import { createBoat, makeMaterials } from './opti-boat.js';
import { createLaser, LASER_SPEC, laserStation } from './laser-boat.js';

export const OPTI_SPEC = {
  key: 'optimist',
  name: 'Optimist',
  sub: 'Single-handed sprit-rig dinghy',
  loa: SPEC.loa,
  beam: SPEC.beam,
  waterline: SPEC.waterline,
  mastFromBow: SPEC.mastFromBow,
  mid: 1.15,
  speedK: 1,
  camScale: 1,
  courseScale: 1,
  sailorSize: 1,
  glb: 'optimist-dinghy.glb',
};

export const BOAT_TYPES = {
  optimist: {
    spec: OPTI_SPEC,
    create: (M) => createBoat(M),
    station: (x) => [sheerY(x), sheerHalf(x), bottomY(x), bottomHalf(x)],
  },
  laser: {
    spec: LASER_SPEC,
    create: (M) => createLaser(M),
    station: laserStation,
  },
};

export const BOAT_COOKIE = 'opt3d_boat';

function pickType() {
  try {
    const q = new URLSearchParams(location.search).get('boat');
    if (q && BOAT_TYPES[q.toLowerCase()]) return q.toLowerCase();
  } catch { /* no location */ }
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + BOAT_COOKIE + '=([^;]*)'));
    if (m && BOAT_TYPES[m[1]]) return m[1];
  } catch { /* cookies blocked */ }
  return 'optimist';
}

/** This page load's boat type, its spec and its hull stations. */
export const BOAT_TYPE = pickType();
export const BS = BOAT_TYPES[BOAT_TYPE].spec;
export const hullStation = BOAT_TYPES[BOAT_TYPE].station;

/** Build one boat of this load's type, with its spec attached. */
export function createAnyBoat(M = makeMaterials()) {
  const b = BOAT_TYPES[BOAT_TYPE].create(M);
  b.spec = b.spec || BS;
  return b;
}

/** Remember a type for the next load. */
export function rememberBoatType(key) {
  try {
    document.cookie = `${BOAT_COOKIE}=${key}; max-age=${365 * 24 * 3600}; path=/; SameSite=Lax`;
  } catch { /* cookies blocked */ }
}
