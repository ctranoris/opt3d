# Sailors in the boats

Date: 2026-11-03 16:11

## What changed

1. **A sailor in every boat** (new `sailor.js`, "Sailor" checkbox, on by
   default). It covers your boat and the four fleet boats. Each fleet
   sailor has its own buoyancy aid colour.
2. **The sailor is on the right side.** They sit on the windward side deck,
   opposite the boom:
   - boom to starboard (+) → port side (+z);
   - boom to port (−) → starboard side (−z).

   While the boom is within 4° of the centreline (in irons, dead
   downwind) they keep the side they are on.
3. **Pose:**
   - They face inboard and about 35° forward, with their feet hooked under
     the hiking strap.
   - The aft hand holds the tiller extension; the forward hand holds the
     mainsheet tail coming out of the ratchet block (drawn as a blue line
     to the hand).
   - They hike out as the heel builds: the pelvis moves out over the
     gunwale and the body leans back over the water, up to 55° by about
     15° of heel.
4. **Tacks and gybes:** when the boom crosses, the sailor ducks low across
   the middle of the cockpit, facing forward under the boom, and comes up
   on the new side in about 1.3 s. The hands swap jobs smoothly on the way.
5. **How it works:** each frame a few points are set from the side, the
   hiking and the crossing: the pelvis, spine and neck, the feet and the
   hand targets. Knees and elbows come from two-bone IK, and every limb is
   a fixed-length capsule laid between two joints.
6. **Tiller extension** (`model/opti-boat.js`): now a 0.60 m tube on a
   swivel at the tiller's fore end, exported as `rudder.extension`. The
   sailor aims it at their aft hand. With the sailor off, it goes back to
   lying forward on the centre thwart.
7. **GLB export** leaves the sailor out and exports the extension at rest.
8. **README:** a Sailor row in the controls table and a paragraph on how
   the sailor is placed.

## Verified (headless renders)

| Case | Boom | Heel | Sailor |
|---|---|---|---|
| Wind NE, heading N | 13° P | 7.5° | starboard side |
| Wind NW, heading N | 14° S | 7.5° | port side |
| 18 kn, port tack | — | 17° | hiking hard on port |
| 18 kn, starboard tack | — | 17° | hiking hard on starboard |

- In a mid-tack frame the sailor is crouched on the centreline, facing
  forward, below the boom.
- The top view shows the extension running from the tiller to the aft
  hand, and the sheet running from the block to the forward hand.
- The fleet boats' sailors are on the side opposite their booms.
- The Sailor toggle works.
- The GLB export has no sailor nodes.
- No page errors.

## Files

- `sailor.js` (new)
- `model/opti-boat.js`
- `fleet.js`
- `viewer.js`
- `index.html`
- `README.md`

Not committed.
