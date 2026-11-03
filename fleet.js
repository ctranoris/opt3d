/**
 * A few more Optimists racing round the course.
 *
 * Each one is a full copy of the model with its own sail number.  The
 * sailing is the same small model the viewer uses for the main boat
 * (apparent wind, boom to leeward, a polar for speed), and the steering is
 * a simple racing helm: point at the next mark, and when the mark is too
 * close to the wind to point at, beat - one tack until the mark is on the
 * other tack's layline, with the odd tack up the middle.
 *
 * Positions are in water coordinates (x east, z south), like the course.
 */

import * as THREE from 'three';
import { SPEC } from './model/opti-core.js';
import { createBoat, makeMaterials } from './model/opti-boat.js';
import { updateRig, updateMainsheet, sailTexture } from './model/opti-rig.js';
import { createSailor, JACKETS } from './sailor.js';

const D2R = Math.PI / 180;
const MID = 1.15;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
const wrap180 = (d) => ((d % 360) + 540) % 360 - 180;

// Mirrors sailTrim() in viewer.js.
export const optimalBoom = (awa) => clamp(awa * 0.55 - 12, 0, 88);
export const polar = (twa) => smoothstep(32, 75, twa) * (1 - 0.12 * smoothstep(110, 180, twa));

// With that polar the best VMG upwind is near 60 deg off the true wind.
const BEAT = 60;
const NOGO = BEAT - 2;
const REACH = 2.5;        // metres: close enough to call a waypoint reached
const TURN = 30;          // deg/s

const ENTRIES = [
  { country: 'GRE', number: '2471' },
  { country: 'GRE', number: '3305' },
  { country: 'GRE', number: '1888' },
  { country: 'GRE', number: '5120' },
];
export const FLEET_N = ENTRIES.length;

export function createFleet() {
  const group = new THREE.Group();
  group.name = 'Fleet';
  const boats = ENTRIES.map((marks, i) => {
    const b = createBoat(makeMaterials());
    const old = b.rig.materials.sailMat.map;
    b.rig.materials.sailMat.map = sailTexture(marks, b.rig.corners);
    b.rig.materials.sailMat.needsUpdate = true;
    if (old) old.dispose();

    const holder = new THREE.Group();
    holder.name = `Fleet ${marks.country} ${marks.number}`;
    holder.add(b.group);
    b.group.position.x = -MID;
    group.add(holder);
    holder.updateMatrixWorld(true);
    const toRig = new THREE.Matrix4().copy(b.rig.group.matrix).invert();
    b.cleatRig = b.cleatLocal.clone().applyMatrix4(toRig);
    const sailor = createSailor({ jacket: JACKETS[(i + 1) % JACKETS.length], cap: i % 2 ? 0x1b2333 : 0xffffff });
    b.group.add(sailor.group);
    return {
      b, holder, marks, sailor,
      w: new THREE.Vector2(), heading: 0, speed: 0, boom: 0, fill: 1, heel: 0,
      tgt: 0, gate: 'P', done: false, tack: 0, tackTime: 0, tackAfter: 25, perf: 1, phase: i * 2.3,
    };
  });

  const fl = new THREE.Vector3();

  return {
    group, boats,

    /**
     * Put the fleet in the row below the start line, head to wind for the
     * countdown, leaving the middle slot for the viewer's own boat.
     */
    reset(course, windFromDeg) {
      const mid = (course.slots - 1) / 2;
      const free = Array.from({ length: course.slots }, (_, k) => k).filter((k) => k !== mid);
      boats.forEach((s, i) => {
        s.w.copy(course.slot(free[i % free.length]));
        s.tack = i % 2 ? 1 : -1;          // the tack each one takes at the gun
        if (course.race.phase === 'countdown') {
          s.heading = windFromDeg % 360;
          s.speed = 0; s.boom = 0; s.fill = 0; s.heel = 0;
        } else {                          // no countdown: already sailing
          s.heading = (windFromDeg + s.tack * BEAT + 360) % 360;
          s.speed = 0.06; s.boom = 0; s.fill = 1; s.heel = 0;
        }
        s.tgt = 0; s.tackTime = 0; s.done = false;
        s.gate = i % 2 ? 'S' : 'P';      // which gate mark to round
        s.tackAfter = 18 + 22 * Math.random();
        s.perf = 0.86 + 0.14 * Math.random();
      });
    },

    /**
     * Sail every boat for `dt`.  `seaH(x, z)` gives the sea height at a
     * water point, `wind` the true wind speed (0..1, x18 = kn).
     */
    update(dt, t, course, windFromDeg, wind, seaH) {
      const a0 = windFromDeg * D2R;
      fl.set(-Math.sin(a0), 0, Math.cos(a0));           // the air moves this way
      for (const s of boats) {
        // ---- the helm ----
        // next waypoint: reached when close, or when sailed past it
        const route = course.route(s.gate);
        let tg = route[Math.min(s.tgt, route.length - 1)];
        if (!s.done) {
          const from = s.tgt ? route[s.tgt - 1] : null;
          const d = s.w.distanceTo(tg);
          const past = from && d < 8 &&
            (s.w.x - tg.x) * (tg.x - from.x) + (s.w.y - tg.y) * (tg.y - from.y) > 0;
          if (d < REACH || past) {
            if (++s.tgt >= route.length) s.done = true;   // across the finish
            else tg = route[s.tgt];
          }
        }
        const brg = Math.atan2(tg.x - s.w.x, -(tg.y - s.w.y)) / D2R;
        const rel = wrap180(brg - windFromDeg);
        let want;
        if (course.race.phase === 'countdown' || s.done) {
          want = windFromDeg;                              // head to wind: waiting for the gun, or finished
        } else if (Math.abs(rel) < NOGO) {
          if (!s.tack) s.tack = rel >= 0 ? 1 : -1;
          s.tackTime += dt;
          // now and then tack up the middle of the beat
          if (s.tackTime > s.tackAfter && Math.abs(rel) < NOGO * 0.6) {
            s.tack = -s.tack; s.tackTime = 0; s.tackAfter = 18 + 22 * Math.random();
          }
          want = windFromDeg + s.tack * BEAT;
        } else {
          want = brg;
          s.tack = 0; s.tackTime = 0;
        }
        want += 2.5 * Math.sin(t * 0.37 + s.phase);
        const dh = wrap180(want - s.heading);
        s.heading = (s.heading + clamp(dh, -TURN * dt, TURN * dt) + 360) % 360;

        // ---- the sail ----
        const h = s.heading * D2R;
        const bx = Math.sin(h), bz = -Math.cos(h);       // bow
        const px = -Math.cos(h), pz = -Math.sin(h);      // port (+Z of the boat)
        const twa = Math.acos(clamp(-(fl.x * bx + fl.z * bz), -1, 1)) / D2R;
        const appX = fl.x * wind - bx * s.speed, appZ = fl.z * wind - bz * s.speed;
        const ax = -(appX * bx + appZ * bz);
        const az = appX * px + appZ * pz;
        const app = Math.hypot(ax, az);
        const awa = app > 1e-5 ? Math.acos(clamp(ax / app, -1, 1)) / D2R : 0;
        const side = az > 0 ? -1 : 1;
        const wantBoom = side * optimalBoom(awa);
        s.boom += clamp(wantBoom - s.boom, -70 * dt, 70 * dt);
        const a = s.boom * D2R;
        const across = app > 1e-5 ? (ax * Math.sin(a) + az * Math.cos(a)) / app : 0;
        s.fill += clamp(clamp(across / 0.35, -1, 1) - s.fill, -6 * dt, 6 * dt);
        const cn = clamp(4 * across, -1.2, 1.2);
        s.heel += (14 * app * cn * Math.cos(a) - s.heel) * Math.min(1, dt / 0.9);
        const drive = -cn * Math.sin(a);
        const target = drive > 0 ? 0.42 * wind * polar(twa) * s.perf * Math.min(1, Math.abs(s.fill)) : 0;
        s.speed += (target - s.speed) * Math.min(1, dt / 2.5);

        // ---- make way ----
        const ms = s.speed * 18 * 0.5144;
        s.w.x += bx * ms * dt;
        s.w.y += bz * ms * dt;

        // ---- float ----
        const aft = SPEC.loa - MID;
        const hm = seaH(s.w.x, s.w.y);
        const hF = seaH(s.w.x + bx * MID, s.w.y + bz * MID);
        const hA = seaH(s.w.x - bx * aft, s.w.y - bz * aft);
        s.holder.position.set(s.w.x, 0, s.w.y);
        s.holder.rotation.y = -(s.heading + 90) * D2R;
        const g = s.b.group;
        g.position.y = -SPEC.waterline + hm;
        g.rotation.set(s.heel * D2R * (0.82 + 0.18 * Math.sin(t * 0.9 + s.phase)),
          0.03 * Math.sin(t * 0.4 + s.phase), Math.atan2(hA - hF, SPEC.loa) * 0.85);   // +z lifts the stern (+x)
      }
    },

    /** Rebuild the sails and sheets (after the world matrices are current). */
    updateRigs(t, wind) {
      for (const s of boats) {
        updateRig(s.b.rig, { boomDeg: s.boom, fill: s.fill, camber: 1.0, wind, t: t + s.phase });
        s.holder.updateMatrixWorld(true);
        updateMainsheet(s.b.rig, s.b.cleatRig);
        s.sailor.update({ boomDeg: s.boom, heel: s.heel, t: t + s.phase, boat: s.b });
      }
    },

    /** Show or hide the sailors. */
    setSailors(on) {
      for (const s of boats) {
        s.sailor.group.visible = on;
        if (!on) s.sailor.release(s.b);
      }
    },
  };
}
