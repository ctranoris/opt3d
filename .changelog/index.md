# Changelog

Log of completed actions on the Optimist 3D viewer. Newest first.

## 2026-11-03

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
