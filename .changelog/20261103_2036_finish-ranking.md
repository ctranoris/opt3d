# Finish ranking

Date: 2026-11-03 20:36

## What changed

When boats finish, a ranking is shown.

1. **Race clock.**
   - `course.race.clock` counts the seconds since the gun. With no
     countdown (first lay), it counts from when the course was laid.
   - Every boat is timed on this one clock.
   - Our finish time on it is kept in `course.race.finish`.
2. **Fleet finishes.**
   - New `course.crossesFinish(p0, p1)` tells whether a move crossed the
     finish line going upwind.
   - A fleet boat on its last leg that crosses the line gets
     `s.finish = clock`, and then stops head to wind.
   - The last waypoint is now 1 m past the line (it was 3 m), and the
     boats spread less along the line (±3.6 m instead of ±5.4 m).
     Beating at 60° to a waypoint well past the line, some boats were
     crossing just outside the finish buoys.
3. **Ranking panel.**
   - A new `#rank` panel at the top right appears when the first boat
     finishes.
   - It shows position, sail (for example "GRE 1062"), the winner's time,
     and the gap behind the winner for everyone else.
   - Your row is green and marked "(you)", and the winner's number is
     gold.
   - Below the list it shows "N still racing".
   - It is hidden while the course or the fleet is off, and cleared on
     **Re-lay course**.
4. **Race HUD.** After you finish, the race panel shows your place, for
   example "Finished in 5:52.0 · 6th of 13".
5. The README has been updated.

## Verified

- In a headless 600 s simulation, all 12 fleet boats crossed the line and
  were timed (5:11–5:59 after the gun). Before the waypoint change, 3 of
  them crossed outside the buoys.
- The panel showed the finishers in order, our boat was slotted in by its
  time, and the race HUD showed "6th of 13" (screenshot checked).
- The panel was hidden after **Re-lay course**.
- No page errors.

## Files

- `race-course.js`
- `fleet.js`
- `viewer.js`
- `index.html`
- `README.md`

Not committed. The fleet, sailor and cookie changes are also still
uncommitted.
