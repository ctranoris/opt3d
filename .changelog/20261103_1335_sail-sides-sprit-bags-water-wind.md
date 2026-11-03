# Sail faces, sprit side, orange bags, dry hull, compass and wind

Date: 2026-11-03 13:35

## What changed

1. **Sail marks in proportion.** The sail UVs are now a uniform planar
   projection of the flat sail in metres (`sailUV`), replacing the
   corner-parametric mapping that sheared the letters. The marks are sized
   in metres: letters 230 mm, number 300 mm, insignia radius 125 mm.
2. **Battens from both sides.** The cloth texture is now 2048×1024 and holds
   both faces. The left half is the starboard face. The right half is the port
   face, where only the printed marks are mirrored about their own centres.
   The shader adds 0.5 to u on the front (port) face. This replaces the old
   `u = 1 - u` flip, which also mirrored the battens and seams.
3. **Tell-tales from both sides.** They are fixed the same way, painted at
   the same physical position on both halves.
4. **Sprit on the port face** (`SPRIT_SIDE = -1` in `model/opti-rig.js`;
   set it to `+1` to flip). The cloth-contact dent follows the side. The
   snotter is lowered from 0.55 m to 0.40 m above the tack
   (`model/opti-core.js`).
5. **Orange buoyancy bags and stern bag** with black straps
   (`model/opti-hull.js`).
6. **No sea inside the boat.** The water fragment shader moves each point
   into the boat frame (`uBoatInv`, updated every frame) and discards it if
   it falls inside the hull. The hull is looked up in a 47-station table of
   sheer and bottom height and half-breadth (`uHull`).
7. **Compass and wind.** A new `scene-extras.js` adds a compass rose on the
   water round the boat, with N = −Z. The wind is now defined as coming
   from the north (`WIND_FROM_DEG = 0`). A 3D arrow upwind, labelled
   "WIND N", shows the flow with animated streaks. A "Compass & wind"
   checkbox toggles both, and the readout shows the wind direction and the
   boat's heading.
8. **Masthead wind indicator.** A rod and vane above the mast top, with a
   red pointer and fins. It turns to the apparent wind: the true wind minus
   the boat's way along her heading (`setWindVane`).

The README export notes are updated for the two-face texture and the new
scene dressing.

## Verified

- Headless renders from port and starboard: marks readable on both sides,
  battens and tell-tales at the leech on both sides, sprit on the port face,
  orange bags.
- Cockpit close-up: no water inside the hull.
- Wide view: compass and wind arrow show north. The vane points into the
  apparent wind (north-west for a west heading).
- `.tools/export-glb.mjs` still exports (2.5 MB).

## Files

- `model/opti-rig.js`
- `model/opti-core.js`
- `model/opti-hull.js`
- `viewer.js`
- `index.html`
- `scene-extras.js` (new)
- `README.md`

Not committed.
