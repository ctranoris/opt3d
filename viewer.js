/**
 * Optimist dinghy viewer: sky, water, lighting, interactive sail trim.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { SPEC } from './model/opti-core.js';
import { createBoat, makeMaterials } from './model/opti-boat.js';
import {
  updateRig, updateMainsheet, setSailMarks, setWindVane,
  BATTENS, TELLTALES, WINDOW, INSIGNIA,
} from './model/opti-rig.js';
import {
  HULL_N, HULL_STEP, hullTable, createCompass, createWindArrow, placeWindArrow,
  windFlow, WIND_FROM_DEG,
} from './scene-extras.js';

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

// By default the wind is over the starboard side (-Z) and the boom is out to
// port, so the sun comes from the starboard side as well: put it to port and
// the boat spends every view sitting in the shadow of its own sail.  Aft of
// the beam on the starboard quarter also puts the light behind the default camera, which is the
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

// How far the boat has sailed, world x/z, metres.  The boat stays in the
// middle of the compass rose and the sea moves past her instead, so the
// waves are evaluated at (world point + odometer).
const odo = new THREE.Vector2();

/** Water surface height at a world point - mirrored in the shader. */
function waveHeight(x, z, t) {
  x += odo.x; z += odo.y;
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
  uniform vec2 uOffset;
  varying vec3 vWorld;
  varying vec3 vNrm;

  // one sine wave, accumulating height and horizontal gradient
  void addWave(vec2 p, vec2 dir, float amp, float len, float speed,
               inout float h, inout vec2 grad) {
    vec2 d = normalize(dir);
    float k = 6.2831853 / len;
    // ease the steepness out toward the horizon
    float fade = mix(1.0, 0.35, smoothstep(6.0, 60.0, length(p)));
    float ph = k * dot(p + uOffset, d) + uTime * speed * 2.0;
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
  uniform mat4 uBoatInv;
  uniform vec4 uHull[${HULL_N}];
  uniform vec2 uOffset;
  uniform float uTime;
  uniform float uWake;
  varying vec3 vWorld;
  varying vec3 vNrm;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  // (sheer y, sheer half, bottom y, bottom half) at boat-frame station x
  vec4 hullAt(float x) {
    float f = clamp(x / ${HULL_STEP.toFixed(4)}, 0.0, ${(HULL_N - 1).toFixed(1)} - 0.001);
    int i = int(f);
    return mix(uHull[i], uHull[i + 1], f - float(i));
  }

  // True where this point of the sea lies inside the hull: the water
  // there is the boat's interior, so it must not be drawn.
  bool insideHull(vec3 w) {
    vec3 b = (uBoatInv * vec4(w, 1.0)).xyz;
    if (b.x <= 0.0 || b.x >= ${SPEC.loa.toFixed(3)}) return false;
    vec4 h = hullAt(b.x);
    if (b.y <= h.z || b.y >= h.x + 0.15) return false;
    float k = clamp((b.y - h.z) / max(h.x - h.z, 1e-3), 0.0, 1.0);
    return abs(b.z) < mix(h.w, h.y, k);
  }

  // White water made by the boat moving through it, 0..1: a bow wave
  // and foam along her sides, churned water off the transom, and the two
  // arms of the Kelvin wedge (19.5 deg half-angle) spreading astern.
  // Worked out in the boat frame (+x aft, +z port); the foam's texture is
  // fixed to the water, so it streams aft past her as she sails.
  float wakeFoam(vec3 w) {
    if (uWake <= 0.001) return 0.0;
    vec3 b = (uBoatInv * vec4(w, 1.0)).xyz;
    float L = ${SPEC.loa.toFixed(3)};
    if (b.x < -0.6 || b.x > 16.0 || abs(b.z) > 7.0) return 0.0;
    float foam = 0.0;

    // along the hull: a band just outside her waterline, heaviest at the bow
    if (b.x > 0.0 && b.x < L) {
      vec4 h = hullAt(b.x);
      float k = clamp((b.y - h.z) / max(h.x - h.z, 1e-3), 0.0, 1.0);
      float off = abs(b.z) - mix(h.w, h.y, k);
      float band = 0.05 + 0.10 * uWake;
      foam += smoothstep(band, 0.0, off) * step(-0.03, off)
            * mix(1.0, 0.45, b.x / L);
    }
    // a little bow wave pushed ahead of the stem
    foam += smoothstep(0.22, 0.0, length(vec2(b.x + 0.04, b.z * 0.8))) * 0.8;

    // churned water off the transom, widening and dying away astern
    float d = b.x - L;
    if (d > -0.05) {
      float wT = 0.30 + 0.07 * d;
      foam += (1.0 - smoothstep(wT * 0.3, wT, abs(b.z))) * exp(-d * 0.55);
    }

    // Kelvin arms from just ahead of the bow
    float dd = b.x + 0.3;
    if (dd > 0.0) {
      float e = abs(abs(b.z) - dd * 0.354);
      float wA = 0.06 + 0.035 * dd;
      foam += smoothstep(wA, 0.0, e) * exp(-dd * 0.22) * smoothstep(0.0, 0.8, dd) * 1.05;
      // the ruffled water between the arms
      foam += step(abs(b.z), dd * 0.354) * exp(-dd * 0.35) * 0.18;
    }

    // break it up with noise that rides on the water
    vec2 q = w.xz + uOffset;
    float n = vnoise(q * 5.0 + vec2(0.0, uTime * 0.3)) * 0.5
            + vnoise(q * 13.0 - uTime * 0.2) * 0.3
            + vnoise(q * 31.0 + uTime * 0.4) * 0.2;
    foam *= uWake;
    return smoothstep(0.35, 0.9, foam * (0.25 + 1.2 * n));
  }

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
    if (insideHull(vWorld)) discard;
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 N = normalize(vNrm);
    // small-ripple normal detail
    vec2 wq = vWorld.xz + uOffset;
    float r = sin(wq.x * 9.0) * sin(wq.y * 11.0) * 0.02
            + sin(wq.x * 23.0 + 2.0) * sin(wq.y * 19.0) * 0.012;
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

    // white water, lit by the sun and the sky
    float foam = wakeFoam(vWorld);
    vec3 foamCol = vec3(0.86, 0.90, 0.93) * (0.75 + 0.35 * max(dot(N, uSun), 0.0));
    col = mix(col, foamCol, foam * 0.92);

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
let compass, windArrow, helm;
const MID = 1.15;   // midship, boat x: the heading turns about this point
const state = {
  // Boom angle off the centreline, degrees: + to starboard, - to port.
  // The mainsheet slider sets it directly, -180..180.
  boom: -26,
  windFrom: WIND_FROM_DEG,  // compass bearing the true wind blows from
  heading: 270,             // compass course of the bow
  wind: 0.45,
  camber: 0.55,
  autoSail: true,
  seaMotion: true,
  labels: false,
  wire: false,
  spin: false,
  t: 0,
  // solved every frame from the wind, the course and the trim
  fill: 1,      // -1..1: which side the wind fills the sail, and how much
  speed: 0,     // boat speed, in the same units as `wind`
  heel: 0,      // degrees, + to port
  twa: 0, awa: 0, app: 0,
  // the old 0..1 "eased" control, kept for scripts: eased to port
  get sheet() { return Math.min(1, Math.abs(this.boom) / 74); },
  set sheet(v) { this.boom = -v * 74; },
};

const pad3 = (d) => String(Math.round(((d % 360) + 360) % 360) % 360).padStart(3, '0');
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const cardinal = (d) => POINTS[Math.round((((d % 360) + 360) % 360) / 45) % 8];
const fmtBoom = (b) => (Math.abs(b) < 0.5 ? '0°' : `${Math.abs(b).toFixed(0)}° ${b > 0 ? 'S' : 'P'}`);

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

/**
 * A camera preset in world space.  The presets are written for the boat
 * heading west with the wind over her starboard side (the default); turn
 * them with her heading, and mirror the side-on ones when the wind is
 * from port so "Windward" stays windward.
 */
const SIDED = new Set(['quarter', 'windward', 'leeward', 'sail']);
function camFor(name) {
  const c = CAMS[name];
  const p = new THREE.Vector3(...c.pos), q = new THREE.Vector3(...c.tgt);
  if (SIDED.has(name) && windFromPort()) { p.z = -p.z; q.z = -q.z; }
  const yaw = -(state.heading + 90) * D2R;
  for (const v of [p, q]) {
    v.x -= MID;
    v.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    v.x += MID;
  }
  return { pos: p.toArray(), tgt: q.toArray() };
}

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
      uBoatInv: { value: new THREE.Matrix4() },
      uHull: { value: hullTable() },
      uOffset: { value: odo },
      uWake: { value: 0 },
    },
    side: THREE.DoubleSide,
  });
  const waterGeo = gradedGrid(150, 120, 0.1);
  water = new THREE.Mesh(waterGeo, waterMat);
  water.renderOrder = -1;
  scene.add(water);

  // ---- the boat --------------------------------------------------
  boat = createBoat(makeMaterials());
  // The heading turns the boat about her midship, so she stays in the
  // middle of the compass rose.  Heel and pitch stay on boat.group.
  helm = new THREE.Group();
  helm.name = 'Heading';
  helm.position.set(MID, 0, 0);
  helm.add(boat.group);
  boat.group.position.x = -MID;
  scene.add(helm);

  // ---- compass rose on the water, and the wind arrow ---------------
  // North is -Z.  By default the wind is from the north and the boat
  // heads west, so it comes over her starboard side and the boom goes out
  // to port.  Both are set from the panel.
  compass = createCompass();
  compass.position.set(1.15, 0.12, 0);
  scene.add(compass);
  windArrow = createWindArrow();
  placeWindArrow(windArrow, compass.position, state.windFrom);
  scene.add(windArrow);

  // The mainsheet line is a child of the raked rig group, so the cleat
  // must be expressed in that group's frame, not the boat's.  Both are
  // children of the boat, so the rig's local matrix converts between them
  // without depending on how the boat happens to be sitting.
  helm.updateMatrixWorld(true);
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

  if (state.spin) setHeading(state.heading + dt * 15);   // turntable

  sailTrim(dt, t);

  // Make way: move the sea astern at her speed (kn -> m/s).
  const ms = state.speed * 18 * 0.5144;
  odo.x += bowV.x * ms * dt;
  odo.y += bowV.z * ms * dt;

  // Float on the water.  The boat frame is +X aft, +Y up, +Z to port, so
  // heel is a rotation about X (+ heels to port) and pitch one about Z.
  helm.rotation.y = -(state.heading + 90) * D2R;
  const y0 = -SPEC.waterline;
  const heel = state.heel * D2R;
  if (state.seaMotion) {
    // sample the sea under the midship, the bow and the stern, wherever
    // she happens to point
    const bx = Math.sin(state.heading * D2R), bz = -Math.cos(state.heading * D2R);
    const aft = SPEC.loa - MID;
    const h = waveHeight(MID, 0, t);
    const hF = waveHeight(MID - bx * aft, -bz * aft, t);
    const hA = waveHeight(MID + bx * MID, bz * MID, t);
    boat.group.position.y = y0 + h;
    boat.group.rotation.z = Math.atan2(hF - hA, SPEC.loa) * 0.85;
    boat.group.rotation.x = heel * (0.82 + 0.18 * Math.sin(t * 0.9));
    boat.group.rotation.y = 0.03 * Math.sin(t * 0.4) - heel * 0.25;
  } else {
    boat.group.position.y = y0 + waveHeight(MID, 0, t) * 0.15;
    boat.group.rotation.set(heel * 0.55, 0, 0);
  }

  // rig: trim the sail, then string the mainsheet to the cleat
  updateRig(boat.rig, {
    boomDeg: state.boom,
    fill: state.fill,
    camber: 0.35 + state.camber * 1.3,
    wind: state.wind,
    t,
  });
  helm.updateMatrixWorld(true);
  updateMainsheet(boat.rig, boat.cleatRig);

  water.material.uniforms.uTime.value = t;
  water.material.uniforms.uWake.value = Math.min(1.2, (state.speed * 18) / 3);
  water.material.uniforms.uBoatInv.value.copy(boat.group.matrixWorld).invert();

  // the masthead vane shows the apparent wind
  setWindVane(boat.rig, appFlow, t);
  windArrow.userData.update(t, state.wind, state.windFrom, camera);
  controls.update();
  renderer.render(scene, camera);

  if (state.labels) drawLabels();
  updateReadout();
  requestAnimationFrame(animate);
}

/* ------------------------------------------------------------------ *
 * sailing: wind, trim, speed and heel
 *
 * A small steady-state model, just enough for the sail, the vane and the
 * heel to agree with the wind and the course.  All in the horizontal plane.
 * ------------------------------------------------------------------ */

const trueFlow = new THREE.Vector3(), appFlow = new THREE.Vector3();
const bowV = new THREE.Vector3(), portV = new THREE.Vector3();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };

/** Boom angle off the centreline that sets the sail for an apparent wind angle. */
const optimalBoom = (awa) => clamp(awa * 0.55 - 12, 0, 88);

/** Bow and port unit vectors in the world for the current heading. */
function courseVectors() {
  const h = state.heading * D2R;
  bowV.set(Math.sin(h), 0, -Math.cos(h));
  portV.set(-Math.cos(h), 0, -Math.sin(h));      // the boat's +Z
}

/** True when the true wind comes over the port side. */
function windFromPort() {
  courseVectors();
  windFlow(state.windFrom, trueFlow);
  return trueFlow.dot(portV) < 0;                // air moving to starboard
}

function sailTrim(dt, t) {
  courseVectors();
  windFlow(state.windFrom, trueFlow);
  state.twa = Math.acos(clamp(-trueFlow.dot(bowV), -1, 1)) / D2R;

  // Apparent wind: the true wind less the boat's own way through the water.
  appFlow.copy(trueFlow).multiplyScalar(state.wind).addScaledVector(bowV, -state.speed);
  const ax = -appFlow.dot(bowV);                 // boat frame: air moving aft
  const az = appFlow.dot(portV);                 // ... and toward port
  const app = Math.hypot(ax, az);
  state.app = app;
  state.awa = app > 1e-5 ? Math.acos(clamp(ax / app, -1, 1)) / D2R : 0;

  if (state.autoSail) {
    // boom to leeward; dead downwind, stay on the gybe she is on
    let side = az > 0 ? -1 : 1;                  // air going to port: boom to port
    if (state.awa > 168 && Math.abs(state.boom) > 1) side = Math.sign(state.boom);
    const want = side * Math.max(0, optimalBoom(state.awa)
      + 3 * Math.sin(t * 0.31) + 1.5 * Math.sin(t * 0.83 + 1.1));
    const step = 70 * dt;                        // the boom swings across, not jumps
    state.boom += clamp(want - state.boom, -step, step);
    showBoom();
  }

  // How the wind meets the cloth: its component across the sail's chord.
  // For boom angle a the side the cloth bellies to when fill > 0 is
  // (sin a, cos a) in the boat's (aft, port) plane.
  const a = state.boom * D2R;
  const across = app > 1e-5 ? (ax * Math.sin(a) + az * Math.cos(a)) / app : 0;
  const fillT = clamp(across / 0.35, -1, 1);
  state.fill += clamp(fillT - state.fill, -6 * dt, 6 * dt);

  // Force normal to the sail: drive ahead, and heel.
  const cn = clamp(4 * across, -1.2, 1.2);
  const drive = -cn * Math.sin(a);               // forward is -x
  const heelT = 14 * app * cn * Math.cos(a);     // + heels to port
  state.heel += (heelT - state.heel) * Math.min(1, dt / 0.9);

  // Speed: a simple polar for the course, scaled by how well she is
  // trimmed - nothing in irons, nothing with the sail aback.
  const polar = smoothstep(32, 75, state.twa) * (1 - 0.12 * smoothstep(110, 180, state.twa));
  const trim = Math.max(0, 1 - Math.abs(Math.abs(state.boom) - optimalBoom(state.awa)) / 50);
  const e = drive > 0 ? trim * Math.min(1, Math.abs(state.fill)) : 0;
  const target = 0.42 * state.wind * polar * e;
  state.speed += (target - state.speed) * Math.min(1, dt / 2.5);
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
  ['Batten', () => { const c = boat.rig.corners, f = BATTENS[0];
    return rigPoint('xy', c.corner.x + (c.peak.x - c.corner.x) * f - 0.18,
      c.corner.y + (c.peak.y - c.corner.y) * f - 0.06); }],
  ['Tell-tales', () => rigPoint('xy', TELLTALES[0][0] + 0.06, TELLTALES[0][1])],
  ['Window', () => rigPoint('xy', (WINDOW.x0 + WINDOW.x1) / 2, (WINDOW.y0 + WINDOW.y1) / 2 + 0.02)],
  ['Foot of sail', () => rigPoint('mid-foot', 0.25, 0.06)],
  ['Boom', () => rigPoint('mid-foot', -0.35, -0.03)],
  ['Tack / gooseneck', () => rigPoint('tack', -0.01, 0)],
  ['Optimist insignia', () => rigPoint('xy', INSIGNIA.x, INSIGNIA.y)],
  ['Wind indicator', () => boat.group.getObjectByName('Wind indicator').getWorldPosition(new THREE.Vector3())],
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
    case 'xy': p = { x: 0, y: 0 }; break;   // dx, dy are the point itself
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
  const heel = state.heel * (state.seaMotion ? 1 : 0.55);
  const kn = (state.wind * 18).toFixed(0);
  const side = windFromPort() ? 'port' : 'stbd';
  readout.innerHTML =
    `<b>${kn} kn</b> wind from <b>${pad3(state.windFrom)}&deg; ${cardinal(state.windFrom)}</b><br>` +
    `heading <b>${pad3(state.heading)}&deg; ${cardinal(state.heading)}</b> &nbsp; TWA <b>${state.twa.toFixed(0)}&deg;</b> ${side}<br>` +
    `boom <b>${fmtBoom(state.boom)}</b> &nbsp; heel <b>${Math.abs(heel).toFixed(1)}&deg;</b> &nbsp; speed <b>${(state.speed * 18).toFixed(1)} kn</b><br>` +
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
  ui.windDir = $('windDir'); ui.heading = $('heading');
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
    state.boom = +ui.sheet.value;
    state.wind = ui.wind.value / 100;
    state.camber = ui.camber.value / 100;
    showBoom();
    $('windOut').textContent = (state.wind * 18).toFixed(0) + ' kn';
    $('camberOut').textContent = ui.camber.value + '%';
  };
  ['sheet', 'wind', 'camber'].forEach((k) => ui[k].addEventListener('input', () => {
    if (k === 'sheet') { state.autoSail = false; ui.autoSail.checked = false; }
    sync();
  }));
  ui.windDir.addEventListener('input', () => setWindFrom(+ui.windDir.value));
  ui.heading.addEventListener('input', () => setHeading(+ui.heading.value));
  setWindFrom(state.windFrom);
  setHeading(state.heading);

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
  ui.compass = $('compassChk');
  if (ui.compass) ui.compass.addEventListener('change', () => {
    compass.visible = windArrow.visible = ui.compass.checked;
  });

  document.getElementById('cams').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cam]');
    if (!b) return;
    document.querySelectorAll('#cams button').forEach((x) => x.classList.toggle('on', x === b));
    flyTo(camFor(b.dataset.cam));
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
    helm.updateMatrixWorld(true);
    const restore = () => {
      boat.group.quaternion.copy(pq);
      boat.group.position.copy(pp);
      helm.updateMatrixWorld(true);
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

function showBoom() {
  ui.sheet.value = Math.round(state.boom);
  document.getElementById('sheetOut').textContent = fmtBoom(state.boom);
}

/** Set the compass bearing the wind blows from, and move the arrow. */
function setWindFrom(deg) {
  state.windFrom = ((deg % 360) + 360) % 360;
  ui.windDir.value = Math.round(state.windFrom) % 360;
  document.getElementById('windDirOut').textContent = `${pad3(state.windFrom)}° ${cardinal(state.windFrom)}`;
  placeWindArrow(windArrow, compass.position, state.windFrom);
  windArrow.userData.setLabel(`WIND ${pad3(state.windFrom)}° ${cardinal(state.windFrom)}`);
}

/** Set the compass course the bow points to. */
function setHeading(deg) {
  state.heading = ((deg % 360) + 360) % 360;
  ui.heading.value = Math.round(state.heading) % 360;
  document.getElementById('headingOut').textContent = `${pad3(state.heading)}° ${cardinal(state.heading)}`;
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
  if (Math.hypot(dx, dz) < 0.1) return;
  // + to starboard, which is the boat's -z
  state.boom = Math.atan2(-dz, dx) / D2R;
  ui.autoSail.checked = false;
  state.autoSail = false;
  showBoom();
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
  get controls() { return controls; },
  get water() { return water; },
  odo,
  get helm() { return helm; },
  setHeading, setWindFrom, camFor,
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
