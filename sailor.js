/**
 * A young Optimist sailor, posed procedurally in the boat's frame.
 *
 * Boat frame: +x aft (bow at x = 0), +y up, +z port.  Boom angle + is to
 * starboard.  The sailor sits on the windward side, opposite the boom:
 *
 *   boom to starboard (+)  ->  sailor on the port side deck   (+z)
 *   boom to port      (-)  ->  sailor on the starboard deck   (-z)
 *
 * The figure sits on the side deck facing inboard and a little forward,
 * feet hooked under the hiking strap, the aft hand on the tiller
 * extension and the forward hand on the mainsheet.  It hikes out (leans
 * back over the water, legs straightening) as the boat heels, ducks low
 * across the cockpit under the boom when the boat tacks or gybes, and
 * keeps its side while the boom is near the centreline.
 *
 * Everything is placed from joint positions: a few points (pelvis, neck,
 * feet, hands) are set by the pose, knees and elbows come from two-bone
 * IK, and each limb is a capsule of fixed length laid between two joints.
 */

import * as THREE from 'three';
import { EXTENSION } from './model/opti-boat.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
const mix = (a, b, u) => a + (b - a) * u;
const D2R = Math.PI / 180;

// limb lengths for a 1.45 m, 11-12 year old
const L = { spine: 0.46, thigh: 0.40, shin: 0.39, upper: 0.27, fore: 0.25, neck: 0.07 };
const SWITCH = 4;      // deg of boom off the centreline before the sailor changes sides
const CROSS = 1.5;     // side units per second: about 1.3 s across the boat

const UP = new THREE.Vector3(0, 1, 0);
const Y = new THREE.Vector3(0, 1, 0);

/** Mesh laid between two joints: its local +y runs from a to b. */
function limb(mesh, a, b) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y, _d.copy(b).sub(a).normalize());
}
const _d = new THREE.Vector3();

/**
 * Two-bone IK: the middle joint for a chain root -> mid -> end of lengths
 * l1, l2 reaching for `target`, bending toward `pole`.  Writes the joint
 * to `mid` and the reachable end to `end`.
 */
function ik(root, target, l1, l2, pole, mid, end) {
  const dir = _ik.copy(target).sub(root);
  let d = dir.length();
  dir.divideScalar(d || 1);
  d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  end.copy(root).addScaledVector(dir, d);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const p = _ip.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  mid.copy(root).addScaledVector(dir, a).addScaledVector(p, h);
}
const _ik = new THREE.Vector3(), _ip = new THREE.Vector3();

const JACKETS = [0xe8412c, 0xf5c518, 0x1f6fd1, 0x2fa84f, 0xf07c1b, 0xd6336c];

/**
 * Build a sailor.  `jacket` is the buoyancy aid's colour.
 * Returns { group, update(opts) }.
 */
export function createSailor({ jacket = JACKETS[0], cap = 0xffffff, shorts = 0x1b2333 } = {}) {
  const group = new THREE.Group();
  group.name = 'Sailor';

  const M = {
    skin: new THREE.MeshStandardMaterial({ color: 0xe0ac86, roughness: 0.7 }),
    jacket: new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.6 }),
    suit: new THREE.MeshStandardMaterial({ color: shorts, roughness: 0.75 }),
    cap: new THREE.MeshStandardMaterial({ color: cap, roughness: 0.6 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.8 }),
    rope: new THREE.MeshStandardMaterial({ color: 0x2d5fa8, roughness: 0.8 }),
  };
  const add = (geo, mat, name) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = true;
    group.add(m);
    return m;
  };
  const capsule = (r, len, mat, name) => add(new THREE.CapsuleGeometry(r, len, 4, 10), mat, name);

  // torso: the buoyancy aid over the chest, the hips in the wetsuit
  const torso = add(new THREE.CapsuleGeometry(0.125, L.spine - 0.16, 4, 14)
    .translate(0, 0.03, 0).scale(1, 1, 0.78), M.jacket, 'Buoyancy aid');
  const hips = add(new THREE.SphereGeometry(0.12, 14, 10).scale(1.05, 0.7, 0.85), M.suit, 'Hips');
  const neck = capsule(0.04, L.neck, M.skin, 'Neck');
  const head = add(new THREE.SphereGeometry(0.093, 18, 14).scale(0.92, 1.05, 1), M.skin, 'Head');
  // cap: crown and a peak, in the head's frame (peak toward local +z)
  const capG = new THREE.Group();
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.098, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), M.cap);
  crown.position.y = 0.012;
  const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 18, 1, false, -Math.PI / 2, Math.PI)
    .scale(1, 1, 1.15), M.cap);
  peak.position.set(0, 0.02, 0.06);
  peak.rotation.x = 0.12;
  crown.castShadow = peak.castShadow = true;
  capG.add(crown, peak);
  capG.name = 'Cap';
  group.add(capG);

  const legs = [0, 1].map((i) => ({
    thigh: capsule(0.062, L.thigh - 0.1, M.suit, 'Thigh'),
    shin: capsule(0.047, L.shin - 0.08, M.suit, 'Shin'),
    foot: add(new THREE.BoxGeometry(0.075, 0.07, 0.22).translate(0, 0, 0.06), M.boot, 'Boot'),
    hip: new THREE.Vector3(), knee: new THREE.Vector3(), ankle: new THREE.Vector3(),
    i,
  }));
  const arms = [0, 1].map((i) => ({
    upper: capsule(0.045, L.upper - 0.08, M.jacket, 'Upper arm'),
    fore: capsule(0.036, L.fore - 0.06, M.skin, 'Forearm'),
    hand: add(new THREE.SphereGeometry(0.038, 10, 8), M.skin, 'Hand'),
    shoulder: new THREE.Vector3(), elbow: new THREE.Vector3(), wrist: new THREE.Vector3(),
    at: null,                       // smoothed hand position
    i,
  }));

  // the mainsheet tail from the ratchet block to the forward hand
  const tail = add(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 6), M.rope, 'Mainsheet tail');

  // pose state
  let side = 1, crossing = 1, lastT = null;

  // scratch
  const f = new THREE.Vector3(), back = new THREE.Vector3(), spine = new THREE.Vector3();
  const chest = new THREE.Vector3(), right = new THREE.Vector3(), rightH = new THREE.Vector3();
  const P = new THREE.Vector3(), N = new THREE.Vector3(), H = new THREE.Vector3();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), pole = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const tillerTarget = new THREE.Vector3(), sheetTarget = new THREE.Vector3();
  const joint = new THREE.Vector3(), grip = new THREE.Vector3(), q = new THREE.Quaternion();
  const invExt = new THREE.Matrix4();

  /**
   * opts:
   *   boomDeg   boom angle, + to starboard
   *   heel      boat heel in degrees (sign ignored): how hard to hike
   *   t         seconds
   *   boat      the boat object from createBoat(): its tiller extension is
   *             aimed at the aft hand, and the sheet tail starts at its
   *             ratchet block (boat.cleatLocal)
   *   snap      true to jump straight to the pose (no tack animation)
   */
  function update({ boomDeg, heel = 0, t = 0, boat, snap = false }) {
    const dt = lastT === null || snap ? 1 : clamp(t - lastT, 0, 0.1);
    lastT = t;

    // windward side: opposite the boom; hold it while the boom is central
    if (boomDeg > SWITCH) side = 1;
    else if (boomDeg < -SWITCH) side = -1;
    crossing = snap ? side : crossing + clamp(side - crossing, -CROSS * dt, CROSS * dt);
    const s = crossing;
    // c: 1 while ducking across the middle, 0 settled on a side
    const c = 1 - smoothstep(0.35, 0.92, Math.abs(s));
    const hike = (1 - c) * smoothstep(3, 15, Math.abs(heel));
    const bob = 0.012 * Math.sin(t * 1.7);

    // facing: inboard and 35 deg forward on a side, straight forward mid-tack
    f.set(-mix(0.57, 1, c), 0, -s * 0.82).normalize();

    // pelvis on the side deck; out over the edge when hiking
    P.set(mix(1.64, 1.55, c), mix(mix(0.47, 0.44, hike), 0.23, c) + bob * (1 - hike),
      s * (0.47 + 0.15 * hike));

    // spine: lean back (outboard) to hike, forward to duck
    const lean = mix(mix(-6, 55, hike), -38, c) * D2R;
    back.copy(f).negate();
    spine.copy(UP).multiplyScalar(Math.cos(lean)).addScaledVector(back, Math.sin(lean)).normalize();
    N.copy(P).addScaledVector(spine, L.spine);
    chest.copy(f).addScaledVector(spine, -f.dot(spine)).normalize();
    right.crossVectors(spine, chest).normalize();   // across the shoulders
    rightH.crossVectors(f, UP).normalize();

    basis.makeBasis(right, spine, chest);
    torso.position.copy(P).addScaledVector(spine, L.spine * 0.5);
    torso.quaternion.setFromRotationMatrix(basis);
    hips.position.copy(P).addScaledVector(spine, 0.02);
    hips.quaternion.copy(torso.quaternion);

    // head: up off the spine, chin toward the sail; lifted when hiking
    tmp.copy(spine).addScaledVector(UP, 0.5 * hike).addScaledVector(chest, 0.25).normalize();
    const neckTop = tmp2.copy(N).addScaledVector(tmp, L.neck);
    limb(neck, N, neckTop);
    H.copy(neckTop).addScaledVector(tmp, 0.085);
    head.position.copy(H);
    const look = tmp2.copy(chest).addScaledVector(tmp, -chest.dot(tmp)).normalize();
    basis.makeBasis(pole.crossVectors(tmp, look).normalize(), tmp, look);
    head.quaternion.setFromRotationMatrix(basis);
    capG.position.copy(H);
    capG.quaternion.copy(head.quaternion);

    // legs: feet hooked under the strap (it runs from the centre thwart
    // down to the floor aft), or on the floor while crossing
    for (const leg of legs) {
      const k = leg.i ? 1 : -1;
      leg.hip.copy(P).addScaledVector(right, 0.085 * k).addScaledVector(spine, -0.02);
      tmp.set(mix(1.42 + 0.05 * hike, 1.40, c), mix(0.085, 0.06, c), mix(s * mix(0.155, 0.17, hike), 0, c))
        .addScaledVector(rightH, 0.075 * k);
      pole.copy(UP).addScaledVector(f, 0.6).addScaledVector(rightH, 0.15 * k);
      ik(leg.hip, tmp, L.thigh, L.shin, pole, leg.knee, leg.ankle);
      limb(leg.thigh, leg.hip, leg.knee);
      limb(leg.shin, leg.knee, leg.ankle);
      leg.foot.position.copy(leg.ankle).addScaledVector(UP, -0.025);
      leg.foot.rotation.set(0, Math.atan2(f.x, f.z), 0);
    }

    // arms: the aft hand on the tiller extension, the forward hand on the
    // mainsheet.  Which hand is which depends on the side; the hands move
    // to their targets smoothly, so the swap reads as a change of hands.
    for (const arm of arms) {
      const k = arm.i ? 1 : -1;
      arm.shoulder.copy(N).addScaledVector(spine, -0.06).addScaledVector(right, 0.165 * k);
    }
    const aft = arms[0].shoulder.x > arms[1].shoulder.x ? arms[0] : arms[1];
    const fwd = aft === arms[0] ? arms[1] : arms[0];

    // Hand targets in boat terms, so they stay sensible however far the
    // body leans.  Aft hand: down by the hip and a little inboard.
    tillerTarget.copy(aft.shoulder).addScaledVector(UP, -0.30).addScaledVector(f, 0.20)
      .add(tmp.set(0.05, 0, 0));
    // forward hand: on the sheet's tail, part way from the shoulder toward
    // the ratchet block it comes out of
    if (boat && boat.cleatLocal) tmp.copy(boat.cleatLocal).sub(fwd.shoulder).normalize();
    else tmp.copy(f).addScaledVector(UP, -0.6).normalize();
    sheetTarget.copy(fwd.shoulder).addScaledVector(tmp, 0.36)
      .addScaledVector(UP, 0.05 + 0.03 * Math.sin(t * 0.9));

    // aim the tiller extension at the aft hand
    const ext = boat && boat.rudder && boat.rudder.extension;
    let gripAt = tillerTarget;
    if (ext) {
      ext.parent.updateWorldMatrix(true, false);
      // the extension's frame relative to the boat group: walk up the chain
      invExt.identity();
      for (let o = ext.parent; o && o !== boat.group; o = o.parent) invExt.premultiply(o.matrix);
      joint.copy(ext.position).applyMatrix4(invExt);
      tmp.copy(tillerTarget).sub(joint);
      if (tmp.lengthSq() < 1e-6) tmp.set(-1, 0, 0);
      tmp.normalize();
      grip.copy(joint).addScaledVector(tmp, EXTENSION);
      // direction into the tiller's own frame (rotation only)
      q.setFromRotationMatrix(invExt).invert();
      ext.quaternion.setFromUnitVectors(tmp2.set(-1, 0, 0), tmp.applyQuaternion(q));
      gripAt = grip;
    }

    const step = snap ? 1 : 1 - Math.exp(-dt * 10);
    for (const arm of arms) {
      const k = arm.i ? 1 : -1;
      const want = arm === aft ? gripAt : sheetTarget;
      if (!arm.at) arm.at = want.clone();
      arm.at.lerp(want, step);
      // elbows down and out
      pole.copy(spine).negate().addScaledVector(right, 0.6 * k).addScaledVector(chest, -0.2);
      ik(arm.shoulder, arm.at, L.upper, L.fore, pole, arm.elbow, arm.wrist);
      limb(arm.upper, arm.shoulder, arm.elbow);
      limb(arm.fore, arm.elbow, arm.wrist);
      arm.hand.position.copy(arm.wrist);
    }

    // sheet tail: ratchet block to the forward hand
    if (boat && boat.cleatLocal) {
      tmp.copy(boat.cleatLocal);
      tmp2.copy(fwd.wrist);
      tail.visible = true;
      tail.scale.set(1, tmp.distanceTo(tmp2), 1);
      limb(tail, tmp, tmp2);
    } else tail.visible = false;
  }

  /** Put the tiller extension back to rest (sailor hidden). */
  function release(boat) {
    const ext = boat && boat.rudder && boat.rudder.extension;
    if (ext) ext.quaternion.copy(ext.userData.rest);
  }

  return { group, update, release, get side() { return side; } };
}

export { JACKETS };
