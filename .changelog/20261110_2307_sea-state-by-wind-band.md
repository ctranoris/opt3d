# Sea state in three wind bands; wind up to 21 kn

2026-11-10 23:07

Asked for: between 7-10 kn show sea waves, between 11 and 16 kn stronger
waves, and from 17-21 kn stronger waves again.

## What changed

- **`viewer.js`**: `seaTarget()`, the level the sea eases toward, now
  goes up in steps with the wind instead of in one straight line:

  | Wind | Sea level (`uSea`) |
  |---|---|
  | 0-6 kn | 0.45 to 0.69, nearly flat |
  | 7-10 kn | 1.0 |
  | 11-16 kn | 1.5 |
  | 17-21 kn | 2.0 |

  Each step is blended over 1 kn (6-7, 10-11, 16-17), and the sea still
  takes about 4 s to build or drop after the wind changes.
- **`index.html`**: the Wind slider goes to 21 kn (it stopped at 18).
- **`README.md`**: the sea description and the wind limit.

## Checked

- In the page (headless Chrome), with the slider at 5, 8, 14 and 20 kn
  and the sea left to settle: level 0.66, 0.99, 1.48 and 1.98; the four
  screenshots show a visibly bigger sea at each step, and the surface
  holds together at the top one; no console errors.
- `node .tools/fleet-race.js optimist 21`: the fleet races and finishes
  at 21 kn (with capsizes), no console errors.

## Not done

- The boats' motion follows the sea as before, so they pitch and roll
  more in the upper bands; the sailing forces were not retuned for
  19-21 kn, where an Optimist capsizes easily.
- Whitecaps are unchanged (they come in from about 10 kn).
- Not seen on a real GPU, only in the software renderer.
- Nothing committed.
