/**
 * Assembly: every part of an Optimist, positioned in the boat frame.
 *
 *   +X aft (bow transom top at 0), +Y up, +Z port.  y = 0 is the
 *   baseline.
 *
 * Layout follows a current GRP class boat (init_assets/Optimist_dinghy_02):
 * open hull, mast thwart forward, daggerboard case running aft to the
 * centre thwart, a buoyancy bag down each side forward of the centre
 * thwart and one across the stern, V hiking straps, and the mainsheet led
 * from a bridle on the boom to a ratchet block on the centre thwart.
 */

import * as THREE from '../lib/three.module.js';
import { SPEC, sheerY, floorY } from './opti-core.js';
import {
  hullGeometry, gunwaleGeometry, thwartGeometry, boardCaseGeometry,
  sideBagGeometry, sternBagGeometry, floorStripGeometry,
  plateGeometry, tubeGeometry, webbingGeometry,
} from './opti-hull.js';
import { createRig, mastFrame, rigCorners } from './opti-rig.js';

const { loa } = SPEC;

/* ------------------------------------------------------------------ *
 * materials
 * ------------------------------------------------------------------ */

/**
 * Materials, each named.  A name here is what shows up in the outliner of
 * whatever the .glb is opened in, so it is worth more than a colour swatch.
 */
export function makeMaterials() {
  const m = {
    hull: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, vertexColors: true, roughness: 0.38, metalness: 0,
      clearcoat: 0.5, clearcoatRoughness: 0.3, side: THREE.DoubleSide,
    }),
    // same gelcoat, for mouldings that carry no vertex colours
    moulding: new THREE.MeshPhysicalMaterial({
      color: 0xeff0f0, roughness: 0.38, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3,
    }),
    bag: new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0,
    }),
    black: new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.5 }),
    webbing: new THREE.MeshStandardMaterial({
      color: 0x16161a, roughness: 0.8, side: THREE.DoubleSide,
    }),
    steel: new THREE.MeshStandardMaterial({ color: 0xbcc0c6, roughness: 0.28, metalness: 0.85 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.7 }),
    tab: new THREE.MeshStandardMaterial({ color: 0xc8342b, roughness: 0.6 }),
    board: new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.4 }),
    tiller: new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.32, metalness: 0.75 }),
    rope: new THREE.MeshStandardMaterial({ color: 0xefe9d6, roughness: 0.95 }),
  };
  for (const k in m) m[k].name = k;
  return m;
}

/* ------------------------------------------------------------------ *
 * parts
 * ------------------------------------------------------------------ */

const MAST_THWART_TOP = () => sheerY(0.31) - 0.03;
const CENTRE_THWART_TOP = () => sheerY(1.28) - 0.04;

function hullAndMouldings(M) {
  const g = new THREE.Group();
  g.name = 'Hull';
  const add = (geo, name, mat = M.hull) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  add(hullGeometry(), 'Hull shell');
  add(gunwaleGeometry(), 'Gunwale');
  const [m0, m1] = SPEC.mastThwart;
  add(thwartGeometry(m0, m1, MAST_THWART_TOP(), 0.10), 'Mast thwart');
  const [c0, c1] = SPEC.centreThwart;
  add(thwartGeometry(c0, c1, CENTRE_THWART_TOP(), 0.07), 'Centre thwart');
  add(floorStripGeometry(1), 'Floor pad (port)');
  add(floorStripGeometry(-1), 'Floor pad (stbd)');

  // mast hole in the mast thwart
  const hole = new THREE.Mesh(
    new THREE.CylinderGeometry(SPEC.mastDia * 0.85, SPEC.mastDia * 0.85, 0.004, 24), M.black);
  hole.name = 'Mast gate';
  hole.position.set(SPEC.mastFromBow + Math.tan(SPEC.rigRake * Math.PI / 180) * MAST_THWART_TOP(),
    MAST_THWART_TOP() + 0.001, 0);
  g.add(hole);

  // painter eye on the bow transom, drain bung on the stern transom
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 8, 16), M.steel);
  eye.name = 'Bow eye';
  eye.position.set(0.035, 0.34, 0);
  eye.rotation.y = Math.PI / 2;
  g.add(eye);
  const bung = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 14), M.black);
  bung.name = 'Drain bung';
  bung.rotation.z = Math.PI / 2;
  bung.position.set(loa + 0.004, 0.13, 0);
  g.add(bung);
  return g;
}

function daggerboard(M) {
  const g = new THREE.Group();
  g.name = 'Daggerboard case';
  const top = CENTRE_THWART_TOP() - 0.004;
  const kase = new THREE.Mesh(boardCaseGeometry(top), M.moulding);
  kase.name = 'Case trunk';
  kase.castShadow = true;
  g.add(kase);
  // the slot along the top
  const { x0, chord, below } = SPEC.board;
  const slot = new THREE.Mesh(new THREE.BoxGeometry(chord + 0.01, 0.003, 0.022), M.black);
  slot.position.set(x0 + chord / 2, top + 0.0075, 0);
  g.add(slot);

  // the board, down, with its handle standing above the case
  const board = new THREE.Group();
  board.name = 'Daggerboard';
  const yt = top + 0.03, x1 = x0 + chord;
  const blade = new THREE.Mesh(plateGeometry([
    [x0, yt], [x1, yt], [x1, -below + 0.04], [x1 - 0.015, -below + 0.01],
    [x1 - 0.05, -below], [x0 + 0.04, -below], [x0 + 0.008, -below + 0.02],
    [x0, -below + 0.06],
  ], 0.016), M.board);
  blade.name = 'Daggerboard blade';
  blade.castShadow = true;
  board.add(blade);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.03, 0.028), M.black);
  handle.name = 'Daggerboard handle';
  handle.position.set(x0 + 0.07, yt + 0.012, 0);
  board.add(handle);
  g.add(board);
  return { group: g, board };
}

function buoyancy(M) {
  const g = new THREE.Group();
  g.name = 'Buoyancy bags';
  for (const [geo, name] of [[sideBagGeometry(1), 'Side bag (port)'],
    [sideBagGeometry(-1), 'Side bag (stbd)'], [sternBagGeometry(), 'Stern bag']]) {
    const m = new THREE.Mesh(geo, M.bag);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  // red inflation-tube tabs at the aft ends of the side bags
  for (const side of [-1, 1]) {
    const x = SPEC.sideBags[1] - 0.06;
    const tab = new THREE.Mesh(tubeGeometry([
      [x - 0.03, floorY(x) + 0.17, side * 0.30],
      [x + 0.01, floorY(x) + 0.12, side * 0.27],
      [x - 0.02, floorY(x) + 0.07, side * 0.25],
    ], 0.005, 8), M.tab);
    tab.name = 'Bag valve tube';
    g.add(tab);
  }
  // and one on the stern bag
  const sx = SPEC.sternBag.x;
  const sy = floorY(sx) + SPEC.sternBag.r * 1.8;
  const tab = new THREE.Mesh(tubeGeometry([
    [sx - 0.02, sy, 0.24], [sx - 0.06, sy + 0.01, 0.31], [sx - 0.05, sy - 0.01, 0.37],
  ], 0.005, 8), M.tab);
  tab.name = 'Bag valve tube';
  g.add(tab);
  return g;
}

function hikingStraps(M) {
  const g = new THREE.Group();
  g.name = 'Hiking straps';
  const yTh = CENTRE_THWART_TOP() - 0.07;
  const xAft = 2.02, yAft = floorY(xAft) + 0.015;
  for (const side of [-1, 1]) {
    const a = [SPEC.centreThwart[1] - 0.01, yTh - 0.01, side * 0.20];
    const b = [xAft, yAft + 0.02, side * 0.025];
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const strap = new THREE.Mesh(webbingGeometry(a, b, 0.048, [-dz, 0, dx], 0.035), M.webbing);
    strap.name = side > 0 ? 'Hiking strap (port)' : 'Hiking strap (stbd)';
    strap.castShadow = true;
    g.add(strap);
  }
  // the V meets in a plate tied down to an eye on the floor
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.07), M.webbing);
  foot.position.set(xAft + 0.01, yAft + 0.02, 0);
  g.add(foot);
  const tie = new THREE.Mesh(tubeGeometry([
    [xAft + 0.03, yAft + 0.02, 0], [xAft + 0.08, yAft + 0.005, 0], [xAft + 0.12, floorY(xAft + 0.12), 0],
  ], 0.003, 6), M.rope);
  g.add(tie);
  return g;
}

/** Tiller extension length, joint to grip. */
export const EXTENSION = 0.60;

function rudderAssembly(M) {
  const g = new THREE.Group();
  g.name = 'Rudder';

  // gudgeons on the transom, pintles on the blade
  for (const y of [0.38, 0.18]) {
    const gud = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.05), M.steel);
    gud.name = 'Gudgeon';
    gud.position.set(loa + 0.012, y, 0);
    g.add(gud);
  }

  // The blade hangs on the pintle line and turns about it.
  const pivot = new THREE.Group();
  pivot.name = 'Rudder pivot';
  const px = loa + 0.02, py = 0.28;
  pivot.position.set(px, py, 0);
  const outline = [
    [2.315, 0.47], [2.40, 0.495], [2.45, 0.47], [2.70, -0.07],
    [2.69, -0.13], [2.55, -0.22], [2.50, -0.21], [2.32, 0.12],
  ].map(([x, y]) => [x - px, y - py]);
  const blade = new THREE.Mesh(plateGeometry(outline, 0.02), M.board);
  blade.name = 'Rudder blade';
  blade.castShadow = true;
  pivot.add(blade);
  // rudder head cheeks that grip the tiller
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.04), M.black);
  head.name = 'Rudder head';
  head.position.set(2.39 - px, 0.455 - py, 0);
  pivot.add(head);

  // tiller forward over the stern bag, then a hinged extension
  const tiller = new THREE.Group();
  tiller.name = 'Tiller';
  const tY = 0.44 - py;
  const tFwd = 1.77 - px, tAft = 2.43 - px;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(tAft - tFwd, 0.028, 0.024), M.tiller);
  bar.position.set((tAft + tFwd) / 2, tY, 0);
  tiller.add(bar);
  const joint = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), M.black);
  joint.position.set(tFwd, tY, 0);
  tiller.add(joint);
  // The extension swivels on a universal joint at the tiller's fore end.
  // It is built along -x from that joint, so pointing it is one rotation;
  // the sailor's aft hand aims it (see sailor.js), and at rest it lies
  // forward on the centre thwart.
  const extension = new THREE.Group();
  extension.name = 'Tiller extension';
  extension.position.set(tFwd, tY, 0);
  const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, EXTENSION, 10)
    .rotateZ(Math.PI / 2).translate(-EXTENSION / 2, 0, 0), M.black);
  ext.name = 'Tiller extension tube';
  ext.castShadow = true;
  extension.add(ext);
  const grip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), M.black);
  grip.position.set(-EXTENSION, 0, 0);
  extension.add(grip);
  extension.userData.rest = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-1, -0.13, 0.02).normalize());
  extension.quaternion.copy(extension.userData.rest);
  tiller.add(extension);
  pivot.add(tiller);
  g.add(pivot);

  return { group: g, pivot, tiller, extension };
}

function mastStep(M, frame) {
  const g = new THREE.Group();
  g.name = 'Mast step';
  const step = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.02, 20), M.black);
  step.position.copy(frame.base).add(new THREE.Vector3(0, -0.01, 0));
  g.add(step);
  return g;
}

/** Ratchet block on the centre thwart; the mainsheet comes down to it. */
function ratchetBlock(M) {
  const g = new THREE.Group();
  g.name = 'Mainsheet ratchet block';
  const x = (SPEC.centreThwart[0] + SPEC.centreThwart[1]) / 2;
  const y = CENTRE_THWART_TOP();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.012, 18), M.black);
  base.position.set(x, y + 0.006, 0);
  const swivel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 10), M.steel);
  swivel.position.set(x, y + 0.027, 0);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.05), M.black);
  shell.position.set(x, y + 0.075, 0);
  const sheave = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.034, 18), M.gold);
  sheave.rotation.z = Math.PI / 2;
  sheave.position.set(x, y + 0.078, 0);
  g.add(base, swivel, shell, sheave);
  return { group: g, top: new THREE.Vector3(x, y + 0.11, 0) };
}

/* ------------------------------------------------------------------ *
 * the boat
 * ------------------------------------------------------------------ */

/**
 * Build the whole Optimist.  Returns { group, rig, rudder, board, ... }
 * so the scene can animate the moving parts.  `cleatLocal` is where the
 * mainsheet ends, on the ratchet block, in boat coordinates.
 */
export function createBoat(M = makeMaterials()) {
  const boat = new THREE.Group();
  boat.name = 'Optimist dinghy';

  boat.add(hullAndMouldings(M));
  const db = daggerboard(M);
  boat.add(db.group);
  boat.add(buoyancy(M));
  boat.add(hikingStraps(M));
  const rud = rudderAssembly(M);
  boat.add(rud.group);
  const ratchet = ratchetBlock(M);
  boat.add(ratchet.group);

  // ---- rig: mast through the thwart, stepped on the floor ----------
  const frame = mastFrame(floorY(SPEC.mastFromBow) + 0.01);
  const corners = rigCorners();
  const rig = createRig(corners, frame);
  rig.group.position.copy(frame.tack);
  rig.group.rotation.z = -frame.rake;
  boat.add(rig.group);
  boat.add(mastStep(M, frame));

  return {
    group: boat, rig, rudder: rud, board: db.board,
    cleatLocal: ratchet.top, frame, corners, materials: M,
  };
}
