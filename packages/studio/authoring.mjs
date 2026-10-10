import { inverse, worldTransform, validateProject, newId, propertiesFor } from "@evir/project-model";
import {
  convertRectangle,
  insertPoint,
  removePoint,
  bindPath,
  setWeight,
  setKey,
  createAnimation,
  createMachine,
} from "@evir/authoring";
import { worldPoints, controlMatrix, mapPoint, getValue } from "@evir/runtime/geometry";
import { evaluate, MachinePlayer } from "@evir/runtime";
import { compileProject, runtimeSchema } from "@evir/format";
const el = (tag, text) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
export function mountAuthoring(api) {
  const modes = el("div");
  modes.className = "mode-buttons";
  const toolbar = document.querySelector(".toolbar");
  toolbar.querySelector(".mode").replaceWith(modes);
  const add = (label) => {
    const b = el("button", label);
    document.querySelector("#creation-tools").append(b);
    return b;
  };
  const pathButton = add("Path"),
    boneButton = add("Bone");
  pathButton.id = "add-path";
  boneButton.id = "add-bone";
  pathButton.onclick = () => api.add("path");
  boneButton.onclick = () => api.add("bone");
  const exportButton = el("button", "Export .riv");
  exportButton.id = "export-riv";
  document
    .querySelector("#project-file-actions")
    .append(exportButton);
  const panel = el("section");
  panel.id = "authoring-panel";
  panel.setAttribute("aria-label", "Animation and interaction tools");
  document.querySelector(".stage-area").append(panel);
  let mode = "Design",
    animationId = null,
    machineId = null,
    frame = 0,
    playing = false,
    vertices = false,
    pointId = null,
    control = "anchor",
    player = null,
    playerSource = null,
    selectedKey = null,
    editState = null,
    lastTime = 0,
    raf = null;
  const exportSchema = async () => runtimeSchema;
  const button = (text, fn) => {
    const b = el("button", text);
    b.onclick = () => {
      try {
        fn();
      } catch (error) {
        api.notice(error);
      }
    };
    return b;
  };
  const field = (label, value, onchange, type = "text") => {
    const l = el("label");
    l.className = "field";
    l.append(el("span", label));
    const input = el("input");
    input.type = type;
    input.value = value;
    input.setAttribute("aria-label", label);
    input.onchange = () => {
      try {
        if (
          type === "number" &&
          (input.value === "" || !Number.isFinite(input.valueAsNumber))
        )
          throw Error(`${label}: enter a finite number`);
        onchange(type === "number" ? input.valueAsNumber : input.value);
      } catch (e) {
        api.notice(e);
      }
    };
    l.append(input);
    return l;
  };
  const select = (label, options, value, onchange) => {
    const l = el("label");
    l.className = "field";
    l.append(el("span", label));
    const input = el("select");
    input.setAttribute("aria-label", label);
    for (const [id, name] of options) {
      const o = el("option", name);
      o.value = id;
      input.append(o);
    }
    input.value = value || "";
    input.onchange = () => onchange(input.value);
    l.append(input);
    return l;
  };
  const transaction = (label, fn) => {
    stop();
    api.transact(label, fn);
  };
  function stop() {
    frame = Math.round(frame);
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }
  function changeMode(next) {
    if (!api.beforeMode()) return;
    api.cancelDrag();
    stop();
    mode = next;
    panel.scrollTop = 0;
    vertices = false;
    player = null;
    api.refresh();
    api.fit();
  }
  for (const name of ["Design", "Animate", "Interact"]) {
    const b = button(name, () => changeMode(name));
    b.dataset.mode = name;
    b.setAttribute("aria-pressed", "false");
    modes.append(b);
  }
  function currentAnimation(p) {
    return (
      p.animations.find(
        (a) => a.id === animationId && a.artboardId === api.artboardId(),
      ) || p.animations.find((a) => a.artboardId === api.artboardId())
    );
  }
  function currentMachine(p) {
    return (
      p.machines.find(
        (m) => m.id === machineId && m.artboardId === api.artboardId(),
      ) || p.machines.find((m) => m.artboardId === api.artboardId())
    );
  }
  function ensureKey(p, target, property, value) {
    const a = p.animations.find((a) => a.id === animationId),
      n = p.nodes.find((n) => n.id === target);
    if (!a) throw Error("Create an animation first");
    if (
      !a.tracks.some((t) => t.targetId === target && t.property === property) &&
      frame > 0
    )
      setKey(p, a.id, target, property, 0, getValue(n, property));
    setKey(p, a.id, target, property, frame, value);
  }
  function recordEdit(fn) {
    stop();
    if (mode === "Interact") throw Error("Return to Design or Animate to edit");
    const base = api.authored(),
      a = currentAnimation(base);
    if (!a) throw Error("Create an animation before setting keys");
    animationId = a.id;
    const before = evaluate(base, a.id, frame),
      after = structuredClone(before);
    fn(after);
    validateProject(after);
    const changes = [];
    if (
      after.nodes.length !== before.nodes.length ||
      after.name !== before.name ||
      JSON.stringify(after.editor) !== JSON.stringify(before.editor) ||
      JSON.stringify(after.artboards) !== JSON.stringify(before.artboards) ||
      JSON.stringify(after.animations) !== JSON.stringify(before.animations) ||
      JSON.stringify(after.machines) !== JSON.stringify(before.machines)
    )
      throw Error("Return to Design to change structure or editor settings");
    for (const n of after.nodes) {
      const old = before.nodes.find((v) => v.id === n.id);
      if (!old) throw Error("Return to Design to create nodes");
      const stripped = (v) => {
        const copy = structuredClone(v);
        delete copy.transform;
        if (copy.geometry)
          for (const k of ["width", "height", "length", "fill"])
            delete copy.geometry[k];
        return copy;
      };
      if (JSON.stringify(stripped(n)) !== JSON.stringify(stripped(old)))
        throw Error("Return to Design to edit geometry or organization");
      for (const property of propertiesFor(n)) {
        const v = getValue(n, property),
          oldValue = getValue(old, property);
        if (v !== oldValue) changes.push([n.id, property, v]);
      }
    }
    if (!changes.length) throw Error("No animatable property changed");
    transaction("Set animation keys", (p) =>
      changes.forEach(([target, property, value]) =>
        ensureKey(p, target, property, value),
      ),
    );
  }
  function pose(p) {
    if (mode === "Animate") {
      const a = currentAnimation(p);
      return a ? evaluate(p, a.id, frame) : p;
    }
    if (mode === "Interact") {
      const m = currentMachine(p);
      if (!m) return p;
      ensurePlayer(p, m);
      return player.pose();
    }
    return p;
  }
  function tick(now) {
    raf = null;
    if (!playing || document.hidden) return;
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    if (mode === "Animate") {
      const a = currentAnimation(api.authored());
      if (a) {
        frame += dt * a.fps;
        if (frame > a.duration) {
          if (a.loop) frame %= a.duration;
          else {
            frame = a.duration;
            stop();
          }
        }
      }
    } else if (player) {
      try {
        player.advance(dt);
      } catch (error) {
        stop();
        api.notice(error);
      }
    }
    api.draw();
    updatePlayhead();
    if (playing && !document.hidden) raf = requestAnimationFrame(tick);
  }
  function play() {
    playing = !playing;
    if (playing) {
      lastTime = performance.now();
      if (!document.hidden) raf = requestAnimationFrame(tick);
    } else stop();
    refresh();
  }
  // Preserve the pose while suspended; never accumulate hidden-tab time.
  const suspendPlayback = () => { if (raf !== null) cancelAnimationFrame(raf); raf = null; };
  const resumePlayback = () => {
    if (playing && !document.hidden && raf === null) {
      lastTime = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  document.addEventListener("visibilitychange", () => document.hidden ? suspendPlayback() : resumePlayback());
  window.addEventListener("pagehide", suspendPlayback);
  window.addEventListener("pageshow", resumePlayback);
  function updatePlayhead() {
    const range = panel.querySelector('[aria-label="Playhead"]');
    if (range) range.value = frame;
    const label = panel.querySelector("#frame-label");
    if (label) label.textContent = `${Math.round(frame)}f`;
    for (const rect of panel.querySelectorAll("[data-state]"))
      rect.setAttribute(
        "class",
        rect.dataset.state === player?.stateId ? "state-active" : "state-node",
      );
    const active = panel.querySelector("#active-state");
    if (active && player)
      active.textContent =
        "Active: " +
        player.machine.states.find((s) => s.id === player.stateId).name;
  }
  function editGeometry(p, n, host) {
    if (mode !== "Design") return;
    if (n.kind === "rectangle")
      host.append(
        button("Convert to path", () =>
          transaction("Convert rectangle", (p) => convertRectangle(p, n.id)),
        ),
      );
    if (n.kind === "bone") {
      host.append(
        field(
          "Bone length",
          n.geometry.length,
          (v) =>
            transaction(
              "Change bone length",
              (p) => (p.nodes.find((v) => v.id === n.id).geometry.length = v),
            ),
          "number",
        ),
      );
      host.append(button("Add child bone", () => api.add("bone")));
    }
    if (n.kind !== "path") return;
    const section = el("section");
    section.className = "property-section";
    section.append(el("h3", "Path controls"));
    section.append(
      button(vertices ? "Done editing points" : "Edit points", () => {
        vertices = !vertices;
        api.refresh();
      }),
    );
    section.append(
      button(n.geometry.closed ? "Open path" : "Close path", () =>
        transaction(
          "Change path closure",
          (p) =>
            (p.nodes.find((v) => v.id === n.id).geometry.closed =
              !n.geometry.closed),
        ),
      ),
    );
    if (!n.geometry.points.some((v) => v.id === pointId))
      pointId = n.geometry.points[0].id;
    section.append(
      select(
        "Control point",
        n.geometry.points.map((v, i) => [v.id, `Point ${i + 1}`]),
        pointId,
        (id) => {
          pointId = id;
          api.refresh();
        },
      ),
    );
    section.append(
      select(
        "Control handle",
        [
          ["anchor", "Anchor"],
          ["in", "In handle"],
          ["out", "Out handle"],
        ],
        control,
        (key) => {
          control = key;
          api.refresh();
        },
      ),
    );
    const point = n.geometry.points.find((v) => v.id === pointId);
    for (const [label, index] of [
      ["Point X", 0],
      ["Point Y", 1],
    ])
      section.append(
        field(
          label,
          point[control][index],
          (value) =>
            transaction("Edit control point", (p) => {
              const v = p.nodes
                .find((v) => v.id === n.id)
                .geometry.points.find((v) => v.id === pointId);
              if (control === "anchor") {
                const delta = value - v.anchor[index];
                for (const key of ["anchor", "in", "out"])
                  v[key][index] += delta;
              } else v[control][index] = value;
            }),
          "number",
        ),
      );
    section.append(
      button("Split next segment", () =>
        transaction("Insert control point", (p) => {
          pointId = insertPoint(
            p,
            n.id,
            n.geometry.points.findIndex((v) => v.id === pointId),
          );
        }),
      ),
      button("Remove point", () =>
        transaction("Remove control point", (p) => {
          removePoint(p, n.id, pointId);
          pointId = null;
        }),
      ),
    );
    section.append(
      field(
        "Path fill",
        n.geometry.fill.slice(0, 7),
        (value) =>
          transaction("Change path fill", (p) => {
            const g = p.nodes.find((v) => v.id === n.id).geometry;
            g.fill = value + (g.fill.length === 9 ? g.fill.slice(7) : "");
          }),
        "color",
      ),
    );
    const rig = el("section");
    rig.className = "property-section";
    rig.append(el("h3", "Bind & weights"));
    const bones = p.nodes.filter(
        (v) => v.kind === "bone" && v.artboardId === n.artboardId,
      ),
      chosen = new Set(n.geometry.skin?.bones.map((b) => b.boneId) || []);
    for (const b of bones) {
      const label = el("label");
      label.className = "check-field";
      const check = el("input");
      check.type = "checkbox";
      check.checked = chosen.has(b.id);
      check.setAttribute("aria-label", `Bind ${b.name}`);
      check.onchange = () =>
        check.checked ? chosen.add(b.id) : chosen.delete(b.id);
      label.append(check, el("span", b.name));
      rig.append(label);
    }
    rig.append(
      button(
        n.geometry.skin ? "Rebind selected bones" : "Bind selected bones",
        () => transaction("Bind path", (p) => bindPath(p, n.id, [...chosen])),
      ),
    );
    if (n.geometry.skin) {
      rig.append(
        button("Unbind", () =>
          transaction(
            "Unbind path",
            (p) => (p.nodes.find((v) => v.id === n.id).geometry.skin = null),
          ),
        ),
      );
      const weight = n.geometry.skin.weights.find((w) => w.pointId === pointId);
      for (const [boneId, value] of weight[control])
        rig.append(
          field(
            `Weight ${p.nodes.find((v) => v.id === boneId).name}`,
            Number(value.toFixed(6)),
            (value) =>
              transaction("Change influence", (p) =>
                setWeight(p, n.id, pointId, control, boneId, value),
              ),
            "number",
          ),
        );
      rig.append(
        el(
          "p",
          "Influences normalize to 100%. Anchor and handles have independent weights.",
        ),
      );
    }
    host.append(section, rig);
  }
  function animationPanel(p) {
    const a = currentAnimation(p);
    animationId = a?.id || null;
    const header = el("div");
    header.className = "authoring-controls";
    header.append(
      button("+ Animation", () =>
        transaction("Create animation", (p) => {
          animationId = createAnimation(p, api.artboardId());
          frame = 0;
        }),
      ),
    );
    panel.append(header);
    if (!a) {
      panel.append(
        el("p", "Create an animation, select a layer, then set a key."),
      );
      return;
    }
    header.append(
      select(
        "Animation",
        p.animations
          .filter((a) => a.artboardId === api.artboardId())
          .map((a) => [a.id, a.name]),
        a.id,
        (id) => {
          stop();
          animationId = id;
          frame = 0;
          api.refresh();
        },
      ),
      button(playing ? "Pause" : "Play", play),
    );
    header.append(
      field("Animation name", a.name, (value) =>
        transaction(
          "Rename animation",
          (p) => (p.animations.find((v) => v.id === a.id).name = value),
        ),
      ),
    );
    header.append(
      field(
        "Duration frames",
        a.duration,
        (value) =>
          transaction(
            "Change duration",
            (p) => (p.animations.find((v) => v.id === a.id).duration = value),
          ),
        "number",
      ),
    );
    header.append(
      field(
        "FPS",
        a.fps,
        (value) =>
          transaction(
            "Change FPS",
            (p) => (p.animations.find((v) => v.id === a.id).fps = value),
          ),
        "number",
      ),
    );
    const scrub = el("input");
    scrub.type = "range";
    scrub.min = 0;
    scrub.max = a.duration;
    scrub.step = 1;
    scrub.value = frame;
    scrub.setAttribute("aria-label", "Playhead");
    scrub.oninput = () => {
      stop();
      frame = Number(scrub.value);
      api.draw();
      updatePlayhead();
    };
    const label = el("output", `${Math.round(frame)}f`);
    label.id = "frame-label";
    panel.append(scrub, label);
    const n = p.nodes.find((v) => v.id === api.selected());
    if (n) {
      const controls = el("div");
      controls.className = "authoring-controls";
      const allowed = propertiesFor(n).filter(
        (k) =>
          !(
            n.kind === "bone" &&
            p.nodes.find((v) => v.id === n.parentId)?.kind === "bone" &&
            ["x", "y"].includes(k)
          ),
      );
      let property = allowed[0],
        easing = "linear";
      const propertySelect = select(
          "Key property",
          allowed.map((k) => [k, k]),
          property,
          (v) => (property = v),
        ),
        easingSelect = select(
          "New key easing",
          [
            ["linear", "Linear"],
            ["hold", "Hold"],
            ["cubic", "Cubic ease"],
          ],
          easing,
          (v) => (easing = v),
        );
      controls.append(
        propertySelect,
        easingSelect,
        button("Set key", () =>
          transaction("Set key", (p) => {
            ensureKey(
              p,
              n.id,
              property,
              getValue(
                evaluate(p, a.id, frame).nodes.find((v) => v.id === n.id),
                property,
              ),
            );
            const t = p.animations
              .find((v) => v.id === a.id)
              .tracks.find(
                (t) => t.targetId === n.id && t.property === property,
              );
            t.keys.find((k) => k.frame === frame).easing = {
              type: easing,
              curve: easing === "cubic" ? [0.42, 0, 0.58, 1] : null,
            };
          }),
        ),
      );
      panel.append(controls);
    }
    const list = el("div");
    list.className = "track-list";
    for (const track of a.tracks) {
      const row = el("div");
      row.className = "track-row";
      row.append(
        el(
          "span",
          `${p.nodes.find((n) => n.id === track.targetId).name} · ${track.property}`,
        ),
      );
      for (const key of track.keys) {
        const b = button(`◆ ${key.frame}`, () => {
          stop();
          frame = key.frame;
          selectedKey = {
            targetId: track.targetId,
            property: track.property,
            frame: key.frame,
          };
          api.refresh();
        });
        b.title = `${key.value} · ${key.easing.type}`;
        row.append(b);
      }
      row.append(
        button("Remove track", () =>
          transaction("Remove track", (p) => {
            const a = p.animations.find((v) => v.id === animationId);
            a.tracks = a.tracks.filter(
              (t) =>
                t.targetId !== track.targetId || t.property !== track.property,
            );
          }),
        ),
      );
      list.append(row);
    }
    panel.append(list);
    const selectedTrack = a.tracks.find(
      (t) =>
        t.targetId === selectedKey?.targetId &&
        t.property === selectedKey.property,
    );
    const key = selectedTrack?.keys.find((k) => k.frame === selectedKey.frame);
    if (key) {
      const details = el("div");
      details.className = "authoring-controls";
      const updateKey = (fn) =>
        transaction("Edit key", (p) => {
          const track = p.animations
            .find((v) => v.id === a.id)
            .tracks.find(
              (t) =>
                t.targetId === selectedKey.targetId &&
                t.property === selectedKey.property,
            );
          const k = track.keys.find((k) => k.frame === selectedKey.frame);
          fn(k, track);
          track.keys.sort((a, b) => a.frame - b.frame);
        });
      details.append(
        field(
          "Key frame",
          key.frame,
          (value) =>
            updateKey((k, t) => {
              if (t.keys.some((v) => v !== k && v.frame === value))
                throw Error("A key already exists at that frame");
              k.frame = value;
              selectedKey.frame = value;
              frame = value;
            }),
          "number",
        ),
      );
      details.append(
        field(
          "Key value",
          key.value,
          (value) => updateKey((k) => (k.value = value)),
          selectedTrack.property === "fill" ? "text" : "number",
        ),
      );
      details.append(
        select(
          "Key easing",
          [
            ["linear", "Linear"],
            ["hold", "Hold"],
            ["cubic", "Cubic"],
          ],
          key.easing.type,
          (value) =>
            updateKey(
              (k) =>
                (k.easing = {
                  type: value,
                  curve: value === "cubic" ? [0.42, 0, 0.58, 1] : null,
                }),
            ),
        ),
      );
      if (key.easing.type === "cubic")
        for (const [index, label] of [
          "Ease X1",
          "Ease Y1",
          "Ease X2",
          "Ease Y2",
        ].entries())
          details.append(
            field(
              label,
              key.easing.curve[index],
              (value) => updateKey((k) => (k.easing.curve[index] = value)),
              "number",
            ),
          );
      details.append(
        button("Delete key", () =>
          transaction("Delete key", (p) => {
            const a = p.animations.find((v) => v.id === animationId),
              t = a.tracks.find(
                (t) =>
                  t.targetId === selectedKey.targetId &&
                  t.property === selectedKey.property,
              );
            t.keys = t.keys.filter((k) => k.frame !== selectedKey.frame);
            a.tracks = a.tracks.filter((t) => t.keys.length);
            selectedKey = null;
          }),
        ),
      );
      panel.append(details);
    }
  }
  function machinePanel(p) {
    const m = currentMachine(p);
    machineId = m?.id || null;
    const header = el("div");
    header.className = "authoring-controls";
    header.append(
      button("+ Machine", () =>
        transaction(
          "Create machine",
          (p) => (machineId = createMachine(p, api.artboardId())),
        ),
      ),
    );
    panel.append(header);
    if (!m) {
      panel.append(
        el("p", "Create an animation first, then connect its states here."),
      );
      return;
    }
    header.append(
      select(
        "State machine",
        p.machines
          .filter((m) => m.artboardId === api.artboardId())
          .map((m) => [m.id, m.name]),
        m.id,
        (id) => {
          machineId = id;
          player = null;
          api.refresh();
        },
      ),
      button(playing ? "Pause preview" : "Play preview", play),
      button("Reset preview", () => {
        stop();
        player = null;
        ensurePlayer(p, m);
        api.refresh();
      }),
    );
    const stateLabel = el("span");
    stateLabel.id = "active-state";
    header.append(stateLabel);
    const graph = el("div");
    graph.className = "machine-graph";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute(
      "viewBox",
      `0 0 700 ${Math.max(180, ...m.states.map((s) => s.position[1] + 65))}`,
    );
    svg.setAttribute("aria-label", "State machine graph");
    for (const t of m.transitions) {
      const from = m.states.find((s) => s.id === t.fromId),
        to = m.states.find((s) => s.id === t.toId),
        line = document.createElementNS(svg.namespaceURI, "path");
      line.setAttribute(
        "d",
        `M${from.position[0] + 120},${from.position[1] + 20}L${to.position[0]},${to.position[1] + 20}l-7,-4m7,4l-7,4`,
      );
      line.setAttribute("class", "transition-line");
      svg.append(line);
    }
    for (const state of m.states) {
      const g = document.createElementNS(svg.namespaceURI, "g");
      g.setAttribute("transform", `translate(${state.position})`);
      const rect = document.createElementNS(svg.namespaceURI, "rect");
      rect.dataset.state = state.id;
      rect.setAttribute("width", 120);
      rect.setAttribute("height", 40);
      rect.setAttribute("rx", 7);
      rect.setAttribute(
        "class",
        state.id === player?.stateId ? "state-active" : "state-node",
      );
      const text = document.createElementNS(svg.namespaceURI, "text");
      text.setAttribute("x", 10);
      text.setAttribute("y", 25);
      text.textContent =
        state.name + (state.id === m.entryStateId ? " · entry" : "");
      g.append(rect, text);
      svg.append(g);
    }
    graph.append(svg);
    panel.append(graph);
    const forms = el("div");
    forms.className = "machine-forms";
    const update = (fn) =>
      transaction("Edit machine", (p) => {
        fn(p.machines.find((v) => v.id === m.id));
        player = null;
      });
    header.append(
      field("Machine name", m.name, (value) => update((m) => (m.name = value))),
    );
    if (!m.states.some((s) => s.id === editState)) editState = m.entryStateId;
    const state = m.states.find((s) => s.id === editState),
      stateDetails = el("div");
    stateDetails.className = "authoring-controls";
    stateDetails.append(
      select(
        "Edit state",
        m.states.map((s) => [s.id, s.name]),
        editState,
        (id) => {
          editState = id;
          api.refresh();
        },
      ),
      field("State name", state.name, (value) =>
        update((m) => (m.states.find((s) => s.id === editState).name = value)),
      ),
    );
    for (const [index, label] of ["Graph X", "Graph Y"].entries())
      stateDetails.append(
        field(
          label,
          state.position[index],
          (value) =>
            update(
              (m) =>
                (m.states.find((s) => s.id === editState).position[index] =
                  value),
            ),
          "number",
        ),
      );
    stateDetails.append(
      button("Remove state", () =>
        update((m) => {
          if (m.entryStateId === editState)
            throw Error(
              "Choose a different entry state before removing this state",
            );
          m.states = m.states.filter((s) => s.id !== editState);
          m.transitions = m.transitions.filter(
            (t) => t.fromId !== editState && t.toId !== editState,
          );
          editState = null;
        }),
      ),
    );
    panel.append(stateDetails);
    let animation = p.animations.find((a) => a.artboardId === m.artboardId)?.id;
    const states = el("div");
    states.append(
      select(
        "State animation",
        p.animations
          .filter((a) => a.artboardId === m.artboardId)
          .map((a) => [a.id, a.name]),
        animation,
        (id) => (animation = id),
      ),
      button("Add state", () =>
        update((m) =>
          m.states.push({
            id: newId("state"),
            name: p.animations.find((a) => a.id === animation).name,
            animationId: animation,
            position: [
              30 + (m.states.length % 4) * 160,
              50 + Math.floor(m.states.length / 4) * 65,
            ],
          }),
        ),
      ),
    );
    states.append(
      select(
        "Entry state",
        m.states.map((s) => [s.id, s.name]),
        m.entryStateId,
        (id) => update((m) => (m.entryStateId = id)),
      ),
    );
    let name = "active",
      type = "boolean";
    states.append(
      field("New input name", name, (v) => (name = v)),
      select(
        "New input type",
        [
          ["boolean", "Boolean"],
          ["number", "Number"],
          ["trigger", "Trigger"],
        ],
        type,
        (v) => (type = v),
      ),
      button("Add input", () =>
        update((m) =>
          m.inputs.push({
            id: newId("input"),
            name,
            type,
            value: type === "number" ? 0 : false,
          }),
        ),
      ),
    );
    forms.append(states);
    const conditions = el("div");
    let from = m.states[0]?.id,
      to = m.states.at(-1)?.id,
      input = m.inputs[0]?.id,
      op = "eq",
      value = "true";
    conditions.append(
      select(
        "From state",
        m.states.map((s) => [s.id, s.name]),
        from,
        (v) => (from = v),
      ),
      select(
        "To state",
        m.states.map((s) => [s.id, s.name]),
        to,
        (v) => (to = v),
      ),
      select(
        "Condition input",
        m.inputs.map((i) => [i.id, i.name]),
        input,
        (v) => (input = v),
      ),
      select(
        "Comparison",
        [
          ["eq", "Equals"],
          ["ne", "Not equal"],
          ["gt", "Greater than"],
          ["ge", "At least"],
          ["lt", "Less than"],
          ["le", "At most"],
          ["fire", "Trigger fires"],
        ],
        op,
        (v) => (op = v),
      ),
      field("Comparison value", value, (v) => (value = v)),
      button("Add transition", () =>
        update((m) => {
          const i = m.inputs.find((i) => i.id === input);
          if (!i) throw Error("Create an input first");
          m.transitions.push({
            id: newId("transition"),
            fromId: from,
            toId: to,
            conditions: [
              {
                inputId: input,
                op: i.type === "trigger" ? "fire" : op,
                value:
                  i.type === "trigger"
                    ? null
                    : i.type === "boolean"
                      ? parseBoolean(value)
                      : Number(value),
              },
            ],
          });
        }),
      ),
    );
    conditions.append(
      select(
        "Transition to extend",
        m.transitions.map((t) => [
          t.id,
          `${m.states.find((s) => s.id === t.fromId).name} → ${m.states.find((s) => s.id === t.toId).name}`,
        ]),
        m.transitions.at(-1)?.id,
        (v) => (conditions.dataset.transition = v),
      ),
    );
    conditions.append(
      button("Add AND condition", () =>
        update((m) => {
          const t = m.transitions.find(
              (t) =>
                t.id ===
                (conditions.dataset.transition || m.transitions.at(-1)?.id),
            ),
            i = m.inputs.find((i) => i.id === input);
          if (!t || !i) throw Error("Create a transition and input first");
          t.conditions.push({
            inputId: input,
            op: i.type === "trigger" ? "fire" : op,
            value:
              i.type === "trigger"
                ? null
                : i.type === "boolean"
                  ? parseBoolean(value)
                  : Number(value),
          });
        }),
      ),
    );
    forms.append(conditions);
    const defaults = el("div");
    defaults.className = "authoring-controls";
    for (const i of m.inputs.filter((i) => i.type !== "trigger"))
      defaults.append(
        field(
          `Default ${i.name}`,
          i.value,
          (value) =>
            update(
              (m) =>
                (m.inputs.find((v) => v.id === i.id).value =
                  i.type === "boolean" ? parseBoolean(value) : value),
            ),
          i.type === "number" ? "number" : "text",
        ),
      );
    panel.append(defaults);
    const inputs = el("div");
    inputs.append(el("h3", "Test inputs"));
    for (const i of m.inputs) {
      if (i.type === "trigger")
        inputs.append(
          button(`Fire ${i.name}`, () => {
            ensurePlayer(p, m);
            player.set(i.id, true);
            player.advance(0);
            api.refresh();
          }),
        );
      else if (i.type === "boolean") {
        const label = el("label");
        label.className = "check-field";
        const checkbox = el("input");
        checkbox.type = "checkbox";
        checkbox.setAttribute("aria-label", `Test ${i.name}`);
        checkbox.checked = player?.inputs[i.id] ?? i.value;
        checkbox.onchange = () => {
          ensurePlayer(p, m);
          player.set(i.id, checkbox.checked);
          player.advance(0);
          api.refresh();
        };
        label.append(checkbox, el("span", i.name));
        inputs.append(label);
      } else
        inputs.append(
          field(
            `Test ${i.name}`,
            player?.inputs[i.id] ?? i.value,
            (value) => {
              ensurePlayer(p, m);
              player.set(i.id, value);
              player.advance(0);
              api.refresh();
            },
            "number",
          ),
        );
    }
    let listenerInput = m.inputs[0]?.id,
      listenerValue = "true";
    inputs.append(
      select(
        "Listener input",
        m.inputs.map((i) => [i.id, i.name]),
        listenerInput,
        (v) => (listenerInput = v),
      ),
      field("Listener value", listenerValue, (v) => (listenerValue = v)),
      button("Add click listener", () =>
        update((m) => {
          const i = m.inputs.find((i) => i.id === listenerInput),
            target = p.nodes.find((n) => n.id === api.selected());
          if (!i || !target || !["rectangle", "path"].includes(target.kind))
            throw Error("Select a shape and create an input first");
          m.listeners.push({
            id: newId("listener"),
            targetId: target.id,
            event: "click",
            inputId: i.id,
            value:
              i.type === "trigger"
                ? null
                : i.type === "boolean"
                  ? parseBoolean(listenerValue)
                  : Number(listenerValue),
          });
        }),
      ),
    );
    forms.append(inputs);
    panel.append(forms);
    const routes = el("div");
    for (const t of m.transitions)
      routes.append(
        button(
          `${m.states.find((s) => s.id === t.fromId).name} → ${m.states.find((s) => s.id === t.toId).name} · ${t.conditions.map((c) => m.inputs.find((i) => i.id === c.inputId).name + " " + c.op + " " + (c.value ?? "fired")).join(" AND ")} · remove`,
          () =>
            update(
              (m) =>
                (m.transitions = m.transitions.filter((v) => v.id !== t.id)),
            ),
        ),
      );
    for (const l of m.listeners)
      routes.append(
        button(
          `Click ${p.nodes.find((n) => n.id === l.targetId).name} · remove listener`,
          () =>
            update(
              (m) => (m.listeners = m.listeners.filter((v) => v.id !== l.id)),
            ),
        ),
      );
    panel.append(routes);
    updatePlayhead();
  }
  function parseBoolean(value) {
    if (value !== "true" && value !== "false")
      throw Error("Enter true or false");
    return value === "true";
  }
  function ensurePlayer(p, m) {
    const source = JSON.stringify(p);
    if (!player || player.machine.id !== m.id || playerSource !== source) {
      player = new MachinePlayer(p, m.id);
      playerSource = source;
    }
  }
  function refresh() {
    const p = api.authored();
    for (const b of modes.children)
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    panel.hidden = mode === "Design";
    pathButton.disabled = boneButton.disabled = mode !== "Design";
    for (const id of ["add-rectangle", "add-group", "empty-add"])
      document.getElementById(id).disabled = mode !== "Design";
    panel.replaceChildren();
    if (mode === "Animate") animationPanel(p);
    if (mode === "Interact") machinePanel(p);
    frame = Math.round(Math.min(frame, currentAnimation(p)?.duration ?? 0));
  }
  exportButton.onclick = async () => {
    if (!api.ready()) return;
    try {
      api.cancelDrag();
      const result = compileProject(api.authored(), await exportSchema());
      download(result.bytes, "animation/riv", api.authored().name + ".riv");
      download(
        JSON.stringify(result.mapping, null, 2),
        "application/json",
        api.authored().name + ".riv-map.json",
      );
      api.notice("Rive export and source map downloaded.", "success");
    } catch (e) {
      api.notice(e);
    }
  };
  function download(data, type, name) {
    const url = URL.createObjectURL(new Blob([data], { type })),
      a = el("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return {
    get mode() {
      return mode;
    },
    pose,
    beginMove: stop,
    refresh,
    recordEdit,
    editGeometry,
    reset() {
      stop();
      mode = "Design";
      animationId = machineId = null;
      frame = 0;
      player = null;
      playerSource = null;
      selectedKey = null;
      vertices = false;
    },
    writeMoveKeys(p, id, x, y) {
      ensureKey(p, id, "x", x);
      ensureKey(p, id, "y", y);
    },
    click(id) {
      const p = api.authored(),
        m = currentMachine(p);
      if (m) {
        ensurePlayer(p, m);
        player.click(id);
        api.refresh();
      }
    },
    hitControl(p, n, world, zoom) {
      if (!vertices || mode !== "Design" || n?.kind !== "path") return null;
      for (const v of worldPoints(p, n))
        for (const key of ["anchor", "in", "out"])
          if (Math.hypot(v[key][0] - world.x, v[key][1] - world.y) < 8 / zoom) {
            pointId = v.id;
            control = key;
            return {
              pointId: v.id,
              control: key,
              matrix: controlMatrix(p, n, v.id, key),
            };
          }
      return null;
    },
    overlay(ctx, p, n, zoom) {
      if (mode === "Interact") return;
      for (const bone of p.nodes.filter(
        (n) => n.kind === "bone" && n.artboardId === api.artboardId(),
      )) {
        const m = worldTransform(p, bone.id),
          a = mapPoint(m, [0, 0]),
          b = mapPoint(m, [bone.geometry.length, 0]);
        ctx.strokeStyle = "#cf8c25";
        ctx.lineWidth = 3 / zoom;
        ctx.beginPath();
        ctx.moveTo(...a);
        ctx.lineTo(...b);
        ctx.stroke();
        for (const v of [a, b]) {
          ctx.beginPath();
          ctx.arc(...v, 4 / zoom, 0, Math.PI * 2);
          ctx.fillStyle = "#f8da98";
          ctx.fill();
        }
      }
      if (!vertices || n?.kind !== "path" || mode !== "Design") return;
      for (const v of worldPoints(p, n)) {
        ctx.strokeStyle = "#4d7b94";
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        ctx.moveTo(...v.in);
        ctx.lineTo(...v.anchor);
        ctx.lineTo(...v.out);
        ctx.stroke();
        for (const key of ["in", "out", "anchor"]) {
          ctx.beginPath();
          ctx.arc(...v[key], (key === "anchor" ? 4 : 3) / zoom, 0, Math.PI * 2);
          ctx.fillStyle =
            pointId === v.id && control === key ? "#146b53" : "#fff";
          ctx.fill();
          ctx.stroke();
        }
      }
    },
  };
}
