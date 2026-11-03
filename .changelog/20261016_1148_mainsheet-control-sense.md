# Mainsheet control read backwards — fixed

The slider labelled **Mainsheet** was an *ease* control. `state.sheet` counts
how far the boom is out (0 on the centreline, 1 hard over), so pushing the
slider to 85% — which a sailor reads as "sheeted in hard" — actually showed
the boom 63° off the centreline with the readout agreeing, saying "85% sheet /
boom 63°". The label, the readout, and the underlying value disagreed about
which end of the travel was which.

## Fix

The internal value keeps its meaning (the rig solves for a boom angle), and
the sense turns over at the UI boundary in exactly two places:

```js
const sheetToSlider = (s) => Math.round((1 - s) * 100);
const sliderToSheet = (v) => 1 - v / 100;
```

Both the slider's own `input` handler and the sail-drag handler now go through
these, as does the auto-sail animation writing back to the slider, so the four
paths cannot drift apart.

## Three more of the same bug class

Once the sense was pinned down, four couplings turned out to be keyed to the
wrong end of the same fraction:

- **Heel** grew with the boom angle, so easing the sail *heeled the boat
  over*. Now runs off `1 - boomOut`: sheet her in, she powers up and stands up
  less. Pulled into one `heelDeg()` shared by the render loop and the readout,
  which previously carried a duplicate copy of the formula.
- **Camber** deepened as she was eased. Sheeting in is what powers the boat up.
- **Leech hollow** hooked *out* when sheeted in; leech tension hooks it in.
- **Mainsheet slack** hung lodest when the sheet was pulled taut.

The root of all four was a local named `eased` that held the *sheeted-in*
fraction, and a rig field named `sheetOut` holding the boom angle. Both renamed
(`sheetedIn`, `boomOut`), and the `updateRig` parameter is now `boomOut`, so
the names say what the terms need.

## Verification

Probed through the range with the boat's own `pivot.rotation.y`:

| slider | boom | heel |
|--------|------|------|
| 100%   | 0°   | 4.5° |
| 65%    | 26°  | 3.3° |
| 0%     | 74°  | 1.2° |

The debug screenshots named `sheeted_in` and `eased` now show what their names
claim (boom 11° and 70° respectively).

## Note for later

The leech measures 1.72 m across the corners the model solves, against the
2.59 m recorded in `SPEC` as "8'-6" peak → corner". The corners themselves
check out against the plan (foot 1.93 m, head→peak 1.22 m, peak 2.34 m up), so
the class figure is almost certainly measured along the cloth with the sprit
laced to it rather than straight between the corners. Worth confirming against
the rule rather than changing geometry on the strength of a comment.
