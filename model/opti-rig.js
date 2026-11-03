/**
 * The Optimist sprit rig: mast, boom, sprit and a sail that is rebuilt
 * from its four corners whenever the trim changes, so sheeting the
 * mainsheet swings the whole rig about the mast and reshapes the cloth.
 *
 * Rig-local frame, origin at the tack:
 *   +Y up the mast, +X aft, +Z to starboard (leeward).
 *
 * Sail corners, from the class sail lengths (SBM plan / class drawing):
 *   luff  1.68 (tack -> throat, on the mast)
 *   head  1.22 (throat -> peak)
 *   foot  1.93 (tack -> clew, on a level boom)
 *   leech 2.67 (peak -> clew)
 *
 *   clew = foot along the boom
 *   peak = circle(throat, head) x circle(clew, leech)
 *
 * The sprit is not one of the sail's edges: it runs from the snotter, a
 * rope loop on the mast about half a metre above the boom, diagonally up
 * to the peak, and is what holds the peak up.
 */

import * as THREE from '../lib/three.module.js';
import { SPEC, D2R } from './opti-core.js';
import { sparGeometry } from './opti-hull.js';

const PI = Math.PI;

/* ------------------------------------------------------------------ *
 * rig geometry
 * ------------------------------------------------------------------ */

function circleIntersect(c0, r0, c1, r1, sign) {
  const dx = c1.x - c0.x, dy = c1.y - c0.y;
  const d = Math.hypot(dx, dy) || 1e-9;
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const mx = c0.x + a * dx / d, my = c0.y + a * dy / d;
  return { x: mx + sign * h * (-dy / d), y: my + sign * h * (dx / d) };
}

/**
 * The corners, rig-local, +X aft and +Y up the mast: tack, head (throat),
 * peak, corner (clew), plus the sprit's heel (snotter) and tip.  Four sail
 * lengths fix a quadrilateral once the boom angle is chosen; solving it
 * this way gives the ~41 deg head edge and ~3.2 m2 of the class drawing.
 *
 * @param rake  mast rake in degrees; the boom's rise is quoted from the
 *              horizontal, and these corners are in the raked rig frame
 */
export function rigCorners(rake = SPEC.rigRake) {
  const tack = { x: 0, y: 0 };
  const head = { x: 0, y: SPEC.luff };

  // clew: the foot laid along a level boom (level in the boat, so it
  // rises by the rake in this frame)
  const rise = (rake + SPEC.boomRise) * D2R;
  const corner = { x: SPEC.foot * Math.cos(rise), y: SPEC.foot * Math.sin(rise) };

  // peak: head edge from the throat, leech from the clew; of the two
  // intersections take the one above the throat -> clew line, up and aft
  const peak = circleIntersect(head, SPEC.headToPeak, corner, SPEC.leech, 1);

  // the sprit: heel at the snotter, tip a little past the peak
  const snotter = { x: 0, y: SPEC.snotter };
  const dx = peak.x - snotter.x, dy = peak.y - snotter.y;
  const l = Math.hypot(dx, dy);
  const spritEnd = {
    x: peak.x + dx / l * SPEC.spritOver, y: peak.y + dy / l * SPEC.spritOver,
  };

  return { tack, head, peak, corner, snotter, spritEnd, spritLen: l + SPEC.spritOver };
}

/**
 * Mast axis and tack position in the boat frame.  The mast passes
 * through the mast thwart and steps on the floor; the tack (the boom's
 * gooseneck) sits SPEC.tackHeight above the baseline.
 */
export function mastFrame(stepY) {
  const rake = SPEC.rigRake * D2R;
  const base = new THREE.Vector3(SPEC.mastFromBow, stepY, 0);
  const dir = new THREE.Vector3(Math.sin(rake), Math.cos(rake), 0);
  const lower = Math.max(0.02, (SPEC.tackHeight - stepY) / Math.cos(rake));
  const tack = base.clone().addScaledVector(dir, lower);
  return { rake, base, dir, lower, tack };
}

/* ------------------------------------------------------------------ *
 * sail surface
 *
 * Grid over (s, t):  s = 0 luff -> 1 leech,  t = 0 foot -> 1 head.
 * Row t runs from L(t) on the luff to R(t) on the leech, so the four
 * grid corners are tack, corner, peak, head and the t = 1 row is the
 * sprit edge.
 * ------------------------------------------------------------------ */

const SAIL_S = 30;
const SAIL_T = 26;

// Where the spars sit relative to the cloth plane.  +z is to leeward: the
// wind pushes the cloth that way, so the sprit - which the leech is laced
// to - lives on the leeward face, and the boom, which the foot is laced
// into, on the windward face.  The sprit is a straight spar, so where it
// crosses the face of the sail it presses the cloth flat against itself;
// sailGeometry() solves that contact below.
const BOOM_Z = 0.004;
const SPRIT_HOOK_Z = 0.024; // the sprit's centreline where it hooks on
const SPRIT_PEAK_Z = 0.016; // ... and at the peak, where the cloth is flat
const SPRIT_R0 = 0.016;     // spar radius at the heel
const SPRIT_R1 = 0.0135;    // ... and at the peak
const CLOTH = 0.006;        // half a skin, so the cloth lies over the spar
const SPRIT_W = 0.17;       // how wide a band of cloth the sprit flattens
const BRIDLE = [0.69, 1.26]; // bridle ends, m along the boom from the tack
const BRIDLE_DROP = 0.09;    // the block hangs this far under the boom

function leechPoint(corner, peak, t, hollow) {
  const dx = peak.x - corner.x, dy = peak.y - corner.y;
  const len = Math.hypot(dx, dy) || 1;
  // outward normal of the leech (away from the sail interior)
  const nx = dy / len, ny = -dx / len;
  const cx = (corner.x + peak.x) / 2 + nx * hollow;
  const cy = (corner.y + peak.y) / 2 + ny * hollow;
  const it = 1 - t;
  return {
    x: it * it * corner.x + 2 * it * t * cx + t * t * peak.x,
    y: it * it * corner.y + 2 * it * t * cy + t * t * peak.y,
  };
}

/**
 * @param corners  rig corners
 * @param o        { camber, twist, hollow, luffSag, footSag }
 */
export function sailGeometry(corners, o = {}) {
  const {
    camber = 0.085, twist = 0.16, hollow = -0.045,
    luffSag = 0.035, footSag = 0.012,
  } = o;

  const { tack, head, peak, corner } = corners;
  const pos = [], nor = [], uv = [], idx = [];

  // The sprit's trace across the face of the sail, in the same frame as
  // the corners: from the snotter on the mast to the peak.
  const spritA = corners.snotter;
  const sbx = peak.x - spritA.x, sby = peak.y - spritA.y;
  const slen2 = sbx * sbx + sby * sby;

  for (let j = 0; j <= SAIL_T; j++) {
    const t = j / SAIL_T;
    const L = { x: tack.x + (head.x - tack.x) * t, y: tack.y + (head.y - tack.y) * t };
    const R = leechPoint(corner, peak, t, hollow);

    // twist grows toward the head, easing out over the bottom third
    const tw = twist * Math.pow(Math.max(0, t - 0.12) / 0.88, 1.6);

    // Draft depth: deepest mid height, and dying out at both the foot and
    // the head, because the foot is laced into the boom and the head edge
    // is laced to the sprit - neither spar lets the cloth curve.
    const belly = Math.sin(PI * (0.14 + 0.72 * t))
      * Math.min(1, t / 0.16) * Math.min(1, (1 - t) / 0.13);

    for (let i = 0; i <= SAIL_S; i++) {
      const s = i / SAIL_S;
      let px = L.x + (R.x - L.x) * s;
      let py = L.y + (R.y - L.y) * s;
      let pz = 0;

      // Spanwise envelope: nil on the luff and the leech, full mid-chord.
      // Everything that pulls the cloth out of the rig plane goes through
      // this, so the four corners stay welded to the spars - the peak to
      // the sprit tip and the clew to the boom end, which is how a rigid
      // sprit and boom actually hold the cloth.  The peak of the draft is
      // eased forward of mid-chord, as on any drafty sail, which also
      // keeps the aft panel flat enough for the sprit to lie against the
      // leech instead of standing off it.
      const env = Math.sin(PI * Math.pow(s, 0.62)) * (1 - 0.35 * s);

      // Camber, to leeward (+z), and luff sag - both the cloth going to
      // leeward, both fading out at the leech so the edge stays on the
      // sprit.  The foot is laced into the boom, so it stays put.
      const chord = Math.hypot(R.x - L.x, R.y - L.y);
      const draft = camber * (chord / 2.2) * env * belly * 2.4;
      const sag = luffSag * Math.sin(PI * t) * Math.pow(Math.max(0, 1 - s), 1.7);
      pz += draft + sag;
      py -= footSag * Math.sin(PI * s) * Math.pow(Math.max(0, 1 - t), 2.0);

      // Twist: rotate the section about the luff so the leech falls off to
      // leeward.  Only the camber rotates - the luff sag belongs to the
      // mast, which does not twist.  Eased to nothing at the leech so the
      // peak and clew cannot drift off their spars.
      const tws = tw * env;
      const cosT = Math.cos(tws), sinT = Math.sin(tws);
      const rx = px - L.x, rz = draft;
      px = L.x + rx * cosT - rz * sinT;
      pz = rx * sinT + rz * cosT;

      // The sprit is a straight spar laced to the leech on the leeward
      // face, so where it crosses the face of the sail it presses the cloth
      // flat against itself.  Solve that contact: find how far this point
      // sits from the sprit's trace across the cloth, and pull it back
      // behind the spar where the lacing holds it.  This is what gives an
      // Opti sail its crease along the sprit, with the head panel and the
      // lower panel bellied separately.
      const ax = px - spritA.x, ay = py - spritA.y;
      let u = (ax * sbx + ay * sby) / slen2;
      u = Math.min(1, Math.max(0, u));
      const dx = px - (spritA.x + sbx * u), dy = py - (spritA.y + sby * u);
      const near = Math.exp(-((dx * dx + dy * dy) / (SPRIT_W * SPRIT_W)));
      const ceiling = SPRIT_HOOK_Z + (SPRIT_PEAK_Z - SPRIT_HOOK_Z) * u
        - (SPRIT_R0 + (SPRIT_R1 - SPRIT_R0) * u) - CLOTH;
      const proud = pz - ceiling;
      if (proud > 0) pz -= near * proud;

      pos.push(px, py, pz);
      nor.push(0, 0, 1);
      uv.push(s, t);
    }
  }

  const row = SAIL_S + 1;
  for (let j = 0; j < SAIL_T; j++) {
    for (let i = 0; i < SAIL_S; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ *
 * sail cloth texture.  u = 0 at the luff, v = 0 at the foot; canvas
 * row 0 is the top of the image, i.e. v = 1, the head of the sail.
 * ------------------------------------------------------------------ */

/** The printed marks: national letters over the sail number. */
export const SAIL_MARKS = { country: 'GRE', number: '1062' };

// The block of cloth the two lines live on: forward of the batten pockets
// and below the sprit's trace, which crosses this part of the sail at
// about v = 0.65 + 0.45u.  Lines are centred at u = 0.38.
const MARKS_U = 0.38;
const MARKS_COUNTRY_V = 0.53;   // baseline of the national letters
const MARKS_NUMBER_V = 0.385;   // baseline of the sail number

/**
 * One line of class-style lettering, centred on (u, v) as a baseline,
 * shrinking the font until it fits within maxW of the cloth's width so a
 * five-digit number still sits clear of the battens.
 */
function drawMarkLine(g, W, H, text, u, v, size, maxW, color) {
  if (!text) return;
  let px = Math.round(W * size);
  g.font = `bold ${px}px -apple-system, system-ui, sans-serif`;
  const w = g.measureText(text).width;
  const lim = W * maxW;
  if (w > lim) {
    px = Math.max(8, Math.round(px * lim / w));
    g.font = `bold ${px}px -apple-system, system-ui, sans-serif`;
  }
  g.fillStyle = color;
  g.textAlign = 'center';
  g.fillText(text, W * u, H * (1 - v));
}

export function sailTexture(marks = SAIL_MARKS) {
  const W = 640, H = 640;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#fdfdfa');
  grad.addColorStop(0.55, '#f4f4ee');
  grad.addColorStop(1, '#e9e9e1');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // woven feel
  g.globalAlpha = 0.045;
  g.strokeStyle = '#7e7e76';
  g.lineWidth = 1;
  for (let i = 0; i < 130; i++) {
    g.beginPath();
    g.moveTo(0, (i / 130) * H);
    g.lineTo(W, (i / 130) * H + 5);
    g.stroke();
  }
  g.globalAlpha = 1;

  // panel seams, roughly parallel to the foot
  g.strokeStyle = 'rgba(125,125,116,0.30)';
  g.lineWidth = 2;
  for (const v of [0.30, 0.52, 0.74]) {
    g.beginPath();
    g.moveTo(W * 0.04, H * (1 - v));
    g.quadraticCurveTo(W * 0.5, H * (1 - v) - H * 0.05, W * 0.98, H * (1 - v) - H * 0.02);
    g.stroke();
  }

  // batten pockets, close to the leech, raked as on a real Opti sail
  g.strokeStyle = 'rgba(74,74,68,0.50)';
  g.lineWidth = 10;
  g.lineCap = 'round';
  for (const [u0, v0, u1, v1] of [[0.50, 0.60, 0.95, 0.74], [0.44, 0.30, 0.93, 0.46]]) {
    g.beginPath();
    g.moveTo(W * u0, H * (1 - v0));
    g.lineTo(W * u1, H * (1 - v1));
    g.stroke();
  }
  g.lineCap = 'butt';

  // class insignia: the O with its sprit, high on the sail.  The sprit
  // runs from low at the left up past the top right, as on the class flag.
  const cx = W * 0.62, cy = H * (1 - 0.80), r = W * 0.072;
  g.strokeStyle = '#141414';
  g.lineCap = 'round';
  g.lineWidth = r * 0.40;
  g.beginPath();
  g.arc(cx, cy, r, 0, PI * 2);
  g.stroke();
  g.lineWidth = r * 0.26;
  g.beginPath();
  g.moveTo(cx - r * 1.35, cy + r * 1.15);
  g.lineTo(cx + r * 1.15, cy - r * 1.55);
  g.stroke();
  g.lineCap = 'butt';

  // Sail marks as the class rules require them: the national letters on
  // one line and the sail number below, both above the foot and clear of
  // the sprit and batten pockets.  The cloth's shader mirrors the texture
  // on the windward face, so both lines read correctly from either side.
  drawMarkLine(g, W, H, marks.country, MARKS_U, MARKS_COUNTRY_V, 0.088, 0.26, '#1c1c1c');
  drawMarkLine(g, W, H, marks.number, MARKS_U, MARKS_NUMBER_V, 0.108, 0.30, '#1c1c1c');

  // Tell-tales: short yarn ribbons stitched flat to the cloth, not blobs.
  // A pair near the luff to read the flow, and one at each batten tip to
  // read the leech.  They stream aft, so each lies along the chord with a
  // slight droop.
  g.fillStyle = '#c62828';
  for (const [u, v, len] of [
    [0.13, 0.78, 0.075], [0.15, 0.44, 0.070],
    [0.86, 0.72, 0.060], [0.83, 0.42, 0.058],
  ]) {
    const x0 = W * u, y0 = H * (1 - v);
    const L = W * len, wdt = Math.max(2, W * 0.0055);
    g.save();
    g.translate(x0, y0);
    g.rotate(0.10);
    g.beginPath();                       // tapered: stitched, then free end
    g.moveTo(0, -wdt * 0.55);
    g.lineTo(L, -wdt * 0.22);
    g.lineTo(L, wdt * 0.22);
    g.lineTo(0, wdt * 0.55);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(60,20,20,0.55)';  // the stitch it is sewn under
    g.fillRect(-1, -wdt * 0.6, Math.max(2, W * 0.004), wdt * 1.2);
    g.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.name = 'sail-cloth';
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Repaint the cloth with different marks.  `marks` may give `country`
 * and/or `number`; an empty string leaves that line off the sail.
 */
export function setSailMarks(rig, marks = {}) {
  Object.assign(SAIL_MARKS, marks);
  const old = rig.materials.sailMat.map;
  rig.materials.sailMat.map = sailTexture(SAIL_MARKS);
  rig.materials.sailMat.needsUpdate = true;
  if (old) old.dispose();
}

/* ------------------------------------------------------------------ *
 * the rig
 * ------------------------------------------------------------------ */

/**
 * A spar from a to b, tapering rA -> rB.  `z` offsets it out of the cloth
 * plane - +z is to leeward - and may be a pair [zA, zB] to give the spar
 * its own angle across the face of the sail.
 */
function sparBetween(a, b, rA, rB, mat, z = 0) {
  const [zA, zB] = Array.isArray(z) ? z : [z, z];
  const d = new THREE.Vector3(b.x - a.x, b.y - a.y, zB - zA);
  const m = new THREE.Mesh(sparGeometry(d.length(), rB, rA), mat);
  m.position.set(a.x, a.y, zA);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

export function createRig(corners = rigCorners(), frame = mastFrame(0.08)) {
  // anodised aluminium spars, as on every current class rig
  const wood = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.32, metalness: 0.75 });
  const carbon = wood;
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xbcc0c6, roughness: 0.28, metalness: 0.85 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.7 });
  wood.name = 'spar-aluminium'; black.name = 'rig-fitting';
  steel.name = 'rig-hardware'; gold.name = 'block-sheave';

  const group = new THREE.Group();   // at the tack, raked with the mast
  group.name = 'Rig';
  const pivot = new THREE.Group();   // yaws about the mast
  pivot.name = 'Boom pivot';
  group.add(pivot);

  // ---- mast: steps below the tack, so it starts at -frame.lower ----
  const mastLen = frame.lower + SPEC.luff + SPEC.mastAboveHead;
  const mastGeo = sparGeometry(mastLen, SPEC.mastDia / 2 * 0.72, SPEC.mastDia / 2);
  mastGeo.translate(0, -frame.lower, 0);
  const mast = new THREE.Mesh(mastGeo, wood);
  mast.name = 'Mast';
  mast.castShadow = true;
  group.add(mast);
  // masthead truck
  const truck = new THREE.Mesh(new THREE.SphereGeometry(SPEC.mastDia * 0.42, 14, 10), black);
  truck.name = 'Masthead truck';
  truck.position.y = SPEC.luff + SPEC.mastAboveHead;
  group.add(truck);

  // gooseneck: a collar round the mast with the boom jaws on it
  const gooseneck = new THREE.Mesh(
    new THREE.CylinderGeometry(SPEC.mastDia * 0.66, SPEC.mastDia * 0.66, 0.05, 16), black);
  gooseneck.name = 'Gooseneck';
  gooseneck.position.set(0, -0.005, 0);
  group.add(gooseneck);
  // mast heel plug where it lands on the step
  const heel = new THREE.Mesh(
    new THREE.CylinderGeometry(SPEC.mastDia * 0.55, SPEC.mastDia * 0.6, 0.04, 14), black);
  heel.name = 'Mast heel';
  heel.position.set(0, -frame.lower + 0.02, 0);
  group.add(heel);

  // ---- boom -------------------------------------------------------
  // The foot is laced into the boom, so the boom sits on the foot line and
  // its windward half shows below the cloth.  The sprit is laced to the
  // leech on the leeward face - the side the cloth bulges toward - which is
  // why it reads as a diagonal bar across the sail from that side.
  const boom = sparBetween(corners.tack, corners.corner,
    SPEC.boomDia / 2, SPEC.boomDia / 2 * 0.82, carbon, BOOM_Z);
  boom.name = 'Boom';
  boom.castShadow = true;
  pivot.add(boom);

  const boomEnd = new THREE.Mesh(new THREE.SphereGeometry(SPEC.boomDia * 0.6, 14, 10), black);
  boomEnd.name = 'Boom end';
  boomEnd.position.set(corners.corner.x, corners.corner.y, BOOM_Z);
  pivot.add(boomEnd);

  // ---- sprit: from the snotter on the mast up to the peak ---------
  // it lies across the leeward face of the sail and pushes the peak up
  const spritTipZ = SPRIT_PEAK_Z;
  const sprit = sparBetween(corners.snotter, corners.spritEnd,
    SPRIT_R0, SPRIT_R1, wood, [SPRIT_HOOK_Z, spritTipZ]);
  sprit.name = 'Sprit';
  sprit.castShadow = true;
  pivot.add(sprit);

  const spritTip = new THREE.Mesh(new THREE.SphereGeometry(SPEC.spritDia * 0.58, 14, 10), black);
  spritTip.name = 'Sprit tip';
  spritTip.position.set(corners.spritEnd.x, corners.spritEnd.y, spritTipZ);
  pivot.add(spritTip);

  // ---- sail -------------------------------------------------------
  const sailMat = new THREE.MeshPhysicalMaterial({
    map: sailTexture(),
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
    sheen: 0.7,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xffffff),
  });

  // A class insignia and a sail number are printed to read correctly from
  // either side, not as a see-through decal.  The cloth is one double-sided
  // surface whose front face - by the grid's winding - is the windward one.
  // Seen from ahead of the luff the u axis runs aft-to-fore across the
  // screen, so it is the front face that needs the texture mirrored; the
  // leeward face then reads straight off the canvas.
  sailMat.name = 'sail-cloth';
  sailMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec2 sailUv = vMapUv;
        if ( gl_FrontFacing ) sailUv.x = 1.0 - sailUv.x;
        vec4 sampledDiffuseColor = texture2D( map, sailUv );
        diffuseColor *= sampledDiffuseColor;
      #endif`);
  };
  const sail = new THREE.Mesh(sailGeometry(corners), sailMat);
  sail.name = 'Sail';
  sail.castShadow = true;
  pivot.add(sail);

  // corner fittings
  const tackFit = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 10), steel);
  tackFit.name = 'Tack fitting';
  pivot.add(tackFit);
  const headFit = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 10), steel);
  headFit.name = 'Head fitting';
  headFit.position.set(corners.head.x, corners.head.y, 0);
  pivot.add(headFit);

  // ---- mainsheet bridle and block ---------------------------------
  // A rope bridle under the boom; the mainsheet block rides on it,
  // right above the ratchet block on the centre thwart.
  const fx = corners.corner.x / SPEC.foot, fy = corners.corner.y / SPEC.foot;
  const onBoom = (d, drop = 0) => ({ x: fx * d + fy * drop, y: fy * d - fx * drop });
  const b0 = onBoom(BRIDLE[0], SPEC.boomDia / 2), b1 = onBoom(BRIDLE[1], SPEC.boomDia / 2);
  const bm = onBoom((BRIDLE[0] + BRIDLE[1]) / 2, BRIDLE_DROP);
  const bridleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(b0.x, b0.y, BOOM_Z),
    new THREE.Vector3((b0.x + bm.x) / 2, (b0.y + bm.y) / 2 - 0.01, BOOM_Z),
    new THREE.Vector3(bm.x, bm.y + 0.03, BOOM_Z),
    new THREE.Vector3((b1.x + bm.x) / 2, (b1.y + bm.y) / 2 - 0.01, BOOM_Z),
    new THREE.Vector3(b1.x, b1.y, BOOM_Z),
  ]);
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe9e4d4, roughness: 0.95 });
  ropeMat.name = 'rope';
  const bridle = new THREE.Mesh(new THREE.TubeGeometry(bridleCurve, 30, 0.003, 6, false), ropeMat);
  bridle.name = 'Mainsheet bridle';
  pivot.add(bridle);

  const block = new THREE.Group();
  block.name = 'Boom block';
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.026), black);
  const sheave = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 16), gold);
  sheave.rotation.x = PI / 2;
  block.add(shell, sheave);
  block.position.set(bm.x, bm.y, BOOM_Z);
  pivot.add(block);
  corners.boomBlock = { x: bm.x, y: bm.y - 0.03 };

  // ---- snotter: the sprit's heel in a rope loop on the mast -------
  const snot = new THREE.Mesh(new THREE.TorusGeometry(SPEC.mastDia * 0.62, 0.005, 6, 18), ropeMat);
  snot.name = 'Snotter';
  snot.rotation.x = PI / 2;
  snot.position.set(0, corners.snotter.y, 0);
  group.add(snot);
  const heelFit = new THREE.Mesh(new THREE.SphereGeometry(SPEC.spritDia * 0.62, 12, 10), black);
  heelFit.name = 'Sprit heel';
  heelFit.position.set(corners.snotter.x + 0.01, corners.snotter.y, SPRIT_HOOK_Z);
  pivot.add(heelFit);

  // ---- mainsheet line (updated every frame) -----------------------
  const SHEET_PTS = 26;
  const sheetGeo = new THREE.BufferGeometry();
  sheetGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SHEET_PTS * 3), 3));
  const sheetMat = new THREE.LineBasicMaterial({ color: 0xefe9d6, linewidth: 2 });
  sheetMat.name = 'mainsheet-rope';
  const sheet = new THREE.Line(sheetGeo, sheetMat);
  sheet.name = 'Mainsheet';
  sheet.frustumCulled = false;
  group.add(sheet);

  return {
    group, pivot, sail, sheet, boom, sprit, block, mast, corners, BOOM_Z,
    materials: { wood, carbon, black, steel, gold, sailMat },
  };
}

/**
 * Trim the rig.
 * @param rig    createRig() result
 * @param p      { boomOut 0..1, camber, twist, wind 0..1 }
 */
export function updateRig(rig, p = {}) {
  const { boomOut = 0.35, camber = 1, twist = 1, wind = 0.5 } = p;

  // 0 = boom on the centreline, 1 = eased hard over
  const maxOut = 74 * D2R;
  rig.pivot.rotation.y = -boomOut * maxOut;
  rig.boomOut = boomOut;

  // Sheet her in and the leech tensions: the middle of the sail
  // deepens and the leech hooks in.  Ease her and the top twists off and
  // the leech relaxes toward straight.
  const sheetedIn = 1 - boomOut;
  const c = camber * (0.55 + 0.45 * sheetedIn) * (0.55 + 0.6 * wind);
  const tw = twist * (0.45 + 0.75 * boomOut) * (0.6 + 0.7 * wind);

  rig.sail.geometry.dispose();
  rig.sail.geometry = sailGeometry(rig.corners, {
    camber: 0.085 * c,
    twist: 0.16 * tw,
    hollow: -0.045 - 0.03 * sheetedIn,
    luffSag: 0.035 * (0.4 + 0.9 * wind),
  });
}

/**
 * Rebuild the mainsheet from the bridle block down to the ratchet block
 * on the centre thwart.  The line
 * is a child of the boat group; `cleatBoat` is in boat coordinates.
 */
export function updateMainsheet(rig, cleatBoat) {
  const attr = rig.sheet.geometry.attributes.position;
  const arr = attr.array;
  const n = attr.count;

  const bb = rig.corners.boomBlock;
  const a = new THREE.Vector3(bb.x, bb.y, rig.BOOM_Z ?? 0.004);
  rig.pivot.localToWorld(a);
  if (rig.sheet.parent) rig.sheet.parent.worldToLocal(a);
  const b = cleatBoat;

  // rig.boomOut is how far the boom is eased.  Sheet her in and the line
  // pulls taut; ease her and there is slack to hang in.
  const eased = Math.min(1, Math.max(0, rig.boomOut ?? 0.4));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const slack = 0.01 + 0.05 * eased;
    const sag = Math.sin(PI * t) * slack;
    arr[i * 3] = a.x + (b.x - a.x) * t;
    arr[i * 3 + 1] = a.y + (b.y - a.y) * t - sag;
    arr[i * 3 + 2] = a.z + (b.z - a.z) * t;
  }
  attr.needsUpdate = true;
  rig.sheet.geometry.computeBoundingSphere();
}
