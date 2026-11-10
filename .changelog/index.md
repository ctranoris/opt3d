# Changelog

Log of completed actions on the Optimist 3D viewer. Newest first.

## 2026-11-10

- [Sailing model and controls](20261110_1528_sailing-model-controls.md) —
  force-based sailing (`sailing.js`): momentum, leeway, heel and hiking,
  rudder that needs way on, gusts; mainsheet on ↑/↓ (W/S); rudder, leeway
  and VMG in the readout.

## 2026-11-06

- [Laser sail window a quarter as tall](20261106_2054_laser-sail-window.md) —
  the ILCA sail window cut to 0.155 m high (was 0.62 m).

- [ILCA 4 / Laser 4.7 model](20261106_2042_laser-model.md) —
  second boat from init_assets/laser4.7 (bent-mast una rig, traveller,
  cockpit); Boat selector with cookie, fleet and course scale with it.

## 2026-11-03

- [Commit and push: sailors, cookie, finish ranking](20261103_2040_commit-and-push-ranking.md) —
  pushed dcafa60 to origin/main.

- [Finish ranking](20261103_2036_finish-ranking.md) —
  race clock from the gun; fleet boats timed across the finish line; a
  Finish panel lists the finishers in order with ours highlighted.

- [Twelve named sailors, ponytails, sail number remembered](20261103_1945_fleet-sailors-cookie.md) —
  default sail GRE 1060; 12 fleet boats with the given numbers, the girls
  with long hair and a ponytail; 13-boat start row; sail marks kept in a cookie.

- [Commit and push: fleet route and longer course](20261103_1920_commit-and-push-fleet-route.md) —
  pushed 6881406 to main.

- [Fleet rounds the marks properly; bigger course](20261103_1915_fleet-rounds-marks.md) —
  the fleet rounds 1 and 2 outside, goes through the gate round 3S/3P and
  finishes; the course is about 40% longer.

- [Commit and push: sea and start countdown](20261103_1850_commit-and-push-sea-countdown.md) —
  pushed fed9daf to main.

- [Start line-up and 10 s countdown](20261103_1845_start-countdown.md) —
  Re-lay course lines every boat up head to wind below the start line
  and counts down 10 s, with horn and beeps, and an OCS rule.

- [A better sea](20261103_1815_better-sea.md) —
  Gerstner waves running downwind, per-pixel ripples, clouds reflected,
  light through the crests, whitecaps and a sea that builds with the wind.

- [Commit and push: islands and sound](20261103_1750_commit-and-push-islands-sound.md) —
  committed the islands, sound and recordings to main (39635ba) and pushed.

- [Lower islands](20261103_1745_lower-islands.md) —
  island peaks roughly halved, so they sit low on the horizon.

- [Sound from the sounds folder](20261103_1735_sound.md) —
  water, luffing sail and rig-wind loops driven by the boat, plus mainsheet
  and sail-filling one-shots; Sound checkbox.

- [Mountains cut down to a few islands](20261103_1715_few-islands.md) —
  the ring of ranges replaced by four separate hazy islands; checkbox
  renamed Islands.

- [Distant mountains](20261103_1700_distant-mountains.md) —
  three hazy ridge lines on the horizon, with gaps of open sea, snow on the
  far peaks, and a Mountains checkbox.

- [Commit and push: racing, sailors, trapezoid course](20261103_1648_commit-and-push-racing-sailors.md) —
  committed the race course, fleet, sailors and clouds work to main and pushed it.

- [Optimist Worlds trapezoid course, all-GRE fleet](20261103_1640_trapezoid-course-gre-fleet.md) —
  course redone after the Worlds example: Start – 1 (windward) – 2 –
  3S/3P gate – Finish, red marks, four buoys instead of five; the fleet
  sails all show GRE.

- [Sailors in the boats](20261103_1611_sailors-in-the-boats.md) —
  a young sailor in each boat on the windward side, opposite the boom;
  hikes with the heel, ducks across in tacks and gybes, aft hand on a
  swivelling tiller extension, forward hand on the mainsheet.

- [Race course, fleet, clouds and keyboard steering](20261103_1550_race-course-fleet-clouds.md) —
  optional course (start line with two orange flags, marks 1–5, blue
  flagged finish) with a timed race and HUD; optional fleet of four AI
  Optimists racing round it, each with its own wake; cumulus clouds;
  ← / → steering; the sky texture, upside down until now, fixed.

- [Commit and push: sailing simulation](20261103_1458_commit-and-push-sailing-sim.md) —
  committed and pushed the day's sailing, wake and sail-artwork work to main (`0ba3fc0`).

- [The boat makes way: moving sea and wake](20261103_1450_boat-makes-way-wake.md) —
  the sea streams past at her speed; white water in the shader (bow wave,
  side foam, transom wash, Kelvin arms) scaled by boat speed.
- [Sail artwork, wind direction, heading, ±180° boom](20261103_1422_sail-artwork-heading-wind-boom-angle.md) —
  sail redrawn after the class drawing (blue insignia, letters by the leech,
  tell-tales by the mast, clear window, one batten); wind-from and heading
  sliders; mainsheet as a −180..180° boom angle with a sail that luffs and
  backs; turntable fixed; +Z corrected to port.

- [Sail faces, sprit side, bags, dry hull, compass and wind](20261103_1335_sail-sides-sprit-bags-water-wind.md) —
  marks in proportion and battens/tell-tales correct from both sides;
  sprit on the port face with a lower snotter; orange bags; sea masked out
  of the hull; compass rose, north wind arrow and a masthead wind indicator.

- [Sail marks: two editable lines](20261103_1238_sail-marks-two-lines.md) —
  national letters over the sail number (`GRE` / `1062`), changed from the
  panel and repainted live, reading correctly from both sides; this also
  fixed the cloth shader's mirror test, which had been backwards.
- [Untrack build/ and merge to main](20261103_1203_untrack-build-merge-main.md) —
  build output removed from git and ignored; rebuild branch merged into main.
- [Commit and push](20261103_1158_commit-and-push.md) — added .gitignore,
  committed the rebuild on branch `accurate-model-rebuild` and pushed it.
- [Accurate model rebuild](20261103_1151_accurate-model-rebuild.md) — clean-slate
  rebuild as the modern open GRP boat: new hull lines from the SBM plan, thwarts,
  three bags, V straps, daggerboard case, aluminium spars with snotter sprit,
  bridle and ratchet mainsheet; sail ≈3.15 m². README updated.
- [Reference gap analysis](20261103_1126_reference-gap-analysis.md) — compared
  the model with the new photos and the STL (an accurate plan of the interior).
  Hull and rig are close; the interior is wrong: modelled as a decked cockpit
  boat with a ring bag, where a real Opti is open with a mast thwart, centre
  thwart, three bags and V hiking straps.

## 2026-10-16

- [README, with every claim checked against the build](20261016_1352_readme.md)
  — what the project is, where the model lives, how to take it elsewhere.
  Writing it surfaced seven statements that were wrong: the three.js import
  style, the coordinate space `updateMainsheet()` wants, the peak height, the
  material count, the vertex-colour coverage, the CLI's `--sheet` sense, and a
  camera paragraph wrong twice over.
- [Named the export, and a headless export script](20261016_1352_glb-export-naming.md)
  — the `.glb` opened in Blender as `Material.004` / `Mesh.031`: 15 materials
  and 71 nodes, none named. Now 35 named nodes and 15 named materials, plus
  `.tools/export-glb.mjs` for scripted export. Clearcoat and sheen turned out
  to survive as KHR extensions after all.
- [Part labels: real overlap resolution](20261016_1148_part-label-layout.md) —
  labels now push each other apart and clear the control panel; five anchors
  recomputed onto their parts, including the mainsheet cleat that had gone
  stale when it moved to starboard.
- [Sail tell-tales drawn as ribbons](20261016_1148_sail-telltales.md) — the red
  smudges on the cloth were tell-tales painted as solid ellipses; now tapered
  yarn ribbons, four of them, reading correctly from either side.
- [Mainsheet control read backwards](20261016_1148_mainsheet-control-sense.md) —
  the slider labelled "Mainsheet" was an ease control, so 85% showed the boom
  hard over. Sense fixed at the UI boundary, plus four couplings keyed to the
  wrong end of the same fraction (heel, camber, leech hollow, sheet slack).
- [HTML viewer and scene](20261016_1148_html-viewer-scene.md) — `index.html` +
  `viewer.js`: locally vendored three.js, procedural sky and IBL, custom shader
  sea, camera presets, and a movable sail you can drag.
- [Optimist dinghy — parametric 3D model](20261016_1148_optimist-3d-model.md) —
  the hull lofted from the class dimensions as one watertight mesh, white
  outside and plywood inside, with decks, cockpit furniture and spars.
