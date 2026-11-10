# Fleet on the force model; capsize, planing, daggerboard

2026-11-10 16:42

Request: fix the limitations left by the sailing model: the fleet unchanged,
no capsize, no planing, the daggerboard always down.

## What changed

- **`sailing.js`**
  - Daggerboard: `hull.board` (1 down .. 0 raised). Raised: 30% of the
    foils' grip, 7% less resistance, 18% shorter heeling lever.
  - Planing: resistance humps up by 55% near hull speed (`vHull`, 1.85 m/s
    Optimist, 2.5 m/s ILCA 4); flat and fast enough she planes and the hump
    goes. `hull.plane` 0..1.
  - Capsize: the hull's righting moment falls away past 8-12 degrees of
    heel and the heel is no longer clamped at 42. Past 45 degrees she goes
    over (`hull.capsized`), lies 5 s on her side, and is righted, stopped.
  - The sailor's hiking moment brought down to a realistic figure (Optimist
    330 to 250 N m, ILCA 4 620 to 480 N m). Without this a pinned sheet in
    18 kn never capsized her. Auto sail holds less heel (5 degrees).
- **`fleet.js`**: the fleet sails by `stepBoat` instead of the old speed
  polar: tiller with a proportional helm, Auto-sail trim, leeway, heel,
  hiking, gusts and shifts shared with the player, daggerboard lifted off
  the wind, rudder and board shown on each boat. Slower sailors get a
  smaller effective sail. Beat angle 60 to 58 degrees. `optimalBoom` and
  `polar` removed.
- **`viewer.js`**: Q / E lift and lower the daggerboard (mesh moves);
  capsized boat floats on her side, sheet runs out, helm and sheet keys
  ignored until she is up; readout line for the board, "planing" and
  "CAPSIZED"; gust and shift passed to the fleet.
- **`index.html`**: Q / E in the key hint.
- **`.tools/polar.mjs`**: fleet column replaced by planing and board-up
  speed. **`.tools/sail.js`**: daggerboard steps. **`.tools/fleet-race.js`**
  (new): sails the fleet round the course in the page without rendering.
- **`README.md`**: controls, "How she sails", fleet, scripts, limitations.

## Checked

- `node .tools/fleet-race.js`: all twelve finish at 8 kn (362-415 s) and at
  18 kn (218-343 s, planing 13-31 s each, no capsizes); ILCA 4 at 14 and
  18 kn all finish, no capsizes. At 3 kn they are still racing after 900 s
  (slow, not stuck). No console errors.
- Capsize in Node, gusty wind: sheet pinned, the Optimist goes over at
  18 kn (and at 16 kn close-hauled with the boom at 25 degrees); stays up
  at 14 kn. Auto sail stays up to 18 kn, heel at most 15 degrees (ILCA 19).
- Capsize in the page (headless Chrome, 18 kn, boom pinned at 20 degrees):
  over at about 8 s, righted about 6 s later with the sail flagging;
  screenshot checked. No console errors.
- Polar, Optimist: 8 kn unchanged (reach 3.3 kn, 2.6 kn at 60 degrees);
  18 kn reach 7.9 kn planing; 14 kn reach 4.9 kn, not planing.

## Not done

- Tack times were not re-measured after the hiking change (the fleet tacks
  round the course without trouble).
- ILCA 4 capsize and daggerboard not looked at in the page, only in Node
  and the fleet run.
- Nothing committed.
