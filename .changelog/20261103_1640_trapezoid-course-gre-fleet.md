# Optimist Worlds trapezoid course, all-GRE fleet

Date: 2026-11-03 16:40

## What changed

1. **The course now follows the Optimist Worlds example**
   (`init_assets/example_course.png`). The rounding order is
   Start – 1 – 2 – 3S/3P – Finish. It uses fewer buoys than before: four
   turning marks instead of five, two of them making a gate.

   Positions, in metres from the middle of the start line (right as seen
   looking upwind):

   | Mark | Upwind | Right |
   |---|---|---|
   | Mark 1, windward | 60 | 0 |
   | Mark 2 | 50 | −40 |
   | Gate 3S (left, looking upwind) | 2 | −49 |
   | Gate 3P (right, looking upwind) | 2 | −39 |
   | Finish, middle | 30 | −37 |

   - Mark 1 is straight upwind of the start, so the first leg is a beat.
   - The leg to mark 2 is a reach to the left.
   - The leeward gate is 10 m wide.
   - The finish line is 12 m long, between the two blue flagged buoys and
     square to the wind, so the last leg is a beat.
2. **Marks are red with white labels** ("1", "2", "3S", "3P"), as in the
   example drawing. They used to be yellow.
3. **Race logic works in legs** (`legs` in `race-course.js`):
   - A gate leg counts when you round either mark (within 7 m) or sail
     through the line between them.
   - Both gate marks get the pulsing green ring.
   - The HUD reads "Mark 1", "Mark 2", "Gate 3S / 3P", "Finish", with the
     legs listed as 1 · 2 · 3 · F.
4. **The fleet** steers for each leg's end, which is the middle of the
   gate for the gate leg, and then for the finish.
5. **Every sail is GRE.** The four fleet boats are now GRE 2471, 3305, 1888
   and 5120; the main boat was already GRE 1062.
6. **README:** the Race course and Fleet rows, the racing paragraph and the
   course table are updated.

## Verified

- **Race logic:** the boat was placed at each point along the course in
  turn: start, mark 1, mark 2, the gate, below the finish and above it.
  The HUD went from Mark 1 to Mark 2, then Gate 3S / 3P, then Finish, and
  then "Finished".
- **Overview render:** the layout matches the example. The start is
  bottom right, 1 is above it, 2 is up on the left, the gate is bottom
  left and the finish line sits between 2 and the gate.
- **Gate close-up:** 3S is on the left and 3P on the right, looking
  upwind.
- **Fleet:** 300 s of fleet simulation with wind from the north. All four
  boats rounded 1 → 2 → gate → finish and started a second lap.
- No page errors.

## Files

- `race-course.js`
- `fleet.js`
- `viewer.js`
- `README.md`

Not committed.
