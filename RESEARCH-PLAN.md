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
2. **Implemented selection/navigation step:** multiple selection, marquee, grouped world-space movement, keyboard navigation and responsive panels. The [experience-quality evidence](docs/22-selection-and-experience-quality.md) records checks and limitations. Research snapping, guides and layer reorganization before the next increment.
3. **Then expand authoring deliberately:** research gradients, clipping/feathering and richer deformation/blending against the existing runtime experiments; validate each added editor feature with official runtimes. Text/raster assets and semantic `.riv` import need explicit supported contracts.
4. **Keep external evidence gates open:** the physical-device audit is deferred while the user tests it; controlled equivalent Rive Editor exports remain pending. The supplied exports are useful corpus evidence, not equivalent-scene comparisons.
5. **AI/agents remain researched, not implemented:** use the [agent study](docs/15-ai-agent-authoring-research.md) to define bounded document operations, review/undo and data handling before selecting a provider or transport. No new binary format or performance-parity commitment follows from frontend progress.

### Product quality requirements — added 10 October 2026

Apply these alongside the editor/runtime phases, starting with selection/navigation. Research the existing case studies and primary guidance before each increment; verify the resulting user tasks rather than treating a checklist as completion.

- **Mobile responsiveness:** public pages and Studio chrome must reflow at 320 CSS pixels; make Layers/Properties accessible on small screens and preserve a usable stage. Physical touch/pinch and mobile performance remain separate device checks.
- **Memory and lifecycle:** stop animation scheduling when paused, offscreen or hidden; disconnect observers and abort pending loads on teardown; bound canvas pixel allocations and keep history behavior explicit. Measure browser resource behavior before claiming memory/performance gains.
- **Accessibility:** keyboard selection/navigation, visible focus, labeled controls, adequate touch targets, reduced-motion alternatives, programmatic statuses and custom dialogs that manage focus. Automated WCAG checks supplement representative assistive-technology sessions.
- **SEO and sharing:** descriptive server-rendered titles/descriptions, canonical URLs, sitemap/robots behavior and an original story-led Evir showcase image for Open Graph and social cards. Preserve the supplied brand artwork; never fabricate product screenshots or endorsements.
- **Loading and recovery:** a fitting living-character loading state, static reduced-motion fallback, usable preview fallback/retry and friendly branded error pages with recovery links.
- **Toasts and alerts:** consistent custom, accessible success/error feedback and inline field errors. Avoid browser `alert`, `confirm`, `prompt` and validation popovers; keep important errors visible and do not steal focus for passive status updates.

The current increment combines these requirements with multiple selection, marquee and stage/layer navigation. The device audit and controlled equivalent Rive Editor comparisons remain pending.

### Architecture follow-up

The reusable project model, motion/state-machine evaluator, Canvas2D renderer, authoring operations and `.riv` compiler are independent versioned npm packages. `apps/web` is the single hosted frontend: `/product` and `/editor` are public pages, and `/editor/studio/` composes the separately maintained `@evir/studio` UI package. Studio consumes the engine; the engine does not depend on the frontend. See [the completed workspace migration](docs/19-workspace-migration.md) and [package contracts](packages/README.md). Physical-device and equivalent Editor-scene research gates are still pending; organization does not close them or finalize a new binary format.

---
