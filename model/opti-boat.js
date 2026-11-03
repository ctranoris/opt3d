/**
 * Assembly: every part of an Optimist, positioned in the boat frame.
 *
 *   +X aft (bow at 0), +Y up, +Z starboard.  y = 0 is the baseline.
 */

import * as THREE from '../lib/three.module.js';
import {
  SPEC, range, cockpitHalf, sheerY, innerHalf, deckY,
} from './opti-core.js';
import {
  hullGeometry, foredeckGeometry, aftdeckGeometry, sideDeckGeometry,
  coamingGeometry, sparGeometry, plateGeometry, bagGeometry,
  airBagPath, crossBagPath, deckSurface,
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
      color: 0xffffff, vertexColors: true, roughness: 0.36, metalness: 0,
      clearcoat: 0.55, clearcoatRoughness: 0.28, side: THREE.DoubleSide,
    }),
    ply: new THREE.MeshStandardMaterial({
      color: 0xd9b98a, roughness: 0.72, metalness: 0, side: THREE.DoubleSide,
    }),
    plyDark: new THREE.MeshStandardMaterial({
      color: 0xa97a48, roughness: 0.7, metalness: 0, side: THREE.DoubleSide,
    }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.6 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xbcc0c6, roughness: 0.28, metalness: 0.85 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.7 }),
    bag: new THREE.MeshStandardMaterial({ color: 0xc8342b, roughness: 0.62 }),
    board: new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.45, side: THREE.DoubleSide }),
    rope: new THREE.MeshStandardMaterial({ color: 0xefe9d6, roughness: 0.95 }),
    rubber: new THREE.MeshStandardMaterial({
      color: 0x2a2a2e, roughness: 0.55, side: THREE.DoubleSide,
    }),
  };
  for (const k in m) m[k].name = k;
  return m;
}

/* ------------------------------------------------------------------ *
 * small parts
 * ------------------------------------------------------------------ */

function hikingStrap(M, side) {
  const g = new THREE.Group();
  g.name = side > 0 ? 'Hiking straps (stbd)' : 'Hiking straps (port)';
  // straps lie on the outboard edge of the side deck, against the inwale
  for (const x of [0.72, 1.12, 1.52]) {
    const c = cockpitHalf(x) || 0.35;
    const h = innerHalf(x, deckY(x)) - 0.005;
    const z = side * (h - 0.026);
    const y = deckSurface(x, z) + 0.004;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.006, 0.038), M.black);
    strap.position.set(x, y, z);
    strap.rotation.y = side * 0.10;
    g.add(strap);
  }
  return g;
}

function centreboardCase(M) {
  const g = new THREE.Group();
  g.name = 'Centreboard case';
  const [x0, x1, w] = SPEC.boardCase;
  const yTop = deckY(1.0) + 0.005;
  const yBot = 0.02;

  // sides
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(
      plateGeometry([[x0, yBot], [x1, yBot], [x1, yTop], [x0, yTop]], 0.012), M.ply);
    panel.position.z = side * (w / 2);
    g.add(panel);
  }
  // fore and aft bulkheads, as wide as the case and no wider
  for (const x of [x0, x1]) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, yTop - yBot, w), M.ply);
    panel.position.set(x, (yTop + yBot) / 2, 0);
    g.add(panel);
  }
  // lid
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(x1 - x0, 0.014, w + 0.024), M.ply);
  lid.position.set((x0 + x1) / 2, yTop + 0.007, 0);
  g.add(lid);

  // the board itself, in the up position it lives inside the case
  const board = new THREE.Group();
  board.name = 'Centreboard';
  const blade = new THREE.Mesh(
    plateGeometry([[0, 0], [0.26, 0], [0.24, -SPEC.boardDepth], [0.06, -SPEC.boardDepth]], 0.018),
    M.board);
  blade.name = 'Centreboard blade';
  blade.position.set(x0 + 0.02, yBot + 0.02, 0);
  board.add(blade);
  // handle poking above the lid
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.03), M.black);
  handle.position.set(x0 + 0.06, yTop + 0.06, 0);
  board.add(handle);
  g.add(board);
  return { group: g, board };
}

function rudderAssembly(M) {
  const g = new THREE.Group();
  g.name = 'Rudder';
  const xT = loa;

  // rudder head fitting on the gudgeons
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.10, 0.115), M.black);
  head.name = 'Rudder head';
  head.position.set(xT + 0.028, 0.455, 0);
  g.add(head);
  for (const z of [-0.05, 0.05]) {
    const gud = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.055, 0.014), M.steel);
    gud.position.set(xT + 0.008, 0.478, z);
    g.add(gud);
  }

  // blade: hangs from the head, pivoting about its leading edge
  const pivot = new THREE.Group();
  pivot.name = 'Rudder pivot';
  pivot.position.set(xT + 0.028, 0.42, 0);
  const blade = new THREE.Mesh(
    plateGeometry([[0, 0], [0.115, 0.02], [0.135, -0.30], [0.02, -0.34]], 0.016), M.board);
  blade.position.y = -0.01;
  pivot.add(blade);
  // tiller band and bar
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.10), M.steel);
  band.position.set(0.02, 0.015, 0);
  pivot.add(band);
  // The tiller is fixed to the rudder head and reaches forward into the
  // cockpit, so the helmsman can hold it from the side tank.
  const tiller = new THREE.Group();
  tiller.name = 'Tiller';
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.024, 0.030), M.plyDark);
  bar.position.set(-0.20, 0.058, 0);
  tiller.add(bar);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.11, 12), M.black);
  grip.rotation.z = Math.PI / 2;
  grip.position.set(-0.40, 0.062, 0);
  tiller.add(grip);
  tiller.rotation.z = 0.06;   // a slight sheer rise toward the inboard end
  pivot.add(tiller);
  g.add(pivot);

  return { group: g, pivot, tiller };
}

function mastStep(M, frame) {
  const g = new THREE.Group();
  g.name = 'Mast step';
  // mast step: a plywood pad on the foredeck where the mast lands
  const step = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.088, 0.022, 20), M.plyDark);
  step.position.copy(frame.base).add(new THREE.Vector3(0, 0.011, 0));
  g.add(step);
  return g;
}

function sheetSystem(M) {
  const g = new THREE.Group();
  g.name = 'Mainsheet cleat';
  // An Optimist has no traveller: the sheet simply falls off the boom
  // block to a cleat on the side tank.
  const cleat = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.05), M.black);
  const horn1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.075, 10), M.black);
  horn1.rotation.z = Math.PI / 2;
  horn1.rotation.y = 0.5;
  horn1.position.y = 0.03;
  const horn2 = horn1.clone();
  horn2.rotation.y = -0.5;
  horn2.position.y = 0.055;
  cleat.add(base, horn1, horn2);
  // The boom eases to starboard, so the sheet falls straight down to the
  // starboard side tank.  Real Optis carry a cleat each side; the model
  // shows the working one.
  const x = 1.62, c = cockpitHalf(x) || 0.38;
  cleat.position.set(x, deckSurface(x, c) + 0.008, c + 0.055);
  cleat.rotation.y = Math.PI - 0.35;
  g.add(cleat);

  return { group: g, cleatPos: cleat.position.clone() };
}

function bags(M) {
  const g = new THREE.Group();
  g.name = 'Buoyancy bags';
  for (const side of [-1, 1]) {
    const bag = new THREE.Mesh(bagGeometry(airBagPath(side), 0.048), M.bag);
    bag.castShadow = true;
    g.add(bag);
  }
  for (const [x, r] of [[0.60, 0.05], [1.86, 0.05]]) {
    const bag = new THREE.Mesh(bagGeometry(crossBagPath(x, r), r), M.bag);
    bag.castShadow = true;
    g.add(bag);
  }
  // buoyancy bag under the foredeck, visible through the hatch
  return g;
}

function bowHandleAndGrab(M) {
  const g = new THREE.Group();
  g.name = 'Handles and grab rail';
  // bow handle
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.10, 0.335, -0.055),
    new THREE.Vector3(0.055, 0.40, -0.03),
    new THREE.Vector3(0.055, 0.40, 0.03),
    new THREE.Vector3(0.10, 0.335, 0.055),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.012, 10, false), M.black);
  g.add(handle);

  // stern grab rail
  const y = sheerY(loa) + 0.02;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 12), M.black);
  rail.rotation.x = Math.PI / 2;
  rail.position.set(loa - 0.02, y + 0.055, 0);
  g.add(rail);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.075, 10), M.black);
    post.position.set(loa - 0.02, y + 0.02, side * 0.44);
    g.add(post);
  }
  return g;
}

function hullFittings(M) {
  const g = new THREE.Group();
  g.name = 'Rubbing strake and drain';
  // rubbing strake: a thin dark strip just below the inwale
  const xs = range(0.02, loa - 0.01, 90);
  const pos = [], idx = [];
  const h = 0.016;
  for (let i = 0; i < xs.length; i++) {
    for (const side of [-1, 1]) {
      const yTop = sheerY(xs[i]) - 0.004;
      const yBot = yTop - h;
      pos.push(xs[i], yTop, side * (innerHalf(xs[i], yTop) + 0.002));
      pos.push(xs[i], yBot, side * (innerHalf(xs[i], yBot) + 0.002));
    }
  }
  for (let i = 0; i < xs.length - 1; i++) {
    const a = i * 4;
    // starboard pair 0,1 ; port pair 2,3
    idx.push(a + 0, a + 1, a + 4, a + 4, a + 1, a + 5);
    idx.push(a + 2, a + 6, a + 3, a + 3, a + 6, a + 7);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const strake = new THREE.Mesh(geo, M.rubber);
  g.add(strake);

  // drain hole in the transom
  const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 14), M.black);
  drain.rotation.z = Math.PI / 2;
  drain.position.set(loa - 0.005, 0.06, 0.20);
  g.add(drain);
  return g;
}

/* ------------------------------------------------------------------ *
 * the boat
 * ------------------------------------------------------------------ */

/**
 * Build the whole Optimist.  Returns { group, rig, rudder, board, ... }
 * so the scene can animate the moving parts.
 */
export function createBoat(M = makeMaterials()) {
  const boat = new THREE.Group();
  boat.name = 'Optimist dinghy';

  // ---- hull and decks ---------------------------------------------
  const hull = new THREE.Mesh(hullGeometry(), M.hull);
  hull.name = 'Hull';
  hull.castShadow = true;
  hull.receiveShadow = true;
  boat.add(hull);

  const deckNames = ['Foredeck', 'Aft tank', 'Side deck (stbd)',
    'Side deck (port)', 'Cockpit coaming'];
  for (const [gi, g] of [foredeckGeometry(), aftdeckGeometry(),
    sideDeckGeometry(1), sideDeckGeometry(-1), coamingGeometry()].entries()) {
    const m = new THREE.Mesh(g, M.ply);
    m.name = deckNames[gi];
    m.receiveShadow = true;
    boat.add(m);
  }

  // ---- furniture ---------------------------------------------------
  boat.add(bags(M));
  boat.add(hikingStrap(M, 1));
  boat.add(hikingStrap(M, -1));
  const cb = centreboardCase(M);
  boat.add(cb.group);
  const rud = rudderAssembly(M);
  boat.add(rud.group);
  const sheets = sheetSystem(M);
  boat.add(sheets.group);
  boat.add(bowHandleAndGrab(M));
  boat.add(hullFittings(M));

  // ---- rig ---------------------------------------------------------
  const frame = mastFrame(deckSurface(SPEC.mastFromBow, 0) + 0.022);
  const corners = rigCorners();
  const rig = createRig(corners, frame);
  rig.group.position.copy(frame.tack);
  rig.group.rotation.z = -frame.rake;
  boat.add(rig.group);
  boat.add(mastStep(M, frame));

  return {
    group: boat, rig, rudder: rud, board: cb.board,
    cleatLocal: sheets.cleatPos, frame, corners, materials: M,
  };
}
