# Sail artwork after the class drawing; wind direction, heading, ±180° boom, turntable

Date: 2026-11-03 14:22

## What changed

1. **Sail artwork, after `init_assets/S-OD_Optimist_R6_Mainsail_416x.webp`**
   (`model/opti-rig.js`):
   - Blue class insignia (ring with an upright stroke) high in the sail.
   - Blue national letters over the sail number, right-aligned a fixed
     distance in from the leech, as in the drawing.
   - Crosscut panels above and radial panels fanning from the clew.
   - One batten in the upper leech, replacing the earlier set.
   - Two red tell-tales near the mast (a dot and a short yarn).
   - A clear, semi-transparent window above the foot, cut out of the
     texture's alpha.
   - The sailmaker's logo in the drawing is left out, because it is a brand.
   - The new exports `BATTENS`, `INSIGNIA`, `TELLTALES` and `WINDOW` drive
     both the painting and the part labels.
2. **Wind direction** in degrees: the "Wind from" slider (0–359). The 3D
   arrow moves round the compass and its label reads e.g. `WIND 090° E`.
3. **Boat heading** in degrees: the "Heading" slider (0–359). The boat sits
   in a new `Heading` group that turns about her midship, so she stays
   centred on the compass rose. Sea motion samples the waves along her
   actual heading.
4. **Mainsheet as a boom angle, −180°…+180°.**
   - 0° is the boom on the centreline, + is to starboard and − to port.
   - The slider, the drag (now all the way round) and auto sail all set
     `state.boom`.
   - `state.sheet` remains as a 0..1 port-ease getter/setter, so the
     scripts and `.tools/export-glb.mjs --sheet` still work.
   - `updateRig` takes `boomDeg`; `boomOut` still works.
5. **Sail physics** (`sailTrim()` in `viewer.js`):
   - The model works out the true and apparent wind for the course.
   - **Auto sail** sets the boom to leeward at an angle chosen for the
     apparent wind angle. It gybes across, with the boom swinging at a
     limited rate.
   - The cloth fills on the side the wind pushes it. In irons it luffs and
     flutters, and when aback it bellies the other way. This uses the new
     `fill`, `side` and `flutter` inputs on `sailGeometry`/`updateRig`.
   - Heel and boat speed follow the force on the sail.
   - The masthead vane shows the apparent wind.
   - The readout shows the wind, heading, TWA (port/stbd), boom angle, heel
     and speed.
6. **Turntable fixed.** It used to add to `boat.group.rotation.y`, which the
   float code overwrote every frame, so nothing turned. It now turns the
   heading at 15°/s, and the sliders follow.
7. **Camera presets** turn with the heading. When the wind is over port,
   Quarter, Windward, Leeward and Sail swap sides.
8. **Port/starboard naming corrected.** +Z in the boat frame is geometrically
   **port**; the comments and README had it as starboard.
   - Comments in the model files and the README are fixed.
   - The node names `Side bag`, `Floor pad` and `Hiking strap` (port/stbd)
     are swapped to match.
   - The sprit (`SPRIT_SIDE = -1`) is therefore on the starboard face, the
     boat's right side, as originally asked.
9. **Fixes found while verifying:**
   - The sail material needs `forceSinglePass`. Otherwise three.js draws the
     transparent double-sided cloth in two passes with the winding flipped,
     and each side shows the other side's (mirrored) artwork.
   - Range sliders get `min-width: 0` so the outputs are no longer clipped.
   - The panel scrolls when it is taller than the window.
10. **Part labels:** Batten, Optimist insignia, Tell-tales, Window and Wind
    indicator are anchored on the actual artwork and parts (25 labels).

## Verified (headless renders)

- Both faces: the marks read correctly from each side, the window shows the
  sea through it, and the tell-tales sit by the mast.
- Heading 045° with wind from N: TWA 45° port, boom 15° S, heel to starboard.
- The turntable moves the heading 270° → 302° over 40 frames.
- In irons (heading 090°, wind 090°): the boom centres, the sail luffs, and
  speed is 0.
- Boom at 179° (over the bow) and 70° S (aback): the sail flips side, and
  speed is 0.
- Part labels land on their parts. No page errors.
- `.tools/export-glb.mjs` still exports (2.5 MB).

## Files

- `model/opti-rig.js`
- `model/opti-boat.js`
- `model/opti-hull.js`
- `model/opti-core.js`
- `viewer.js`
- `index.html`
- `README.md`

Not committed.
