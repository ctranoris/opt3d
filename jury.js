/**
 * Jury boats: three grey RIBs with two judges each and a yellow JURY flag.
 *
 *   - one follows the fleet round the course, a few lengths astern of the
 *     pack (or of the viewer's boat, sailing alone);
 *   - one lies off the windward mark;
 *   - one lies off the right-hand end of the finish line.
 *
 * They are in water coordinates (x east, z south), like the course and the
 * fleet, and each has a body (collisions.js) so the dinghies can bump into
 * them - and steer round them.
 */

import * as THREE from 'three';
import { makeBody, loadBody } from './collisions.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap180 = (d) => ((d % 360) + 540) % 360 - 180;

const LEN = 4.6, BEAM = 2.0;
const CRUISE = 4.2;        // m/s flat out (8 kn): enough to keep up with a planing dinghy
const FOLLOW = 16;         // metres astern of the pack

function juryFlagTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 160;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffd21f';
  g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#111';
  g.font = 'bold 84px Arial, Helvetica, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('JURY', cv.width / 2, cv.height / 2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A judge: legs, jacket, head and cap.  `sit` folds the legs forward. */
function judge(M, jacket, sit) {
  const g = new THREE.Group();
  const jm = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.8 });
  const legH = sit ? 0.42 : 0.8;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(sit ? 0.5 : 0.2, sit ? 0.2 : legH, 0.34), M.dark);
  legs.position.set(sit ? -0.2 : 0, sit ? legH : legH / 2, 0);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.36, 4, 12), jm);
  torso.position.y = legH + 0.36;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), M.skin);
  head.position.y = legH + 0.82;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.122, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.cap);
  cap.position.y = legH + 0.84;
  const peak = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.015, 0.16), M.cap);
  peak.position.set(-0.15, legH + 0.86, 0);          // -x is forward
  g.add(legs, torso, head, cap, peak);
  return g;
}

function rib(M, flagTex) {
  const g = new THREE.Group();
  // boat frame as the dinghies': +X aft, +Y up, +Z to port; origin amidships on the water
  const half = LEN / 2, hb = BEAM / 2 - 0.24;
  const pts = [
    [half - 0.1, 0.34, hb], [0.6, 0.34, hb], [-0.7, 0.36, hb], [-1.55, 0.42, hb * 0.72],
    [-2.0, 0.5, hb * 0.3], [-2.08, 0.52, 0],
    [-2.0, 0.5, -hb * 0.3], [-1.55, 0.42, -hb * 0.72], [-0.7, 0.36, -hb], [0.6, 0.34, -hb], [half - 0.1, 0.34, -hb],
  ].map((p) => new THREE.Vector3(...p));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 56, 0.24, 12), M.tube);
  g.add(tube);
  for (const z of [hb, -hb]) {                      // the cone ends of the tubes
    const end = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), M.tube);
    end.scale.x = 1.5;
    end.position.set(half - 0.1, 0.34, z);
    g.add(end);
  }
  // the hull under the tubes
  const sh = new THREE.Shape();
  sh.moveTo(half - 0.25, hb);
  sh.lineTo(-0.7, hb); sh.lineTo(-1.5, hb * 0.7); sh.lineTo(-2.0, 0);
  sh.lineTo(-1.5, -hb * 0.7); sh.lineTo(-0.7, -hb); sh.lineTo(half - 0.25, -hb);
  sh.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.42, bevelEnabled: false });
  hullGeo.rotateX(Math.PI / 2);                     // the shape's y becomes z, the depth goes down
  const hull = new THREE.Mesh(hullGeo, M.hull);
  hull.position.y = 0.3;
  g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.04, hb * 2 - 0.3), M.deck);
  deck.position.set(0.3, 0.31, 0);
  g.add(deck);

  // console, screen, seat, outboard
  const con = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.8), M.white);
  con.position.set(0.1, 0.7, 0);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.76), M.glass);
  screen.position.set(-0.12, 1.2, 0);
  screen.rotation.z = -0.3;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 8, 20), M.dark);
  wheel.position.set(0.4, 0.98, 0);
  wheel.rotation.y = Math.PI / 2;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.9), M.white);
  seat.position.set(1.25, 0.57, 0);
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.52, 0.34), M.dark);
  motor.position.set(half + 0.12, 0.72, 0);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.1), M.dark);
  leg.position.set(half + 0.12, 0.15, 0);
  g.add(con, screen, wheel, seat, motor, leg);

  // the judges: one at the wheel, one sitting on the port tube forward
  const j1 = judge(M, 0x24457a, false);
  j1.position.set(0.72, 0.32, 0);
  const j2 = judge(M, 0xc7372f, true);
  j2.position.set(-0.75, 0.2, hb - 0.05);
  j2.rotation.y = -0.5;
  g.add(j1, j2);

  // the flag, on a staff on the starboard quarter
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 2.0, 8), M.metal);
  staff.position.set(1.75, 1.45, -hb + 0.05);
  const fly = new THREE.Group();
  fly.position.set(1.75, 2.4, -hb + 0.05);
  const geo = new THREE.PlaneGeometry(0.72, 0.45, 10, 3);
  geo.translate(0.36, -0.2, 0);
  geo.userData.base = geo.attributes.position.array.slice();
  const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: flagTex, roughness: 0.7, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: flagTex, emissiveIntensity: 0.18,
  }));
  fly.add(flag);
  g.add(staff, fly);
  return { group: g, fly, flag };
}

export function createJury() {
  const group = new THREE.Group();
  group.name = 'Jury boats';
  const M = {
    tube: new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.75 }),
    hull: new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.6 }),
    deck: new THREE.MeshStandardMaterial({ color: 0x5b616b, roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b1f29, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fc4d6, roughness: 0.1, transparent: true, opacity: 0.45 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xdcdcdc, roughness: 0.4, metalness: 0.4 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xe0ac86, roughness: 0.8 }),
    cap: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
  };
  const flagTex = juryFlagTexture();
  const ROLES = ['follow', 'windward', 'finish'];
  const boats = ROLES.map((role, i) => {
    const r = rib(M, flagTex);
    const holder = new THREE.Group();
    holder.name = `Jury boat ${i + 1}`;
    holder.add(r.group);
    group.add(holder);
    return {
      role, holder, rib: r, phase: i * 2.1,
      w: new THREE.Vector2(), heading: 0, speed: 0, turn: 0,
      body: makeBody(`jury boat ${i + 1}`, LEN, BEAM, 520, 'jury'),
      dir: new THREE.Vector2(0, 1),
    };
  });
  const _t = new THREE.Vector2(), _c = new THREE.Vector2(), _v = new THREE.Vector2();

  /** Where this boat means to be. */
  function station(s, course, racers) {
    const up = course.up, rx = -up.y, ry = up.x;       // right, looking upwind
    if (s.role === 'windward') {
      const m = course.marks[0].userData.w;
      return _t.set(m.x + up.x * 6 + rx * 10, m.y + up.y * 6 + ry * 10);
    }
    if (s.role === 'finish') {
      const f = course.finish[1];
      return _t.set(f.x + rx * 7 + up.x * 1, f.y + ry * 7 + up.y * 1);
    }
    // astern of the pack: the boats still racing, by the way they are going
    const mid = _c.set(0, 0); _v.set(0, 0);
    let n = 0;
    for (const b of racers) {
      if (b.held) continue;
      mid.x += b.x; mid.y += b.z; _v.x += b.vx; _v.y += b.vz; n++;
    }
    if (!n || course.race.phase === 'countdown') {
      // nobody under way: behind the middle of the start row
      const a = course.start[0], b = course.start[1];
      const back = course.slotDepth + 14;
      return _t.set((a.x + b.x) / 2 - up.x * back, (a.y + b.y) / 2 - up.y * back);
    }
    mid.multiplyScalar(1 / n); _v.multiplyScalar(1 / n);
    if (_v.length() > 0.4) s.dir.lerp(_v.normalize(), 0.02).normalize();   // slowly: a tack must not swing her round
    return _t.set(mid.x - s.dir.x * FOLLOW, mid.y - s.dir.y * FOLLOW);
  }

  return {
    group, boats,
    bodies: boats.map((s) => s.body),

    /** On station for a newly laid course. */
    reset(course, windFromDeg) {
      for (const s of boats) {
        s.dir.set(course.up.x, course.up.y);
        s.w.copy(station(s, course, []));
        s.heading = (windFromDeg + (s.role === 'follow' ? 0 : -70) + 360) % 360;
        s.speed = 0; s.turn = 0;
      }
    },

    /**
     * Per frame.  `racers` are the dinghies' bodies, `flow` the world
     * direction the wind blows (for the flags).
     */
    update(dt, t, course, windFromDeg, wind, seaH, flow, racers) {
      for (const s of boats) {
        const tg = station(s, course, racers);
        const dx = tg.x - s.w.x, dz = tg.y - s.w.y;
        const d = Math.hypot(dx, dz);
        const h = s.heading * D2R;
        const bx = Math.sin(h), bz = -Math.cos(h);

        // a dinghy close ahead: stop and let her by
        let blocked = false;
        for (const b of racers) {
          const ex = b.x - s.w.x, ez = b.z - s.w.y;
          const ahead = ex * bx + ez * bz, off = Math.abs(-ex * bz + ez * bx);
          if (ahead > 0 && ahead < 7 + s.speed * 2 && off < 2.6) { blocked = true; break; }
        }
        // motor for the station when it is more than a few metres off;
        // on it, lie stopped across the wind and drift back when pushed off
        const going = d > (s.speed > 0.2 ? 1.5 : 5);
        const wantV = blocked ? 0 : going ? clamp((d - 1) * 0.45, 0.6, CRUISE) : 0;
        s.speed += clamp(wantV - s.speed, -2.2 * dt, 1.2 * dt);
        if (going && s.speed > 0.05) {
          const brg = Math.atan2(dx, -dz) / D2R;
          const dh = wrap180(brg - s.heading);
          const rate = clamp(dh * 2, -55, 55) * clamp(s.speed / 1.2, 0.25, 1);
          s.turn += (rate - s.turn) * Math.min(1, dt / 0.35);
        } else s.turn *= Math.exp(-dt / 0.4);
        s.heading = (s.heading + s.turn * dt + 360) % 360;
        s.w.x += bx * s.speed * dt;
        s.w.y += bz * s.speed * dt;

        // float: she lifts her bow as she gets going and leans into the turn
        const hm = seaH(s.w.x, s.w.y);
        const hF = seaH(s.w.x + bx * 1.6, s.w.y + bz * 1.6), hA = seaH(s.w.x - bx * 1.6, s.w.y - bz * 1.6);
        s.holder.position.set(s.w.x, hm - 0.16 + 0.05 * clamp(s.speed / CRUISE, 0, 1), s.w.y);
        s.holder.rotation.y = -(s.heading + 90) * D2R;
        s.rib.group.rotation.set(
          -s.turn * D2R * 0.12 * clamp(s.speed / 2, 0, 1) + 0.03 * Math.sin(t * 1.1 + s.phase),
          0,
          Math.atan2(hA - hF, 3.2) * 0.8 - 0.07 * clamp(s.speed / CRUISE, 0, 1));
        // the flag streams with the wind she feels
        const ax = flow.x * wind * 9.3 - bx * s.speed, az = flow.z * wind * 9.3 - bz * s.speed;
        s.rib.fly.rotation.y = Math.atan2(-az, ax) - s.holder.rotation.y;
        const geo = s.rib.flag.geometry, base = geo.userData.base, arr = geo.attributes.position.array;
        const app = Math.hypot(ax, az), amp = 0.02 + 0.006 * app, f = 5 + 0.9 * app;
        for (let i = 0; i < arr.length; i += 3) {
          const k = base[i] / 0.72;
          arr[i + 2] = Math.sin(base[i] * 10 - t * f + s.phase) * amp * k;
          arr[i + 1] = base[i + 1] - (1 - Math.min(1, app / 4)) * 0.25 * k * k;
        }
        geo.attributes.position.needsUpdate = true;
      }
    },

    /** Load the bodies for the collision pass ... */
    loadBodies() {
      for (const s of boats) {
        loadBody(s.body, s.w.x, s.w.y, s.heading, s.speed, 0);
        s.body.held = s.speed < 0.3;
      }
    },
    /** ... and take what it did: a bump shoves her and takes her way off. */
    storeBodies() {
      for (const s of boats) {
        const b = s.body;
        s.w.x += b.x - b.x0; s.w.y += b.z - b.z0;
        if (b.hit) s.speed = clamp(b.vx * b.bx + b.vz * b.bz, 0, s.speed);
      }
    },
  };
}
