# Part labels: real overlap resolution, and anchors on the parts

The "Part labels" overlay placed each label at its anchor plus a fixed offset
jittered by the label's index in the list. That worked until two parts sat
close in the boat: the mainsheet cleat and a hiking strap both lie on the
side deck a hand span apart, so their labels landed on top of each other, and
no index-based offset can separate a pair whose anchors are a few pixels
apart on screen.

## Fix

`drawLabels()` now places, then resolves:

- **`separate(boxes)`** — up to 30 relaxation passes over all label boxes,
  pushing each overlapping pair apart along whichever axis needs the smaller
  move, and stopping early once nothing overlaps.
- **Panel clearance** applied last. The control panel is opaque, so a label
  under it is simply lost; the separation pass can push one there, so labels
  are shunted clear of `#panel`'s bounding rect afterwards.
- Leader lines still run anchor → label, so a nudged label stays visibly tied
  to its part however far it has been pushed.

## Anchors corrected

Several labels pointed near their part rather than at it. Recomputed from the
model's own geometry rather than eyeballed:

| part | was | now |
|------|-----|-----|
| Mainsheet cleat | port side (−0.42) | starboard side tank, (0.406, 0.435) |
| Hiking strap | inboard | outboard on the side deck, (0.395, 0.485) |
| Side tank / air bag | off the bag | the bag's fitted centreline (0.385, 0.428) |
| Centreboard case | inside the hull | on the case lid (0.385, 0.085) |
| Tiller | over the side | on the bar at z = 0 (0.50, 0) |

The cleat anchor had gone stale when the cleat itself moved from port to
starboard — the sheet falls off the boom block to the starboard side tank, as
there is no traveller on an Optimist.

## Verification

A headless pass reads every label's client rect, checks pairwise overlap and
panel intersection: no label sits under the panel, and the previously
colliding cleat/strap pair is clear.
