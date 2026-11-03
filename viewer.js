/**
 * Optimist dinghy viewer: sky, water, lighting, interactive sail trim.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { SPEC } from './model/opti-core.js';
import { createBoat, makeMaterials } from './model/opti-boat.js';
import { updateRig, updateMainsheet, setSailMarks } from './model/opti-rig.js';

const D2R = Math.PI / 180;
const boot = document.getElementById('boot');
const bootMsg = document.getElementById('bootMsg');

function fail(err) {
  boot.classList.remove('hide');
  boot.classList.add('err');
  bootMsg.innerHTML =
    'The viewer needs to run from a local web server, because it loads ' +
    'ES modules.<br><br>From this folder run <code>python3 -m http.server 8000</code> ' +
    'and open <code>http://localhost:8000</code>.<br><br>' +
    '<span style="opacity:.7">' + (err && err.message ? err.message : err) + '</span>';
  console.error(err);
}

/* ------------------------------------------------------------------ *
 * sky and sun
 * ------------------------------------------------------------------ */

// The wind is from port and the boom eases to starboard, so the sun has to
// come from the port side as well: put it to starboard and the boat spends
// every view sitting in the shadow of its own sail.  Aft of the beam on the
// port quarter also puts the light behind the default camera, which is the
// way a boat like this is normally photographed.
const SUN_AZ = -52 * D2R;      // compass-ish azimuth of the light
const SUN_EL = 42 * D2R;
const sunDir = new THREE.Vector3(
  Math.cos(SUN_EL) * Math.cos(SUN_AZ),
  Math.sin(SUN_EL),
  Math.cos(SUN_EL) * Math.sin(SUN_AZ)).normalize();

const HORIZON = new THREE.Color(0xbfd3e0);
const ZENITH = new THREE.Color(0x2f6ea8);
const SUN_TINT = new THREE.Color(0xfff2d8);
const SEA_TINT = new THREE.Color(0x708a9c);

/** Same function in JS (for the texture) and GLSL (for reflections). */
function skyColor(dir) {
  const y = Math.max(0, dir.y);
  const c = HORIZON.clone().lerp(ZENITH, Math.pow(y, 0.42));
  const d = Math.max(0, dir.dot(sunDir));
  c.lerp(SUN_TINT, Math.pow(d, 8) * 0.5);
  // the sun disc itself
  const k = Math.pow(d, 900) * 3.0;
  c.r += SUN_TINT.r * k; c.g += SUN_TINT.g * k; c.b += SUN_TINT.b * k;
  if (dir.y < 0) c.lerp(SEA_TINT, Math.min(1, -dir.y * 3));
  return c;
}

function skyTexture() {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const img = g.createImageData(W, H);
  const dir = new THREE.Vector3();
  for (let j = 0; j < H; j++) {
    const phi = (j / (H - 1) - 0.5) * Math.PI;      // +up .. -down
    for (let i = 0; i < W; i++) {
      const theta = (i / (W - 1)) * Math.PI * 2;
      dir.set(Math.cos(phi) * Math.cos(theta), Math.sin(phi), Math.cos(phi) * Math.sin(theta));
      const c = skyColor(dir);
      const k = (j * W + i) * 4;
      img.data[k] = Math.round(255 * Math.pow(c.r, 1 / 2.2));
      img.data[k + 1] = Math.round(255 * Math.pow(c.g, 1 / 2.2));
      img.data[k + 2] = Math.round(255 * Math.pow(c.b, 1 / 2.2));
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ *
 * water
 * ------------------------------------------------------------------ */

const WAVES = [
  // dirX, dirZ, amplitude, wavelength, speed
  [1.0, 0.25, 0.035, 3.1, 0.55],
  [0.35, -1.0, 0.026, 2.2, 0.72],
  [-0.6, 0.8, 0.016, 1.3, 0.95],
  [0.85, 0.55, 0.009, 0.62, 1.35],
];

/** Water surface height in the boat frame - mirrored in the shader. */
function waveHeight(x, z, t) {
  let h = 0;
  for (const [dx, dz, a, l, s] of WAVES) {
    const n = Math.hypot(dx, dz);
    const k = (Math.PI * 2) / l;
    h += a * Math.sin(k * (x * dx + z * dz) / n + t * s * 2.0);
  }
  return h;
}

const WATER_VS = /* glsl */`
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNrm;

  // one sine wave, accumulating height and horizontal gradient
  void addWave(vec2 p, vec2 dir, float amp, float len, float speed,
               inout float h, inout vec2 grad) {
    vec2 d = normalize(dir);
    float k = 6.2831853 / len;
    // ease the steepness out toward the horizon
    float fade = mix(1.0, 0.35, smoothstep(6.0, 60.0, length(p)));
    float ph = k * dot(p, d) + uTime * speed * 2.0;
    h += amp * fade * sin(ph);
    grad += amp * fade * k * d * cos(ph);
  }

  void main() {
    vec2 p = position.xz;
    float h = 0.0;
    vec2 grad = vec2(0.0);
    addWave(p, vec2( 1.00,  0.25), 0.035, 3.10, 0.55, h, grad);
    addWave(p, vec2( 0.35, -1.00), 0.026, 2.20, 0.72, h, grad);
    addWave(p, vec2(-0.60,  0.80), 0.016, 1.30, 0.95, h, grad);
    addWave(p, vec2( 0.85,  0.55), 0.009, 0.62, 1.35, h, grad);

    vNrm = normalize(vec3(-grad.x, 1.0, -grad.y));
    vWorld = (modelMatrix * vec4(p.x, h, p.y, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const WATER_FS = /* glsl */`
  uniform vec3 uSun;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uSunTint;
  uniform vec3 uSeaTint;
  uniform float uOpacity;
  varying vec3 vWorld;
  varying vec3 vNrm;

  vec3 sky(vec3 d) {
    float y = max(d.y, 0.0);
    vec3 c = mix(uHorizon, uZenith, pow(y, 0.42));
    float s = max(dot(d, uSun), 0.0);
    c = mix(c, uSunTint, pow(s, 8.0) * 0.5);
    c += uSunTint * pow(s, 900.0) * 3.0;
    if (d.y < 0.0) c = mix(c, uSeaTint, min(1.0, -d.y * 3.0));
    return c;
  }

  void main() {
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 N = normalize(vNrm);
    // small-ripple normal detail
    float r = sin(vWorld.x * 9.0) * sin(vWorld.z * 11.0) * 0.02
            + sin(vWorld.x * 23.0 + 2.0) * sin(vWorld.z * 19.0) * 0.012;
    N = normalize(N + vec3(r, 0.0, r * 0.7));

    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 R = reflect(-V, N);
    R.y = abs(R.y) * 0.55 + 0.02;
    vec3 refl = sky(normalize(R));
    vec3 body = mix(uDeep, uShallow, clamp(N.y * 0.5 + 0.35, 0.0, 1.0));
    vec3 col = mix(body, refl, clamp(fres * 1.25, 0.0, 1.0));

    // sun glitter
    vec3 Hv = normalize(V + uSun);
    float spec = pow(max(dot(N, Hv), 0.0), 340.0);
    col += uSunTint * spec * 4.0;
    float path = pow(max(dot(normalize(vec3(R.x, 0.0, R.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0), 6.0);
    col += uSunTint * path * smoothstep(0.55, 1.0, fres) * 0.10;

    // atmospheric haze: fade to the sky just above the horizon in the
    // view direction, so the rim of the plane cannot be seen
    float dist = length(cameraPosition - vWorld);
    float haze = smoothstep(18.0, 120.0, dist);
    col = mix(col, sky(normalize(V + vec3(0.0, 0.03, 0.0))), haze);

    gl_FragColor = vec4(col, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------ *
 * scene
 * ------------------------------------------------------------------ */

let renderer, scene, camera, controls, boat, water, sun, pmrem;
const state = {
  // how far the boom is eased; the slider reports its complement as mainsheet %
  sheet: 0.35,
  wind: 0.45,
  camber: 0.55,
  autoSail: true,
  seaMotion: true,
  labels: false,
  wire: false,
  spin: false,
  t: 0,
};

// state.sheet is how far the boom is eased - 0 on the centreline, 1 hard over -
// because that is the angle the rig and the sail-drag solve for.  The slider is
// a mainsheet, which reads the other way: pull it in and the boom comes in.
// These two are the only places the sense turns over.
const sheetToSlider = (s) => Math.round((1 - s) * 100);
const sliderToSheet = (v) => 1 - v / 100;

/**
 * Heel angle in degrees for the current trim, before the sea-state scale.
 * Sheet her in and she is powered up and stands up less; ease her and the
 * sail spills and she comes upright, so the heeling force runs off one minus
 * the eased fraction.
 */
const heelDeg = () => state.wind * (5 + 13 * (1 - state.sheet));

// Framing: the rig reaches ~2.35 m above the baseline and the board hangs
// to -0.55 m, so a view has to clear ~3 m of height.  At 38 deg vertical
// that wants ~5 m of distance; anything closer crops the peak.
//
// Bearing matters as much as distance.  With the boom eased the chord
// points about 40 deg off the centreline, so the cloth only reads as a
// surface from near its normal - roughly abeam on the opposite tack side.
// A camera on the leeward quarter looks straight down the chord and sees a
// thin blade, so the default sits on the windward quarter instead.
const CAMS = {
  quarter: { pos: [5.6, 2.4, -4.6], tgt: [1.15, 1.4, 0] },
  windward: { pos: [2.6, 1.7, -6.0], tgt: [1.15, 1.35, 0] },
  leeward: { pos: [0.2, 1.6, 6.0], tgt: [1.15, 1.35, 0] },
  bow: { pos: [-5.2, 1.5, 1.2], tgt: [1.1, 1.3, 0] },
  stern: { pos: [6.8, 1.9, 0.9], tgt: [1.2, 1.3, 0] },
  top: { pos: [1.15, 7.5, 0.001], tgt: [1.15, 0, 0] },
  sail: { pos: [4.0, 2.0, -3.2], tgt: [1.3, 1.8, 0.25] },
};

function init() {
  const app = document.getElementById('app');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  app.insertBefore(renderer.domElement, app.firstChild);

  scene = new THREE.Scene();

  const skyTex = skyTexture();
  pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(skyTex).texture;
  scene.background = skyTex;
  scene.environment = env;

  camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 900);
  const c0 = CAMS.quarter;
  camera.position.set(...c0.pos);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...c0.tgt);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 0.7;
  controls.maxDistance = 26;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  // ---- lights ----------------------------------------------------
  sun = new THREE.DirectionalLight(0xfff4e2, 2.6);
  sun.position.copy(sunDir).multiplyScalar(14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 30;
  const s = 3.6;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.bias = -0.0007;
  sun.shadow.normalBias = 0.02;
  sun.target.position.set(1.15, 0.5, 0);
  scene.add(sun, sun.target);

  scene.add(new THREE.HemisphereLight(0xbcd6ee, 0x2b3f4d, 0.55));

  // ---- water -----------------------------------------------------
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: WATER_VS,
    fragmentShader: WATER_FS,
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: sunDir.clone() },
      uDeep: { value: new THREE.Color(0x14313f) },
      uShallow: { value: new THREE.Color(0x2c6b78) },
      uHorizon: { value: HORIZON.clone() },
      uZenith: { value: ZENITH.clone() },
      uSunTint: { value: SUN_TINT.clone() },
      uSeaTint: { value: SEA_TINT.clone() },
      uOpacity: { value: 1 },
    },
    side: THREE.DoubleSide,
  });
  const waterGeo = gradedGrid(150, 120, 0.1);
  water = new THREE.Mesh(waterGeo, waterMat);
  water.renderOrder = -1;
  scene.add(water);

  // ---- the boat --------------------------------------------------
  boat = createBoat(makeMaterials());
  scene.add(boat.group);

  // The mainsheet line is a child of the raked rig group, so the cleat
  // must be expressed in that group's frame, not the boat's.  Both are
  // children of the boat, so the rig's local matrix converts between them
  // without depending on how the boat happens to be sitting.
  boat.group.updateMatrixWorld(true);
  const toRig = new THREE.Matrix4().copy(boat.rig.group.matrix).invert();
  boat.cleatRig = boat.cleatLocal.clone().applyMatrix4(toRig);

  addEventListener('resize', onResize);
  boot.classList.add('hide');
}

/**
 * A water grid that is dense under the boat and coarse at the horizon:
 * row spacing grows geometrically outward from `firstGap`, so the short
 * chop stays resolved where it matters without spending a quarter of a
 * million triangles out at the skyline.
 */
function gradedGrid(extent, segments, firstGap) {
  const total = (r) => firstGap * (Math.pow(r, segments) - 1) / (r - 1);
  let lo = 1.0001, hi = 3;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (total(mid) > extent) hi = mid; else lo = mid;
  }
  const r = (lo + hi) / 2;

  const half = [0];
  for (let i = 0; i < segments; i++) half.push(half[i] + firstGap * Math.pow(r, i));
  half[segments] = extent;
  const stops = half.slice(1).map((v) => -v).reverse().concat(half);

  const n = stops.length;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      pos.push(stops[i], 0, stops[j]);
      uv.push(i / (n - 1), j / (n - 1));
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

/* ------------------------------------------------------------------ *
 * animation
 * ------------------------------------------------------------------ */

const clock = new THREE.Clock();
const tmpV = new THREE.Vector3();

function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  state.t += dt;
  const t = state.t;

  if (fly) {
    fly.t = Math.min(1, fly.t + dt * 1.9);
    const k = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - Math.pow(-2 * fly.t + 2, 2) / 2;
    camera.position.lerpVectors(fly.p0, fly.p1, k);
    controls.target.lerpVectors(fly.t0, fly.t1, k);
    if (fly.t >= 1) fly = null;
  }

  if (state.autoSail) {
    state.sheet = 0.42 + 0.26 * Math.sin(t * 0.31) + 0.07 * Math.sin(t * 0.83 + 1.1);
    state.sheet = Math.min(1, Math.max(0, state.sheet));
    ui.sheet.value = sheetToSlider(state.sheet);
    document.getElementById('sheetOut').textContent = ui.sheet.value + '%';
  }

  // Float on the water.  The boat frame is +X aft, +Y up, +Z starboard,
  // so heel is a rotation about X and pitch a rotation about Z.  The sail
  // is to starboard when eased, so the wind is from port and the leeward
  // (starboard) side goes down: a positive roll.
  const y0 = -SPEC.waterline;
  const heel = heelDeg() * D2R;
  if (state.seaMotion) {
    const h = waveHeight(1.15, 0, t);
    const hF = waveHeight(SPEC.loa, 0, t);
    const hA = waveHeight(0, 0, t);
    boat.group.position.y = y0 + h;
    boat.group.rotation.z = Math.atan2(hF - hA, SPEC.loa) * 0.85;
    boat.group.rotation.x = heel * (0.82 + 0.18 * Math.sin(t * 0.9));
    boat.group.rotation.y = 0.03 * Math.sin(t * 0.4) - heel * 0.25;
  } else {
    boat.group.position.y = y0 + waveHeight(1.15, 0, t) * 0.15;
    boat.group.rotation.set(heel * 0.55, 0, 0);
  }

  if (state.spin) {
    boat.group.rotation.y += dt * 0.28;
  }

  // rig: trim the sail, then string the mainsheet to the cleat
  updateRig(boat.rig, {
    boomOut: state.sheet,
    camber: 0.35 + state.camber * 1.3,
    wind: state.wind,
  });
  boat.group.updateMatrixWorld(true);
  updateMainsheet(boat.rig, boat.cleatRig);

  water.material.uniforms.uTime.value = t;
  controls.update();
  renderer.render(scene, camera);

  if (state.labels) drawLabels();
  updateReadout();
  requestAnimationFrame(animate);
}

/* ------------------------------------------------------------------ *
 * part labels
 * ------------------------------------------------------------------ */

// Anchored on the parts' own coordinates, so each leader line lands on the
// thing it names rather than somewhere near it.
const PARTS = [
  ['Sprit', () => rigPoint('peak', 0.06, 0.05)],
  ['Sprit tensioner (snotter)', () => rigPoint('snotter', -0.04, 0)],
  ['Mast', () => rigPoint('head', -0.01, -0.25)],
  ['Luff of sail', () => rigPoint('mid-luff', 0.06, 0.25)],
  ['Leech of sail', () => rigPoint('mid-leech', 0.26, 0.10)],
  ['Batten', () => rigPoint('mid-leech', 0.10, -0.16)],
  ['Foot of sail', () => rigPoint('mid-foot', 0.25, 0.06)],
  ['Boom', () => rigPoint('mid-foot', -0.35, -0.03)],
  ['Tack / gooseneck', () => rigPoint('tack', -0.01, 0)],
  ['Optimist insignia', () => rigPoint('mid-sail', 0.30, 0.34)],
  ['Air bag', () => boatPoint(0.85, 0.20, 0.37)],
  ['Mast thwart', () => boatPoint(0.32, 0.37, -0.25)],
  ['Centre thwart', () => boatPoint(1.28, 0.35, -0.35)],
  ['Daggerboard case', () => boatPoint(1.05, 0.35, 0.04)],
  ['Daggerboard', () => boatPoint(1.10, -0.30, 0.0)],
  ['Hiking straps', () => boatPoint(1.70, 0.16, 0.12)],
  ['Mainsheet block', () => boatPoint(1.28, 0.44, 0.0)],
  ['Stern bag', () => boatPoint(2.19, 0.24, -0.25)],
  ['Rudder', () => boatPoint(2.58, 0.0, 0.0)],
  ['Tiller', () => boatPoint(1.95, 0.45, 0.0)],
  ['Bow transom', () => boatPoint(0.07, 0.26, 0.0)],
  ['Transom', () => boatPoint(SPEC.loa, 0.30, 0.30)],
];

function boatPoint(x, y, z) {
  return new THREE.Vector3(x, y, z).applyMatrix4(boat.group.matrixWorld);
}

function rigPoint(which, dx, dy) {
  const c = boat.rig.corners;
  let p;
  switch (which) {
    case 'peak': p = { x: c.peak.x, y: c.peak.y }; break;
    case 'head': p = { x: c.head.x, y: c.head.y }; break;
    case 'tack': p = { x: 0, y: 0 }; break;
    case 'snotter': p = { x: c.snotter.x, y: c.snotter.y }; break;
    case 'mid-luff': p = { x: c.head.x * 0.5, y: c.head.y * 0.5 }; break;
    case 'mid-foot': p = { x: c.corner.x * 0.5, y: c.corner.y * 0.5 }; break;
    case 'mid-leech': p = { x: (c.peak.x + c.corner.x) / 2, y: (c.peak.y + c.corner.y) / 2 }; break;
    case 'mid-sail': p = { x: c.corner.x * 0.42, y: c.head.y * 0.62 }; break;
    default: p = { x: 0, y: 0 };
  }
  tmpV.set(p.x + dx, p.y + dy, 0.02);
  boat.rig.pivot.localToWorld(tmpV);
  return tmpV.clone();
}

let labelEls = null, leaderEls = null;
function ensureLabels() {
  if (labelEls) return;
  const host = document.getElementById('labels');
  const svg = document.getElementById('leaders');
  labelEls = []; leaderEls = [];
  PARTS.forEach(([text]) => {
    const div = document.createElement('div');
    div.className = 'lbl';
    div.textContent = text;
    host.appendChild(div);
    labelEls.push(div);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', 'rgba(255,255,255,0.5)');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
    leaderEls.push(line);
  });
}

const _proj = new THREE.Vector3();

/**
 * Slide any labels that have landed on top of each other apart, along
 * whichever axis needs the smaller push.  Two parts a hand span apart in
 * the boat - the cleat and the hiking strap, both on the side deck - land a
 * few pixels apart on screen, and no fixed offset can separate a pair whose
 * anchors are that close; only measuring the boxes can.  The leader lines
 * keep each label tied to its part however far it gets nudged.
 */
function separate(boxes) {
  for (let pass = 0; pass < 30; pass++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const ox = (a.w + b.w) / 2 + 5 - Math.abs(a.x - b.x);
        const oy = (a.h + b.h) / 2 + 4 - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (ox < oy) {
          const s = (a.x <= b.x ? 1 : -1) * ox / 2;
          a.x -= s; b.x += s;
        } else {
          const s = (a.y <= b.y ? 1 : -1) * oy / 2;
          a.y -= s; b.y += s;
        }
      }
    }
    if (!moved) break;
  }
}

function drawLabels() {
  ensureLabels();
  const svg = document.getElementById('leaders');
  const W = innerWidth, H = innerHeight;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // The control panel is opaque, so a label under it is simply lost.
  const p = document.getElementById('panel').getBoundingClientRect();
  const panel = { x0: p.left - 6, x1: p.right + 6, y0: p.top - 6, y1: p.bottom + 6 };

  const placed = [];
  for (let i = 0; i < PARTS.length; i++) {
    const wp = PARTS[i][1]();
    _proj.copy(wp).project(camera);
    const div = labelEls[i], line = leaderEls[i];
    if (_proj.z > 1 || _proj.z < -1) {
      div.style.display = 'none'; line.style.display = 'none'; continue;
    }
    const ax = (_proj.x * 0.5 + 0.5) * W;
    const ay = (-_proj.y * 0.5 + 0.5) * H;
    // Start each label out away from its anchor, outward from the screen
    // centre, with a per-part angle offset so neighbours begin apart.
    let vx = ax - W / 2, vy = ay - H / 2;
    let vl = Math.hypot(vx, vy);
    if (vl < 1) { vx = Math.cos(i); vy = Math.sin(i); vl = 1; }
    const a = Math.atan2(vy, vx) + ((i % 5) - 2) * 0.26;
    const off = 58 + (i % 4) * 17;
    // Make it measurable before reading its size: a label hidden last frame
    // (it was off-screen) reports 0x0 while display is none, and the
    // separation pass would then happily stack another label on top of it.
    div.style.display = 'block';
    placed.push({
      i, ax, ay, div, line,
      x: ax + Math.cos(a) * off,
      y: ay + Math.sin(a) * off,
      w: div.offsetWidth, h: div.offsetHeight,
    });
  }

  separate(placed);

  for (const b of placed) {
    let lx = Math.min(W - 80, Math.max(80, b.x));
    const ly = Math.min(H - 26, Math.max(26, b.y));
    // Clear of the panel last: the separation pass can push a label under
    // it, and shunting it out is cheaper than re-running the pass.
    if (lx - b.w / 2 < panel.x1 && lx + b.w / 2 > panel.x0 &&
        ly - b.h / 2 < panel.y1 && ly + b.h / 2 > panel.y0) {
      lx = Math.min(W - 80, Math.max(lx, panel.x1 + b.w / 2 + 4));
    }
    b.div.style.left = lx + 'px';
    b.div.style.top = ly + 'px';
    b.line.style.display = 'block';
    b.line.setAttribute('x1', b.ax); b.line.setAttribute('y1', b.ay);
    b.line.setAttribute('x2', lx); b.line.setAttribute('y2', ly);
  }
}

/* ------------------------------------------------------------------ *
 * readout
 * ------------------------------------------------------------------ */

const readout = document.getElementById('readout');
function updateReadout() {
  const boomDeg = (state.sheet * 74).toFixed(0);
  const heel = (heelDeg() * (state.seaMotion ? 1 : 0.55)).toFixed(1);
  const kn = (state.wind * 18).toFixed(0);
  readout.innerHTML =
    `<b>${kn} kn</b> wind &nbsp; <b>${sheetToSlider(state.sheet)}%</b> sheet<br>` +
    `boom <b>${boomDeg}&deg;</b> &nbsp; heel <b>${heel}&deg;</b><br>` +
    `LOA 2.30 m &middot; beam 1.13 m &middot; sail <b>${sailArea.toFixed(1)} m&sup2;</b>`;
}

/**
 * Sail area, measured from the flat corner geometry - the class rule
 * measures the developed cloth, not the inflated shape.
 */
let sailArea = 0;
function measureSail() {
  const c = boat.corners;
  const tri = (p, q, r) => {
    const ux = q.x - p.x, uy = q.y - p.y;
    const wx = r.x - p.x, wy = r.y - p.y;
    return Math.abs(ux * wy - uy * wx) * 0.5;
  };
  // a quadratic leech with control offset h sags h/2, so take off the
  // parabolic slice between the leech and its chord
  const hollow = 0.045 * 0.5;
  const leechLen = Math.hypot(c.peak.x - c.corner.x, c.peak.y - c.corner.y);
  sailArea = tri(c.tack, c.head, c.peak) + tri(c.tack, c.peak, c.corner)
    - (2 / 3) * hollow * leechLen;
}

/* ------------------------------------------------------------------ *
 * UI
 * ------------------------------------------------------------------ */

const ui = {};
function bindUI() {
  const $ = (id) => document.getElementById(id);
  ui.sheet = $('sheet'); ui.wind = $('wind'); ui.camber = $('camber');
  ui.autoSail = $('autoSail'); ui.seaMotion = $('seaMotion');
  ui.labels = $('labelsChk'); ui.wire = $('wireChk');
  ui.water = $('waterChk'); ui.spin = $('spinChk');
  ui.sailCountry = $('sailCountry'); ui.sailNumber = $('sailNumber');

  // The two lines on the cloth: national letters over the sail number.
  // Repaint on each keystroke so the sail keeps up with the typing.
  const applyMarks = () => {
    setSailMarks(boat.rig, {
      country: ui.sailCountry.value.toUpperCase().replace(/[^A-Z]/g, ''),
      number: ui.sailNumber.value.replace(/[^0-9A-Za-z-]/g, ''),
    });
  };
  ui.sailCountry.addEventListener('input', () => {
    const p = ui.sailCountry.selectionStart;
    ui.sailCountry.value = ui.sailCountry.value.toUpperCase();
    ui.sailCountry.setSelectionRange(p, p);
    applyMarks();
  });
  ui.sailNumber.addEventListener('input', applyMarks);

  const sync = () => {
    state.sheet = sliderToSheet(+ui.sheet.value);
    state.wind = ui.wind.value / 100;
    state.camber = ui.camber.value / 100;
    $('sheetOut').textContent = ui.sheet.value + '%';
    $('windOut').textContent = (state.wind * 18).toFixed(0) + ' kn';
    $('camberOut').textContent = ui.camber.value + '%';
  };
  ['sheet', 'wind', 'camber'].forEach((k) => ui[k].addEventListener('input', () => {
    if (k === 'sheet') { state.autoSail = false; ui.autoSail.checked = false; }
    sync();
  }));

  ui.autoSail.addEventListener('change', () => { state.autoSail = ui.autoSail.checked; });
  ui.seaMotion.addEventListener('change', () => { state.seaMotion = ui.seaMotion.checked; });
  ui.spin.addEventListener('change', () => { state.spin = ui.spin.checked; });
  ui.labels.addEventListener('change', () => {
    state.labels = ui.labels.checked;
    document.getElementById('labels').classList.toggle('on', state.labels);
    if (!state.labels && labelEls) {
      labelEls.forEach((e) => (e.style.display = 'none'));
      leaderEls.forEach((e) => (e.style.display = 'none'));
    }
  });
  ui.wire.addEventListener('change', () => {
    state.wire = ui.wire.checked;
    boat.group.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { m.wireframe = state.wire; });
      }
    });
  });
  ui.water.addEventListener('change', () => { water.visible = ui.water.checked; });

  document.getElementById('cams').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cam]');
    if (!b) return;
    document.querySelectorAll('#cams button').forEach((x) => x.classList.toggle('on', x === b));
    flyTo(CAMS[b.dataset.cam]);
  });

  const panel = document.getElementById('panel');
  document.getElementById('toggle').addEventListener('click', (e) => {
    panel.classList.toggle('min');
    e.currentTarget.textContent = panel.classList.contains('min') ? '+' : '−';
  });

  document.getElementById('png').addEventListener('click', () => {
    renderer.render(scene, camera);
    const a = document.createElement('a');
    a.download = 'optimist.png';
    a.href = renderer.domElement.toDataURL('image/png');
    a.click();
  });

  document.getElementById('glb').addEventListener('click', () => {
    const exporter = new GLTFExporter();
    // export the boat upright on its baseline, not floating and heeled
    const pq = boat.group.quaternion.clone();
    const pp = boat.group.position.clone();
    boat.group.quaternion.identity();
    boat.group.position.set(0, 0, 0);
    boat.group.updateMatrixWorld(true);
    const restore = () => {
      boat.group.quaternion.copy(pq);
      boat.group.position.copy(pp);
      boat.group.updateMatrixWorld(true);
    };
    exporter.parse(
      boat.group,
      (buf) => {
        restore();
        const blob = new Blob([buf], { type: 'model/gltf-binary' });
        const a = document.createElement('a');
        a.download = 'optimist-dinghy.glb';
        a.href = URL.createObjectURL(blob);
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      },
      (err) => { restore(); console.error(err); alert('Export failed: ' + err.message); },
      { binary: true, onlyVisible: true },
    );
  });

  sync();
}

/* camera fly-to, eased inside animate() */
let fly = null;
function flyTo(cam) {
  fly = {
    t: 0,
    p0: camera.position.clone(),
    t0: controls.target.clone(),
    p1: new THREE.Vector3(...cam.pos),
    t1: new THREE.Vector3(...cam.tgt),
  };
}

/* ------------------------------------------------------------------ *
 * dragging the sail
 * ------------------------------------------------------------------ */

const ray = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let dragging = null;

function pointerToSheet(ev) {
  const nx = (ev.clientX / innerWidth) * 2 - 1;
  const ny = -(ev.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera({ x: nx, y: ny }, camera);

  // plane through the current boom end, horizontal
  const boomW = new THREE.Vector3(
    boat.rig.corners.corner.x, boat.rig.corners.corner.y, 0);
  boat.rig.pivot.localToWorld(boomW);
  plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), boomW);

  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, hit)) return;
  boat.group.worldToLocal(hit);
  const dx = hit.x - SPEC.mastFromBow;
  const dz = hit.z;
  if (dx <= 0.02) return;
  const ang = Math.atan2(dz, dx);
  state.sheet = Math.min(1, Math.max(0, ang / (74 * D2R)));
  ui.sheet.value = sheetToSlider(state.sheet);
  ui.autoSail.checked = false;
  state.autoSail = false;
  document.getElementById('sheetOut').textContent = ui.sheet.value + '%';
}

function bindDrag() {
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const nx = (ev.clientX / innerWidth) * 2 - 1;
    const ny = -(ev.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera({ x: nx, y: ny }, camera);
    const hit = ray.intersectObject(boat.rig.sail, false)[0];
    if (!hit) return;
    dragging = true;
    controls.enabled = false;
    el.setPointerCapture(ev.pointerId);
    pointerToSheet(ev);
    el.style.cursor = 'grabbing';
  });
  el.addEventListener('pointermove', (ev) => {
    if (dragging) { pointerToSheet(ev); return; }
    const nx = (ev.clientX / innerWidth) * 2 - 1;
    const ny = -(ev.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera({ x: nx, y: ny }, camera);
    el.style.cursor = ray.intersectObject(boat.rig.sail, false).length ? 'grab' : '';
  });
  const end = (ev) => {
    if (!dragging) return;
    dragging = null;
    controls.enabled = true;
    el.style.cursor = '';
    try { el.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/* ------------------------------------------------------------------ *
 * go
 * ------------------------------------------------------------------ */

try {
  init();
  bindUI();
  bindDrag();
  measureSail();
  animate();
} catch (err) {
  fail(err);
}

// Handle for the screenshot harness and for poking at the model by hand.
window.OPTi = {
  get boat() { return boat; },
  get state() { return state; },
  get scene() { return scene; },
  get camera() { return camera; },
  CAMS,
  /** Resolves after `n` rendered frames - the only reliable way to wait
   *  for a state change to reach the screen under a slow software GL. */
  frames(n = 4) {
    return new Promise((res) => {
      let i = 0;
      const step = () => (++i >= n ? res() : requestAnimationFrame(step));
      requestAnimationFrame(step);
    });
  },
};
