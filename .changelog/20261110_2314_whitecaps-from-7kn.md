# Whitecaps from 7 kn, slightly stronger

2026-11-10 23:14

Asked for: whitecaps from 7 kn, and slightly more of them.

## What changed

- **`viewer.js`**: the whitecap strength (`uCaps`) used to start at 9 kn
  and reach 0.85 at 18 kn. It now starts just above 6 kn, is 0.18 at
  7 kn, 0.35 at 8 kn, and climbs to 1.0 at 21 kn.

  | Wind | Before | Now |
  |---|---|---|
  | 7 kn | 0 | 0.18 |
  | 9 kn | 0 | 0.36 |
  | 14 kn | 0.41 | 0.64 |
  | 20 kn | 0.85 | 0.99 |

- **`README.md`**: the sea description.

## Checked

- In the page (headless Chrome) at 6, 7, 9, 14 and 20 kn: the strength
  reads 0.00, 0.18, 0.36, 0.64, 0.99; no console errors.

## Not done

- In the small software-rendered screenshots the whitecaps at 7-9 kn are
  hard to tell from the sun glitter, so how they look at 7 kn is not
  confirmed by eye. If they are still too few, the first step (0.35 at
  8 kn) is the number to raise.
- Nothing committed.
