/**
 * A race course on the water, after the Optimist Worlds trapezoid
 * (init_assets/example_course.png): a start line between two flagged
 * buoys, the windward mark 1 straight upwind of it, mark 2 off to the left
 * at the end of a reach, a leeward gate 3S / 3P, and a finish line between
 * two blue flagged buoys upwind of the gate.
 *
 *   Start - 1 - 2 - 3S/3P - Finish     (marks rounded to port; the gate
 *                                       either way round)
 *
 * The race starts with a 10 s countdown, the boats held head to wind in a
 * row below the start line.  The clock starts at the gun; cross the start
 * line going upwind, round 1 and 2, pass through (or round either mark of)
 * the gate, then beat up and cross the finish line.  Over the line before
 * the gun (OCS), a boat has to dip back below it before it can start.
 * The start is between the two flags: a boat that goes up past the line
 * outside them has started, but owes a 360 degree turn, and no mark counts
 * for her until she has made it.
 *
 * Everything here lives in water coordinates (x east, z south, metres),
 * fixed to the sea.  The viewer keeps its own boat in the middle of the
 * scene and moves the sea past her, so the group that holds the course is
 * shifted by minus the odometer every frame.
 */

import * as THREE from 'three';
import { BS } from './model/boats.js';

const D2R = Math.PI / 180;

// Course plan in (upwind, right) metres from the middle of the start line,
// "right" as seen looking upwind.  A beat to the windward mark 1, a reach
// left to 2, a run down to the leeward gate 3S / 3P (3S on the left looking
// upwind, rounded to starboard; 3P on the right, rounded to port), and a
// short beat up to the finish.
const PLAN = {
  // the row of boats is 40 m wide; the line runs on to the left of it,
  // because a row going off on starboard tack slides that way before it
  // gets up to the line
  startLeft: 34, startRight: 20,
  rowHalf: 20,
  startAhead: 6,               // start line this far upwind of the boat
  slots: 13,                   // boats in the row below the line; ours in the middle
  marks: [
    { label: '1', at: [84, 0] },
    { label: '2', at: [70, -56] },
    { label: '3S', at: [3, -61] },
    { label: '3P', at: [3, -51] },
  ],
  // each leg ends at one mark, or at either mark of a gate
  legs: [{ name: '1', marks: [0] }, { name: '2', marks: [1] }, { name: '3', marks: [2, 3], gate: true }],
  finish: [42, -50],           // middle of the finish line, square to the wind
  finishHalf: 7,
};
// A bigger, faster boat gets a bigger course (start slots, legs and all).
const K = BS.courseScale || 1;
// ... and the legs are a quarter longer than the plan above (the lines stay as they are).
const LEGS = 1.25;
PLAN.startLeft *= K; PLAN.startRight *= K; PLAN.rowHalf *= K; PLAN.startAhead *= K; PLAN.finishHalf *= K;
PLAN.finish = PLAN.finish.map((v) => v * K * LEGS);
for (const m of PLAN.marks) m.at = m.at.map((v) => v * K * LEGS);

// Laylines: the course a boat makes good close-hauled (heading plus a little
// leeway), and the angle she runs at, degrees off the wind.
const LAY_UP = 61;
const LAY_DOWN = BS.key === 'optimist' ? 165 : 155;
const LAY_LEN = { mark: 75 * K, gate: 65 * K, finish: 50 * K };
const STBD_COL = 0x35e06a, PORT_COL = 0xff4d4d;

export const ROUND_RADIUS = 7 * K;   // pass this close to a mark to round it
export const COUNTDOWN = 10;     // seconds from laying the course to the gun

const MARK_COL = 0xd8231b;
const START_COL = 0xff6a1a;
const FINISH_COL = 0x1f5fd6;

/* ------------------------------------------------------------------ *
 * pieces
 * ------------------------------------------------------------------ */

/** Red inflatable mark with its number round the sides. */
function numberTexture(n) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#d8231b';
  g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, cv.width, 22);
  g.font = `bold ${String(n).length > 1 ? 140 : 170}px Arial, Helvetica, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // four times round, so it reads from any side
  for (let k = 0; k < 4; k++) g.fillText(String(n), (k + 0.5) * cv.width / 4, 145);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function turningMark(n) {
  const g = new THREE.Group();
  g.name = `Mark ${n}`;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.55, 1.6, 40, 1, true),
    new THREE.MeshStandardMaterial({
      map: numberTexture(n), roughness: 0.55, side: THREE.DoubleSide,
      // a touch of glow, so a mark against the light still reads as red
      emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0.0,
    }));
  body.material.emissiveMap = body.material.map;
  body.material.emissiveIntensity = 0.22;
  body.position.y = 0.55;
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: MARK_COL, roughness: 0.55, emissive: MARK_COL, emissiveIntensity: 0.18 }));
  top.scale.y = 0.35;
  top.position.y = 1.35;
  g.add(body, top);
  body.castShadow = top.castShadow = true;
  return g;
}

/** A flag on a staff; the cloth is animated in `waveFlag`. */
function flag(color, w = 0.8, h = 0.5) {
  const geo = new THREE.PlaneGeometry(w, h, 12, 4);
  geo.translate(w / 2, -h / 2, 0);
  geo.userData.base = geo.attributes.position.array.slice();
  geo.userData.w = w;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color, roughness: 0.7, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.15,
  }));
  m.name = 'Flag';
  return m;
}

function waveFlag(m, t, wind, phase) {
  const geo = m.geometry, base = geo.userData.base, W = geo.userData.w;
  const arr = geo.attributes.position.array;
  const amp = 0.03 + 0.06 * wind;
  const f = 6 + 8 * wind;
  for (let i = 0; i < arr.length; i += 3) {
    const x = base[i], y = base[i + 1];
    const k = x / W;
    arr[i + 2] = Math.sin(x * 9 - t * f + phase) * amp * k + Math.sin(y * 7 + t * 3) * 0.01 * k;
    // a light breeze lets the fly droop
    arr[i + 1] = y - (1 - Math.min(1, wind * 2.2)) * 0.25 * k * k;
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
}

/** Buoy with a staff and a flag: the ends of the start and finish lines. */
function flagBuoy(color, name) {
  const g = new THREE.Group();
  g.name = name;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.15 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 18), mat);
  ball.scale.y = 0.85;
  ball.position.y = 0.12;
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 2.6, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.3 }));
  staff.position.y = 1.55;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), mat);
  knob.position.y = 2.88;
  const fl = flag(color);
  const fly = new THREE.Group();     // turns the flag to stream downwind
  fly.position.y = 2.82;
  fly.add(fl);
  g.add(ball, staff, knob, fly);
  ball.castShadow = staff.castShadow = fl.castShadow = true;
  g.userData.fly = fly;
  g.userData.flag = fl;
  return g;
}

function dashedLine(color) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
  const line = new THREE.Line(geo, new THREE.LineDashedMaterial({
    color, dashSize: 0.9, gapSize: 0.7, transparent: true, opacity: 0.75,
  }));
  line.renderOrder = 1;
  return line;
}

function setLine(line, a, b, y = 0.09) {
  const p = line.geometry.attributes.position.array;
  p[0] = a.x; p[1] = y; p[2] = a.y;
  p[3] = b.x; p[4] = y; p[5] = b.y;
  line.geometry.attributes.position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
  line.computeLineDistances();
}

/* ------------------------------------------------------------------ *
 * geometry helpers (2D, water coordinates)
 * ------------------------------------------------------------------ */

const cross2 = (ax, ay, bx, by) => ax * by - ay * bx;

/** Did the move p0 -> p1 cross the segment a-b?  Returns the side it came from, or 0. */
function crossing(p0, p1, a, b) {
  const rx = p1.x - p0.x, ry = p1.y - p0.y;
  const sx = b.x - a.x, sy = b.y - a.y;
  const den = cross2(rx, ry, sx, sy);
  if (Math.abs(den) < 1e-9) return 0;
  const qx = a.x - p0.x, qy = a.y - p0.y;
  const t = cross2(qx, qy, sx, sy) / den;
  const u = cross2(qx, qy, rx, ry) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? Math.sign(den) || 1 : 0;
}

/** Compass bearing of a water-coordinate vector (north = -z). */
export const bearing2 = (dx, dz) => ((Math.atan2(dx, -dz) / D2R) + 360) % 360;

/* ------------------------------------------------------------------ *
 * the course
 * ------------------------------------------------------------------ */

export function createCourse() {
  const group = new THREE.Group();
  group.name = 'Race course';

  const pin = flagBuoy(START_COL, 'Start pin');
  const committee = flagBuoy(START_COL, 'Start committee end');
  const marks = PLAN.marks.map((m) => turningMark(m.label));
  const legs = PLAN.legs;
  const fin = [flagBuoy(FINISH_COL, 'Finish (left)'), flagBuoy(FINISH_COL, 'Finish (right)')];
  const startLine = dashedLine(0xffffff);
  const finishLine = dashedLine(0x6fa8ff);
  group.add(pin, committee, ...marks, ...fin, startLine, finishLine);

  // a pulsing ring on the water round the next mark (two for the gate)
  const ringGeo = new THREE.RingGeometry(2.0, 2.35, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x4cff9a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
  const rings = [0, 1].map(() => {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 2;
    group.add(ring);
    return ring;
  });

  // laylines to mark 1, the gate and the finish: green for the starboard
  // tack (or gybe) one, red for the port one
  const lay = new THREE.Group();
  lay.name = 'Laylines';
  lay.visible = false;
  const layLines = [0, 1, 2].map(() => [dashedLine(STBD_COL), dashedLine(PORT_COL)]);
  for (const pair of layLines) for (const l of pair) { l.material.dashSize = 1.6; l.material.gapSize = 1.0; l.material.opacity = 0.9; lay.add(l); }
  group.add(lay);
  let layWind = null;
  const _e = new THREE.Vector2();
  /** One layline: from `p`, back along the course of a boat at `off` degrees from the wind. */
  function layline(line, p, windDeg, off, len) {
    const h = (windDeg + off) * D2R;
    _e.set(p.x - Math.sin(h) * len, p.y + Math.cos(h) * len);
    setLine(line, p, _e, 0.11);
  }

  const buoys = [pin, committee, ...marks, ...fin];
  const flagBuoys = [pin, committee, ...fin];
  buoys.forEach((b, i) => { b.userData.w = new THREE.Vector2(); b.userData.phase = i * 1.7; });

  const course = {
    group, marks, legs, pin, committee, fin, buoys,
    laid: false,
    // water coordinates of the course features
    start: [new THREE.Vector2(), new THREE.Vector2()],
    finish: [new THREE.Vector2(), new THREE.Vector2()],
    finishMid: new THREE.Vector2(),
    routes: { S: [], P: [] },
    up: new THREE.Vector2(),
    // race state
    // phase: 'countdown' -> 'started' (gun gone, line not yet crossed)
    //   -> 'racing' -> 'done'; or 'pre' (no countdown: the clock starts
    //   at the line) -> 'racing' -> 'done'
    // clock: seconds since the gun (or since the course was laid, with no
    // countdown), the same for every boat; finish: ours on that clock
    race: { phase: 'pre', count: COUNTDOWN, ocs: false, next: 0, time: 0, best: null, clock: 0, finish: null },
    slots: PLAN.slots,
    slotDepth: PLAN.startAhead,
    _prev: null,

    /**
     * Lay the course for the wind, ahead of `p0` (the boat's position in
     * water coordinates), and reset the race.
     */
    layout(p0, windFromDeg, countdown = true) {
      const a = windFromDeg * D2R;
      const u = new THREE.Vector2(Math.sin(a), -Math.cos(a));   // upwind
      const r = new THREE.Vector2(Math.cos(a), Math.sin(a));    // right, looking upwind
      const at = (du, dr) => new THREE.Vector2(
        S.x + u.x * du + r.x * dr, S.y + u.y * du + r.y * dr);
      const S = p0.clone().addScaledVector(u, PLAN.startAhead);
      this.up.copy(u);
      this.start[0].copy(at(0, -PLAN.startLeft));
      this.start[1].copy(at(0, PLAN.startRight));
      this._row = [at(-PLAN.startAhead, -PLAN.rowHalf), at(-PLAN.startAhead, PLAN.rowHalf)];
      pin.userData.w.copy(this.start[0]);
      committee.userData.w.copy(this.start[1]);
      PLAN.marks.forEach((m, i) => marks[i].userData.w.copy(at(...m.at)));
      // the finish line square to the wind: the last leg is a beat
      const F = at(...PLAN.finish);
      const across = r.clone().multiplyScalar(PLAN.finishHalf);
      this.finishMid.copy(F);
      this.finish[0].copy(F).sub(across);
      this.finish[1].copy(F).add(across);
      fin[0].userData.w.copy(this.finish[0]);
      fin[1].userData.w.copy(this.finish[1]);
      setLine(startLine, this.start[0], this.start[1]);
      setLine(finishLine, this.finish[0], this.finish[1]);
      // The fleet's route, as waypoints (up, right of each mark): round 1
      // and 2 to port on the outside, keeping 3-4 m off, down through the
      // middle of the gate, round 3P (to port) or 3S (to starboard) below
      // it, then beat up across the finish.  Every leg out of a mark is a
      // reach, so no boat has to tack across a mark to make a waypoint.
      const m = (k, du, dr) => at(PLAN.marks[k].at[0] + du, PLAN.marks[k].at[1] + dr);
      const g = (du, dr) => at(PLAN.marks[2].at[0] + du,
        (PLAN.marks[2].at[1] + PLAN.marks[3].at[1]) / 2 + dr);
      const common = [
        m(0, 0, 6), m(0, 4, -3),                 // lay the right of 1, bear away over the top
        m(1, 4, 0), m(1, 3, -3), m(1, 0, -5),    // above 2 and round its outside
        g(2, 0), g(-3, 0),                       // down through the middle of the gate
      ];
      const over = [at(PLAN.finish[0] + 1, PLAN.finish[1])];   // just across the finish
      this.routes = {
        P: [...common, m(3, -4, 1), m(3, 0, 5), ...over],     // left turn round 3P
        S: [...common, m(2, -4, -1), m(2, 0, -5), ...over],   // right turn round 3S
      };
      layWind = null;
      this.laid = true;
      this.reset(countdown);
    },

    /** Water position of slot `i` of the row below the start line. */
    slot(i) {
      const [a, b] = this._row;
      const f = (i + 0.5) / PLAN.slots;
      return new THREE.Vector2(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
    },

    /** Restart the race: with a countdown, or ('pre') start whenever. */
    reset(countdown = true) {
      this.race.phase = countdown ? 'countdown' : 'pre';
      this.race.count = COUNTDOWN;
      this.race.ocs = false;
      this.race.penalty = false;
      this.race.turn = 0;
      this._hdg = null;
      this.race.clock = 0;
      this.race.finish = null;
      this.race.next = 0;
      this.race.time = 0;
      this._prev = null;
    },

    /** Show or hide the laylines. */
    setLaylines(on) { lay.visible = on; layWind = null; },
    get laylines() { return lay.visible; },

    /**
     * Lay the laylines for the wind as it is now.  To windward (mark 1,
     * the finish) they run down and out from the target: on the green one
     * a boat close-hauled on starboard tack just fetches it, on the red one
     * a boat on port.  At the finish they come from the two ends of the
     * line, the port tack one from the left end and the starboard one from
     * the right, so anywhere between them she can cross.  At the gate they
     * run up from its middle: the angle to gybe at on the run.
     */
    layLaylines(windDeg) {
      layWind = windDeg;
      const m1 = marks[0].userData.w;
      layline(layLines[0][0], m1, windDeg, -LAY_UP, LAY_LEN.mark);      // starboard tack: heading left of the wind
      layline(layLines[0][1], m1, windDeg, LAY_UP, LAY_LEN.mark);
      const gate = this.legPoint(2);
      layline(layLines[1][0], gate, windDeg, LAY_DOWN, LAY_LEN.gate);   // starboard gybe: wind over the starboard quarter
      layline(layLines[1][1], gate, windDeg, -LAY_DOWN, LAY_LEN.gate);
      layline(layLines[2][0], this.finish[1], windDeg, -LAY_UP, LAY_LEN.finish);
      layline(layLines[2][1], this.finish[0], windDeg, LAY_UP, LAY_LEN.finish);
    },

    /** Where a leg ends: the mark, or the middle of a gate. */
    legPoint(i) {
      const ms = legs[i].marks.map((k) => marks[k].userData.w);
      return ms.length === 1 ? ms[0] : ms[0].clone().add(ms[1]).multiplyScalar(0.5);
    },

    /** Did a boat going from water point p0 to p1 cross the finish line upwind? */
    crossesFinish(p0, p1) {
      return !!crossing(p0, p1, this.finish[0], this.finish[1]) &&
        (p1.x - p0.x) * this.up.x + (p1.y - p0.y) * this.up.y > 0;
    },

    /**
     * A boat going from p0 to p1 and the start line: 1 if she crossed it
     * going upwind between the flags, -1 back down between them; 2 and -2
     * the same outside the flags (across the line carried on past them); 0
     * if she did not cross.
     */
    startCross(p0, p1) {
      const a = this.start[0], b = this.start[1], up = this.up;
      const d0 = (p0.x - a.x) * up.x + (p0.y - a.y) * up.y;
      const d1 = (p1.x - a.x) * up.x + (p1.y - a.y) * up.y;
      if ((d0 < 0) === (d1 < 0)) return 0;
      const k = d0 / (d0 - d1);
      const cx = p0.x + (p1.x - p0.x) * k - a.x, cy = p0.y + (p1.y - p0.y) * k - a.y;
      const sx = b.x - a.x, sy = b.y - a.y;
      const f = (cx * sx + cy * sy) / (sx * sx + sy * sy);
      return (d1 > d0 ? 1 : -1) * (f >= 0 && f <= 1 ? 1 : 2);
    },

    /** The fleet's waypoints round the course, by gate mark ('S' or 'P'). */
    route(side) { return this.routes[side]; },

    /** Water-coordinate targets for a boat going round: each leg's end, then the finish. */
    targets() {
      return [...legs.map((_, i) => this.legPoint(i)), this.finishMid];
    },

    /**
     * Per frame.  `seaH(x, z)` is the sea height at a water point; `flow`
     * the world direction the true wind blows; `boatW` our boat's water
     * position.  Returns what the HUD needs.
     */
    update(dt, t, seaH, flow, wind, boatW, heading = null) {
      const yaw = Math.atan2(-flow.z, flow.x);
      for (const b of buoys) {
        const w = b.userData.w;
        const h = seaH(w.x, w.y);
        // the buoy rides the swell and rocks with it
        b.position.set(w.x, h - 0.22, w.y);
        const hx = seaH(w.x + 0.5, w.y) - h, hz = seaH(w.x, w.y + 0.5) - h;
        b.rotation.set(hz * 1.6, 0, -hx * 1.6);
      }
      for (const b of flagBuoys) {
        b.userData.fly.rotation.y = yaw - b.rotation.y;
        waveFlag(b.userData.flag, t, wind, b.userData.phase);
      }

      if (lay.visible) {
        const windDeg = Math.atan2(-flow.x, flow.z) / D2R;      // where the wind comes from
        if (layWind === null || Math.abs(windDeg - layWind) > 0.05) this.layLaylines(windDeg);
      }

      // ---- the race ----
      const R = this.race;
      const p1 = boatW.clone();
      const p0 = this._prev || p1;
      this._prev = p1;
      if (R.phase !== 'countdown') R.clock += dt;
      // the 360 she owes for starting outside the flags: the heading has to
      // go right round, one way
      if (R.penalty && heading != null && this._hdg != null) {
        R.turn += ((heading - this._hdg) % 360 + 540) % 360 - 180;
        if (Math.abs(R.turn) >= 355) { R.penalty = false; R.turn = 0; }
      }
      this._hdg = heading;
      if (R.phase === 'pre') {
        // across the line going upwind starts the clock; outside the flags costs a turn
        const s = this.startCross(p0, p1);
        if (s > 0) { R.phase = 'racing'; R.next = 0; R.time = 0; R.penalty = s === 2; R.turn = 0; }
      } else if (R.phase === 'countdown' || R.phase === 'started') {
        // across the line: upwind before the gun is over early, back down
        // clears it; upwind after the gun (and not OCS) is a start -
        // a good one between the flags, one with a turn to make outside them
        const sc = this.startCross(p0, p1), up = Math.sign(sc);
        if (R.phase !== 'countdown' && up > 0 && !R.ocs) { R.penalty = sc === 2; R.turn = 0; }
        if (R.phase === 'countdown') {
          if (up > 0) R.ocs = true; else if (up < 0) R.ocs = false;
          R.count -= dt;
          if (R.count <= 0) { R.count = 0; R.phase = 'started'; R.time = 0; }
        } else {
          R.time += dt;
          if (up < 0) R.ocs = false;
          else if (up > 0 && !R.ocs) { R.phase = 'racing'; R.next = 0; }
        }
      } else if (R.phase === 'racing') {
        R.time += dt;
        if (R.penalty) {
          // nothing counts until the turn is made
        } else if (R.next < legs.length) {
          const leg = legs[R.next];
          const ms = leg.marks.map((k) => marks[k].userData.w);
          // round the mark (either gate mark), or sail through the gate
          if (ms.some((w) => p1.distanceTo(w) < ROUND_RADIUS) ||
              (leg.gate && crossing(p0, p1, ms[0], ms[1]))) R.next++;
        } else if (crossing(p0, p1, this.finish[0], this.finish[1])) {
          R.phase = 'done';
          R.finish = R.clock;
          if (R.best == null || R.time < R.best) R.best = R.time;
        }
      }

      // where to go next, and the ring that shows it
      let goal;
      if (R.phase === 'pre' || R.phase === 'countdown' || R.phase === 'started') goal = this.start[0].clone().add(this.start[1]).multiplyScalar(0.5);
      else if (R.phase === 'racing') goal = R.next < legs.length ? this.legPoint(R.next) : this.finishMid;
      else goal = null;
      const lit = R.phase === 'racing' && R.next < legs.length ? legs[R.next].marks : [];
      const k = 1 + 0.12 * Math.sin(t * 4);
      ringMat.opacity = 0.45 + 0.25 * Math.sin(t * 4);
      rings.forEach((ring, i) => {
        ring.visible = i < lit.length;
        if (!ring.visible) return;
        const w = marks[lit[i]].userData.w;
        ring.position.set(w.x, seaH(w.x, w.y) + 0.06, w.y);
        ring.scale.set(k, k, k);
      });
      let dist = 0, brg = 0;
      if (goal) {
        dist = goal.distanceTo(p1);
        brg = bearing2(goal.x - p1.x, goal.y - p1.y);
      }
      const label = R.next < legs.length
        ? (legs[R.next].gate ? `Gate ${legs[R.next].marks.map((i) => PLAN.marks[i].label).join(' / ')}` : `Mark ${legs[R.next].name}`)
        : 'Finish';
      return { phase: R.phase, count: R.count, ocs: R.ocs, penalty: R.penalty, turn: R.turn, next: R.next, legs: legs.map((l) => l.name), label, time: R.time, best: R.best, dist, brg };
    },
  };
  return course;
}
