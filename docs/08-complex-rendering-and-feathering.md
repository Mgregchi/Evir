# Complex rendering, direct blending and the feathering correction

This pass extends the merged research baseline with 14 cases per official web backend, four freshly compiled RML projects, and a stronger feathering diagnostic. Packages remain pinned to Canvas2D/WebGL2 2.44.0 and the CLI to 1.4.0. These are compatibility experiments, not a production renderer or complete exporter.

## Feathering now works in the cloud

The earlier empty captures were caused by an authoring error: the feathered fills used the default `nonZero` rule. Rive requires `clockwise` for feathered fills. The pinned renderer explicitly returns without drawing under another fill rule. The Editor sets this rule when feathering is enabled; the CLI accepts the invalid combination without reporting an inspection problem.

We missed this requirement in the previous pass. Both the independent writer and the RML source now set it explicitly. The independent fixture grows from 88 to **90 bytes**; the official CLI fixture grows from 158 to **160 bytes**. The previous four failed captures are retained in [the original failure evidence](../research/results/feather-probe-before-fill-rule.json); the original sources remain available in commit `a5eb041`.

The expanded diagnostic runs nine scenes with offscreen rendering both enabled and disabled:

| Cases                                                                         | Outcome                         | Independent assertions                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Independent and official CLI outer feather, clockwise control, offset feather | 8 successful soft-edge checks   | Opaque center, fractional alpha inside and outside the geometric edge, zero distant alpha, expected centroid |
| Inner feather                                                                 | 2 successful soft-edge checks   | Fractional interior edge, transparent center and exterior; coverage contained within original shape          |
| Clipped feather                                                               | 2 successful soft-edge checks   | Fractional inner edge, opaque center, exact 64×64 clip coverage, no exterior coverage                        |
| Zero strength with nonZero fill                                               | 2 successful hard-edge controls | Exact 64×64 coverage and no soft exterior                                                                    |
| NonZero fills at strengths 1 and 4                                            | 4 confirmed renderer skips      | Empty output under the documented unsupported combination                                                    |

Thus **12 soft-edge checks and 2 hard-edge controls pass**, while 4 negative controls confirm the renderer's explicit skip behavior. They are labelled separately in [the current results](../research/results/feather-probe.json). The command exits nonzero on any unexpected outcome. Captured context diagnostics identify SwiftShader, report no context loss or outstanding GL errors, and include console warnings/errors.

An inner feather paints the interior boundary of the inverse path clipped to the original shape; it does not turn the whole interior into an opaque softened fill. Offset tests move the feather centroid 16 pixels right. These observations are specific to the small tested shapes. They do not establish feather performance on physical GPUs or equivalence to an independently implemented algorithm.

Authoritative references:

- [Fill rules and feathering](https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/editor/fundamentals/fill-and-stroke.mdx).
- [Renderer skip for non-clockwise feathered fills](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/renderer/src/rive_renderer.cpp), `RiveRenderer::drawPath`.
- [Inner path and offsets](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/shapes/paint/feather.cpp) and [paint clipping](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/shapes/paint/shape_paint.cpp).
- Official CLI 1.4.0 bundled `docs/drawing.md`, which explicitly describes the clockwise requirement and the empty `inspect.problems` pitfall.

## Complex path and paint acceptance

Four winding cases check area and center/exterior alpha against independently calculated expectations. A 160×160 outer contour and 64×64 inner contour give:

- `nonZero`, same direction: 25,600 covered pixels; the center is filled.
- `nonZero`, opposite direction: 21,504 pixels; the center is a hole.
- `evenOdd`, either direction: 21,504 pixels; the center is a hole.

A self-intersecting bow tie checks both lobes and an exterior point, with a coverage bound around its analytic area of 8,192 pixels². Fractional diagonal coverage makes the nonzero pixel count slightly larger than analytic area; exact equality would be the wrong assertion.

Two overlapping semitransparent rectangles test declaration order and source-over compositing. Each isolated rectangle has alpha 128; overlap alpha is 192. Reversing declaration order reverses the dominant red/blue component, approximately 170/85. Rive traverses its drawable list in reverse: the first declared shape is on top in these cases. This order must be preserved by an exporter rather than assumed to follow SVG paint order. See [artboard traversal](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/artboard.cpp).

Nested clips intersect a 96×160 mask and a 160×64 mask to produce exactly 96×64 visible pixels. Other probes check a 16-pixel round-capped open stroke against rectangle-plus-semicircle area, and radial-gradient colors at the center and near the radius. Two independent state-machine layers simultaneously set horizontal and vertical position.

These cases all pass on Canvas2D and WebGL2. They expand official-runtime acceptance, not the capabilities of the independent lab triangulator: that lab still supports only simple single-contour polygons.

## Direct blending differs from the tested 1D blend

The direct state has two number inputs controlling two constant-position animations. Each weight is clamped to [0, 100] and divided by 100. Animation contributions are applied sequentially rather than normalized into a weighted average. For left pose 64, right pose 192 and weights `a`, `b`, the tested update is:

```text
x_next = ((1 - a) * x_previous + a * 64) * (1 - b) + b * 192
```

At inputs 75/25, starting at x=64, successive ticks give x=96, 102, 103.125 and 103.3359375. This is not the x=96 position of the corresponding normalized blend on every tick. Setting both weights to 100 makes the later animation win; setting both to zero preserves the previous value. Values outside the input range are checked against the clamped formula.

The direct fixture includes the reset bit used by the earlier 1D probe, but this direct implementation does not perform the 1D reset operation. The pinned [direct implementation](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/animation/blend_state_direct_instance.cpp), [blend accumulation](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/animation/blend_accumulator.cpp), and [1D reset implementation](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/animation/blend_state_1d_instance.cpp) explain the distinction. Do not generalize the earlier 1D flag behavior to every blend state.

The harness pauses playback and advances explicit zero-duration ticks through the pinned package's private state-machine wrapper, then requests drawing. This deliberately tests application semantics independent of wall-clock scheduling; the private access is research tooling, not a recommended application API. Eight input pairs are checked over four ticks for each of the independently written and official CLI exports, on both backends. A future package upgrade must revalidate this harness.

The CLI export of the direct scene is **321 bytes**, versus **245 bytes** for the independent scene. An official evenOdd RML export is **257 bytes**, versus **174 bytes** independently, and matches the independent scene's pixel hash within each backend. All four RML projects verify, inspect without problems, and compile in fresh temporary directories. The CLI sources and binary hashes are retained. These comparisons still do not substitute for equivalent exports obtained through the web Editor.

## Reproduction and the hardware boundary

```bash
npm ci
npm run research:complex
RIVE_CLI=/path/to/rive npm run compile:rml
npm run probe:hardware
```

`research:complex` regenerates fixtures, runs the codec and geometry checks, validates 14 cases on each backend, and runs all 18 feather/control configurations. CLI regeneration is optional because the compiled artifacts are retained.

The hardware probe checks contexts actually used by the runtime. This workspace exposes SwiftShader and no `/dev/dri` devices. Its probe records `hardware-unavailable` and exits 1. A new guarded benchmark command refuses software rendering or unavailable renderer identification **before collecting measurements or writing a hardware benchmark result**:

```bash
npm run benchmark:hardware
```

Run that command on a GPU-equipped machine with Chromium, using `CHROMIUM_PATH` where necessary. It writes a separate `research/results/runtime-benchmark-hardware.json`; the cloud baseline is preserved. Passing the renderer guard only identifies a hardware candidate. Record the physical device model, OS, driver/browser versions, display refresh rate, power mode, viewport/DPR and run conditions alongside repeated results before making hardware claims. The benchmark remains a desktop browser harness; physical mobile runs require an attached-device or on-device runner. GPU completion time and GPU memory are still not measured by the callback-duration/heap metrics.

The outstanding work is now arbitrary image/mesh deformation, additional transition/listener/data-binding families, complex feathered paths and paints, a physical mobile runner and measurements, and equivalent Editor exports. None is reported as complete by this pass.

Evidence: [Canvas cases](../research/results/complex-validation-canvas.json), [WebGL2 cases](../research/results/complex-validation-webgl2.json), [CLI provenance](../research/results/rml-export.json), [hardware availability](../research/results/hardware-probe.json).
