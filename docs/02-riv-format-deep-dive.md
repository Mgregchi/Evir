# `.riv` version 7: structural format and implementation

This document describes the original research baseline. See [extended experiments](07-extended-experiments.md) for later weighted-deformation, interaction, rendering and official RML/CLI results.

The executable reference for this investigation is the pinned runtime source listed in [Sources](sources.md). The current inspected C++ source declares format 7.4; generated fixtures deliberately use 7.0 features and are tested against web packages 2.44.0. Package versions and binary format versions are separate.

## Header and object stream

| Sequence              | Representation                                              | Interpretation                                                                         |
| --------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Fingerprint           | `52 49 56 45`                                               | ASCII `RIVE`                                                                           |
| Major version         | unsigned LEB128                                             | Our codec rejects majors other than 7                                                  |
| Minor version         | unsigned LEB128                                             | Declares compatible feature evolution                                                  |
| File ID               | unsigned LEB128, up to 64 bits                              | May be zero                                                                            |
| Property keys for ToC | unsigned LEB128 sequence, then key `0`                      | Keys that need a skip type                                                             |
| ToC type words        | little-endian 32-bit word for each group of up to four keys | Two significant bits per key at positions 0, 2, 4, 6; unused upper bits/padding remain |
| Object type           | unsigned LEB128                                             | Numeric schema type key                                                                |
| Object properties     | property key, then typed value, repeated                    | Property key `0` ends the object                                                       |
| Next object           | continues until EOF                                         | No object-count field or individual record length                                      |

The ToC is a property skip table, not a directory of object offsets. Baseline properties need not be present in it because the runtime already knows their types. If a property is unknown to the schema and absent from the ToC, its size cannot be determined safely. The parser reports the byte offset and fails rather than guessing.

The documentation's description of ToC packing is easy to read as densely packed bytes. The pinned `RuntimeHeader::read` actually reads a 32-bit word every four properties, resetting the bit cursor after eight significant bits. Our independent unknown-property test crosses this word boundary. Likewise, strings and byte arrays in the inspected runtime use a **varuint** byte length, rather than the fixed-width length one might infer from the documentation's binary-types summary. Implementation and round-trip evidence govern the codec.

## Wire values

| Semantic field                             | Wire encoding                              | ToC skip class                                       |
| ------------------------------------------ | ------------------------------------------ | ---------------------------------------------------- |
| Unsigned integer / runtime reference       | unsigned LEB128                            | 0                                                    |
| Signed integer in current generated schema | ZigZag encoded into unsigned LEB128        | 0                                                    |
| Boolean                                    | one byte; upstream true iff byte equals 1  | 0 for 0/1 compatibility; registry distinguishes bool |
| UTF-8 string                               | varuint byte length plus UTF-8 bytes       | 1                                                    |
| Embedded byte data                         | varuint byte length plus raw bytes         | 1                                                    |
| Floating-point value                       | little-endian IEEE 754 binary32            | 2                                                    |
| ARGB color                                 | little-endian unsigned 32-bit packed value | 3                                                    |

`CoreDoubleType` is a 32-bit float on the `.riv` wire despite its name. Editor `.rev` variants are different and are not accepted by this codec. Colors are little endian as integers: ARGB `FF123456` becomes bytes `56 34 12 FF`. UTF-8 lengths count bytes, not code points.

Small keys and references usually fit in one byte. Defaults can be omitted when their runtime semantics are known. A component with animated X position does not store 60 fully serialized scenes per second: it stores a small sequence of typed keyframes and the runtime interpolates them. These choices explain compactness more directly than an assumption that the whole `.riv` stream is compressed. Embedded PNG/font data may itself be compressed and dominate file size.

## Schema and index spaces

`packages/format/schema/runtime.json` contains 353 type definitions and 653 property wire descriptions extracted from generated C++ headers and `CoreRegistry::propertyFieldId`. Extraction retains source paths and an upstream commit SHA. Inheritance supplies the property names for authoring. The global registry is also necessary: historical/deprecated fields can be skippable even when no current class deserializer stores them.

| Concept                     |     Type key | Important keys / references                   |
| --------------------------- | -----------: | --------------------------------------------- |
| Backboard                   |           23 | Establishes file context                      |
| Artboard                    |            1 | Width 7, height 8, name 4; component index 0  |
| Shape                       |            3 | Parent 5, X 13, Y 14, rotation 15             |
| Rectangle                   |            7 | Width 20, height 21; parent points to shape   |
| Fill                        |           20 | Parent points to shape                        |
| SolidColor                  |           18 | Color 37; parent points to fill               |
| RootBone / Bone             |      41 / 40 | Root X/Y 90/91; length 89; rotation inherited |
| LinearAnimation             |           31 | Name 55, FPS 56, duration 57, loop 59         |
| KeyedObject / KeyedProperty |      25 / 26 | Target component index 51 / property key 53   |
| KeyFrameDouble              |           30 | Frame 67, interpolation 68, value 70          |
| StateMachine / layer        |      53 / 57 | Names inherited from machine component        |
| Boolean / number input      |      59 / 56 | Per-machine input indices                     |
| Entry / Any / Exit state    | 63 / 62 / 64 | Per-layer state indices                       |
| AnimationState              |           61 | Animation index 149                           |
| StateTransition             |           65 | Destination state index 151, duration 158     |
| Boolean / number condition  |      71 / 70 | Input index 155, comparison operator 156      |

Do not use stream record numbers as component IDs. Animation records are not components and do not increment component indices. Similarly, an animation's index is distinct from a component's and a layer's state index. The generator explicitly arranges ownership contexts and references; the structural reader intentionally does not implement the full semantic importer.

## Annotated files and corpus

The generated static fixture is 76 bytes. Its header is eight bytes: `RIVE`, major 7, minor 0, file ID 0, empty ToC. A Backboard and Artboard are followed by Shape, Rectangle, Fill and SolidColor. [Full byte annotation](../research/results/static-annotated.txt) includes object and property offsets. [Upstream clipping annotation](../research/results/artboardclipping-annotated.txt) shows an independently authored 195-byte upstream fixture.

Five upstream files cover clipping, bone/IK records, transitions, animation behavior, and embedded text/image assets. Provenance, license and SHA-256 hashes are in [the corpus manifest](../research/fixtures/upstream/manifest.json). All five pass byte-identical structural parse/write round trips. This verifies decoding and preservation of their streams; it does not prove that our own code implements their skinning, text layout or animation semantics. Generated-fixture browser tests establish those semantics only for the subset described in [Recreation](03-recreation.md).

Embedded assets are file-level records such as `ImageAsset`, `FontAsset` and `FileAssetContents`. Content bytes can be stored inline. Other assets can require application loading or hosted retrieval. The parser represents opaque byte arrays as hex to avoid interpreting them as text. This is convenient for inspection but increases Python allocation costs. The asset-heavy upstream fixture demonstrates why file-size and parser-allocation metrics must be stratified by content.

## Compatibility, malformed input and limits

Unknown object types are retained structurally if every property can be read through the known schema or ToC. Unknown length-prefixed properties are retained as opaque bytes. Current schema interpretation wins over ToC skip classes. The codec rejects truncated fields, overflowing integers, unsupported majors, invalid UTF-8 strings and untyped unknown properties. It keeps field offsets and original value bytes for forensic inspection.

`write(parsed, preserve_raw=True)` preserves raw value representations. It is explicitly a lossless preservation mode: editing `value` while retaining `raw` will not change that field. Normal `write(parsed)` encodes the current values and is the correct mode for edits. Noncanonical input varints are normalized because key/header bytes are re-encoded; 'lossless' is therefore guaranteed for the tested canonical corpus, not every possible malformed or noncanonical stream. NaN payload preservation is possible via raw field bytes; ordinary authored writes require finite floats.

This is a research codec, not an untrusted-file sandbox or full Rive importer. It does not validate every reference, inherited property membership, cycle, animation ordering, asset contract, script signature or feature version. The official runtime remains the semantic acceptance check. The extracted schema is pinned rather than assumed to remain compatible forever.
