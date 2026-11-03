# Distant mountains

Date: 2026-11-03 17:00

## What changed

1. **Mountains on the horizon** (new `mountains.js`). There are three ridge
   lines on rings 650, 760 and 880 m out, with peaks of about 34, 62 and
   95 m, so the ranges rise a few degrees above the horizon.
   - Heights come from ridged noise sampled round the circle, so the ring
     has no seam.
   - A broad mask breaks the ranges up and leaves stretches of open sea
     horizon between them.
   - The colours are worked out per vertex:
     - rock is lighter on the slopes that face the sun;
     - the highest peaks of the far ridge carry snow;
     - each ridge is mixed toward the horizon colour, the far ones more, so
       they stand in layers of aerial perspective;
     - the foot of each ridge is the horizon colour itself, so it melts into
       the sea haze.
   - The material is unlit, ignores the scene fog and is not tone mapped,
     like the sky, so the haze matches the sky exactly.
   - The ring is fixed in the world like the sky and does not drift with
     the sea.
2. **Camera far plane** raised from 900 to 1200 m, so the far ridge isn't
   clipped when the camera is zoomed out.
3. **"Mountains" checkbox** in the panel, on by default. `OPTi.setMountains`
   and `OPTi.mountains` are exposed for tests.
4. **README:** a Mountains row has been added to the features table.

## Verified

- Headless renders were taken from the default camera, and from a low
  camera looking north, east, south and west. The ranges show in layers
  with gaps between them. The ones toward the sun are paler, and the feet
  blend into the sea haze.
- No page errors.

## Files

- `mountains.js` (new)
- `viewer.js`
- `index.html`
- `README.md`

Not committed.
