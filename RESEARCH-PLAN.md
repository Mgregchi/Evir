**Research Plan for Evir**  
**Goal:** Deeply understand what makes Rive excellent, then recreate and benchmark it until we can match its core strengths.

We will only start designing our own extensions or format after we can reliably produce working results that are comparable to Rive in key metrics.

---

### Research Objective

Answer these questions thoroughly:

1. What technical decisions make Rive fast and lightweight?
2. How does the `.riv` format achieve small size + fast loading?
3. How does the State Machine system work under the hood?
4. How does the Rive Renderer achieve high performance?
5. Can we generate valid `.riv` files ourselves?
6. How close can we get to Rive’s performance metrics?

---

### Research Phases

### Phase 1: Understanding the Surface (1–2 weeks)

**Goal:** Build strong foundational knowledge.

Tasks:
- Study official Rive documentation (format, state machines, runtimes)
- Analyze the published `.riv` format specification
- Study Rive Markup Language (RML) — this is important
- Review open-source runtime code (`rive-runtime`)
- Document the high-level architecture of Rive (Editor → .riv → Runtime → Renderer)

**Deliverable:**  
`docs/01-rive-overview.md` — Clear explanation of how Rive works end-to-end.

---

### Phase 2: Deep Dive into the `.riv` Format (2–4 weeks)

**Goal:** Fully understand the binary structure.

Tasks:
- Map the file header (`RIVE` fingerprint, versioning, Table of Contents)
- Understand object serialization (type keys + property system)
- Study how Artboards, Shapes, Paths, Bones, Animations, and State Machines are stored
- Learn how forward-compatibility works (skipping unknown properties)
- Compare simple vs complex `.riv` files (hex analysis)
- Study how assets (images, fonts) are embedded

**Deliverable:**  
`docs/02-riv-format-deep-dive.md` + annotated example files.

---

### Phase 3: Recreation Capability (3–5 weeks)

**Goal:** Be able to generate valid `.riv` files.

Tasks:
- Build a basic `.riv` reader (parse and print structure)
- Build a basic `.riv` writer
- Successfully create simple files (single shape, simple animation)
- Progress to characters with bones
- Progress to basic State Machines
- Validate generated files using official Rive runtimes (Web, Flutter, etc.)

**Success Criteria:**  
We can create a `.riv` file from scratch that plays correctly in the official Rive runtime.

**Deliverable:**  
Working parser + writer + test suite.

---

### Phase 4: Benchmarking & Metrics (2–3 weeks)

**Goal:** Measure how close we are to real Rive performance.

Key Metrics to track:

| Metric                    | How to Measure                        | Target |
|--------------------------|---------------------------------------|--------|
| File Size                | Compare same content                  | Close to Rive |
| Load Time                | Time to parse + initialize            | Competitive |
| Runtime FPS              | Complex character + state machine     | Stable 60fps |
| Memory Usage             | On mobile + web                       | Reasonable |
| State Machine Complexity | Many states + transitions             | Handles well |
| Binary Efficiency        | Bytes per object / property           | Understand Rive’s packing |

**Deliverable:**  
`docs/04-benchmarks.md` with clear comparisons.

---

### Phase 5: Synthesis & Decision Point

Only after completing Phases 1–4 do we decide:

- Continue staying compatible with `.riv` longer?
- Start designing our own improved format?
- Which parts of Rive are worth copying vs improving?

---

### Research Principles

- **Evidence over assumptions** — Everything must be tested.
- **Small reproducible examples** — Always start simple.
- **Official runtime is the judge** — A file is only valid if official runtimes accept it.
- **Document everything** — Future us will thank us.
- **No premature architecture** — Understanding comes first.

---

### Current progress and next actions — 10 October 2026

The structural reader/writer, generated fixtures, official Canvas2D/WebGL2 checks and cloud benchmarks are implemented. The [runtime audit](docs/09-runtime-research-closure.md) records their scope and pending gates. Studio's four [authoring milestones](docs/13-editor-milestone-acceptance.md) are implemented for the declared subset. The public web app is live according to the user; this workspace's HTTPS check returned 403, so production navigation has not been independently verified here.

1. **Implemented next authoring step:** Pen drawing with corner/curve gestures, open/closed paths, reversible drafts and official-runtime export checks. [Research and acceptance](docs/21-pen-authoring-research-and-acceptance.md) document the evidence and limits.
2. **Next editor step:** research and implement selection/navigation improvements, starting with multiple selection and marquee. Extend the transaction and world-transform checks before adding snapping, guides or layer reorganization.
3. **Then expand authoring deliberately:** research gradients, clipping/feathering and richer deformation/blending against the existing runtime experiments; validate each added editor feature with official runtimes. Text/raster assets and semantic `.riv` import need explicit supported contracts.
4. **Keep external evidence gates open:** the physical-device audit is deferred while the user tests it; controlled equivalent Rive Editor exports remain pending. The supplied exports are useful corpus evidence, not equivalent-scene comparisons.
5. **AI/agents remain researched, not implemented:** use the [agent study](docs/15-ai-agent-authoring-research.md) to define bounded document operations, review/undo and data handling before selecting a provider or transport. No new binary format or performance-parity commitment follows from frontend progress.

### Architecture follow-up

The reusable project model, motion/state-machine evaluator, Canvas2D renderer, authoring operations and `.riv` compiler are independent versioned npm packages. `apps/web` is the single hosted frontend: `/product` and `/editor` are public pages, and `/editor/studio/` composes the separately maintained `@evir/studio` UI package. Studio consumes the engine; the engine does not depend on the frontend. See [the completed workspace migration](docs/19-workspace-migration.md) and [package contracts](packages/README.md). Physical-device and equivalent Editor-scene research gates are still pending; organization does not close them or finalize a new binary format.

---
