/**
 * Scene dressing that is not part of the boat: a compass rose on the
 * water, a wind arrow showing where the wind comes from, and the hull
 * table the water shader uses to keep the sea out of the boat.
 *
 * World frame (the viewer's): +Y up, north is -Z, east is +X, south +Z,
 * west -X.  The boat's bow points -X, so with no turntable she heads west.
 */
import * as THREE from 'three';
import { SPEC, sheerY, sheerHalf, bottomY, bottomHalf } from './model/opti-core.js';

/** The wind blows FROM this compass bearing (degrees, 0 = north). */
export const WIND_FROM_DEG = 0;

/** Unit vector the air moves along, world frame, for a "from" bearing. */
export function windFlow(fromDeg = WIND_FROM_DEG, out = new THREE.Vector3()) {
  const a = fromDeg * Math.PI / 180;
  // bearing b points along (sin b, 0, -cos b); the air moves the other way
  return out.set(-Math.sin(a), 0, Math.cos(a));
}

/** Compass bearing (0..360, 0 = north) of a horizontal world direction. */
export function bearingOf(dir) {
  const b = Math.atan2(dir.x, -dir.z) * 180 / Math.PI;
  return (b + 360) % 360;
}

/* ------------------------------------------------------------------ *
 * hull table for the water mask
 * ------------------------------------------------------------------ */

export const HULL_STEP = 0.05;
// enough stations for the longest hull (the 4.23 m ILCA); shorter ones pad
export const HULL_N = Math.round(4.30 / HULL_STEP) + 1;   // 47

/**
 * One vec4 per station, every HULL_STEP from the bow:
 * (sheer height, sheer half breadth, bottom height, bottom half breadth).
 * Between bottom and sheer the side is a straight line, which is the
 * outside of the hull everywhere above the bilge.
 */
export function hullTable(station = (x) => [sheerY(x), sheerHalf(x), bottomY(x), bottomHalf(x)], loa = SPEC.loa) {
  const out = [];
  for (let i = 0; i < HULL_N; i++) {
    const x = Math.min(loa, i * HULL_STEP);
    out.push(new THREE.Vector4(...station(x)));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * text on a flat plane
 * ------------------------------------------------------------------ */

function textPlane(text, h, color = '#ffffff', weight = 'bold') {
  const c = document.createElement('canvas');
  const px = 128;
  const g = c.getContext('2d');
  g.font = `${weight} ${px}px Arial, Helvetica, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 24;
  c.width = w; c.height = px + 24;
  g.font = `${weight} ${px}px Arial, Helvetica, sans-serif`;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = 10;
  g.fillText(text, w / 2, c.height / 2 + 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(h * w / c.height, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  return m;
}

/* ------------------------------------------------------------------ *
 * compass rose
 * ------------------------------------------------------------------ */

/**
 * A compass rose floating on the water round the boat: a ring with a
 * tick every 10 degrees, the cardinal letters, and a red north pointer.
 */
export function createCompass(radius = 4.3) {
  const g = new THREE.Group();
  g.name = 'Compass';

  const white = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
  });
  const red = new THREE.MeshBasicMaterial({ color: 0xe0302a, side: THREE.DoubleSide });

  const flat = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;      // lie on the water, facing up
    m.renderOrder = 2;
    return m;
  };

  g.add(flat(new THREE.RingGeometry(radius - 0.05, radius, 128), white));
  g.add(flat(new THREE.RingGeometry(radius + 0.32, radius + 0.35, 128), white));

  // ticks: every 10 deg, longer every 30, longest at the cardinals
  for (let d = 0; d < 360; d += 10) {
    const len = d % 90 === 0 ? 0.32 : d % 30 === 0 ? 0.22 : 0.12;
    const wdt = d % 90 === 0 ? 0.05 : 0.025;
    const tick = flat(new THREE.PlaneGeometry(wdt, len), white);
    const a = d * Math.PI / 180;
    const r = radius + len / 2;
    tick.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r);
    tick.rotation.z = -a;             // radial, after the lie-flat turn
    g.add(tick);
  }

  // the cardinal letters, upright and turned to face the centre
  const LET = [['N', 0, '#ff5a4f'], ['E', 90, '#ffffff'], ['S', 180, '#ffffff'], ['W', 270, '#ffffff']];
  for (const [t, d, col] of LET) {
    const a = d * Math.PI / 180;
    const p = textPlane(t, 0.55, col);
    const r = radius + 0.75;
    p.position.set(Math.sin(a) * r, 0.30, -Math.cos(a) * r);
    p.rotation.y = -a;                 // face back toward the boat
    p.renderOrder = 3;
    g.add(p);
  }
  // the degree figures at 30 deg steps between them, lying flat
  for (let d = 30; d < 360; d += 30) {
    if (d % 90 === 0) continue;
    const a = d * Math.PI / 180;
    const p = textPlane(String(d).padStart(3, '0'), 0.22, '#ffffff', '600');
    p.rotation.set(-Math.PI / 2, 0, -a);
    const r = radius + 0.55;
    p.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r);
    p.renderOrder = 3;
    g.add(p);
  }

  // north pointer: a red arrowhead just inside the ring
  const tri = new THREE.Shape();
  tri.moveTo(0, 0.42); tri.lineTo(-0.2, -0.1); tri.lineTo(0, 0.0); tri.lineTo(0.2, -0.1);
  tri.closePath();
  const ptr = flat(new THREE.ShapeGeometry(tri), red);
  ptr.position.set(0, 0, -(radius - 0.45));
  g.add(ptr);

  return g;
}

/* ------------------------------------------------------------------ *
 * wind arrow
 * ------------------------------------------------------------------ */

/**
 * A 3D arrow standing upwind of the boat, pointing the way the wind
 * blows, with a label saying where it comes from.  Returns the group; its
 * `userData.update(t, wind, fromDeg)` animates it.
 */
export function createWindArrow() {
  const g = new THREE.Group();
  g.name = 'Wind arrow';

  const mat = new THREE.MeshStandardMaterial({
    color: 0x7fc8ff, emissive: 0x1f5d8c, emissiveIntensity: 0.6,
    roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.92,
  });
  // built along +Z (the way the air goes), tail at z = 0
  const arrow = new THREE.Group();
  const SHAFT = 1.5, HEAD = 0.5;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, SHAFT, 20), mat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = SHAFT / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, HEAD, 24), mat);
  head.rotation.x = Math.PI / 2;
  head.position.z = SHAFT + HEAD / 2;
  // tail feathers
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.36), mat);
  fin.position.z = 0.2;
  const fin2 = fin.clone();
  fin2.rotation.z = Math.PI / 2;
  arrow.add(shaft, head, fin, fin2);
  arrow.position.z = -(SHAFT + HEAD) / 2;   // centre it on the group
  g.add(arrow);

  const label = textPlane('WIND  N', 0.34, '#ffffff');
  label.position.set(0, 0.42, 0);
  label.renderOrder = 3;
  g.add(label);

  // little streaks moving along the arrow, so it reads as flow
  const streakMat = new THREE.MeshBasicMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.7 });
  const streaks = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.45), streakMat);
    s.userData.off = [(i % 3 - 1) * 0.5, (Math.floor(i / 3) - 0.5) * 0.5, i / 6];
    g.add(s);
    streaks.push(s);
  }

  g.userData.update = (t, wind, fromDeg, camera) => {
    const k = 0.6 + 0.8 * wind;
    arrow.scale.setScalar(k);
    for (const s of streaks) {
      const [ox, oy, ph] = s.userData.off;
      const f = (t * (0.35 + wind) + ph) % 1;
      s.position.set(ox * k, oy * k, (f - 0.5) * 2.4 * k);
      s.material.opacity = 0.7 * Math.sin(Math.PI * f);
    }
    // keep the label facing the camera
    if (camera) label.quaternion.copy(camera.quaternion).premultiply(
      g.getWorldQuaternion(new THREE.Quaternion()).invert());
    label.position.y = 0.42 * k + 0.1;
  };
  g.userData.setLabel = (text) => {
    const n = textPlane(text, 0.34, '#ffffff');
    label.geometry.dispose(); label.material.map.dispose();
    label.geometry = n.geometry; label.material = n.material;
  };
  return g;
}

/**
 * Put the wind arrow upwind of `centre`, `dist` metres off and `height`
 * up, pointing downwind for a wind from `fromDeg`.
 */
export function placeWindArrow(arrow, centre, fromDeg, dist = 4.6, height = 2.6) {
  const a = fromDeg * Math.PI / 180;
  arrow.position.set(centre.x + Math.sin(a) * dist, height, centre.z - Math.cos(a) * dist);
  // the arrow is built along +Z; turn +Z onto the flow
  const flow = windFlow(fromDeg);
  arrow.rotation.set(0, Math.atan2(flow.x, flow.z), 0);
}
