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

### Immediate Next Actions

1. Create the repository structure for research documentation
2. Start Phase 1: Write the Rive overview document
3. Collect a set of simple → complex `.riv` sample files for analysis
4. Set up a basic testing environment (official Rive web runtime)

### Architecture follow-up

The reusable project model, motion/state-machine evaluator, Canvas2D renderer, authoring operations and `.riv` compiler have now been extracted into versioned npm packages. Public site and editor application build independently; `/product` and `/editor` are public pages, while the full editor launches through a configurable URL suitable for a studio subdomain. See [the completed workspace migration](docs/19-workspace-migration.md) and [package contracts](packages/README.md). Physical-device and equivalent Editor-scene research gates are still pending; organization does not close them or finalize a new binary format.

---
