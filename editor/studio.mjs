import {
  createProject,
  History,
  addNode,
  reparent,
  removeSubtree,
  reorder,
  worldTransform,
  inverse,
  serializeProject,
  openProject,
} from "./model.mjs";
const $ = (s) => document.querySelector(s);
const element = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
const iconPaths = {
  cursor: "M5 3l14 9-7 1-3 7z",
  pan: "M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4",
  rectangle: "M4 4h16v16H4z",
  group: "M4 4h11v11H4zM9 9h11v11H9",
  download: "M12 3v12M7 10l5 5 5-5M4 17v4h16v-4",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  hidden: "M3 3l18 18M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z",
  unlock: "M7 10V7a5 5 0 0 1 10 0M5 10h14v11H5z",
};
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icon");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", iconPaths[name]);
  svg.append(path);
  return svg;
}
for (const holder of document.querySelectorAll("[data-icon]"))
  holder.append(icon(holder.dataset.icon));
const CACHE = "evir.studio.project.v1";
let store,
  activeArtboard,
  selected = null,
  tool = "select",
  space = false,
  drag = null,
  cameras = {},
  generation = 0,
  savedFingerprint = "",
  status = "Local project";
const canvas = $("#scene"),
  ctx = canvas.getContext("2d"),
  stage = $("#stage");
function demo() {
  const p = createProject();
  p.name = "Little explorer";
  const group = addNode(p, "group");
  const root = p.nodes.find((n) => n.id === group);
  root.name = "Explorer";
  root.transform = [1, 0, 0, 1, 220, 105];
  for (const [name, x, y, w, h, color] of [
    ["Left boot", 15, 205, 58, 28, "#54777b"],
    ["Right boot", 109, 205, 58, 28, "#54777b"],
    ["Left arm", -20, 113, 27, 74, "#82bea9"],
    ["Right arm", 177, 113, 27, 74, "#82bea9"],
    ["Body", 10, 105, 162, 105, "#a0d7bd"],
    ["Chest light", 69, 129, 44, 37, "#edb75f"],
    ["Antenna", 85, -17, 12, 30, "#54777b"],
    ["Antenna light", 78, -28, 26, 18, "#edb75f"],
    ["Head", 0, 0, 182, 102, "#b9e6cd"],
    ["Left eye", 39, 34, 20, 26, "#233e3c"],
    ["Right eye", 123, 34, 20, 26, "#233e3c"],
    ["Smile", 72, 72, 38, 7, "#54777b"],
  ]) {
    const nodeId = addNode(p, "rectangle", group);
    const n = p.nodes.find((n) => n.id === nodeId);
    n.name = name;
    n.transform = [1, 0, 0, 1, x, y];
    n.geometry = { width: w, height: h, fill: color };
  }
  return p;
}
function notice(error) {
  $("#notice span").textContent = error?.message || String(error);
  $("#notice").hidden = false;
}
function clearNotice() {
  $("#notice").hidden = true;
}
function project() {
  return store.snapshot();
}
function artboard(p = project()) {
  return p.artboards.find((a) => a.id === activeArtboard);
}
function camera() {
  return cameras[activeArtboard];
}
function editable(p, n, key) {
  if (!n) return false;
  let current = n;
  while (current) {
    if (p.editor[key].includes(current.id)) return false;
    current = p.nodes.find((v) => v.id === current.parentId);
  }
  return true;
}
function bundle() {
  const p = store.committed();
  p.editor.cameras = structuredClone(cameras);
  return p;
}
function setStatus(text) {
  status = text;
  $("#save-status").textContent = text;
}
async function persist() {
  const version = ++generation;
  setStatus("Saving in browser…");
  try {
    const text = await serializeProject(bundle());
    if (version !== generation) return;
    localStorage.setItem(CACHE, text);
    savedFingerprint = text;
    setStatus("Saved in this browser");
  } catch (e) {
    if (version === generation) {
      setStatus("Not saved in browser");
      notice(
        `Your changes are still open. Download a project copy. ${e.message}`,
      );
    }
  }
}
function install(p) {
  ++generation;
  store = new History(p);
  activeArtboard = p.artboards[0].id;
  selected = null;
  cameras = structuredClone(p.editor.cameras);
  drag = null;
  render();
}
function edit(label, fn) {
  clearNotice();
  try {
    store.transact(label, fn);
    render();
    persist();
  } catch (e) {
    notice(e);
    render();
  }
}
function node() {
  return project().nodes.find((n) => n.id === selected);
}
function select(id) {
  selected = id;
  render();
}
function setTool(next) {
  tool = next;
  $("#select-tool").setAttribute("aria-pressed", String(next === "select"));
  $("#pan-tool").setAttribute("aria-pressed", String(next === "pan"));
  stage.style.cursor = next === "pan" ? "grab" : "default";
}
function add(kind) {
  let created;
  edit(`Add ${kind}`, (p) => {
    const parent = p.nodes.find((n) => n.id === selected);
    const parentId =
      parent?.kind === "group" && editable(p, parent, "locked")
        ? parent.id
        : null;
    created = addNode(p, kind, parentId, activeArtboard);
    const n = p.nodes.find((n) => n.id === created);
    n.transform[4] = parentId ? 25 : artboard(p).width / 2 - 60;
    n.transform[5] = parentId ? 25 : artboard(p).height / 2 - 50;
  });
  if (created) select(created);
}
function flattened(p, frontFirst = false) {
  const result = [];
  function visit(parentId, depth) {
    for (const n of p.nodes
      .filter((n) => n.artboardId === activeArtboard && n.parentId === parentId)
      .sort((a, b) => (frontFirst ? b.order - a.order : a.order - b.order))) {
      result.push({ n, depth });
      visit(n.id, depth + 1);
    }
  }
  visit(null, 0);
  return result;
}
function point(matrix, x, y) {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}
function bounds(p, n) {
  const all =
    n.kind === "group"
      ? p.nodes.filter((v) => {
          let parent = v;
          while (parent) {
            if (parent.id === n.id) return v.kind === "rectangle";
            parent = p.nodes.find((v) => v.id === parent.parentId);
          }
          return false;
        })
      : [n];
  const corners = all
    .filter((v) => editable(p, v, "hidden"))
    .flatMap((v) => {
      const m = worldTransform(p, v.id);
      return [
        [0, 0],
        [v.geometry.width, 0],
        [v.geometry.width, v.geometry.height],
        [0, v.geometry.height],
      ].map(([x, y]) => point(m, x, y));
    });
  if (!corners.length) {
    const pos = point(worldTransform(p, n.id), 0, 0);
    return { x: pos.x - 12, y: pos.y - 12, width: 24, height: 24 };
  }
  const xs = corners.map((v) => v.x),
    ys = corners.map((v) => v.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
function draw() {
  const p = project(),
    a = artboard(p),
    c = camera(),
    r = stage.getBoundingClientRect(),
    dpr = devicePixelRatio || 1;
  const w = Math.round(r.width * dpr),
    h = Math.round(r.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(c.zoom, c.zoom);
  ctx.shadowColor = "#0004";
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#f8faf7";
  ctx.fillRect(0, 0, a.width, a.height);
  ctx.shadowColor = "transparent";
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, a.width, a.height);
  ctx.clip();
  for (const { n } of flattened(p))
    if (n.kind === "rectangle" && editable(p, n, "hidden")) {
      ctx.save();
      ctx.transform(...worldTransform(p, n.id));
      ctx.fillStyle = n.geometry.fill;
      ctx.fillRect(0, 0, n.geometry.width, n.geometry.height);
      ctx.restore();
    }
  ctx.restore();
  const n = p.nodes.find((n) => n.id === selected);
  if (n && editable(p, n, "hidden")) {
    const b = bounds(p, n);
    ctx.strokeStyle = "#308c70";
    ctx.lineWidth = 1.5 / c.zoom;
    ctx.strokeRect(b.x, b.y, b.width, b.height);
    for (const [x, y] of [
      [b.x, b.y],
      [b.x + b.width, b.y],
      [b.x + b.width, b.y + b.height],
      [b.x, b.y + b.height],
    ]) {
      const s = 5 / c.zoom;
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      ctx.strokeRect(x - s / 2, y - s / 2, s, s);
    }
  }
  ctx.restore();
  $("#zoom").textContent = Math.round(c.zoom * 100) + "%";
  $("#empty-stage").hidden = p.nodes.some(
    (n) => n.artboardId === activeArtboard,
  );
}
function fit() {
  const r = stage.getBoundingClientRect(),
    a = artboard();
  const zoom = Math.min(
    (r.width - 100) / a.width,
    (r.height - 85) / a.height,
    1.5,
  );
  cameras[activeArtboard] = {
    zoom: Math.max(0.1, zoom),
    x: (r.width - a.width * zoom) / 2,
    y: (r.height - a.height * zoom) / 2,
  };
  draw();
  persist();
}
function field(label, value, onChange, type = "text", disabled = false) {
  const wrapper = element("label", undefined, "field");
  wrapper.append(element("span", label));
  const input = element("input");
  input.type = type;
  input.value = value;
  input.disabled = disabled;
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => {
    if (
      type === "number" &&
      (input.value.trim() === "" || !Number.isFinite(input.valueAsNumber))
    ) {
      notice(`${label}: enter a finite number`);
      render();
      return;
    }
    onChange(type === "number" ? input.valueAsNumber : input.value);
  });
  wrapper.append(input);
  return wrapper;
}
function section(title) {
  const s = element("section", undefined, "property-section");
  s.append(element("h3", title));
  return s;
}
function action(text, fn, disabled = false, cls) {
  const b = element("button", text, cls);
  b.disabled = disabled;
  b.addEventListener("click", fn);
  return b;
}
function properties(p) {
  const host = $("#properties");
  host.replaceChildren();
  const n = p.nodes.find((n) => n.id === selected),
    a = artboard(p);
  $("#kind-label").textContent = n ? n.kind.toUpperCase() : "ARTBOARD";
  if (!n) {
    const info = section("Canvas");
    info.append(
      field("Artboard name", a.name, (v) =>
        edit("Rename artboard", (p) => (artboard(p).name = v)),
      ),
    );
    const pair = element("div", undefined, "field-pair");
    for (const key of ["width", "height"])
      pair.append(
        field(
          key === "width" ? "Width" : "Height",
          a[key],
          (v) => edit("Resize artboard", (p) => (artboard(p)[key] = v)),
          "number",
        ),
      );
    info.append(pair);
    host.append(info);
    const hint = section("Make it yours");
    hint.append(
      element(
        "p",
        "Select a shape on the stage or in Layers to change its position, size, and color.",
      ),
    );
    host.append(hint);
    return;
  }
  const locked = !editable(p, n, "locked"),
    info = section("Layer");
  info.append(
    field(
      "Layer name",
      n.name,
      (v) =>
        edit(
          "Rename layer",
          (p) => (p.nodes.find((n) => n.id === selected).name = v),
        ),
      "text",
      locked,
    ),
  );
  host.append(info);
  const transform = section("Position");
  const pair = element("div", undefined, "field-pair");
  for (const [label, index] of [
    ["X", 4],
    ["Y", 5],
  ])
    pair.append(
      field(
        label,
        Number(n.transform[index].toFixed(3)),
        (v) =>
          edit(
            "Move layer",
            (p) =>
              (p.nodes.find((n) => n.id === selected).transform[index] = v),
          ),
        "number",
        locked,
      ),
    );
  transform.append(pair);
  const angle = Math.atan2(n.transform[1], n.transform[0]);
  transform.append(
    field(
      "Rotation",
      Number(((angle * 180) / Math.PI).toFixed(2)),
      (v) =>
        edit("Rotate layer", (p) => {
          const m = p.nodes.find((n) => n.id === selected).transform,
            delta = (v * Math.PI) / 180 - angle,
            c = Math.cos(delta),
            s = Math.sin(delta);
          const [a, b, c0, d] = m;
          m[0] = c * a - s * b;
          m[1] = s * a + c * b;
          m[2] = c * c0 - s * d;
          m[3] = s * c0 + c * d;
        }),
      "number",
      locked,
    ),
  );
  const scalePair = element("div", undefined, "field-pair");
  const scales = [
    Math.hypot(n.transform[0], n.transform[1]),
    Math.hypot(n.transform[2], n.transform[3]) *
      (n.transform[0] * n.transform[3] - n.transform[1] * n.transform[2] < 0
        ? -1
        : 1),
  ];
  for (const [index, label] of [
    [0, "Scale X"],
    [1, "Scale Y"],
  ])
    scalePair.append(
      field(
        label,
        Number(scales[index].toFixed(3)),
        (v) =>
          edit("Scale layer", (p) => {
            if (v === 0 || Math.abs(scales[index]) < 1e-12)
              throw Error(
                "Scale must be nonzero. This transform cannot be rescaled from zero.",
              );
            const m = p.nodes.find((n) => n.id === selected).transform,
              factor = v / scales[index],
              start = index * 2;
            m[start] *= factor;
            m[start + 1] *= factor;
          }),
        "number",
        locked,
      ),
    );
  transform.append(
    scalePair,
    element("p", "Transforms are relative to the parent group."),
  );
  host.append(transform);
  if (n.kind === "rectangle") {
    const size = section("Size & appearance");
    const pair = element("div", undefined, "field-pair");
    for (const key of ["width", "height"])
      pair.append(
        field(
          key === "width" ? "Shape width" : "Shape height",
          n.geometry[key],
          (v) =>
            edit(
              "Resize shape",
              (p) => (p.nodes.find((n) => n.id === selected).geometry[key] = v),
            ),
          "number",
          locked,
        ),
      );
    size.append(
      pair,
      field(
        "Fill color",
        n.geometry.fill.slice(0, 7),
        (v) =>
          edit("Change fill", (p) => {
            const g = p.nodes.find((n) => n.id === selected).geometry;
            g.fill = v + (g.fill.length === 9 ? g.fill.slice(7) : "");
          }),
        "color",
        locked,
      ),
    );
    host.append(size);
  }
  const hierarchy = section("Organization"),
    label = element("label", undefined, "field");
  label.append(element("span", "Parent"));
  const parentSelect = element("select");
  parentSelect.setAttribute("aria-label", "Parent");
  parentSelect.disabled = locked;
  const option = (value, text) => {
    const o = element("option", text);
    o.value = value;
    return o;
  };
  parentSelect.append(option("", "Artboard"));
  for (const group of p.nodes.filter(
    (v) =>
      v.kind === "group" && v.artboardId === activeArtboard && v.id !== n.id,
  )) {
    let ancestor = group,
      cycle = false;
    while (ancestor) {
      if (ancestor.id === n.id) {
        cycle = true;
        break;
      }
      ancestor = p.nodes.find((v) => v.id === ancestor.parentId);
    }
    if (!cycle && editable(p, group, "locked"))
      parentSelect.append(option(group.id, group.name));
  }
  parentSelect.value = n.parentId || "";
  parentSelect.addEventListener("change", () =>
    edit("Change parent", (p) =>
      reparent(p, selected, parentSelect.value || null),
    ),
  );
  label.append(parentSelect);
  hierarchy.append(
    label,
    element("p", "Changing the parent keeps the layer in place."),
  );
  const actions = element("div", undefined, "property-actions");
  actions.append(
    action(
      "Send backward",
      () => edit("Change draw order", (p) => reorder(p, selected, -1)),
      locked,
    ),
    action(
      "Bring forward",
      () => edit("Change draw order", (p) => reorder(p, selected, 1)),
      locked,
    ),
  );
  hierarchy.append(actions);
  host.append(hierarchy);
  const controls = section("Layer controls");
  const buttons = element("div", undefined, "property-actions");
  buttons.append(
    action(p.editor.locked.includes(n.id) ? "Unlock" : "Lock", () =>
      toggle("locked", n.id),
    ),
    action(p.editor.hidden.includes(n.id) ? "Show" : "Hide", () =>
      toggle("hidden", n.id),
    ),
    action(
      n.kind === "group" ? "Delete group & contents" : "Delete layer",
      deleteSelection,
      locked,
      "danger",
    ),
  );
  controls.append(buttons);
  if (locked)
    controls.append(
      element(
        "p",
        "This layer or its parent is locked. Unlock it in Layers to edit.",
      ),
    );
  host.append(controls);
}
function toggle(key, id) {
  edit(key === "locked" ? "Toggle lock" : "Toggle visibility", (p) => {
    p.editor[key] = p.editor[key].includes(id)
      ? p.editor[key].filter((v) => v !== id)
      : [...p.editor[key], id];
  });
}
function render() {
  const p = project();
  if (!p.nodes.some((n) => n.id === selected)) selected = null;
  $("#project-name").value = p.name;
  $("#save-status").textContent = status;
  $("#artboard-title").textContent = artboard(p).name;
  $("#layer-count").textContent = p.nodes.filter(
    (n) => n.artboardId === activeArtboard,
  ).length;
  const picker = $("#artboard");
  picker.replaceChildren();
  for (const a of p.artboards) {
    const o = element("option", a.name);
    o.value = a.id;
    picker.append(o);
  }
  picker.value = activeArtboard;
  const layers = $("#layers");
  layers.replaceChildren();
  const search = $("#search").value.trim().toLowerCase();
  for (const { n, depth } of flattened(p, true)) {
    if (search && !n.name.toLowerCase().includes(search)) continue;
    const row = element(
      "div",
      undefined,
      "layer-row" +
        (selected === n.id ? " selected" : "") +
        (!editable(p, n, "hidden") ? " dim" : ""),
    );
    row.style.paddingLeft = `${depth * 12}px`;
    const button = action("", () => select(n.id));
    button.className = "layer-select";
    button.setAttribute("aria-label", `Select ${n.name}`);
    button.setAttribute("aria-pressed", String(n.id === selected));
    const symbol = element("span", undefined, "layer-icon");
    symbol.append(icon(n.kind === "group" ? "group" : "rectangle"));
    button.append(symbol, element("span", n.name));
    const visible = action("", () => toggle("hidden", n.id), false, "small");
    visible.append(icon(p.editor.hidden.includes(n.id) ? "hidden" : "eye"));
    visible.setAttribute(
      "aria-label",
      `${p.editor.hidden.includes(n.id) ? "Show" : "Hide"} ${n.name}`,
    );
    visible.setAttribute(
      "aria-pressed",
      String(p.editor.hidden.includes(n.id)),
    );
    const lock = action("", () => toggle("locked", n.id), false, "small");
    lock.append(icon(p.editor.locked.includes(n.id) ? "lock" : "unlock"));
    lock.setAttribute(
      "aria-label",
      `${p.editor.locked.includes(n.id) ? "Unlock" : "Lock"} ${n.name}`,
    );
    lock.setAttribute("aria-pressed", String(p.editor.locked.includes(n.id)));
    row.append(button, visible, lock);
    layers.append(row);
  }
  if (!layers.children.length)
    layers.append(
      element(
        "p",
        search ? "No matching layers." : "Your layers will appear here.",
        "panel-note",
      ),
    );
  const n = p.nodes.find((n) => n.id === selected);
  $("#selection-status").textContent = n
    ? `${n.name} · ${n.kind}`
    : "Select a layer to edit";
  $("#undo").disabled = !store.canUndo;
  $("#redo").disabled = !store.canRedo;
  properties(p);
  draw();
}
function deleteSelection() {
  const p = project(),
    n = p.nodes.find((n) => n.id === selected);
  if (!n || !editable(p, n, "locked")) return;
  const target = selected;
  edit("Delete layer and descendants", (p) => removeSubtree(p, target));
  selected = null;
  render();
}
function coordinates(event) {
  const r = stage.getBoundingClientRect();
  return { x: event.clientX - r.left, y: event.clientY - r.top };
}
function hit(p, world) {
  for (const { n } of flattened(p).reverse()) {
    if (
      n.kind !== "rectangle" ||
      !editable(p, n, "hidden") ||
      !editable(p, n, "locked")
    )
      continue;
    let local;
    try {
      local = point(inverse(worldTransform(p, n.id)), world.x, world.y);
    } catch {
      continue;
    }
    if (
      local.x >= 0 &&
      local.x <= n.geometry.width &&
      local.y >= 0 &&
      local.y <= n.geometry.height
    )
      return n;
  }
  return null;
}
stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button") || drag || ![0, 1].includes(e.button)) return;
  clearNotice();
  stage.focus();
  const start = coordinates(e),
    c = structuredClone(camera());
  if (space || tool === "pan" || e.button === 1) {
    drag = { kind: "pan", start, c };
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  const p = project(),
    world = { x: (start.x - c.x) / c.zoom, y: (start.y - c.y) / c.zoom };
  let n = hit(p, world);
  if (n && !e.ctrlKey && !e.metaKey) {
    while (n.parentId) n = p.nodes.find((v) => v.id === n.parentId);
  }
  selected = n?.id || null;
  render();
  if (!n) return;
  const parentInverse = n.parentId
    ? inverse(worldTransform(p, n.parentId))
    : [1, 0, 0, 1, 0, 0];
  store.begin("Move layer");
  drag = {
    kind: "move",
    start,
    c,
    transform: [...n.transform],
    parentInverse,
    id: n.id,
  };
  stage.setPointerCapture(e.pointerId);
  e.preventDefault();
});
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const now = coordinates(e),
    dx = (now.x - drag.start.x) / drag.c.zoom,
    dy = (now.y - drag.start.y) / drag.c.zoom;
  if (drag.kind === "pan") {
    cameras[activeArtboard] = {
      ...drag.c,
      x: drag.c.x + now.x - drag.start.x,
      y: drag.c.y + now.y - drag.start.y,
    };
    draw();
    return;
  }
  try {
    store.preview((p) => {
      const n = p.nodes.find((n) => n.id === drag.id),
        m = drag.parentInverse;
      n.transform = [...drag.transform];
      n.transform[4] += m[0] * dx + m[2] * dy;
      n.transform[5] += m[1] * dx + m[3] * dy;
    });
    draw();
  } catch (error) {
    cancelDrag();
    notice(error);
  }
});
function finishDrag() {
  if (!drag) return;
  if (drag.kind === "move") store.commit();
  drag = null;
  render();
  persist();
}
function cancelDrag() {
  if (!drag) return;
  if (drag.kind === "move") store.cancel();
  else cameras[activeArtboard] = drag.c;
  drag = null;
  render();
}
stage.addEventListener("pointerup", finishDrag);
stage.addEventListener("pointercancel", cancelDrag);
stage.addEventListener("lostpointercapture", cancelDrag);
function zoom(factor, at) {
  if (drag) return;
  const c = camera(),
    r = stage.getBoundingClientRect();
  at ||= { x: r.width / 2, y: r.height / 2 };
  const next = Math.max(0.1, Math.min(4, c.zoom * factor)),
    ratio = next / c.zoom;
  c.x = at.x - (at.x - c.x) * ratio;
  c.y = at.y - (at.y - c.y) * ratio;
  c.zoom = next;
  draw();
  persist();
}
stage.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (drag) return;
    if (e.ctrlKey || e.metaKey)
      zoom(Math.exp(-e.deltaY * 0.002), coordinates(e));
    else {
      camera().x -= e.deltaX;
      camera().y -= e.deltaY;
      draw();
      persist();
    }
  },
  { passive: false },
);
$("#project-name").addEventListener("change", (e) =>
  edit("Rename project", (p) => (p.name = e.target.value)),
);
$("#artboard").addEventListener("change", (e) => {
  cancelDrag();
  activeArtboard = e.target.value;
  selected = null;
  render();
});
$("#search").addEventListener("input", render);
$("#select-tool").onclick = () => setTool("select");
$("#pan-tool").onclick = () => setTool("pan");
$("#add-rectangle").onclick = () => add("rectangle");
$("#empty-add").onclick = () => add("rectangle");
$("#add-group").onclick = () => add("group");
$("#fit").onclick = fit;
$("#zoom-in").onclick = () => zoom(1.2);
$("#zoom-out").onclick = () => zoom(1 / 1.2);
function undo() {
  cancelDrag();
  store.undo();
  render();
  persist();
}
function redo() {
  cancelDrag();
  store.redo();
  render();
  persist();
}
$("#undo").onclick = undo;
$("#redo").onclick = redo;
async function save() {
  if (store.active) {
    notice("Finish or cancel your drag before saving.");
    return;
  }
  try {
    const text = await serializeProject(bundle()),
      url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = element("a");
    a.href = url;
    a.download =
      (project().name.replace(/[^a-zA-Z0-9_-]+/g, "-") || "project") +
      ".evir-project.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    clearNotice();
    await persist();
  } catch (e) {
    notice(e);
  }
}
$("#save").onclick = save;
$("#open").onclick = () => $("#file").click();
$("#file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const next = await openProject(await file.text());
    cancelDrag();
    if (!(await askReplace("Open another project?", "Open project"))) return;
    install(next);
    persist();
    clearNotice();
  } catch (error) {
    notice(error);
  }
});
$("#new").onclick = async () => {
  if (!(await askReplace("Start a new project?", "Create project"))) return;
  cancelDrag();
  install(createProject());
  fit();
  clearNotice();
};
function askReplace(title, action) {
  const dialog = $("#replace-project");
  $("#replace-title").textContent = title;
  $("#replace-confirm").textContent = action;
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) =>
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "replace"),
      { once: true },
    ),
  );
}
$("#save-before-replace").onclick = save;
$("#notice button").onclick = clearNotice;
$("#shortcuts").onclick = () => $("#help").showModal();
$("#close-help").onclick = () => $("#help").close();
window.addEventListener("keydown", (e) => {
  if ($("#help").open || $("#replace-project").open) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "s") {
    e.preventDefault();
    // Commit the focused field before taking the saved snapshot.
    if (e.target.closest("input,select,textarea")) e.target.blur();
    save();
    return;
  }
  if (e.target.closest("input,select,textarea")) return;
  if (mod && e.key.toLowerCase() === "z") {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if (e.code === "Space" && e.target.closest("button,a")) return;
  if (e.code === "Space") {
    e.preventDefault();
    space = true;
    stage.style.cursor = "grab";
    return;
  }
  if (e.key === "Escape") {
    if (drag) cancelDrag();
    else select(null);
    return;
  }
  if (drag) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    deleteSelection();
  }
  if (!mod) {
    switch (e.key.toLowerCase()) {
      case "v":
        setTool("select");
        break;
      case "h":
        setTool("pan");
        break;
      case "r":
        add("rectangle");
        break;
      case "f":
        fit();
        break;
      case "?":
        $("#help").showModal();
        break;
    }
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    space = false;
    stage.style.cursor = tool === "pan" ? "grab" : "default";
  }
});
window.addEventListener("blur", () => {
  space = false;
  stage.style.cursor = tool === "pan" ? "grab" : "default";
  cancelDrag();
});
window.addEventListener("beforeunload", (e) => {
  if (
    store.active ||
    JSON.stringify(bundle(), null, 2) + "\n" !== savedFingerprint
  ) {
    e.preventDefault();
    e.returnValue = "";
  }
});
new ResizeObserver(() => {
  if (store) draw();
}).observe(stage);
let initial = demo(),
  restored = false;
try {
  const cached = localStorage.getItem(CACHE);
  if (cached) {
    initial = await openProject(cached);
    restored = true;
  }
} catch (e) {
  notice(`The saved project could not be restored. ${e.message}`);
}
install(initial);
if (!restored) fit();
else {
  setStatus("Restored from this browser");
  savedFingerprint = await serializeProject(bundle());
}
// Read-only snapshots for diagnostics and browser acceptance tests.
window.evirStudio = {
  snapshot: () => structuredClone(bundle()),
  selection: () => selected,
};
