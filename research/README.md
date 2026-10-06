# Reproduce the research

The evidence and tools in this checkout run without Rive accounts, API keys, a live CDN or an installed editor. Python uses only its standard library. Node dependencies and WASM binaries are pinned through `package-lock.json`.

## Complete workflow

Prerequisites: Node 24 (tested 24.19.0), npm 11 (tested 11.9.0), Python 3.12 (tested 3.12.14), and Chromium (tested 151.0.7922.173). On another machine, set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`. WebGL2 must be available; the tested cloud configuration uses software SwiftShader. A real GPU is needed for representative device-performance conclusions.

```bash
cd /workspace/Evir
npm --cache /workspace/.npm-cache ci
npm run research
```

The full command generates 11 independently authored fixtures, runs 16 codec tests, validates all 11 fixtures under each of the two official rendering packages, benchmarks the codec and both web runtimes, and regenerates `docs/04-benchmarks.md` from the resulting JSON files. It takes approximately two minutes on this environment. Browser runners start their own loopback-only HTTP server on port 8776 and close the browser/server afterward; run browser commands sequentially and keep that port available.

Use the existing checkout: cloud tasks are already isolated; do not create another Git worktree unless explicitly requested. The separate `/workspace/evir-research` harness prepared during onboarding is not required for these checked-in tools.

## Individual operations

```bash
npm run generate
npm test
npm run validate
npm run validate:webgl2
npm run benchmark
npm run benchmark:webgl2
npm run report
python3 tools/riv.py research/fixtures/animated.riv
python3 tools/riv.py research/fixtures/bones.riv --json
python3 tools/riv.py research/fixtures/upstream/two_bone_ik.riv --roundtrip /tmp/two-bone-copy.riv
```

`write(doc)` re-encodes current field values. `write(doc, preserve_raw=True)` preserves stored value bytes where present; use it for forensic round trips, not property edits. This codec is a structural research tool and delegates semantic acceptance to the official runtime.

The schema and upstream fixtures are already checked in, so the normal workflow does not fetch source repositories. To regenerate that source-derived evidence, prepare the pinned checkout outside Evir:

```bash
git clone https://github.com/rive-app/rive-runtime.git /tmp/evir-pinned-runtime
git -C /tmp/evir-pinned-runtime checkout 7aa93402a27c800db8a36acc8672612c100ea9b1
cd /workspace/Evir
python3 tools/extract_schema.py /tmp/evir-pinned-runtime research/schema/runtime.json
python3 tools/collect_corpus.py /tmp/evir-pinned-runtime
npm run research
```

Do not run the collector against a mutable branch and describe the resulting corpus as the pinned revision. The corpus manifest records origin paths, source SHA, byte counts and hashes; its license file belongs with the copied fixtures. Generated export files have corresponding readable `.json` documents. Results include exact browser/package versions, graphics implementation, sample counts and metric definitions. A rerun replaces measured results, so numeric differences between machines or runs are expected.

## Evidence map

- [Architecture, state machines, renderer and RML](../docs/01-rive-overview.md)
- [Binary format and annotated examples](../docs/02-riv-format-deep-dive.md)
- [Recreation scope and runtime acceptance](../docs/03-recreation.md)
- [Measurements and interpretation](../docs/04-benchmarks.md)
- [Compatibility decision](../docs/05-synthesis.md)
- [Pinned official sources](../docs/sources.md)

The data supports a compatible export subset and an official-runtime cloud baseline. It does not assert full format support, an independent Evir renderer, mobile validation, actual official RML compilation or hardware-GPU performance.

## Extended rendering and compatibility probes

See [rendering foundations](../docs/06-rendering-foundations.md) and [extended experiment results](../docs/07-extended-experiments.md). `npm run research:advanced` runs the weighted deformation, triggers/blend/reset/listener, curve/gradient/clip, official RML static acceptance, and independent triangle quality checks. `npm run compile:rml` additionally needs the official CLI (set `RIVE_CLI` to its executable); retained CLI outputs allow validation without it. `npm run probe:feather` is a separate diagnostic that currently records failures and exits nonzero.
