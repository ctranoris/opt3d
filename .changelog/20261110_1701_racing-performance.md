# Faster 3D when racing

2026-11-10 17:01

Request: improve the 3D performance when racing; it is a little slow on
the user's graphics card.

## What changed

- **`viewer.js`**
  - Graphics quality levels: rendering resolution x1 / 0.8 / 0.65 / 0.5,
    shadow map 2048 / 2048 / 1024 / none, fleet detail distances scaled
    to match.
  - **Auto** (default) watches the smoothed frame time: under about
    40 frames a second for 1.5 s it goes down a level; at 55 or better for
    8 s it goes back up. If a raise is followed by a drop within 15 s it
    does not try again for 3 minutes. The level Auto settled on and the
    chosen mode are kept in `localStorage`.
  - Sea shader: new `uFleetXZ` uniform; each pixel skips the hull and wake
    work for fleet boats more than 20 m away (before, every sea pixel did
    a matrix multiply and the hull and wake shapes for all twelve).
  - `OPTi.gfx`, `OPTi.setGfxMode`, `OPTi.setGfxLevel`, `OPTi.renderer` for
    testing.
- **`fleet.js`**
  - Fleet boats and sailors no longer cast shadows (the shadow map only
    covers the player's boat, but they were still being submitted to it).
  - `fleet.lod(camPos, k)`: per boat, 29 small parts hidden beyond 11 m
    from the camera and 23 medium ones beyond 26 m, with a little slack
    against flicker.
  - `updateRigs`: boats at detail level 1 rebuild sail, sheet and sailor
    every 2nd frame, level 2 every 4th, staggered.
- **`index.html`**: **Graphics** selector (Auto / Best / Balanced / Fast).
- **`README.md`**: the Graphics control and a note on the fleet savings.

## Checked

Headless Chrome with software GL, 640x400, fleet lined up at the start
(all twelve within 25 m):

- Draw calls 448 before; 391 on Best, 337 on Fast.
- Canvas 640x400 on Best, 320x200 on Fast (a quarter of the pixels).
- Auto, started from Best at about 4 frames a second, stepped down to the
  lowest level within 15 s.
- No console errors or warnings; `node .tools/fleet-race.js optimist 14`
  still finishes all twelve, no errors.

## Not done

- Real frame rates were not measured: the only GL available here is the
  software one. The gain on the user's card is not known.
- The step back up on Auto (needs a fast GPU) was not exercised.
- The sail geometry is still rebuilt (new buffers) every frame for the
  near boats; reusing the buffers is a further saving not taken.
- At the start line, with every boat close, the detail levels save little.
- Nothing committed.
