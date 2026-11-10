# Sea showing inside the opponents' boats

2026-11-10 22:50

Report: during a race there is sometimes water in the boats of the
opponents.

## Cause

The sea shader cuts the water out of each fleet hull, and skips a boat
whose wake factor is below zero - that is how "fleet off" is signalled.
The wake factor is the boat's speed, and it was only limited from above:
a fleet boat going astern (in irons after the gun or a bad tack, or
knocked back by a bump - more common now that the hulls are solid) had a
negative factor, so the shader took her for absent and drew the sea
straight through her hull until she moved ahead again.

## What changed

- **`viewer.js`**: the fleet's wake factor is clamped to 0..1.2, so only
  "fleet off" is negative. The same clamp on our own boat's factor (her
  hull was never skipped, but a negative wake made no sense either).
- **`fleet.js`**: after a bump only the boat's x and z are written back,
  not her height (it was being set to the same value; tidied while
  looking for the cause).

## Checked

- `node .tools/sail.js`: the page loads and sails, no console errors.

## Not done

- Not seen fixed on screen: the cause was found by reading the shader
  and the code that feeds it, and the fix is one clamp. If water still
  shows in a boat, note what she was doing (capsized, heeled hard, in a
  steep wave) - a boat on her side is a separate case.
- Nothing committed.
