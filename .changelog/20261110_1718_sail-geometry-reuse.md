# Sail geometry reshaped in place

2026-11-10 17:18

Request: make the further saving left over from the racing performance
work: the Optimist sail geometry was thrown away and rebuilt every frame
for every near boat.

## What changed

- **`model/opti-rig.js`**
  - `sailGeometry(corners, o, into)`: new optional third argument, a
    geometry it made earlier. Given one, it writes the new positions and
    uvs into the existing buffers, recomputes the normals and bounding
    sphere, and returns the same geometry. Without it, it makes a new one
    as before (now filling typed arrays directly).
  - `updateRig` passes `rig.sail.geometry` instead of disposing it and
    building a new one.
- Per sail and frame this saves: one `BufferGeometry`, three attribute
  arrays and a 4680-entry index list built as plain arrays and converted,
  and on the graphics card three vertex buffers, an index buffer and a
  vertex array object deleted and created again. The 837 vertices are
  still computed and uploaded each time the sail is updated.
- The ILCA 4 rig already reshaped its sail in place; not touched.

## Checked

- Headless Chrome (software GL), Optimist with the fleet out: sail
  geometry finite, normals unit length, bounding sphere 1.58 m, 837
  vertices; no console errors or warnings; screenshot of the fleet's sails
  (cloth shape, lettering, window, tell-tales) looks as before.

## Not done

- No frame-rate measurement (software GL only), as before.
- Nothing committed.
