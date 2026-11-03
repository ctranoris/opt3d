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

LOA 2.30 m · beam 1.13 m · sail area ≈3.15 m² · sprit rig · open GRP hull.

The boat is modelled as the modern class boat: an open GRP hull with a rolled
gunwale, a mast thwart and a centre thwart, two side bags and a stern bag, V
hiking straps, a daggerboard case, aluminium spars, a snotter-tensioned
sprit, and a mainsheet run from a boom block through a bridle to a ratchet
block on the centre thwart.

---

## Quick start

The page uses ES modules, so it needs a local web server — opening
`index.html` straight off disk will fail on module security rules. From this
folder:

```bash
python3 -m http.server 8137      # or: npx serve -l 8137
# then open http://127.0.0.1:8137/index.html
```

Any static server works (`npx serve`, `php -S`, nginx, a ten-line Node
`http` server where there is no Python). There is no build
step and no `npm install`: three.js r169 is vendored in `lib/`, so the page
runs offline with nothing fetched from a CDN.

---

## Where the model lives

**The model is code, not a mesh file.** `model/` generates it at load time:

| file | what it holds |
|------|---------------|
| `model/opti-core.js` | `SPEC` — every class dimension in metres — the sheer, rocker and half-breadth tables, the section function `halfSection()`, and the lofting maths (`loft`, `merge`, `fan`, `toGeometry`) |
| `model/opti-hull.js` | the hull shell (outer and inner skins), gunwale, thwarts, daggerboard case, buoyancy bags, floor pads, and the spar/plate/tube/webbing primitives |
| `model/opti-rig.js` | mast, boom, sprit, snotter, the sail surface, the sail texture, the corner solve, and the mainsheet with bridle and blocks |
| `model/opti-boat.js` | assembles everything into one `THREE.Group`, plus materials, daggerboard, rudder and tiller, hiking straps and the ratchet block |

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

There is a file called `init_assets/Opti Model.stl`. **That is reference
input, not the model** — it came with the source material and is not what the
viewer renders. It was used as a plan of the interior layout (thwart, bag and
case positions).

### Getting a mesh file out

Press **Download .glb** in the viewer. That exports the boat as a binary
glTF 2.0 file (~1.4 MB), upright on its baseline rather than floating and
heeled.

For scripting, the same export runs headless:

```bash
(cd .tools && npm install)               # once - puppeteer
python3 -m http.server 8137 &            # the page needs a server
node .tools/export-glb.mjs optimist.glb
node .tools/export-glb.mjs eased.glb --sheet 0.85
```

Run from the repo root; the script finds puppeteer in `.tools/node_modules`
and writes the file wherever you point it. If puppeteer's bundled browser is
not installed, point it at a local Chrome with the `CHROME` environment
variable (`CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"`);
`shot.js` honours the same variable.

Note that `--sheet` is the **eased fraction** to port, not the viewer's
boom angle: `0` is the boom on the centreline and `1` is 74° out to port.
The viewer's own control is the signed boom angle (`state.boom`, degrees,
+ to starboard); `--sheet s` sets it to `-74·s`.

---

## Using the model in other applications

### glTF (.glb) — the route that works everywhere

`.glb` is the interchange format here, and it is the one to reach for. What
survives the trip:

- **Named parts.** 54 of the 67 nodes carry a name, and they are the ones you
  would look for: `Hull` (with `Hull shell`, `Gunwale`, `Mast thwart`,
  `Centre thwart`, floor pads, `Mast gate`, `Bow eye`, `Drain bung`),
  `Daggerboard case`, `Daggerboard`, `Buoyancy bags` (`Side bag (stbd)`,
  `Side bag (port)`, `Stern bag`), `Hiking straps`, `Rudder`, `Tiller`,
  `Tiller extension`, `Mainsheet ratchet block`, `Mast step`, and under `Rig`:
  `Mast`, `Boom`, `Sprit`, `Snotter`, `Gooseneck`, `Sail`, `Mainsheet bridle`,
  `Boom block`, `Mainsheet`. The unnamed ones are sub-meshes of those, so
  nothing is orphaned in the outliner.
- **Named materials** — `hull`, `moulding`, `bag`, `black`, `steel`,
  `board`, `tab`, `webbing`, `rope`, `tiller`, `gold`, `spar-aluminium`,
  `rig-fitting`, `rig-hardware`, `block-sheave`, `sail-cloth`,
  `mainsheet-rope`.
- **Vertex colours** on the hull, thwarts and bags. The hull is an outer
  white gelcoat skin plus an inner skin coloured grey on the sides and
  darker on the floor, so it reads correctly with no textures at all.
- **One texture**, the sail cloth after the class sail drawing: the blue
  class insignia high in the sail, national letters over the sail number
  set in from the leech, crosscut panels above radial panels from the clew,
  one leech batten, two tell-tales near the mast, and a clear window above
  the foot (cut out of the texture's alpha, so the material is transparent).
- **Double-sided flags**, and clearcoat on the hull and sheen on the cloth,
  written as the standard `KHR_materials_clearcoat` and `KHR_materials_sheen`
  extensions.

Units are **metres**, origin at the bow on the baseline.

```
+X aft   (bow at x = 0, transom at x = 2.30)
+Y up    (y = 0 is the baseline / keel line)
+Z to port      (so -Z is starboard)
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
- **The sail reads mirrored from the starboard side.** The cloth texture holds
  both faces side by side: the port (+Z) face on the left half, the
  starboard (-Z) face on the right, where the insignia, letters and number are pre-mirrored so
  they read correctly through the cloth while seams, battens and tell-tales
  stay where they physically are. In the viewer a small `onBeforeCompile`
  patch moves the starboard face onto the right half. That patch is shader code,
  not data, so it cannot travel: in another application both faces use the
  port half, and from starboard the marks read mirror-imaged (the battens and
  tell-tales are still in the right place).
- **The water is not part of the model.** The shader sea, the compass rose and the wind arrow are scene dressing; the masthead wind indicator is part of the rig and is exported, set to the wind at the time of export.

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

// the mainsheet is a child of the raked rig group, so the ratchet block - which
// `createBoat` reports in the boat frame - has to be re-expressed in the
// rig's frame before the line can be strung to it
boat.group.updateMatrixWorld(true);
const toRig = new THREE.Matrix4().copy(boat.rig.group.matrix).invert();
updateMainsheet(boat.rig, boat.cleatLocal.clone().applyMatrix4(toRig));
```

`updateRig()` rebuilds the sail geometry for the trim you ask for: camber,
twist, leech hollow and luff sag all follow from `boomOut` and `wind`, so
sheeting in deepens the sail and hooks the leech in, and easing lets the top
twist off. `boat.cleatLocal` is where the mainsheet ratchet block sits, on the
centre thwart; `boat.rudder`
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
| **Mainsheet** | boom angle, −180° to +180°: 0° on the centreline, + to starboard (S), − to port (P). Past ±90° the boom swings forward of the mast |
| **Wind from** | compass bearing the true wind blows from (0° = north); moves the wind arrow |
| **Heading** | compass course of the bow; turns the boat on the compass rose |
| **Wind** | breeze strength — drives heel, sail load and luff sag |
| **Draft** | how deep the sail is foiled |
| **Auto sail** | puts the boom out to leeward at the right angle for the wind, gybing across when the wind changes side |
| **Sea motion** | float her on the waves |
| **Part labels** | name 25 parts with leader lines |
| **Turntable** | slowly turns the boat's heading (15°/s); the sail trims itself if Auto sail is on |
| **Wireframe / Water / Compass & wind** | as they say |

**Drag the sail** in the viewport to swing the boom to any angle on either
side. Orbit with the left button, zoom with the wheel.

The sail responds to the wind: a small model works out the true and
apparent wind angles from the course, fills the cloth on the side the wind
pushes it (it luffs and flutters when the wind runs along it, as in irons,
and bellies the other way when aback), and sets the heel and boat speed from
the force on the sail. She makes way at that speed: the boat stays in the
middle of the compass rose and the sea moves past her (the waves and the
foam drift astern), with white water drawn in the water shader - a bow
wave, foam along her sides, churned water off the transom and the two arms
of the wake - all growing with her speed. The readout shows the wind, heading, true wind angle,
boom angle, heel and speed; the masthead vane points into the apparent wind.

By default the wind is from the north and she heads west, so it comes over
her **starboard** side and the boom is out to port. The **Quarter** (the
default), **Windward**, **Leeward** and **Sail** presets turn with her
heading and swap sides when the wind is over port, so Windward is always the
windward side. Windward and Leeward show opposite faces of the cloth. Worth knowing if you export from one of them: the artwork is mirrored
on the back face of a `.glb` (see [What does not
survive](#what-does-not-survive)), so check the sail from both sides after
import. **Plan** is the preset for judging set-up — foot fore-and-aft, sprit
angle, how far the boom is eased.

---

## Reference material

What the model was built against, all in `init_assets/`:

- `SBM125-Optimist-OriginalPlanRedrawn-web.jpg` — the redrawn SBM plan; the
  source of the sheer, rocker and half-breadth tables
- `Parts_of_the_Optimist.png` — parts diagram, used for naming and rig layout
- `Optimist_dinghy.png`, `Optimist_dinghy_02.png`, `opte_image_01.jpg`,
  `images.jpg`, `aa699154995f7a28d5fbfc6f6e7c7088.jpg` — photographs; the
  plan-view photo set the thwart, bag and strap layout
- `Opti Model.stl` — reference only, see above

Elsewhere:

- `tools/` — the plan images with measurement grids overlaid, and the small
  scripts used to read offsets off the plan and the STL
- `build/` — local output of the verification scripts (screenshots,
  `optimist.glb`); git-ignored, regenerate it with `.tools/`

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

- **Rig geometry is solved from four edges.** The sail's corners come from
  luff 1.68 m, foot 1.93 m (boom level), head→peak 1.22 m and leech 2.67 m.
  That puts the peak about 3.2 m above the baseline, the sprit at about
  2.20 m and the area at about 3.15 m². These are read off the class plan
  and photos, not taken from the measurement rules, so check them against
  the current class rules before using the model for anything dimensional.
- **Details still approximate**: the thwarts are plain mouldings with no
  plywood grain or fastenings, the rudder blade outline is traced from photos,
  and the aft face of the daggerboard case sits in deep shadow under the
  centre thwart.
- **The sail is a parametric approximation**, not a cloth simulation. It
  reads correctly for trim and it flattens where the sprit presses it, but
  there is no flutter, no luffing oscillation, and no interaction with
  apparent wind.
- **No foils in the water** — the daggerboard and rudder are modelled, but
  there is no hydrodynamics. The heel and leeway you see are dressed for
  looks from the wind and trim sliders, not solved.
