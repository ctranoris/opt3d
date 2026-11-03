# Reference gap analysis — model vs. photos and STL

**Date:** 2026-11-03 11:26

## What was done

- Read the project (README, `model/*.js`, earlier changelog) and compared the
  existing verification renders in `build/` against the reference material in
  `init_assets/`, including the two new images `Optimist_dinghy_02.png`
  (top-down photo of a modern GRP Opti) and `opte_image_01.jpg` (3D-printed
  model).
- Analysed `init_assets/Opti Model.stl` (Node, no Python on this machine):
  6 002 triangles, two components — a low-relief plan-view hull (53 × 113 ×
  12.7 units) and the flat sail + spars. It is a print-plate model, not a 3D
  hull, but it is an accurate **plan of the interior layout**. Rendered to
  `build/ref_stl_plan.png`.

## Findings — where the model departs from a real Optimist

The hull shape and rig are broadly right. The interior is not: it is built
as a decked boat with a cockpit, while a real Opti is an open hull.

| Area | Model now | Reference (photo 02 + STL) |
|---|---|---|
| Decks | full foredeck, aft tank deck, side decks, coaming | open hull; only a narrow gunwale/inwale |
| Mast support | mast step pad on a foredeck | **mast thwart** across the bow ≈0.19–0.40 m aft, with a small bow compartment ahead of it |
| Centre thwart | none | **thwart across the beam** at ≈1.25 m aft |
| Daggerboard case | box 0.80–1.10 m with lid | slot case ≈0.86–1.25 m, running forward from the thwart, top flush with it |
| Buoyancy | one red tube ring around the cockpit | **3 grey bags**: two along the sides forward (≈0.40–1.25 m), one across the stern |
| Hiking straps | short pads on the side decks | **V of straps** from the centre thwart to the stern, meeting on the centreline |
| Stern | flat aft deck + grab rail | open to a transom; stern bag sits on the floor against it |

(STL scale ≈ 0.0215 m per unit; positions are from the bow.)

Housekeeping noticed: the reference images moved from the repo root to
`init_assets/` but the README still lists them at the root.

## Not done yet

No model code was changed. Next step is to agree the scope of "optimise"
(layout fidelity vs. mesh/performance) before editing.
