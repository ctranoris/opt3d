# Race course, fleet, clouds and keyboard steering

Date: 2026-11-03 15:50

## What changed

1. **Race course** (new `race-course.js`, "Race course" checkbox, optional):
   - The **start line** runs between two orange buoys with staffs and orange
     flags, with a dashed white line on the water. It is 24 m long and lies
     12 m upwind of the boat.
   - **Five yellow turning marks** have their number printed round the
     sides (four times, so it reads from anywhere) and ride the swell.
   - The **finish line** runs between two blue buoys with blue flags, with
     a dashed blue line. It is square to the last leg.
   - The flags stream downwind and flap harder in more wind.
   - The course is laid relative to the wind: a windward leg, then reach,
     run, beam reach, beat, and a broad reach home. "Re-lay course" lays it
     again for the present wind and position and restarts the race.
   - Everything is fixed to the moving water (a "Sea frame" group at minus
     the odometer), so the marks drift past as she sails.
2. **The race:**
   - Crossing the start line upwind starts the clock.
   - A mark counts as rounded once you pass within 7 m of it, in order. The
     next one has a pulsing green ring.
   - Crossing the finish line ends the race.
   - A HUD at the top shows the next mark, its distance and bearing, the
     time, the leg progress (1–5, F) and the best time.
3. **Keyboard steering:** ← / → (or A / D) turn the bow at 40°/s. The
   camera swings round with her.
4. **Fleet** (new `fleet.js`, "Fleet" checkbox, optional; it turns the
   course on):
   - Four more Optimists (ITA 2471, ESP 3305, USA 1888, GBR 5120) start on
     the line and race round the marks.
   - They use the same sailing model as the main boat: apparent wind, boom
     to leeward, fill, heel, and the speed polar.
   - The racing helm points at the next mark. When the mark is in the no-go
     zone it beats at 60° to the wind, which is about the best VMG for this
     polar. It tacks on the layline, sometimes tacks up the middle, and
     keeps going round after the finish.
   - In the water shader, each fleet boat has its own wake and the sea is
     masked out of its hull: new `uFleetInv[]` and `uFleetWake[]` uniforms.
     The shader code was refactored into `insideHull(b)`, `wakeShape(b, wake)`
     and `foamTexture()`.
5. **Clouds:** fair-weather cumulus painted into the sky texture, which
   also feeds the image-based lighting.
   - Value-noise fbm on a flat cloud deck, so the clouds crowd toward the
     horizon.
   - Sun-side lighting, grey bases, and haze far out.
6. **Sky orientation bug fixed.** The equirect sky texture had always been
   upside down and turned 180°: the visible sky was the grey "below the
   horizon" tint, and the painted sun sat under the sea. The texture now
   follows three.js's equirect convention. The background sun lines up
   with the directional light, and the environment lighting comes from
   the right hemisphere.
7. **Smaller changes:**
   - Distance fog (45–220 m) on the scene, matching the sea's own haze.
   - The camera can zoom out to 70 m to see the course.
   - JS `waveHeight()` applies the same distance fade as the shader, so
     distant buoys and boats sit on the surface.
   - The bow and stern wave samples in the float code were renamed to say
     which is which. Behaviour is unchanged.
   - README: controls table, a racing section with the course plan, and the
     fleet's helm.

## Verified (headless renders, puppeteer + SwiftShader)

- Overview, start-line close-up and fleet close-up: the flags stream
  downwind, the fleet boats are dry inside and leave wakes, and the marks
  are numbered.
- The race logic, driven by moving the boat:
  - pre-start → racing on crossing the line upwind;
  - marks 1 → 5 rounded in order;
  - finish → "Finished", with the best time recorded.
- The HUD and pulsing ring render on mark 1.
- After ~10 s the fleet boats beat on opposite tacks at 2.2–2.5 kn.
- Holding → turns the heading.
- The sky texture now has the blue sky and sun on top, with clouds.
- No page errors.

## Files

- `race-course.js` (new)
- `fleet.js` (new)
- `viewer.js`
- `index.html`
- `README.md`

Not committed.
