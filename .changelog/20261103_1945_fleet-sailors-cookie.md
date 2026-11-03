# Twelve named sailors, ponytails, and the sail number remembered

Date: 2026-11-03 19:45

## What changed

1. **Default sail.** Your boat's default sail is now GRE 1060 (a boy). It
   was GRE 1062. The change is in `model/opti-rig.js` (`SAIL_MARKS`) and
   in the Sail no. field in `index.html`.
2. **The fleet.** There are now twelve other boats instead of four, listed
   in `fleet.js` `ENTRIES`:

   | Girls | Boys |
   |---|---|
   | GRE 1062, 105, 1054, 1055 | GRE 1057, 1058, 128, 3153, 1052, 2737, 2828, 2628 |

   - The jacket and cap colours vary from boat to boat as before.
   - The shader's wake and hull-mask arrays grow with `FLEET_N`.
3. **Girls have longer hair with a ponytail.** This is
   `createSailor({ ponytail: true, hair })` in `sailor.js`.
   - **Hair:** a shell of hair round the back and sides of the head, from
     under the cap down to the nape.
   - **Ponytail:** a tapered lock with a hair tie, coming out of the back
     of the cap.
     - Each frame it is turned to hang down under gravity, whatever the
       heel and the tilt of the head.
     - It is kept off the back of the head, and it swings gently.
   - **Hair colour:** chosen from four colours (`HAIR`).
4. **Start row for 13 boats.**
   - The start line is now 40 m long (it was 28 m).
   - There are 13 slots about 3 m apart, with ours in the middle.
   - Finishers spread out along the finish line, each in its own lane, so
     they don't all stop on one spot.
5. **The sail marks are remembered.**
   - The Country and Sail no. are saved in a cookie,
     `opt3d_sail=GRE/1060`, kept for a year, with `path=/` and
     `SameSite=Lax`.
   - It is saved as you type, and read back when the page loads.
   - If cookies are blocked, the page still works; it just doesn't
     remember.
6. **README:** updated the Fleet and Sailor rows, added a Country / Sail
   no. row, and updated the Re-lay text.

## Verified

Headless tests:

- **Sail number.** The default is 1060. After typing 4321, the cookie
  reads `opt3d_sail=GRE%2F4321`, and after a reload the field shows 4321.
- **Start row.** After Re-lay course all 12 fleet boats are in the row
  (render checked).
- **Close-up renders** of GRE 1062:
  - from behind: brown hair under the white cap, with the ponytail hanging;
  - hiking: the ponytail hangs down past the shoulders.
- **Full-course simulation, 600 s.**
  - All 12 boats round the marks on the outside and finish in about
    325–375 s.
  - They stop spread across the finish line.
- No page errors.

## Files

- `model/opti-rig.js`
- `index.html`
- `sailor.js`
- `fleet.js`
- `race-course.js`
- `viewer.js`
- `README.md`

Not committed.
