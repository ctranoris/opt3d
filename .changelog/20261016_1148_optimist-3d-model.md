# Optimist dinghy — parametric 3D model

Built a dimensionally-accurate Optimist from the reference plans in the repo
root (`SBM125-Optimist-OriginalPlanRedrawn-web.jpg`, the parts diagram, the
STL). The hull is lofted parametrically rather than sculpted, so it stays
true to the class dimensions.

## What was made

- `model/opti-core.js` — the class dimensions (`SPEC`) and the lofting maths:
  Catmull-Rom station tables, `halfWidth`, `innerHalf`, `sheerY`, `deckY`,
  `cockpitHalf`, plus `loft`/`merge`/`fan`/`toGeometry` mesh helpers.
- `model/opti-hull.js` — the shell as one closed ring per station (outside
  skin down from the inwale, across the bottom, up the other side, home along
  the inside skin), so the hull is a single watertight mesh with real gunwale
  thickness and per-vertex colour: white gelcoat outside, plywood inside. Also
  the decks, coaming, side air bags, and the spar/bag/plate primitives.
- `model/opti-boat.js` — assembly of the hull, cockpit furniture, centreboard
  case, rudder + tiller, sheet and cleat, hiking straps.

## Key dimensions honoured

LOA 2.30 m, beam 1.13 m, sail 2.6 m², sprit-rig corner geometry solved from
head→peak 1.22 m and the sprit's 2.46 m.

## Verification

`.tools/inspect.mjs` reports 0 degenerate triangles on every mesh (the only
non-zero "degenerate" row is the 8-point mainsheet `Line` primitive, which is
expected for a line).
