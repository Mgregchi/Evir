# A growing feature gallery

Research and implementation: 10 October 2026. The user requested more examples of working features, with additions as Evir progresses. PR #16 is merged into main; it adds selection/navigation and experience quality. This gallery increment adds content and host controls, using the existing engine subset.

## Research and decisions

Reviewed the [public-site case studies](16-public-site-research.md), [editor acceptance](13-editor-milestone-acceptance.md), [experience-quality evidence](22-selection-and-experience-quality.md), the scene schema, Canvas evaluator, compiler and public runtime API before selecting examples. The API supports typed setInput, click and reset; authoring supports fill/numeric keys, hold/linear/cubic interpolation and independently weighted path controls. It does not provide gradients, text or mesh rendering in this editor subset.

The [live retrieval register](../research/showcase-gallery/sources.json) records resolved URLs and response hashes. [LottieFiles featured animations](https://lottiefiles.com/featured-free-animations) exposes browsing categories/keywords such as interactivity, loading, UI and success. Apply the principle of discoverable feature labels to five original studies, with direct links and inspection notes; search/pagination are not needed for five examples. The [Rive community](https://community.rive.app/) redirected to its Start Here route and supplied only a minimal page shell to the read-only retrieval. No detailed gallery behavior is inferred from that shell. Existing Rive/Framer/Penpot case-study observations remain separately cited. No third-party animation, community counts or endorsements are copied.

## Working examples

| Study | Features demonstrated | Inspect in Studio |
| --- | --- | --- |
| Milo | Cubic paths, two-bone weighted arm, boolean Idle/Hello states | Wave arm weights and Hello rotation keys |
| Orbit | Nested groups and a rotation loop | Satellite rotation track |
| Bloom | Captured bind transforms, two-bone chain, independent anchor/handle weights | Flexible stem influences and Breeze joint rotations |
| Tempo | Numeric and fill keys; cubic, linear and hold timing | Column height/Y tracks and easing types in Rhythm |
| Signal | Boolean and number inputs, AND gate, return conditions, click listener, transient trigger, reset | Flow inputs, conditions, celebration pad listener and constant state fill keys |

All scenes are original Evir project-model artwork; real Canvas captures supply their posters. Their editable source and compiler-produced `.riv` are downloadable. These illustrations use solid fills; a color transition is not a gradient feature. Signal's level input selects states, rather than representing a data-binding implementation. Its HTML Celebrate button calls the existing runtime click API for the celebration pad; the official-runtime check sends an actual canvas mouse click. Reset creates the initial pose/input defaults. Animation pause is independent from input changes, so interactions remain usable with reduced motion.

The gallery uses one static metadata catalog, `apps/web/examples.mjs`, for build asset requirements, capture, page content and export validation. It identifies features, alternatives and inspection instructions. Project generation remains in `generate-examples.mjs`. Add the scene there and register its metadata, then regenerate/capture/validate. A new interactive contract also needs its accessible host controls and explicit machine-input scenarios in the official-runtime test; the catalog does not invent them. No hosting targets or environment settings are added.

Previews initialize on their first visible intersection; below-fold scenes retain a poster until needed. A successful scene loads once per mounted card. The existing loop runs only when playing and visible, with fetch/listener/observer cleanup and poster/retry recovery retained. At five examples, visible-first loading limits initial work; scene unloading or large-gallery caching would need measurements before introducing extra complexity.

## Adding examples as features ship

Every new authoring/runtime feature should bring a small original study and a reproducible acceptance case. Keep the editable source, feature labels, keyboard-equivalent controls, useful static poster, inspection note and compatible export. Validate source references/weights, test the actual user interaction and compare representative poses with the official runtime. Never label a research-only fixture as a supported Studio feature.

Run:

```sh
node apps/web/generate-examples.mjs
EVIR_CAPTURE_EXAMPLES_ONLY=1 node tools/capture_site_assets.cjs
npm run web:build
npm run test:web
npm run test:experience
npm run test:frontend
npm run test:runtime
```

The regular `npm run web:assets` also regenerates the four actual Studio screenshots. The examples-only capture avoids unrelated screenshot changes during content additions.

## Acceptance scope

[Gallery browser evidence](../research/results/showcase-gallery/browser.json) covers deferred below-fold initialization, one project request per card, reduced-motion defaults, inspection notes, Signal guards/click/reset, 320/390/1440px layout/accessibility, and loading/exporting all five sources in Studio byte-for-byte. [Official-runtime evidence](../research/results/public-site/examples.json) compares 42 selected poses and interaction outcomes per backend (84 total) on Canvas2D and WebGL2 2.44.0. The oracle renders the requested zero-time state and stops its clock while capturing an interaction result.

[Final validation record](../research/results/showcase-gallery/validation.json) also records 12 frontend unit checks, six runtime contracts and the lifecycle/recovery regression pass. These checks establish the demonstrated subset; cloud/software graphics are not hardware or mobile measurements. Automated accessibility does not replace assistive-technology/user sessions. Production deployment remains separate from merging this content.

## Where the project stands and what remains

The engine packages implement editable source validation, playback/deformation, Canvas2D rendering, undoable authoring and compatible export for the declared subset. The public web app composes Studio at `/editor/studio/`; it is live according to the user. The structural binary reader/writer and broader generated-Rive research cases are implemented, but research runtime coverage is wider than what Studio can author.

Next authoring work: snapping/guides, freehand, more comfortable layer/panel/graph editing, then gradients, clips/feathering and richer deformation/animation contracts. Meshes/IK, blend trees/transition mixing, nested machines, text/raster assets, semantic `.riv` import and RML authoring still need supported contracts and implementation. Physical GPU/mobile measurements, heap/resource testing, controlled equivalent Editor exports and representative user sessions remain evidence gates. Supplied third-party exports are valuable corpus samples, but do not substitute for matched scenes. AI/agents are researched, not shipped. A custom GPU renderer or a new optimized binary format is not yet a justified commitment.
