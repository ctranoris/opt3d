# Sail tell-tales drawn as ribbons, not blobs

The sail texture carried its tell-tales as two solid red ellipses. At sail
scale they read as red smudges printed on the cloth — in the quarter view they
were the first thing people asked about, and nothing in the scene was actually
broken.

## Fix

Real tell-tales are short yarn ribbons stitched flat to the cloth and
streaming aft. Each is now drawn as a tapered quad — wide where it is sewn
down, narrow at the free end — with a slight rake and a small dark stitch tab
at the root. Four of them, placed to read flow the way a sailor uses them: a
pair forward near the luff, and one at each batten tip to read the leech.

```js
for (const [u, v, len] of [
  [0.13, 0.78, 0.075], [0.15, 0.44, 0.070],
  [0.86, 0.72, 0.060], [0.83, 0.42, 0.058],
]) { /* tapered quad, rotated 0.10 rad, plus a stitch tab */ }
```

## Note on the mirror

The sail is double-sided cloth: `Material.onBeforeCompile` flips `vMapUv.x`
on back faces so the number and insignia read correctly from either side. The
tell-tales inherit that flip, which is right — they are printed on the cloth,
and from the leeward quarter they should appear on the mirrored side. Verified
in both `shot_cam_sail` (windward) and `shot_cam_leeward`.
