# Evir

**Open-source interactive 2D character & animation engine**

Evir is a fast, lightweight system for creating and running interactive 2D characters and animations — built for real products, especially EdTech and educational apps.

Inspired by the performance and interactivity of Rive, but fully open and independent.

---

### Why Evir exists

Most animation tools force a painful choice:

- **Lottie** → Broad animation delivery ecosystem; interactive authoring and runtime capabilities vary by tool and format
- **Rive** → Excellent performance + state machines, but the editor is closed-source
- Traditional tools → Too heavy or not designed for real-time interaction

Evir aims to close this gap by providing:

- A modern **open-source editor**
- A **high-performance runtime**
- Strong support for **interactive characters** and state-driven animation
- Small file sizes and excellent runtime performance

---

### Core Goals

- Fast and lightweight (both editor and runtime)
- First-class support for interactive characters
- Visual State Machines
- Suitable for mobile and low-end devices
- Fully open source
- Practical for real products (especially education apps)

---

### Project Status

**Early research and working editor prototype**

We are currently:

- Designing the core architecture
- Exploring the optimal file format
- Developing the path, rigging, timeline and interaction editor subset
- Studying high-performance vector rendering approaches

---

### High-Level Architecture (Planned)

```
Editor (Web)
   ↓
Evir Format (.evir)
   ↓
Runtime (Web, Mobile, etc.)
```

The product will eventually be split into independently managed surfaces: public product pages (`/` and `/product`), an editor landing page (`/editor`), the editor application (which may live on a studio subdomain), and versioned runtime/format packages. The current prototype keeps these in one repository while the contracts are still changing. See [the product-boundary decision](docs/18-architecture-boundaries-and-deployment.md).

We are **not** forced to be compatible with `.riv`.  
Instead, we will design our own efficient format optimized for:

- Interactive characters
- State machines
- Small size
- Fast loading & playback

Compatibility layers can be considered later if valuable.

---

### Planned Features (Roadmap Overview)

**Phase 1 – Foundation**
- Core scene graph
- Vector shape & path system
- Basic animation timeline
- Simple state machine
- First runtime prototype

**Phase 2 – Character Focus**
- Bone / skeletal animation
- Interactive character workflows
- Better state machine tools
- Export pipeline

**Phase 3 – Usable Tool**
- Polished editor
- Good performance on mobile
- Documentation & examples

---

### Philosophy

1. **Performance first** — We care deeply about runtime speed and file size.
2. **Characters first** — Optimized for interactive characters rather than general motion graphics.
3. **Open by default** — Editor, runtime, and format should all be open.
4. **Pragmatic** — We prefer shipping something useful over chasing perfect compatibility.

---

### Contributing

Start with [the contributor guide](CONTRIBUTING.md). Reproducible editing feedback, focused fixes, documentation and rendering experiments are welcome through the repository issues and pull requests.

---

### License

[MIT](LICENSE) for project code. Third-party material and brand artwork retain their recorded provenance.

---

### Inspiration

Evir draws inspiration from tools like Rive, Spine, and modern game animation systems — while aiming to remain fully open and focused on practical interactive use cases.


### Research implementation and evidence

The first executable research slice includes a schema-driven `.riv` reader/writer, independently generated animation and articulated-bone fixtures, input-driven state machines, official Canvas2D/WebGL2 validation, and reproducible load, frame-time, memory and size measurements.

Start with [the research workflow](research/README.md), [the Rive overview](docs/01-rive-overview.md), and [the compatibility decision](docs/05-synthesis.md). This establishes a tested export subset and a cloud baseline; full Evir engine parity and mobile performance remain unproven.

The [runtime research closure audit](docs/09-runtime-research-closure.md) covers the extended experiments and distinguishes completed software checks from physical-device and Editor-export evidence still required for complete runtime validation. Device auditing is deferred while the user tests it.

[Editor foundations](docs/10-editor-foundations.md) starts the next research phase with the supplied SOBO Editor export, a proposed editable project architecture, and implementation acceptance criteria. Run `npm run research:editor-export` to reproduce its structural and official-runtime checks.

### Editor prototype

The [Evir Studio workspace](editor/README.md) implements editable cubic paths, bone chains and control skinning, typed timelines, conditional state machines and a tested `.riv` export subset, alongside validated project persistence and transaction history. Run `npm run editor:serve` and open `http://127.0.0.1:8080/editor/`. [UI and workflow research](docs/11-editor-ux-research.md) compares Rive, Penpot, SVGator and Lottie Creator and records the decisions guiding the prototype. Run `npm run test:editor` followed by `npm run validate:editor` to exercise browser authoring and both official runtimes. [Milestone acceptance](docs/13-editor-milestone-acceptance.md) defines the completed subset and remaining scope.

### Current platform and AI context

The [feature audit](docs/14-platform-context-and-shipped-features.md) and [AI/agent authoring study](docs/15-ai-agent-authoring-research.md), reviewed on 9 October 2026, cover Rive and comparable platforms before further implementation. They distinguish documented availability, beta/experimental features, roadmap, runtime support and Evir's remaining gaps. The [evidence register](research/platform-context/README.md) records 78 primary sources, 43 structured claims, conflicting/outdated documentation and local CLI verification. No AI provider or agent transport is selected by this research.

### Public site and additional scene research

The [public site](site/README.md) provides ten pages, original editable examples, actual Studio screenshots, contributor entry points and reviewable feedback drafting. Populate [the frontend environment settings](site/.env.example), run `npm run site:build`, then `npm run site:serve`. Hosting and optional community channels are configurable. The included Pages workflow deploys only when manually dispatched on main.

[Public-page research](docs/16-public-site-research.md) records the Rive/Penpot/Framer observations and Evir's distinct design decisions. [The additional export study](docs/17-supplied-corpus-exploration.md) inventories four supplied `.riv` files and probes representative artboards in the official runtime; the fifth attachment exceeds the download tool's 32 MiB limit. These inputs do not replace controlled equivalent scenes or the deferred physical-device audit.

[Product boundaries and deployment](docs/18-architecture-boundaries-and-deployment.md) records the planned separation between public frontend, editor application and reusable runtime/backend packages. It also defines the migration order so user-facing changes can later ship independently from runtime changes.
