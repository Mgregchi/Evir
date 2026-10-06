# Sources and provenance

Inspected on 2026-10-06. All Git-based evidence uses immutable commits. Direct `rive.app` documentation and `releases.rive.app` installer retrieval returned proxy HTTP 403; official docs were read from their public Git repository instead. No login or credential was required for the evidence or the generated web-runtime checks.

## Official documentation

Repository: [rive-app/rive-docs](https://github.com/rive-app/rive-docs/tree/8879acbbefbf676c8d68d66c2ddfe56c6ee50914), commit `8879acbbefbf676c8d68d66c2ddfe56c6ee50914`.

- [Runtime file format](https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/runtimes/advanced-topic/format.mdx): header, baseline keys, context and hierarchy.
- [RML](https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/runtimes/advanced-topic/rml.mdx): XML types, references, fragments, CLI schema lookup and independent validation checks.
- [Renderer selection](https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/runtimes/choose-a-renderer/overview.mdx): Canvas2D vs Rive Renderer and package mappings.
- [Transitions](https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/editor/state-machine/transitions.mdx): conditions, paths, timing and actions.
- [CLI getting started](https://github.com/rive-app/rive-docs/blob/8879acbbefbf676c8d68d66c2ddfe56c6ee50914/cli/getting-started.mdx): supported platforms, local offline building and authentication boundaries.

## Official implementation

Repository: [rive-app/rive-runtime](https://github.com/rive-app/rive-runtime/tree/7aa93402a27c800db8a36acc8672612c100ea9b1), commit `7aa93402a27c800db8a36acc8672612c100ea9b1`.

- [Runtime header](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/include/rive/runtime_header.hpp): authoritative ToC grouping and version parsing.
- [File importer](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/file.cpp): registry-first unknown-property decoding and object context handling.
- [Binary reader](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/core/binary_reader.cpp) and [field types](https://github.com/rive-app/rive-runtime/tree/7aa93402a27c800db8a36acc8672612c100ea9b1/src/core/field_types): lengths, numeric representations, bounds and booleans.
- [Generated schema](https://github.com/rive-app/rive-runtime/tree/7aa93402a27c800db8a36acc8672612c100ea9b1/include/rive/generated) and [registry](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/include/rive/generated/core_registry.hpp): type/property keys and inheritance.
- [ImportStack](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/include/rive/importers/import_stack.hpp) and [importers](https://github.com/rive-app/rive-runtime/tree/7aa93402a27c800db8a36acc8672612c100ea9b1/src/importers): owner contexts and separate component/animation/state reference spaces.
- [State-machine instance](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/animation/state_machine_instance.cpp), [transitions](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/animation/state_transition.cpp) and [boolean condition](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/src/animation/transition_bool_condition.cpp).
- [Bones](https://github.com/rive-app/rive-runtime/tree/7aa93402a27c800db8a36acc8672612c100ea9b1/src/bones): root transforms, parent-tip placement, skin matrices and packed weights.
- [Renderer GPU definitions](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/renderer/include/rive/renderer/gpu.hpp) and [render context](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/renderer/src/render_context.cpp): pixel-local storage, path batching, buffer rings and backend selection.
- [Actual RML fixture](https://github.com/rive-app/rive-runtime/blob/7aa93402a27c800db8a36acc8672612c100ea9b1/tests/unit_tests/assets/rml/listener_input_values.rml): nested elements, stable references and CLI-based fixture construction.

The extracted metadata and copied upstream fixtures retain Rive's MIT license alongside them. Generated fixtures and the codec are authored in Evir. Upstream examples are evidence and tests, not Evir implementation.

## Executed runtime artifacts

NPM packages `@rive-app/canvas@2.44.0`, `@rive-app/webgl2@2.44.0`, `playwright@1.63.0`, and `pngjs@7.0.0` are pinned in `package-lock.json`, including registry integrity hashes. The web packages supply their own WASM binaries; tests serve those locally rather than relying on a mutable CDN URL. Exact browser, Node, graphics implementation and host metadata are recorded in each benchmark JSON. Current upstream source is a source reference, not a claim that its HEAD and these prebuilt packages contain identical implementations.
