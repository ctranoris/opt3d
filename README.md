# Optimist dinghy — 3D model and viewer

A dimensionally-accurate 3D model of an **Optimist** sailing dinghy — the
single-handed sprit-rig training dinghy that most of the world learns to sail
in — together with a browser scene for looking at it and a way to take the
model into other applications.

The hull is **lofted parametrically from the class dimensions**, not sculpted
by hand: a table of cross-section stations is interpolated and swept, so the
shape is driven by numbers that can be checked against the plan. The sail is
rebuilt from its four corners every time you change the trim, so it sheets in
and out as real cloth would rather than being a rigid prop that rotates.

LOA 2.30 m · beam 1.13 m · sail area 2.6 m² · sprit rig.

---

## Quick start

The page uses ES modules, so it needs a local web server — opening
`index.html` straight off disk will fail on module security rules. From this
folder:

```bash
python3 -m http.server 8137
# then open http://127.0.0.1:8137/index.html
```

Any static server works (`npx serve`, `php -S`, nginx). There is no build
step and no `npm install`: three.js r169 is vendored in `lib/`, so the page
runs offline with nothing fetched from a CDN.

---

## Where the model lives

**The model is code, not a mesh file.** `model/` generates it at load time:

| file | what it holds |
|------|---------------|
| `model/opti-core.js` | `SPEC` — every class dimension in metres — plus the lofting maths (`loft`, `merge`, `fan`, `toGeometry`) and the section tables |
| `model/opti-hull.js` | the hull shell, decks, coaming, air bags, and the spar/plate/tube primitives |
| `model/opti-rig.js` | mast, boom, sprit, the sail surface, the sail texture, and the trim solve |
| `model/opti-boat.js` | assembles everything into one `THREE.Group`, plus materials and the cockpit furniture |

The entry point is **`createBoat()`** in `model/opti-boat.js`, which returns
the boat as a `THREE.Group` ready to add to a scene:

```js
import { createBoat, makeMaterials } from './model/opti-boat.js';
const boat = createBoat(makeMaterials());
scene.add(boat.group);
```

`boat.group` is the whole boat. `boat.rig` is the rig, and `updateRig()` /
`updateMainsheet()` re-trim it — see [As a three.js
module](#as-a-threejs-module).

There is a file called `Opti Model.stl` in this folder. **That is reference
input, not the model** — it came with the source material and is not what the
viewer renders.

`model/opti-geometry.js` is an earlier draft of the lofting, superseded by the
`opti-core` / `opti-hull` split. Nothing imports it, and it carries its own
copy of `SPEC` — so if you are editing dimensions, edit `opti-core.js` and not
that one.

### Getting a mesh file out

Press **Download .glb** in the viewer. That exports the boat as a binary
glTF 2.0 file (~1.1 MB), upright on its baseline rather than floating and
heeled.

For scripting, the same export runs headless:

```bash
(cd .tools && npm install)               # once - puppeteer
python3 -m http.server 8137 &            # the page needs a server
node .tools/export-glb.mjs optimist.glb
node .tools/export-glb.mjs eased.glb --sheet 0.85
```

Run from the repo root; the script finds puppeteer in `.tools/node_modules`
and writes the file wherever you point it.

Note that `--sheet` is the **eased fraction**, not the slider's percentage:
`0` is the boom on the centreline and `1` is eased hard over, so `--sheet
0.85` is the opposite of what the viewer's "85%" reads as. The default is the
viewer's opening trim, 0.35.

---

## Using the model in other applications

### glTF (.glb) — the route that works everywhere

`.glb` is the interchange format here, and it is the one to reach for. What
survives the trip:

- **Named parts.** 35 of the 71 nodes carry a name, and they are the ones you
  would look for: `Hull`, `Foredeck`, `Aft tank`, `Side deck (stbd)`,
  `Cockpit coaming`, `Buoyancy bags`, `Hiking straps (stbd)`, `Centreboard
  case`, `Centreboard`, `Rudder`, `Rudder pivot`, `Tiller`, `Mainsheet cleat`,
  `Mast`, `Boom`, `Sprit`, `Sail`, `Mainsheet`, `Rig`. The unnamed 36 are all
  sub-meshes under one of those — the four bags under `Buoyancy bags`, the
  three webbing loops under each `Hiking straps`, the panels and lid of the
  `Centreboard case` — so nothing is orphaned in the outliner.
- **All 15 materials, named** — `hull`, `ply`, `plyDark`, `black`, `steel`,
  `bag`, `board`, `rubber`, `spar-wood`, `spar-carbon`, `rig-fitting`,
  `rig-hardware`, `block-sheave`, `sail-cloth`, `mainsheet-rope`.
- **Vertex colours** on the hull and the five deck meshes. The hull is one
  watertight mesh whose colour says white gelcoat outside and plywood inside,
  so it reads correctly with no textures at all.
- **One texture**, the sail cloth: class insignia, sail number, panel seams,
  batten pockets and tell-tales.
- **Double-sided flags**, and clearcoat on the hull and sheen on the cloth,
  written as the standard `KHR_materials_clearcoat` and `KHR_materials_sheen`
  extensions.

Units are **metres**, origin at the bow on the baseline.

```
+X aft   (bow at x = 0, transom at x = 2.30)
+Y up    (y = 0 is the baseline / keel line)
+Z to starboard
```

**Import notes.**

- **Blender** — *File → Import → glTF 2.0 (.glb/.gltf)*. Nothing special to
  set. The clearcoat and sheen extensions are supported by the current
  official importer; an older one will drop them and the hull reads as plain
  glossy plastic, which is close enough not to matter.
- **Unity / Unreal** — drop the `.glb` in; both convert to their native asset
  format on import. Check the double-sided flag survived: the cloth is one
  surface seen from both sides, and the `doubleSided` flag is set in the file,
  but an engine that ignores it will cull the back of the sail.
- **Meshlab / CloudCompare / slicers** — these read glTF less happily. If you
  need STL, open the `.glb` in Blender and export from there, so the mesh
  stays watertight and the vertex colours are baked to a texture first.

#### What does *not* survive

- **The export is a static snapshot of one trim.** The sail's shape, the boom
  angle and the sheet are solved live in the viewer, so a `.glb` has whatever
  trim it was exported at — export twice at different `--sheet` values if you
  need both ends of the range.
- **The sail reads mirrored from behind.** In the viewer, a small
  `onBeforeCompile` shader patch flips the cloth's UV on back faces, so the
  insignia and sail number read correctly from either side. That patch is
  three.js shader code rather than data, so it cannot travel: in another
  application the back face of the cloth shows the artwork mirror-imaged. If
  that matters, give the sail a second material with a pre-mirrored texture on
  export, or accept it — a real sail number is applied to read from both
  sides, so the mirrored face is the less faithful option either way.
- **The water is not part of the model.** The shader sea is scene dressing.

### As a three.js module

If your project already uses three.js, skip the export and import the
generator — you keep the live rig:

```js
// note: as shipped the model modules pull in their own copy of three from
// lib/ - point them at your own first, or you end up with two of them
import * as THREE from 'three';
import { createBoat, makeMaterials } from './model/opti-boat.js';
import { updateRig, updateMainsheet } from './model/opti-rig.js';

const boat = createBoat(makeMaterials());
scene.add(boat.group);

// boomOut: 0 = boom on the centreline, 1 = eased hard over
updateRig(boat.rig, { boomOut: 0.3, camber: 1, wind: 0.5 });

// the mainsheet is a child of the raked rig group, so the cleat - which
// `createBoat` reports in the boat frame - has to be re-expressed in the
// rig's frame before the line can be strung to it
boat.group.updateMatrixWorld(true);
const toRig = new THREE.Matrix4().copy(boat.rig.group.matrix).invert();
updateMainsheet(boat.rig, boat.cleatLocal.clone().applyMatrix4(toRig));
```

`updateRig()` rebuilds the sail geometry for the trim you ask for: camber,
twist, leech hollow and luff sag all follow from `boomOut` and `wind`, so
sheeting in deepens the sail and hooks the leech in, and easing lets the top
twist off. `boat.cleatLocal` is where the mainsheet cleat sits; `boat.rudder`
and `boat.board` are the two other moving assemblies.

**One thing to know before you copy the folder into a project.** The model
modules import three.js by **relative path** — `import * as THREE from
'../lib/three.module.js'` — so they work in this repo with no bundler and no
install. `viewer.js`, on the other hand, uses the bare specifier `'three'`
plus the importmap in `index.html`. If you want the bare-specifier style
throughout (a bundler, or npm-installed three), change the one import line in
each of `opti-hull.js`, `opti-rig.js` and `opti-boat.js`; if you want the
relative style in your own page, add an importmap entry for `'three'` pointing
at the copy in `lib/`.

### Other engines

There is no first-class exporter for USD, FBX or OBJ. Go through the `.glb`:
Blender will write all three from it, and the part and material names carry
through a Blender round trip.

---

## The viewer

`index.html` + `viewer.js`. Beyond the boat: a procedural sky feeding
image-based lighting, a custom shader sea (four summed sine waves with
analytic normals, fresnel, sun glitter, distance haze), soft shadows, and
seven camera presets.

**Controls**

| | |
|---|---|
| **Mainsheet** | sheet the sail. 100% = boom on the centreline, 0% = eased hard over |
| **Wind** | breeze strength — drives heel, sail load and luff sag |
| **Draft** | how deep the sail is foiled |
| **Auto sail** | sheets her in and out on its own |
| **Sea motion** | float her on the waves |
| **Part labels** | name 20 parts with leader lines |
| **Wireframe / Water / Turntable** | as they say |

**Drag the sail sideways** in the viewport to sheet it. Orbit with the left
button, zoom with the wheel.

The boom eases to **starboard**, so the wind is shown coming over the port
side. That makes **Quarter** (the default) and **Windward** both port-side
views, and **Leeward** the starboard one — they show opposite faces of the
cloth. Worth knowing if you export from one of them: the artwork is mirrored
on the back face of a `.glb` (see [What does not
survive](#what-does-not-survive)), so check the sail from both sides after
import. **Plan** is the preset for judging set-up — foot fore-and-aft, sprit
angle, how far the boom is eased.

---

## Reference material in this folder

What the model was built against:

- `SBM125-Optimist-OriginalPlanRedrawn-web.jpg` — the redrawn SBM plan; the
  source of the hull station tables
- `Parts_of_the_Optimist.png` — parts diagram, used for furniture placement
- `Optimist_dinghy.png`, `images.jpg`, `aa699154995f7a28d5fbfc6f6e7c7088.jpg`
  — photographs for reference
- `Opti Model.stl` — reference only, see above
- `tools/` — the plan images with measurement grids overlaid, used to read
  offsets off the plan
- `build/` — rendered screenshots from the verification runs

---

## Development

```bash
python3 -m http.server 8137
```

Verification scripts live in `.tools/` and drive headless Chrome
(SwiftShader), so they need `npm install` in `.tools/` once:

| script | what it does |
|--------|--------------|
| `.tools/shot.js` | screenshots every camera preset and trim state, captures console errors |
| `.tools/export-glb.mjs` | headless `.glb` export |
| `.tools/inspect.mjs` | geometry audit — degenerate triangles and bounds per mesh |
| `.tools/parts.js` | hides one named part and screenshots, for identifying geometry |
| `.tools/xray.js` | renders with the sail hidden, to inspect the spars |

`shot.js` waits on camera-position stability and rendered frames rather than
fixed delays, because software GL runs at a few frames a second and the
camera fly-to is eased inside the render loop.

`.changelog/` records what was done, newest first, with `index.md` as the
entry point.

---

## Known limitations

- **The leech figure is unconfirmed.** `SPEC.leech` records 2.59 m ("8'-6"",
  peak → corner), but the straight-line distance between the two corners the
  model solves is 1.717 m. The corners themselves check out: the foot measures
  1.930 m and head→peak 1.220 m, both against `SPEC`, and the peak lands 2.175
  m above the baseline. So the class figure is almost certainly measured along
  the cloth with the sprit laced to it rather than straight between corners —
  but check it against the class rules before treating either number as
  authoritative.
- **The sail is a parametric approximation**, not a cloth simulation. It
  reads correctly for trim and it flattens where the sprit presses it, but
  there is no flutter, no luffing oscillation, and no interaction with
  apparent wind.
- **One mainsheet cleat.** Real Optis carry one each side; the model shows
  the working starboard one.
- **No foils in the water** — the centreboard and rudder are modelled, but
  there is no hydrodynamics. The heel and leeway you see are dressed for
  looks from the wind and trim sliders, not solved.
