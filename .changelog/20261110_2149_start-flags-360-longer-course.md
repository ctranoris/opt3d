# Start between the flags or a 360; course 25% longer

2026-11-10 21:49

Asked for: every boat must pass the start line between the two flags,
otherwise she has to make a 360 penalty; and the whole course 25% longer.

## What changed

- **`race-course.js`**
  - `course.startCross(p0, p1)` tells a crossing of the line between the
    flags from one outside them (across the line carried on past its ends).
  - Our boat: going up past the line outside the flags (after the gun, not
    OCS) starts her race with a penalty. `course.update` now takes the
    heading and adds up the turn; at a full circle one way the penalty is
    gone. Until then no mark and no finish counts. `raceInfo` has
    `penalty` and `turn`.
  - Legs 25% longer: marks and finish are laid 1.25 times as far from the
    start (mark 1 at 105 m, was 84 m). The start and finish lines keep
    their length, the rounding radius too.
  - The start line now runs from 34 m left to 20 m right of the middle of
    the row (54 m, was 40 m): the row goes off on starboard tack and
    slides left before it reaches the line, so with the old line the left
    hand boats could not have started between the flags.
- **`fleet.js`**: before she has started a boat checks where her tack
  meets the line and takes the other tack if that is past an end. One
  that starts outside anyway puts the helm over and turns a full circle,
  bearing away first, then sails on.
- **`viewer.js`**: the race panel shows "Started outside the flags - turn
  a full circle, a tack and a gybe (120° of 360°)" in red.
- **`.tools/fleet-race.js`** prints each boat's 360s.
- **`README.md`**: the rule, the line, the course table (which still had
  the dimensions from before the last lengthening).

## Checked

- `node .tools/fleet-race.js optimist 8`: all twelve start between the
  flags (no 360s) and finish in 460-568 s (359-463 s on the shorter
  course), 52 bumps. ILCA 4 at 12 kn: all twelve finish, no 360s. No
  console errors.
- A fleet boat put 6 m outside the pin just below the line: one penalty,
  the circle made in about 15 s, then she beats on.
- Our boat, with positions fed to `course.update` in the page: across
  outside the flags gives the penalty; at mark 1 with it owed the mark
  does not count; after the heading has gone through 360° the penalty
  clears and the mark counts; across between the flags gives none. The
  panel shows the red line.

## Not done

- The 360 was not sailed by hand in the page (software GL is too slow);
  only its bookkeeping was tested.
- A penalty circle may be turned anywhere and at any time before the next
  mark; the fleet does not keep clear of a boat while she is turning.
- Nothing committed.
