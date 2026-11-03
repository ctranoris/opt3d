# The boat makes way: moving sea and white-water wake

Date: 2026-11-03 14:50

## What changed (`viewer.js`)

- **Moving through the water.** The boat stays centred on the compass rose,
  and the sea moves past her at her speed instead.
  - An odometer (`odo`, world metres) adds up `speed × heading` every frame.
  - The waves are evaluated at the world point plus the odometer, in both
    the JS `waveHeight()` (used for floating the boat) and the water
    shaders (new `uOffset` uniform). The swell and ripples therefore drift
    astern.
- **White water** (`wakeFoam()` in the water fragment shader), worked out in
  the boat frame from `uBoatInv`:
  - a bow wave just ahead of the stem;
  - a foam band outside the waterline along both sides, heaviest forward,
    from the same hull table that keeps water out of the cockpit;
  - churned water off the transom, widening and fading astern;
  - the two Kelvin wake arms (19.5° half-angle) spreading astern, with
    lightly ruffled water between them.
- **Look and strength.**
  - The foam is broken up by three octaves of value noise fixed to the
    moving water, so it streams aft past the boat.
  - It is lit by the sun.
  - Its strength (`uWake`) scales with boat speed: none when she is
    stopped (in irons or aback), full at about 3 kn.
- README: the controls section describes the motion and the wake.

## Verified

- Headless renders from astern and from above at heading 300° on a close
  reach (2.8 kn): the transom wake, the arms and the side foam are all in
  the right place.
- The odometer advances along the heading. No page errors.

Not committed.
