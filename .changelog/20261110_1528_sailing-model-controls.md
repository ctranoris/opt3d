# Sailing model and controls

2026-11-10 15:28

Request: improve how the boat behaves against the wind, and her controls.

## What changed

Your boat used to turn at a fixed 40°/s whatever her speed, and her speed
simply followed a polar. She now sails on a force model.

- **`sailing.js`** (new): sail lift and drag by angle of attack (luffing,
  stall), hull resistance, windage, leeway against the foils, heel against
  hull stiffness and a sailor who hikes with a lag, a rudder whose bite
  grows with boat speed (sculling when stopped, reversed going astern),
  weather helm, and course holding with hands off. Plain JS in SI units, no
  three.js, so it runs in Node. Parameters for the Optimist and the ILCA 4.
- **`viewer.js`**: the player's boat is driven by `stepBoat`; she moves by
  her speed and her leeway; the rudder blade and tiller follow the helm; the
  sailor hikes from the model; gusts (about ±15%) and shifts (about ±5°) on
  the wind she feels; the readout gains rudder, leeway and VMG.
- **Controls**: ← / → or A / D are the helm. ↑ / ↓ or W / S haul in and let
  out the mainsheet, which turns Auto sail off and leaves the boom free to
  swing to leeward as far as the sheet allows. The slider and dragging the
  sail still hold the boom where it is put. Auto sail now picks the boom
  angle with the most drive and eases when overpowered.
- **`index.html`**: the key hint text.
- **`README.md`**: controls table, a "How she sails" section, readout,
  development scripts, known limitations.
- **`.tools/polar.mjs`** (new): prints the model's polar next to the
  fleet's. **`.tools/sail.js`** (new): sails her in the headless page with
  the keys.

## Checked

- `node .tools/polar.mjs optimist`, 8 kn of wind: 3.33 kn on a beam reach,
  2.58 kn at 60° (best VMG 1.29 kn; fleet 1.21), 2.52 kn on a run (fleet
  2.96).
- Tacks simulated in Node: Optimist about 5 s at 8 kn and 3 s at 16 kn;
  ILCA 4 about 7 s at 8 kn.
- `node .tools/sail.js` in headless Chrome: reach, luff into irons, tack,
  sheet in and out. No console errors.

## Not changed

- The fleet (`fleet.js`) still sails its old polar. The player is slightly
  faster upwind and about 15% slower on a run than the fleet.
- No capsize, no planing; the daggerboard is always down.
- Nothing committed.
