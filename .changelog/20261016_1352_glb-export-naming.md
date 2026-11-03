# Named the export, and a headless export script

The `.glb` came out of the viewer geometrically correct but with nothing in
its outliner: all 15 materials and all 71 nodes were unnamed, so anything
opened in Blender or Unity showed `Material.004` and `Mesh.031`. A model you
cannot navigate by name is not much use in another application, so this made
the export path worth documenting.

## Changes

- `model/opti-boat.js` — `makeMaterials()` now sets `.name` on every material
  in a loop over the keys, so a new material is named by construction rather
  than by remembering. Assemblies and their parts named too: `Hull`,
  `Foredeck`, `Aft tank`, `Side deck (stbd/port)`, `Cockpit coaming`,
  `Buoyancy bags`, `Hiking straps (stbd/port)`, `Centreboard case`,
  `Centreboard`, `Rudder`, `Rudder pivot`, `Tiller`, `Mainsheet cleat`,
  `Handles and grab rail`, `Rubbing strake and drain`, `Mast step`,
  `Optimist dinghy`. The decks loop needed restructuring to
  `for (const [gi, g] of [...].entries())` with a `deckNames` array, since it
  previously built five geometries positionally with no name to hang on them.
- `model/opti-rig.js` — same for the rig: `Rig`, `Boom pivot`, `Mast`,
  `Masthead truck`, `Gooseneck`, `Boom`, `Boom end`, `Sprit`, `Sprit tip`,
  `Sail`, `Tack fitting`, `Head fitting`, `Boom block`, `Mainsheet`, and
  materials `spar-wood`, `spar-carbon`, `rig-fitting`, `rig-hardware`,
  `block-sheave`, `sail-cloth`, `mainsheet-rope`.
- `.tools/export-glb.mjs` (new) — headless export for scripting. Loads the
  real page and runs the same `GLTFExporter` with the same options as the
  button, so the two cannot drift apart. Resets the boat upright on the
  baseline before parsing and restores the pose after, so the mesh is the pose
  asked for rather than wherever the sea had left it.
  `node .tools/export-glb.mjs out.glb [--sheet 0..1] [--camber 0..1]`.

## Verified

Re-exported and parsed the GLB chunks directly:

```
wrote optimist.glb (1116756 bytes)
nodes 71 (35 named, 36 unnamed)   meshes 53   materials 15 (all named)
images 1   textures 1   COLOR_0 on Hull + the 5 deck meshes
extensionsUsed: KHR_materials_clearcoat, KHR_materials_sheen
```

Two things I checked rather than assumed, both of which contradicted what I
had expected to write:

- **The unnamed 36 are not orphans.** Every one sits under a named assembly —
  the four bags under `Buoyancy bags`, the three loops under each `Hiking
  straps`, the panels and lid of the `Centreboard case`.
- **Clearcoat and sheen do survive**, as standard `KHR_materials_clearcoat`
  and `KHR_materials_sheen` extensions, and `doubleSided` is set on the cloth.
  I had been about to document them as losses.

What genuinely does not survive is the sail's back-face UV mirror: that is an
`onBeforeCompile` shader patch, code rather than data, so the artwork reads
mirror-imaged on the back face after export.

Regression: viewer boots with `errors: none`, `sailTris 1560`, labels clean
across quarter / windward / top / stern.
