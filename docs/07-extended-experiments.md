# Extended compatibility and rendering experiments

This pass follows the original research baseline and the user's rendering note. It adds targeted semantic cases without treating small tests as full production-feature support.

## Results

Eight additional cases pass on each official web backend (`@rive-app/canvas` and `@rive-app/webgl2`, both 2.44.0):

| Case                       | Independent check                                                                                | Scope                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Weighted path deformation  | Fixed, fully moving and mixed vertices; centroid, area and spatial alpha assertions at two times | A six-vertex path with two bones and packed four-slot weight format; not a complete arbitrary mesh exporter |
| Trigger                    | Two firings switch left/right; intervening frames hold the pose                                  | Trigger consumption, rather than repeatedly toggling from a stale fired value                               |
| Blend                      | Inputs 0, .25, .5, .75, 1 produce corresponding positions                                        | One-dimensional two-animation blend, with reset enabled                                                     |
| Reset                      | Restarting the trigger machine returns to its initial pose                                       | Playback-instance reset; not every animation-reset mode                                                     |
| Listener                   | A pointer-down inside the shape fires a trigger and changes pose                                 | One pointer listener and action; not comprehensive listener/data-binding support                            |
| Cubic curve                | Expected circle-like area and centroid                                                           | Detached cubic handles, not all path winding/intersection cases                                             |
| Gradient                   | Opaque left red/right blue sample assertions                                                     | Linear gradient with two stops                                                                              |
| Clip                       | Area reduces to 64×64 at the expected position                                                   | A source-shape clip attached to a containing node                                                           |
| Official RML static export | Pixel hash equals independently authored static fixture within each backend                      | RML/CLI verification, inspection and runtime execution                                                      |

Reset is checked as part of the trigger case, so the table has nine behaviors but eight loaded cases per backend. All generated cases are built from schema records rather than copied from editor exports. The original 16 codec tests still pass, and geometry tests check area, winding, concavity, degeneracy, subdivision tolerance and endpoints.

### Blend reset matters

The initial blend probe without the reset flag did not yield the expected quarter-position. Inspection of the pinned implementation showed the reset option seeds property values before accumulating animation contributions. Setting `LayerStateFlags::Reset` (bit 1, value 2) makes the tested blend positions stable and correct. This is a concrete reason to validate intermediate poses rather than accept a graph solely because it imports.

### Official authoring is now exercised

Public access allowed installation of official Rive CLI 1.4.0. Its installer verifies the release archive against the manifest SHA-256; TLS and verification were retained. The binary required `libGLESv2.so.2`; Debian's signed package metadata supplied `libgles2` 1.7.0-1+b2, extracted outside the system tree. The CLI was run through the dynamic loader with that library directory. It does not need a Rive account for these local projects.

`tools/compile_rml.py` compiles copies in fresh temporary directories, checks `--verify`, requires an empty inspect `problems` list, builds with `--once`, and records hashes and sizes. It does not publish, upload scenes or authenticate to an account. The retained projects have explicit default artboards and layout styles; early inspect warnings were corrected before the final recorded builds.

The independent static `.riv` is **76 bytes**; the official RML/CLI version is **153 bytes** and matches its pixels on both web backends. The CLI export carries layout-style and skip-table metadata that the small independent scene omits. Equivalent visible pixels do not make the files equally capable as editor/authoring documents. This is an official **CLI export comparison**, not an Editor export comparison and not evidence that our writer is generally superior.

## Original feathering failure (resolved in the following pass)

**Update:** [the following pass](08-complex-rendering-and-feathering.md) identified the missing clockwise fill rule and now validates soft edges. The paragraphs below describe the original observations, retained for context.

Both an independently generated feather fixture and an official CLI feather export compile structurally, but yielded completely empty captures in the current WebGL2 cloud tests. Fresh pages avoid mixing incompatible 2D/WebGL canvas contexts; offscreen false/true and repeated draw requests were tried. All four combinations failed the visible-pixel check. The original dedicated probe retained the observations and exited nonzero; the general advanced passing suite deliberately covers the eight supported cases and does not claim feathering passed.

The failures do not identify the root cause as either the format writer or the shader math. They establish that compilation/inspection alone does not validate feather output, and that the observed failure also occurs through the official authoring route. No claim is made about real GPU or native renderer behavior. At that point further debugging was needed; the recorded failure is not silently converted into an expected pass.

## Independent triangle lab

The lab runs its own WebGL2 vertex and fragment shaders, without Rive. A four-cubic circle is flattened to **128 vertices / 126 triangles**, preserving a polygon area of approximately **16,877.37 pixels²**. The reference is Canvas2D cubic rendering at 8× linear resolution, box-averaged to 256×256.

| Mode             | Edge mean absolute alpha error | Full-image coverage RMSE |
| ---------------- | -----------------------------: | -----------------------: |
| Aliased          |                         .19437 |                   .02360 |
| Explicit 4× MSAA |                         .07177 |                   .00879 |
| 2×-axis SSAA     |                         .06590 |                   .00795 |
| 4×-axis SSAA     |                         .02419 |                   .00296 |
| 8×-axis SSAA     |                         .01063 |                   .00133 |

The sampled modes reduce edge error in this particular test. They do not prove universal ordering of AA methods. The reference itself is an approximation, and flattening adds geometric error. SSAA can increase work and memory greatly: 8× along each axis uses 64× pixel area. The recorded one-shot CPU submission durations are quantized and exclude GPU completion, so they are not used to rank performance. All results use ANGLE/SwiftShader software graphics.

The triangulator is for small, simple, single-contour polygons. It is not a production implementation for holes, self-intersections or arbitrary winding. The lab does not reproduce Rive's signed-coverage patches, feathering, complex paints or batching.

## Reproduction

After `npm ci`, run:

```bash
npm run research:advanced
```

This generates the eight independent probes (including the separate feather fixture), runs the original codec tests and geometry checks, validates the eight supported cases on both web backends, and runs the triangle lab. The official RML binary artifacts are retained, so a CLI is not required to repeat browser validation. CLI regeneration and the separate feather probe are additional commands:

```bash
RIVE_CLI=/workspace/evir-research/rive-cli/run npm run compile:rml
npm run probe:feather
```

`probe:feather` now checks corrected clockwise fills, inner/offset/clipped soft edges and explicit negative controls. It exits nonzero on unexpected outcomes. The original failures are retained separately, and the resolution is explained in the following pass. The loader wrapper path above is specific to this workspace; on a machine with the required system libraries, set `RIVE_CLI` to its installed `rive` executable.

To reproduce CLI installation here, download and inspect the official installer from `https://releases.rive.app/cli/install.sh`, then run it with `RIVE_VERSION=1.4.0` and an installation directory under `RIVE_HOME`. The release archive is checksum-verified by that installer. Ensure the native library prerequisite is available, then use `tools/compile_rml.py`. No secret values are needed.

Raw evidence:

- [Canvas advanced validations](../research/results/advanced-validation-canvas.json)
- [WebGL2 advanced validations](../research/results/advanced-validation-webgl2.json)
- [CLI export provenance](../research/results/rml-export.json)
- [Static CLI inspection](../research/results/rml-static-inspect.json)
- [Feather CLI inspection](../research/results/rml-feather-inspect.json)
- [Original feather failures](../research/results/feather-probe-before-fill-rule.json)
- [Triangle quality results](../research/results/vector-lab.json)

## Remaining gaps

Real hardware GPU and physical mobile measurements remain absent. Device emulation or SwiftShader would not substitute for those observations. The web Editor comparison still needs an actual editor export of the same scene; local CLI compilation does not establish that result. Blend trees beyond the tested 1D case, general weighted meshes, listener families, winding/holes, overlapping transparency, richer clip stacks and feathering were further compatibility work at this stage. The following pass adds coverage for winding, nested clips, compositing, direct blending and a working feather path.

The original PR has been merged as [PR #1](https://github.com/Mgregchi/Evir/pull/1); these experiments extend its baseline. The decision remains to grow tested compatibility and measurement coverage before designing a new wire format or promising a replacement renderer.
