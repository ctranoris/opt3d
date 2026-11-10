# Contact between boats, VMG to the next mark, jury boats

2026-11-10 21:40

Asked for: 1) collision detection with the rest of the boats during a
race, 2) VMG to show the next buoy in a race, 3) some jury boats.

## What changed

### 1. Contact

- **`collisions.js`** (new, no three.js): each hull is a capsule seen from
  above. `resolveContacts` pushes overlapping hulls apart (the lighter one
  further), takes out the speed they had toward each other, scrubs a
  little more, and reports the bumps.
- **`fleet.js`**: every fleet boat has a body; `fleet.collide()` runs the
  bumps for the fleet plus whatever else is on the water (our boat, the
  jury boats). So that they do not just pile into each other the fleet
  now keeps clear: port gives way to starboard, windward keeps clear on
  the same tack, everyone keeps clear of jury boats and stopped or
  capsized boats; the give-way boat ducks the other's stern or holds off;
  no tack without room; all twelve go off on starboard tack at the gun
  (they alternated before). Finished boats no longer stop on the line:
  they move up to a place in three rows above it.
- **`viewer.js`**: our boat has a body too; a bump moves her (the sea,
  since she is the middle of the scene) and takes her speed. The race
  panel shows "Contact with GRE 1057" (or "jury boat 1") in red for 3 s.
- **`sound.js`**: `signal('bump', vol)`, a short thud; other boats' bumps
  within 30 m are heard, quieter.

### 2. VMG

- With the course out the readout's VMG is the speed made good toward
  the next thing to round, and says which: `VMG to start`, `to mark 1`,
  `to mark 2`, `to gate 3`, `to finish`. Without a course (or after the
  finish) it is the windward VMG as before.

### 3. Jury boats

- **`jury.js`** (new): three grey RIBs, two judges each, yellow JURY flag
  streaming in the wind she feels. One follows the pack about 16 m astern
  (or us, sailing alone), one lies off the windward mark, one off the
  right-hand end of the finish line. They come and go with the Race
  course checkbox, stop for a dinghy close ahead, and are solid.

### Also

- **`.tools/fleet-race.js`** runs with the jury boats and the bumps and
  prints how many there were.
- **`README.md`**: contact, jury boats, the VMG readout, the tool.

## Checked

- `node .tools/fleet-race.js optimist 8`: all twelve finish (359-463 s;
  364-439 s before, without contact), 59 bumps in the race, 21 of them at
  more than 1 m/s, none with a jury boat. At 14 kn 73 bumps (4 with a
  jury boat); ILCA 4 at 10 kn 35 bumps (3 with a jury boat). No console
  errors; all twelve finish in those two as well.
- In the page (headless Chrome, software GL): the jury boats show with
  the course; sailing our boat at 1.5 m/s into a jury boat stops her
  (0.35 m/s after), the panel shows "Contact with jury boat 1"; the
  readout says `VMG to start` before the start and `VMG to mark 1`
  racing; no console errors.

## Not done

- No penalties, protests, whistles or flags from the jury: they only watch.
- The fleet still bumps about five times a minute, mostly at the start
  and the marks; it gives no mark-room, to us or to each other.
- The bump sound was not heard (no audio in the headless browser), and
  nothing was tried on a real graphics card.
- The jury boats leave no wake and cast no shadow.
- Nothing committed.
