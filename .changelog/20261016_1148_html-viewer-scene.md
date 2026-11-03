# HTML viewer and scene

`index.html` + `viewer.js` present the boat in a lit, shaded scene with a
custom water surface and a movable sail. three.js r169 is vendored locally in
`lib/` (no CDN), loaded as ES modules through an importmap.

## Scene

- `WebGLRenderer` with ACESFilmic tone mapping, PCF soft shadows, and
  `preserveDrawingBuffer` so the "Save image" button can read the canvas.
- Image-based lighting from a procedural sky run through
  `PMREMGenerator.fromEquirectangular`.
- A custom `ShaderMaterial` sea: four summed sine waves with analytic gradient
  normals, Schlick fresnel, sun glitter, and distance haze matched to the sky
  function. The grid is geometrically spaced and solved by bisection so detail
  sits near the hull, not out at the horizon.
- Sun placed on the port quarter — with the boom eased to starboard, a
  starboard sun left the boat sitting in the shadow of its own sail in every
  view.

## Controls

Wind, Mainsheet, and Draft sliders; Auto sail, Sea motion, Part labels,
Wireframe, Water, Turntable toggles; seven camera presets; .glb and PNG
export. Dragging the sail sideways sheets it.

The favicon is an inline SVG sprit-rig silhouette, so the page requests
nothing from the server and the console stays clean (the only error in a headless
run had been the browser's own `/favicon.ico` probe).

## Verification

`.tools/shot.js` drives headless Chrome (SwiftShader) through every camera
preset and trim state, capturing console errors. It waits on camera-position
stability (`settle()`) and rendered frames (`frames()`) rather than fixed
delays, because software GL runs at a few frames a second and the fly-to is
eased inside the render loop.
