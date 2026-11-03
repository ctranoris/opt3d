# Accurate model rebuild (clean slate)

**Date:** 2026-11-03 11:51

## Why
The gap analysis ([20261103_1126](20261103_1126_reference-gap-analysis.md)) showed
that the model was a decked cockpit boat with a ring bag. A real Optimist is an
open GRP hull with thwarts, three bags and V hiking straps. The user asked for
more accuracy and allowed a clean slate.

## What changed
- **`model/opti-core.js`, rewritten.** It has new `SPEC` values and new sheer,
  rocker and half-breadth tables taken from the SBM plan. The bow transom is a
  raked line blended into the rocker, and `halfSection(x, inset)` builds each
  section as sheer, side, bilge curve and flat bottom. `loft()` gained a `flip`
  option so that normals face the visible side; with reversed normals, the
  shadow bias was putting the interior in shadow.
- **`model/opti-hull.js`, rewritten.**
  - The hull has an outer gelcoat skin and an inner skin, with a rolled
    gunwale around the sheer.
  - The interior has a mast thwart and a centre thwart, a daggerboard case with
    a rounded front, two side bags and a stern bag with strap bands, and floor
    pads.
- **`model/opti-rig.js`.**
  - The corners are solved from luff 1.68, foot 1.93 (boom level),
    head-to-peak 1.22 and leech 2.67.
  - The sprit runs from a snotter 0.55 m up the mast.
  - The spars are aluminium, with a gooseneck, a mast heel and a snotter.
  - The mainsheet runs from the boom block through a bridle to the ratchet
    block.
- **`model/opti-boat.js`, rewritten.** It assembles the hull and mouldings, the
  daggerboard (case, blade and handle), the bags with valve tubes, the V hiking
  straps, a rudder and tiller (aluminium tiller with an extension), the mast
  step, and the ratchet block on the centre thwart.
- **`model/opti-geometry.js`, deleted.** It was the old unused draft.
- **`viewer.js`.** New camera presets, a wider shadow extent and 19 part labels
  re-anchored onto the new parts.
- **`.tools/shot.js` and `export-glb.mjs`** now honour a `CHROME` environment
  variable that points at a local Chrome.
- **README** brought up to date: the architecture, the GLB node and material
  names, the references now in `init_assets/`, and the limitations.

## Verified
- Sail area is about 3.15 m² and the sprit about 2.20 m. The peak sits about
  3.2 m above the baseline, the boom at 0.70 m and the clew at x = 2.25.
- The plan view matches the photo layout and the side view matches the class
  drawing (`build/shot_*.png`, `close_interior.png`, `close_side.png`,
  `shot_labels.png`).
- Normal-direction probes pass on every surface. The page shows no errors.
- `build/optimist.glb` exports cleanly: 1.45 MB, 67 nodes, 54 of them named.

## Remaining limitations
- The rig numbers come from the plan and photos, not the measurement rules.
- The thwarts have no plywood or fastening detail.
- The rudder outline is approximate.
- The aft face of the daggerboard case is dark under the thwart.
