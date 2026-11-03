# Fleet rounds the marks properly; bigger course

Date: 2026-11-03 19:15

## What changed

1. **Fleet route.** The fleet boats used to steer at the centre of each mark
   and loop round the course forever. Each one now follows a route of
   waypoints, built when the course is laid (`course.route(side)` in
   `race-course.js`):
   - **Mark 1:** lay the right-hand side of the mark, then bear away over
     the top, rounding it to port on the outside.
   - **Mark 2:** pass above it and round its outside.
   - **Gate:** run down through the middle, between 3S and 3P.
   - **Below the gate:** every other boat rounds 3P (to port) or 3S (to
     starboard).
   - **Finish:** beat up across the finish line, then stop head to wind
     just past it.

   Every leg out of a mark is a reach, so no boat has to tack across a
   mark to reach a waypoint. A waypoint counts as reached within 2.5 m,
   or once the boat has sailed past it.
2. **Longer course.** Distances are about 40% longer:

   | Item | Position before | Position now |
   |---|---|---|
   | Mark 1 | 60 m upwind | 84 m upwind |
   | Mark 2 | 50 m upwind, 40 m left | 70 m upwind, 56 m left |
   | Gate | 2 m upwind, 39–49 m left | 3 m upwind, 51–61 m left |
   | Finish line | 30 m upwind, 37 m left | 42 m upwind, 50 m left |

   - The finish line is 14 m wide (it was 12 m).
   - The start line is 28 m wide (it was 24 m).
3. README: the fleet description has been updated.

## Verified

Ran a 600 s headless fleet simulation after **Re-lay course**:

- All four boats finish in about 340–375 s and stop just over the line.
- They pass 2.4–2.8 m outside mark 1 (over its top) and about 3.5 m
  outside mark 2.
- Each boat passes about 3 m below its own gate mark (3P or 3S), and
  about 5 m from the other gate mark, so it goes through the middle.
- No page errors.

## Files

- `race-course.js`
- `fleet.js`
- `README.md`

Not committed.
