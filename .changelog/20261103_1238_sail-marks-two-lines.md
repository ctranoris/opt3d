# Sail marks: national letters over the sail number, editable

**Date:** 2026-11-03 12:38 (+0200)

## What changed

The single "1" on the sail is replaced by the two lines the class rules
actually use: the national letters on top (`GRE`) and the sail number below
(`1062`), both editable from the control panel and both reading correctly
from either side of the cloth.

### `model/opti-rig.js`

- `SAIL_MARKS` holds the printed marks: `{ country: 'GRE', number: '1062' }`.
- `sailTexture(marks)` takes the marks and paints them. A new
  `drawMarkLine()` helper draws one centred line and shrinks the font until
  the text fits its allotted width, so a six-digit number stays clear of the
  batten pockets instead of running under them.
- The two lines sit at `u = 0.38` — forward of the battens and below the
  sprit's trace, which crosses this part of the sail at about
  `v = 0.65 + 0.45u`. Country baseline `v = 0.53`, number baseline `v = 0.385`.
- `setSailMarks(rig, marks)` repaints the cloth live: it merges the given
  marks into `SAIL_MARKS`, builds a fresh `CanvasTexture`, swaps it onto
  `sailMat`, and disposes the old one. An empty string drops that line.
- **Fixed a pre-existing mirror bug.** The `onBeforeCompile` patch mirrored
  the texture on the *back* face (`!gl_FrontFacing`). By the sail grid's
  winding the front face is the windward one, and seen from ahead of the luff
  its `u` axis runs aft-to-fore across the screen — so it was the *front*
  face that needed the flip. The old test was backwards: the windward side
  read mirror-imaged and the leeward side read straight. Now `gl_FrontFacing`
  flips, so both faces read correctly.

### `index.html`

- Two text inputs in the Sail trim group: **Country** (maxlength 3) and
  **Sail no.** (maxlength 6), with a small `.txt` style matching the panel.

### `viewer.js`

- `bindUI()` wires both inputs to `setSailMarks()` on every keystroke.
  Country is upper-cased and filtered to `A–Z` (caret position preserved);
  the number is filtered to digits/letters/hyphen.

## Verification

Headless render (puppeteer-core + cached Chrome, swiftshader), Sail and
Leeward cameras:

- `GRE` / `1062` and `ITA` / `77` both read correctly from windward and
  leeward — no mirroring on either face.
- A six-digit `112233` auto-shrinks and stays clear of the battens.
- Lowercase `ita` typed into the field comes back as `ITA`.
- No console errors or page errors.

## Note for the .glb export

The mirror is a three.js shader patch, not data, so it still cannot travel —
the README's "reads mirrored from behind" caveat is unchanged. The canvas
itself now carries the two-line marks, so an exported cloth shows them
mirror-imaged on its back face exactly as before.
