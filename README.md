# Evir

**Open-source interactive 2D character & animation engine**

Evir is a fast, lightweight system for creating and running interactive 2D characters and animations — built for real products, especially EdTech and educational apps.

Inspired by the performance and interactivity of Rive, but fully open and independent.

---

### Why Evir exists

Most animation tools force a painful choice:

- **Lottie** → Easy, but limited interactivity and heavier files
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

**Early research & architecture phase**

We are currently:

- Designing the core architecture
- Exploring the optimal file format
- Planning the editor + runtime split
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

This project is in very early stages.  
If you're interested in high-performance animation, vector rendering, or building tools for interactive characters, feel free to open an issue or reach out.

---

### License

TBD (likely MIT or Apache 2.0)

---

### Inspiration

Evir draws inspiration from tools like Rive, Spine, and modern game animation systems — while aiming to remain fully open and focused on practical interactive use cases.

