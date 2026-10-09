# Exploring the additional Rive Editor exports

Received 9 October 2026. The user supplied five runtime `.riv` exports, with no editable `.rev` backups. [Structural inventory](../research/results/supplied-corpus-inventory.json) and [official-runtime probe results](../research/results/supplied-corpus-runtime.json) record filenames, hashes, features and precise scope. The originals and private screenshots remain outside the repository and public website.

## Findings

| Export | Bytes | Objects | Artboards | Useful research signals |
| --- | ---: | ---: | ---: | --- |
| Character poses | 5,998,357 | 428,293 | 2 | 18 animations, 404,236 double keyframes, clipping, feathering, constraints, layout, view-model conditions and listeners |
| Interactive character follow | 81,042 | 2,796 | 2 | Images/assets, root bone, clipping, target alignment and boolean listeners |
| Maasai-inspired event hero | 1,550,988 | 2,330 | 6 | 40 root/child bones, 48 skins, gradients, feathering, text, images, nested artboards and layout |
| StudioRun cosmic game | 13,363,082 | 102,020 | 17 | 174 animations in `Control`, 156 in another artboard, numeric/boolean/trigger listeners, hundreds of gradients, feathering, text and assets |
| Room decor mini-game | Unavailable | — | — | The attachment download tool rejects files larger than 32 MiB; this file was not inspected |

All four downloaded files parse without unknown schema types/properties in the inventory. Both raw-preserving and fully encoded reader/writer roundtrips reproduce each original byte-for-byte. This proves codec handling for these files; it does not mean Evir's editor can reconstruct every object as an editable scene.

The pinned official `@rive-app/webgl2@2.44.0` runtime successfully loaded one representative artboard and its first state machine from each downloaded export, matched the animation/machine inventory, produced nonempty pixels, and started the machine without page errors. The probe tried pointer movement/click input but has no interaction oracle. It blocked external requests and kept images private. Coverage alone is not a shape/pose correctness test; game completion, every artboard/state, equal-scene rendering and mobile performance were not asserted. Load timings are exploratory cloud values, not cross-device benchmarks.

## What this adds to the project context

These files contain much more than basic animated paths. They provide concrete cases for constraints, nested artwork, text/assets, layout, skinning, listeners and view-model contracts. The pose export also shows that keyframe volume can dominate object count: simple-looking characters do not necessarily have small animation data.

The banner is useful for future controlled rigging/text/layout cases. The follower is useful for pointer/target contracts and images. The game is useful for interactions, many timelines and asset-heavy scenes. Their current success in the official runtime does not close Evir's unsupported authoring features or indicate that the smaller Evir showcases are equivalent scenes.

The next comparison step remains selecting a small, specified scene from an Editor project, matching its geometry, rig/weights, animation timing, state-machine/data contract and assets in Evir, then checking expected poses and interactions. Runtime exports expose useful object/data evidence, while an editable backup or documented authoring setup helps explain intent and export defaults. See [the controlled comparison protocol](../research/editor-comparison/README.md).

The public site therefore uses original Evir examples and actual Evir editor captures. Receipt of third-party runtime files supplies research inputs; it does not establish artwork ownership, redistribution terms or Evir feature parity. The room-decor attachment and the deferred device audit remain explicit gaps.

## Reproduce privately

```sh
python3 tools/inspect_supplied_corpus.py /path/to/export1.riv /path/to/export2.riv \
  --output /tmp/evir-corpus.json
EVIR_CORPUS_INVENTORY=/tmp/evir-corpus.json \
  EVIR_CORPUS_OUTPUT=/tmp/evir-corpus-runtime.json \
  EVIR_CORPUS_SCREENSHOTS=/tmp/evir-corpus-screenshots \
  node tools/probe_supplied_corpus.cjs /path/to/export1.riv /path/to/export2.riv
```

The inventory script accepts `--blocked filename` to record an unavailable input. The probe requires matching inventory filenames/hashes and uses the environment variables shown above for private outputs. Keep originals and screenshots outside public directories. These inputs are not included in ordinary site or CI builds.
