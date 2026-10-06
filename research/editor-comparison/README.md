# Equivalent Editor export comparison

The official CLI projects verify and render, but they are not exports obtained from the web Editor. This comparison remains open until the actual files are available.

The four scene definitions in `spec.json` cover a static rectangle, a four-bone textured mesh, number/color/boolean data binding, and a feathered fill. The associated RML sources specify the same scenes mathematically. Open equivalent authored content in the Rive Editor and export its runtime `.riv` files as:

```text
research/fixtures/editor/static.riv
research/fixtures/editor/weighted-mesh.riv
research/fixtures/editor/data-binding.riv
research/fixtures/editor/feather.riv
```

Preserve the animation names `Bone0` through `Bone3`, machine name `Controller`, view-model name `Model`, and its `positionX`, `width`, `color` and `active` properties so the comparison can drive equivalent poses. The feather scene is a 64×64 rectangle centered at (128,128) on a 256×256 artboard, blue `FF2864DC`, clockwise fill, outer feather strength12. It differs in size/position from the earlier RML feather project; use the explicit specification rather than that project's smaller rectangle.

Add `provenance.json` here with `exportSource: "Rive Editor"`, `editorVersion`, `exportedAt`, and `operator`. Record the actual export provenance, not CLI build metadata. Do not include credentials. The comparison records hashes and sizes of the supplied files, checks both weighted-mesh poses and both data-binding states, and applies within-backend image-error bounds (normalized RGBA MAE < .001 and fewer than 1% of pixels differing by more than 2 channel levels). Both sides must render nonempty output.

Run `npm run compare:editor`. The command requires real files and provenance and exits nonzero if they are missing or the scenes differ. It does not substitute CLI exports to produce a passing result. Match failures need investigation rather than relaxed thresholds: differences may expose artboard layout, defaults, animation, binding or renderer behavior.

An authenticated Editor account/session is not currently available through this workspace's CLI. The public Editor URL being reachable would not establish such access. No upload, publication or account modification was attempted.
