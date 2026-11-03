# Start line-up and 10 s countdown

Date: 2026-11-03 18:45

## What changed

Pressing **Re-lay course** now starts the race properly.

1. **Line-up.**
   - The course is laid with the start line 6 m upwind of the boat (it was
     12 m).
   - All five boats are put in a row 6 m below the start line, with ours in
     the middle slot and the four fleet boats either side of it.
   - Every boat is head to wind and stopped, with its sail luffing.
   - The camera swings round with our boat so the view keeps the same
     angle on her.
2. **Countdown.**
   - The race HUD shows "Start in N" and counts down 10 seconds.
   - The fleet boats hold head to wind until the gun.
   - At the gun the fleet boats bear away, alternately onto port and
     starboard tack, and beat for the line.
3. **Signals.** These are synthesised with Web Audio in `sound.js`
   (`signal()`), so no sound files are needed:
   - a horn at 10 s;
   - a beep each of the last 5 seconds;
   - a long horn at the gun.
4. **Start rules.**
   - The race clock starts at the gun.
   - Crossing the line upwind after the gun starts the race.
   - A boat over the line before the gun is OCS. The HUD shows it in red,
     and the boat must dip back below the line before it can start.
5. **No countdown on first lay.** Switching on **Race course** for the
   first time keeps the old behaviour: no countdown, and the clock starts
   when you cross the line. This means opening the page doesn't turn the
   boat head to wind.
6. The README and the button tooltip have been updated.

## Phases

The race (`course.race.phase`) now moves through these phases:

- After **Re-lay course**: `countdown` → `started` → `racing` → `done`
- When the course is first laid: `pre` → `racing` → `done`

## Verified

Headless tests:

- **Line-up.** All boats are in the row and head to wind, our speed is
  0 kn, and the HUD shows "Start in 9" (render checked).
- **Countdown, in real frames.**
  - The signals played were the horn, five beeps and the gun.
  - After the gun the phase is `started` and the HUD shows
    "Go! · 0:00.4".
  - The fleet boats bore away onto alternating tacks.
- **Start logic.**
  - Over the line early sets OCS.
  - Still over the line after the gun: the race does not start.
  - Dipping back below the line clears OCS, and crossing upwind then
    starts the race.
  - A clean start goes to `racing` on the crossing.
- **Page load.** The course is in `pre` and the heading is unchanged.
- No page errors.

## Files

- `race-course.js`
- `fleet.js`
- `viewer.js`
- `sound.js`
- `index.html`
- `README.md`

Not committed. The sea changes are also still uncommitted.
