# Rendering foundations for Evir

This investigation follows the user's rendering note. The source video was not supplied, so its identity and specific claims are unverified. The concepts below are checked against renderer source, official explanations and a runnable triangle experiment. They should be read alongside [the architecture baseline](01-rive-overview.md) and [extended experiments](07-extended-experiments.md).

## Corrections that affect the design

Triangles are the main primitive of the conventional GPU rasterization pipeline, but 'everything is triangles' is not a complete description of modern vector rendering. Compute-based pipelines can calculate coverage and compositing without first triangulating every filled shape. Curves also need not be converted into a single non-overlapping interior mesh: Rive uses specialized patches with signed coverage as well as an interior-triangulation path.

A 2D engine needs painter's order, alpha compositing, fill rules and clipping. Keeping only the closest surface cannot implement overlapping translucent fills. Depth/stencil can accelerate or organize selected operations, but do not remove ordering and blend semantics. Early-Z helps workloads with rejectable depth-tested fragments; it is not a universal solution to 2D overdraw.

MSAA samples coverage/depth at multiple positions. Ordinary MSAA does **not** necessarily execute the fragment shader separately at every sample. Resolving combines sample results. SSAA increases rendering resolution and shading work before downsampling. A 2× increase along each axis means approximately 4× as many pixels; our 8×-axis reference has 64× the pixel area.

Vector feathering is broader than normal edge AA: it produces intentionally soft fills, strokes and shadows. Rive's explanation relates it to Gaussian-like vector-space coverage. It is not just a larger MSAA setting, nor merely a generic blur applied to the completed framebuffer.

Canvas and SVG are APIs/content models, not blanket guarantees of CPU-only rendering. Browser implementations can use GPU acceleration and compositing. SVG additionally carries retained-document/style/layout costs that do not apply identically to immediate-mode Canvas. A comparison must specify the actual backend, scene, updates and visual result.

CPU/GPU distinctions are useful but coarse: branching divergence, memory access, occupancy, bandwidth and synchronization matter alongside parallel arithmetic. Increasing triangle count can lose performance when fragment work or memory bandwidth dominates.

## Curves to rasterization

```mermaid
flowchart LR
    A[Scene updates and path edits] --> B[Transform-aware curve subdivision]
    B --> C[Geometry or coverage encoding]
    C --> D[Vertex shader]
    D --> E[Triangle coverage rasterization]
    E --> F[Fragment coverage and paint evaluation]
    F --> G[Ordered blending and clip handling]
    G --> H[Framebuffer resolve and presentation]
```

Ear clipping can triangulate a small simple polygon, including concave contours; it is straightforward but scales poorly. Constrained triangulation requires robust predicates and explicit handling of holes and fill semantics. Neither is an automatic solution to Bézier curves, self-intersections, stroke joins or nonzero/even-odd winding. Curves first need an approximation or an analytical treatment; flattening tolerance should be evaluated in screen space and revisited when transforms change.

The pinned Rive `gpu.hpp` describes GPU-style tessellation into a texture containing positions and normals, followed by instanced patches. `midpointFan` patches contain interior fans and approximately one-pixel AA borders. `midpointFanCenterAA` splits inset/outset contributions. The `outerCurves` path tessellates curve boundaries while separately triangulating interior connections on the CPU to reduce overlap. Therefore the correct answer to 'how does Rive turn paths into triangles?' is a family of strategies coordinated with signed coverage and paint evaluation, not one generic polygon triangulator.

Path identifiers in pixel-local storage allow batching without clearing coverage for every path. Ring buffers permit CPU preparation to overlap GPU execution. Platform-dependent raster-ordering, atomic and depth/stencil alternatives change the tradeoffs. These mechanisms are described in the inspected source, but our small experiment does not reproduce Rive's batching, PLS, feathering or renderer scheduling.

## Anti-aliasing choices

| Method            | Work and useful cases                                             | Cost or limitation to measure                                                             |
| ----------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| MSAA              | Sample coverage/depth within a pixel; conventional triangle edges | Attachment storage and resolves; sample limits; fragment-shading behavior varies          |
| SSAA              | Render a larger image and downsample                              | Pixel work, intermediate memory and bandwidth grow with area                              |
| Coverage AA       | Compute or interpolate fractional edge coverage                   | Join/intersection correctness, compositing and signed overlap                             |
| Analytical AA     | Integrate an edge model over the pixel footprint                  | Curve/corner mathematics and approximation error                                          |
| FXAA              | Image-space smoothing based on detected edges                     | Can soften text/detail; lacks original vector coverage                                    |
| TAA               | Accumulate jittered frames using temporal information             | History, motion reprojection and ghosting; poor default for isolated UI correctness tests |
| SDF/MSDF          | Reuse distance representations for glyphs/icons                   | Small-feature/corner quality, atlas resolution, scaling and stroke effects                |
| Vector feathering | Integrate contributions over intentionally softened vector edges  | Wide-edge overlap, winding, curves, corners, precision and backend support                |

AA coverage and colors should be composed consistently with premultiplied alpha and an explicit color-space policy. Counting covered pixels alone is not a complete quality metric. Our lab measures fractional-alpha differences at reference edge pixels and whole-image coverage RMSE; it does not assess color-space, overlapping transparency, temporal stability or perceived quality across all content.

## Feathering evidence

The official article [How Rive reinvented feathering for the vectorian era](https://rive.app/blog/how-rive-reinvented-feathering-for-the-vectorian-era), read on 2026-10-06, explains expanding edge ramps and accounting for signed contributions where softened edges overlap. Its discussion of a two-dimensional integral and clockwise fill behavior is consistent with the implementation's positive/negative coverage conventions. The shader `draw_path_common.glsl` references Gaussian-integral textures and feather coverage classification; the render context also has feather-atlas allocation and fallback paths.

This article is an explanatory account from Rive, not an independently reproduced performance study. No separately identified peer-reviewed 'Vector Feathering paper' was verified. The source header links renderer algorithm documents, but their mere presence is not evidence that we read or validated every derivation. A faithful reimplementation appears feasible in principle from the published code and descriptions, but a linear `smoothstep` around a distance edge would not establish equivalence to Rive's curved and overlapping feather behavior.

Our feather probes currently fail to produce visible pixels in this cloud setup, including an official CLI export. That result is scoped to package 2.44.0, Chromium and the observed graphics implementation. It does not establish that Rive feathering generally fails, nor isolate the failure to its math. See the retained probe rather than treating successful file compilation as rendering validation.

## Compare renderer families, not slogans

| System        | Evidence inspected                                                              | What Evir should learn                                                                                            |
| ------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Rive Renderer | Pinned GPU definitions, shaders and render context; official feathering article | Signed coverage, adaptive patches, batching, feature-dependent rendering                                          |
| Vello         | Pinned README and architecture document                                         | The current project has CPU, hybrid GPU and compute research paths; 'Vello is compute-only' is outdated           |
| Pathfinder    | Pinned README                                                                   | GPU vector rasterization with conventional and compute-capable paths; browser/native backend constraints          |
| NanoVG        | Pinned README                                                                   | Geometry/fringe AA, stencil requirements and practical API scope; repository states it is not actively maintained |
| Impeller      | Official engine README                                                          | Offline shader preparation, explicit resource/pipeline management and instrumentability                           |
| Skia / Canvas | Rive's documented renderer separation; Canvas2D reference experiments           | Compare a concrete Skia backend and API workload before attributing a cost to 'Canvas'                            |

No end-to-end comparative performance benchmark of all these engines was run. Vello's current Sparse Strips family preprocesses paths on the CPU and uses sparse tiled/strip coverage; its hybrid GPU renderer supports WebGL2 without compute shaders. The original compute renderer remains under a research directory. This illustrates why hardware compatibility should guide a minimum viable renderer rather than assuming newer always means compute-only.

'Form' in the note is not an unambiguous project identifier. It is not assigned an architecture or benchmark result without an exact repository or publication.

## Performance experiment design

Measure CPU scene update, flattening/tessellation, upload bytes, submission, GPU completion, presentation, texture/buffer memory and peak allocation separately. Readbacks and synchronous queries can serialize CPU/GPU work; do not put them into the hot path and call the result an ordinary frame time. GPU timer queries need support and disjoint-result checks; CPU submission is not GPU duration.

Vary path complexity, view scale, overlap, clip depth, paints and changing versus static content. Triangle count does not measure the number of repeatedly shaded pixels. Excessive overdraw and wide feather footprints can stress bandwidth. Tile-based mobile GPUs can reduce some attachment traffic, but resolves, tile spills, blending and large intermediates still cost memory and work. Batching must preserve draw order and state compatibility; instancing similar patches can save submission overhead without eliminating fragment costs.

The runnable lab flattens a single cubic circle at 0.1 output-pixel tolerance, ear-clips it, and submits flat-color WebGL2 triangles. It compares aliased output, explicit 4-sample MSAA and 2×/4×/8×-axis SSAA against an 8×-axis Canvas2D cubic reference. It validates polygon area and improved edge error for the selected sample; it is a foundation experiment rather than an Evir production renderer.

## Minimum viable renderer hypothesis

Start with ordered solid fills, simple contours and explicit bounds; use transform-aware curve flattening and a verified triangulation/fill policy. Add correct alpha blending and clipping, then strokes/gradients and reusable geometry. MSAA can be a baseline when available, with coverage AA worth investigating for constrained hardware. Cache static geometry and invalidate it when animated paths or relevant transforms change.

Do not promise arbitrary SVG paths, weighted skinning on the GPU, signed coverage, native mobile support or Rive-quality feathering from this lab. The next renderer experiment should add concave/hole/intersection quality tests and overlapping translucent content before making speed comparisons. Keep the official runtime as the semantic reference while those capabilities mature.

## Additional source revisions

- [Rive runtime GPU definitions](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/renderer/include/rive/renderer/gpu.hpp) and [coverage/feather shaders](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/renderer/src/shaders/draw_path_common.glsl).
- [Vello architecture](https://github.com/linebender/vello/blob/c005e30ecbad6377c4cbea7aa39d2f1e5948bc38/ARCHITECTURE.md), revision `c005e30ecbad6377c4cbea7aa39d2f1e5948bc38`.
- [Pathfinder README](https://github.com/servo/pathfinder/blob/6c3c0466f451c5bd2007087728cd168798cd64e8/README.md), revision `6c3c0466f451c5bd2007087728cd168798cd64e8`.
- [NanoVG README](https://github.com/memononen/nanovg/blob/ce3bf745eb2d2dbc14a50bf2446783f691ac4353/README.md), revision `ce3bf745eb2d2dbc14a50bf2446783f691ac4353`.
- [Impeller README](https://github.com/flutter/engine/blob/main/impeller/README.md), read on 2026-10-06; this particular URL is mutable, unlike the pinned references above.
