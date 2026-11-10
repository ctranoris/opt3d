/**
 * A few more Optimists racing round the course.
 *
 * Each one is a full copy of the model with its own sail number.  They
 * sail by the same force model as the viewer's own boat (sailing.js): the
 * same sail, momentum, leeway, heel, rudder, planing and gusts.  Each has
 * a simple racing helm on the tiller: steer for the next mark, and when
 * the mark is too close to the wind to point at, beat - one tack until the
 * mark is on the other tack's layline, with the odd tack up the middle.
 * They trim like Auto sail, and lift the daggerboard off the wind.
 *
 * They keep clear of each other, of the viewer's boat and of the jury
 * boats by the simplest of the racing rules: port tack gives way to
 * starboard, and on the same tack the windward boat keeps clear.  The
 * give-way boat ducks the other's stern, or holds off.  When that fails
 * the hulls bump (collisions.js).
 *
 * Positions are in water coordinates (x east, z south), like the course.
 */

import * as THREE from 'three';
import { SPEC } from './model/opti-core.js';
import { makeMaterials } from './model/opti-boat.js';
import { createAnyBoat, BS } from './model/boats.js';
import { updateRig, updateMainsheet, sailTexture } from './model/opti-rig.js';
import { createSailor, JACKETS, HAIR } from './sailor.js';
import { sailParams, newHullState, stepBoat, bestBoom, KN } from './sailing.js';
import { makeBody, loadBody, bodyU, bodyV, resolveContacts } from './collisions.js';

const D2R = Math.PI / 180;
const MID = 1.15;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
const wrap180 = (d) => ((d % 360) + 540) % 360 - 180;

const MS = 18 * KN;        // m/s in one unit of `wind`

// The best VMG upwind is 55-60 deg off the true wind (node .tools/polar.mjs).
const BEAT = 58;
const NOGO = BEAT - 2;
const REACH = 2.5;        // metres: close enough to call a waypoint reached
const TURN = 30;          // deg/s, when she is held head to wind
const BOARD_TRAVEL = BS.key === 'laser' ? 0.55 : 0.42;   // m the daggerboard lifts

// The other sailors; `girl` ones have long hair in a ponytail.
const ENTRIES = [
  { country: 'GRE', number: '1062', girl: true },
  { country: 'GRE', number: '1057' },
  { country: 'GRE', number: '1058' },
  { country: 'GRE', number: '128' },
  { country: 'GRE', number: '105', girl: true },
  { country: 'GRE', number: '3153' },
  { country: 'GRE', number: '1052' },
  { country: 'GRE', number: '1054', girl: true },
  { country: 'GRE', number: '2737' },
  { country: 'GRE', number: '2828' },
  { country: 'GRE', number: '2628' },
  { country: 'GRE', number: '1055', girl: true },
];
export const FLEET_N = ENTRIES.length;

export function createFleet() {
  const group = new THREE.Group();
  group.name = 'Fleet';
  const boats = ENTRIES.map((marks, i) => {
    const b = createAnyBoat(makeMaterials());
    if (b.rig.paint) b.rig.paint({ country: marks.country, number: marks.number });
    else {
      const old = b.rig.materials.sailMat.map;
      b.rig.materials.sailMat.map = sailTexture({ country: marks.country, number: marks.number }, b.rig.corners);
      b.rig.materials.sailMat.needsUpdate = true;
      if (old) old.dispose();
    }

    const holder = new THREE.Group();
    holder.name = `Fleet ${marks.country} ${marks.number}`;
    holder.add(b.group);
    b.group.position.x = -BS.mid;
    group.add(holder);
    holder.updateMatrixWorld(true);
    const toRig = new THREE.Matrix4().copy(b.rig.group.matrix).invert();
    b.cleatRig = b.cleatLocal.clone().applyMatrix4(toRig);
    const sailor = createSailor({
      jacket: JACKETS[(i + 1) % JACKETS.length], cap: i % 2 ? 0x1b2333 : 0xffffff,
      ponytail: !!marks.girl, hair: HAIR[i % HAIR.length], size: BS.sailorSize,
    });
    b.group.add(sailor.group);

    // Cheaper to draw: the sun's shadow map only covers the viewer's own
    // boat, so these need not be drawn into it; and from a distance the
    // small parts (fittings, blocks, ropes) are too small to see, so they
    // are sorted by size here and hidden by lod() below.
    const small = [], medium = [];
    holder.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      if (o.name === 'Mainsheet tail' || !o.visible || o === b.rig.sail) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const r = o.geometry.boundingSphere.radius;
      if (!(r >= 0.05)) small.push(o);
      else if (r < 0.16) medium.push(o);
    });
    return {
      small, medium, lod: 0, dist: 0,
      place: 0, started: false, spin: 0, spinDir: 1, spinTime: 0, hPrev: 0, penalties: 0,
      body: makeBody(`${marks.country} ${marks.number}`, BS.loa, BS.beam, 85, 'dinghy', BS.mid - BS.loa / 2),
      contacts: 0,
      b, holder, marks, sailor,
      w: new THREE.Vector2(), heading: 0, speed: 0, boom: 0, fill: 1, heel: 0,
      hull: newHullState(), P: sailParams(BS.key),
      tgt: 0, gate: 'P', lane: 0, finish: null, prev: new THREE.Vector2(), done: false, tack: 0, tackTime: 0, tackAfter: 25, perf: 1, phase: i * 2.3,
    };
  });

  const fl = new THREE.Vector3();
  let frame = 0;
  const _fin = new THREE.Vector2(), _lane = new THREE.Vector2();
  let all = [];            // every body on the water at the last collide(): for keeping clear
  const bumps = [];

  /**
   * Keeping clear.  Looks for the boat she would hit soonest on the present
   * courses and, if it is hers to keep clear of, returns the heading to
   * steer instead of `want`; otherwise `want`.
   */
  /** Room to tack (to go about onto heading `hdg`)?  Nobody close on the new course. */
  function roomToTack(s, hdg) {
    const B = s.body, h = hdg * D2R, nx = Math.sin(h), nz = -Math.cos(h);
    for (const c of all) {
      if (c === B) continue;
      const dx = c.x - B.x, dz = c.z - B.z;
      if (dx * dx + dz * dz < 64 && dx * nx + dz * nz > -1.5) return false;
    }
    return true;
  }

  function keepClear(s, want, windFromDeg, upx, upz) {
    const B = s.body;
    let soonest = 6, o = null;
    for (const c of all) {
      if (c === B) continue;
      const dx = c.x - B.x, dz = c.z - B.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 144) continue;
      const rvx = c.vx - B.vx, rvz = c.vz - B.vz;
      const rv2 = rvx * rvx + rvz * rvz;
      if (rv2 < 0.01) continue;                        // going along together
      const tca = -(dx * rvx + dz * rvz) / rv2;       // time of closest approach
      if (tca <= 0 || tca >= soonest) continue;
      const miss = Math.hypot(dx + rvx * tca, dz + rvz * tca);
      if (miss > (B.half + B.r + c.half + c.r) * 0.75 + 0.4) continue;
      // whose is it to keep clear?
      const mine = c.kind !== 'dinghy' || c.held ||
        (B.tack !== c.tack ? B.tack > 0                               // port gives way to starboard
          : (B.x - c.x) * upx + (B.z - c.z) * upz > 0);               // windward keeps clear
      if (!mine) continue;
      soonest = tca; o = c;
    }
    if (!o) return want;
    const dx = o.x - B.x, dz = o.z - B.z;
    if (B.bx * o.bx + B.bz * o.bz < 0.6 && !o.held) {
      // crossing: duck her stern
      const back = o.half + o.r + 1.6;
      return Math.atan2(dx - o.bx * back, -(dz - o.bz * back)) / D2R;
    }
    // much the same course, or she is stopped: hold off to the side she is not on
    const toStarboard = -dx * B.bz + dz * B.bx > 0;   // she is on my starboard hand
    return want + (toStarboard ? -28 : 28);
  }

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
        s.tack = -1;                      // they all go off on starboard tack at the gun
        s.contacts = 0; s.body.cool = 0;
        s.started = false; s.spin = 0; s.penalties = 0;
        if (course.race.phase === 'countdown') {
          s.heading = windFromDeg % 360;
          s.speed = 0; s.boom = 0; s.fill = 0; s.heel = 0;
        } else {                          // no countdown: already sailing
          s.heading = (windFromDeg + s.tack * BEAT + 360) % 360;
          s.speed = 0.06; s.boom = 0; s.fill = 1; s.heel = 0;
        }
        Object.assign(s.hull, newHullState());
        s.hull.u = s.speed * MS;
        s.tgt = 0; s.tackTime = 0; s.done = false; s.finish = null;
        s.gate = i % 2 ? 'S' : 'P';      // which gate mark to round
        s.lane = ((i % 7) - 3) * 1.2 * (BS.courseScale || 1);     // where along the finish line it crosses, metres
        s.tackAfter = 18 + 22 * Math.random();
        s.perf = 0.86 + 0.14 * Math.random();
        // the slower ones get less out of their sail (speed goes with its square root)
        s.P = { ...sailParams(BS.key), sail: sailParams(BS.key).sail * s.perf * s.perf };
      });
    },

    /**
     * Sail every boat for `dt`.  `seaH(x, z)` gives the sea height at a
     * water point, `wind` the true wind speed (0..1, x18 = kn), `felt`
     * the gust (a factor) and shift (deg) of the moment.  They steer by
     * the mean wind and sail in the wind as it is.
     */
    update(dt, t, course, windFromDeg, wind, seaH, felt = null) {
      const a0 = (windFromDeg + (felt ? felt.shift : 0)) * D2R;
      const W = wind * (felt ? felt.gust : 1) * MS;      // m/s
      fl.set(-Math.sin(a0), 0, Math.cos(a0));           // the air moves this way
      for (const s of boats) {
        // ---- the helm ----
        // next waypoint: reached when close, or when sailed past it
        const route = course.route(s.gate);
        let tg = route[Math.min(s.tgt, route.length - 1)];
        // (the last one, on the finish line, is only done by crossing the line)
        if (!s.done && s.tgt < route.length - 1) {
          const from = s.tgt ? route[s.tgt - 1] : null;
          const d = s.w.distanceTo(tg);
          const past = from && d < 8 &&
            (s.w.x - tg.x) * (tg.x - from.x) + (s.w.y - tg.y) * (tg.y - from.y) > 0;
          if (d < REACH || past) {
            tg = route[++s.tgt];
          }
        }
        // spread the fleet along the finish line, so they don't all stop in one spot
        if (s.tgt >= route.length - 1) tg = _fin.copy(route[route.length - 1]).add(_lane.set(-course.up.y, course.up.x).multiplyScalar(s.lane));
        const brg = Math.atan2(tg.x - s.w.x, -(tg.y - s.w.y)) / D2R;
        const rel = wrap180(brg - windFromDeg);
        let want;
        // finished: she clears the line for a place in the rows above it, the
        // first home furthest up, and waits there
        let park = 0;
        if (s.done) {
          const row = 2 - Math.min(2, Math.floor(s.place / 4)), col = (s.place % 4) - 1.5;
          const m = course.finishMid, up = course.up, a = 6 + row * BS.loa * 1.7, c = col * BS.beam * 2.9;
          _lane.set(m.x + up.x * a - up.y * c, m.y + up.y * a + up.x * c);
          park = s.w.distanceTo(_lane);
        }
        if (park > 1.2) {
          want = Math.atan2(_lane.x - s.w.x, -(_lane.y - s.w.y)) / D2R;
        } else if (course.race.phase === 'countdown' || s.done) {
          want = windFromDeg;                              // head to wind: waiting for the gun, or finished
        } else if (Math.abs(rel) < NOGO) {
          if (!s.tack) s.tack = rel >= 0 ? 1 : -1;
          s.tackTime += dt;
          // now and then tack up the middle of the beat
          if (s.tackTime > s.tackAfter && Math.abs(rel) < NOGO * 0.6 && roomToTack(s, windFromDeg - s.tack * BEAT)) {
            s.tack = -s.tack; s.tackTime = 0; s.tackAfter = 18 + 22 * Math.random();
          }
          if (!s.started) {
            // the start is between the flags: if this tack takes her past
            // an end of the line, the other one
            const a = course.start[0], b = course.start[1], L = a.distanceTo(b);
            const along = ((s.w.x - a.x) * (b.x - a.x) + (s.w.y - a.y) * (b.y - a.y)) / L;
            const below = (a.x - s.w.x) * course.up.x + (a.y - s.w.y) * course.up.y;
            if (below > 0) {
              const hit = along + s.tack * below * 1.9;
              if (hit < 2.5) s.tack = 1; else if (hit > L - 2.5) s.tack = -1;
            }
          }
          want = windFromDeg + s.tack * BEAT;
        } else {
          want = brg;
          s.tack = 0; s.tackTime = 0;
        }
        want += 2.5 * Math.sin(t * 0.37 + s.phase);
        const H = s.hull, P = s.P;
        const sailing = !(course.race.phase === 'countdown' || s.done);
        // the 360 for starting outside the flags: helm over, right round
        if (s.spin > 0 && sailing) want = s.heading + s.spinDir * 70;
        else if (sailing && all.length && !H.capsized) want = keepClear(s, want, windFromDeg, course.up.x, course.up.y);
        const dh = wrap180(want - s.heading);

        // ---- the wind she feels ----
        const h = s.heading * D2R;
        const bx = Math.sin(h), bz = -Math.cos(h);       // bow
        const px = -Math.cos(h), pz = -Math.sin(h);      // port (+Z of the boat)
        const twa = Math.acos(clamp(-(fl.x * bx + fl.z * bz), -1, 1)) / D2R;
        const appX = fl.x * W - bx * H.u - px * H.v, appZ = fl.z * W - bz * H.u - pz * H.v;
        const ax = -(appX * bx + appZ * bz);             // air moving aft, m/s
        const az = appX * px + appZ * pz;                // ... and toward port
        const awa = Math.atan2(Math.abs(az), ax) / D2R;

        if (sailing) {
          // ---- sail, board and tiller ----
          // boom to leeward at the angle that drives her hardest; dead
          // downwind it stays on the gybe she is on
          let side = az > 0 ? -1 : 1;
          if (awa > 165 && Math.abs(s.boom) > 1) side = Math.sign(s.boom);
          if (!H.capsized) {
            const wantBoom = side * bestBoom(P, ax, az);
            const step = Math.min(70, 4 * Math.abs(wantBoom - s.boom) + 0.5) * dt;
            s.boom += clamp(wantBoom - s.boom, -step, step);
          }
          // board down to windward, most of the way up off the wind
          const board = 1 - 0.7 * smoothstep(100, 135, twa);
          H.board += clamp(board - H.board, -0.6 * dt, 0.6 * dt);
          // the tiller: hard over for a big turn, a touch for a small one
          const helm = Math.abs(dh) < 1.5 ? 0 : clamp(dh / 22, -1, 1);
          const f = stepBoat(H, P, ax, az, s.boom, helm, dt);
          s.heading = (s.heading + H.yawRate * dt + 360) % 360;
          s.fill += clamp((H.capsized ? 0 : clamp(f.across / 0.35, -1, 1)) - s.fill, -6 * dt, 6 * dt);
        } else {
          // held head to wind, sail shaking: waiting for the gun, or finished
          s.heading = (s.heading + clamp(dh, -TURN * dt, TURN * dt) + 360) % 360;
          const k = Math.exp(-dt / 1.2);
          // (paddling up to her place after the finish, otherwise stopping)
          H.u = park > 1.2 ? H.u + (Math.min(1.1, park * 0.4) * (Math.abs(dh) < 50 ? 1 : 0.3) - H.u) * (1 - k) : H.u * k;
          H.v *= k; H.heel *= k; H.hike *= k; H.rudder *= k; H.yawRate = 0;
          H.plane = 0; H.capsized = false; H.down = 0;
          H.board += clamp(1 - H.board, -0.6 * dt, 0.6 * dt);
          s.boom += clamp(-s.boom, -70 * dt, 70 * dt);
          s.fill += clamp(-s.fill, -6 * dt, 6 * dt);
        }
        s.heel = H.heel;
        s.speed = H.u / MS;

        // ---- make way, and leeway ----
        s.prev.copy(s.w);
        s.w.x += (bx * H.u + px * H.v) * dt;
        s.w.y += (bz * H.u + pz * H.v) * dt;
        // the start: between the flags, or she owes a turn (bearing away first)
        if (sailing && !s.started) {
          const sc = course.startCross(s.prev, s.w);
          if (sc > 0) {
            s.started = true;
            if (sc === 2) {
              s.spin = 360; s.spinTime = 0; s.penalties++;
              s.spinDir = wrap180(s.heading - windFromDeg) < 0 ? -1 : 1;
            }
          }
        }
        if (s.spin > 0) {
          s.spin -= s.spinDir * wrap180(s.heading - s.hPrev);
          s.spinTime += dt;
          if (s.spin <= 0 || s.spinTime > 60) { s.spin = 0; s.tack = 0; s.tackTime = 0; }
        }
        s.hPrev = s.heading;
        // finished: across the line upwind, on the last leg, on the race clock;
        // then it stops head to wind just over the line
        if (!s.done && s.tgt >= route.length - 1 && course.crossesFinish(s.prev, s.w)) {
          s.finish = course.race.clock;
          s.place = boats.reduce((n, q) => n + (q.done ? 1 : 0), 0);
          s.done = true;
        }

        // ---- float ----
        const aft = BS.loa - BS.mid;
        const hm = seaH(s.w.x, s.w.y);
        const hF = seaH(s.w.x + bx * BS.mid, s.w.y + bz * BS.mid);
        const hA = seaH(s.w.x - bx * aft, s.w.y - bz * aft);
        s.holder.position.set(s.w.x, 0, s.w.y);
        s.holder.rotation.y = -(s.heading + 90) * D2R;
        const g = s.b.group;
        const lying = smoothstep(40, 88, Math.abs(s.heel));   // capsized: floating on her side
        g.position.y = -BS.waterline + hm + 0.14 * lying;
        g.rotation.set(s.heel * D2R * (0.82 + 0.18 * Math.sin(t * 0.9 + s.phase) * (1 - lying) + 0.18 * lying),
          0.03 * Math.sin(t * 0.4 + s.phase), Math.atan2(hA - hF, BS.loa) * 0.85 * (1 - lying));   // +z lifts the stern (+x)
        s.b.rudder.pivot.rotation.y = H.rudder * D2R;
        if (s.b.board) s.b.board.position.y = (1 - H.board) * BOARD_TRAVEL;
      }
    },

    /**
     * The bumps.  `extra` are the bodies of whatever else is on the water
     * (the viewer's boat, the jury boats), loaded by their owners, who also
     * take back what the bumps did to them.  `on` false: the fleet is not
     * out, only the extras can touch.  Returns the bumps worth a noise.
     */
    collide(dt, course, windFromDeg, extra = [], on = true) {
      all = on ? boats.map((s) => s.body).concat(extra) : extra;
      if (on) {
        for (const s of boats) {
          const b = s.body;
          loadBody(b, s.w.x, s.w.y, s.heading, s.hull.u, s.hull.v);
          b.tack = wrap180(s.heading - windFromDeg) < 0 ? -1 : 1;     // -1 starboard tack, +1 port
          b.held = course.race.phase === 'countdown' || s.done || s.hull.capsized;
        }
      }
      resolveContacts(all, dt, bumps);
      if (on) {
        for (const s of boats) {
          const b = s.body;
          if (!b.hit) continue;
          s.w.x += b.x - b.x0; s.w.y += b.z - b.z0;
          s.hull.u = bodyU(b); s.hull.v = bodyV(b);
          s.holder.position.set(s.w.x, 0, s.w.y);
        }
        for (const c of bumps) for (const b of [c.a, c.b]) { const s = boats.find((q) => q.body === b); if (s) s.contacts++; }
      }
      return bumps;
    },

    /**
     * Level of detail by distance from the camera: 0 near (everything),
     * 1 (small parts hidden), 2 far (medium ones too).  `k` scales the
     * distances: below 1 the detail goes sooner.
     */
    lod(camPos, k = 1) {
      for (const s of boats) {
        const e = s.b.group.matrixWorld.elements;   // the holder's own position is in the moving sea frame
        s.dist = Math.hypot(e[12] - camPos.x, e[14] - camPos.z, camPos.y);
        // a little slack on the way back in, so a boat on the line doesn't flicker
        const near = 11 * k, far = 26 * k, slack = 1.12;
        let lod = s.lod;
        if (lod === 0) { if (s.dist > near * slack) lod = s.dist > far * slack ? 2 : 1; }
        else if (lod === 1) { if (s.dist < near) lod = 0; else if (s.dist > far * slack) lod = 2; }
        else if (s.dist < far) lod = s.dist < near ? 0 : 1;
        if (lod === s.lod) continue;
        s.lod = lod;
        for (const o of s.small) o.visible = lod < 1;
        for (const o of s.medium) o.visible = lod < 2;
      }
    },

    /**
     * Rebuild the sails and sheets (after the world matrices are current).
     * The distant boats take turns: every 2nd frame at lod 1, every 4th
     * at lod 2.
     */
    updateRigs(t, wind) {
      frame++;
      for (let i = 0; i < boats.length; i++) {
        const s = boats[i];
        if (s.lod && (frame + i) % (s.lod * 2)) continue;
        updateRig(s.b.rig, { boomDeg: s.boom, fill: s.fill, camber: 1.0, wind, t: t + s.phase });
        s.holder.updateMatrixWorld(true);
        updateMainsheet(s.b.rig, s.b.cleatRig);
        s.sailor.update({ boomDeg: s.boom, heel: Math.max(Math.abs(s.heel), 3 + 13 * s.hull.hike), t: t + s.phase, boat: s.b });
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
