import {
  createProject,
  worldTransform,
  inverse,
  serializeProject,
  openProject,
} from "@evir/project-model";
import { History, addNode, reparent, removeSubtree, reorder } from "@evir/authoring";
import { mountAuthoring } from "./authoring.mjs";
import { PenDraft } from "./pen.mjs";
import { mountPanels } from "./panels.mjs";
import { createFeedback } from "@evir/ui";
import { available, selectionRoots, selectionBounds, marqueeTargets,
  prepareSelectionMove, applySelectionMove } from "./selection.mjs";
import { drawScene, nodeBounds, pathOnContext } from "@evir/renderer-canvas";
import { worldPoints, mapPoint } from "@evir/runtime/geometry";
const config = JSON.parse(document.getElementById('editor-config').textContent);
document.querySelector('.brand').href = config.publicSiteUrl;
let authoring;
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
  path: "M4 18C4 3 20 21 20 6M2 16h4v4H2zM18 4h4v4h-4z",
  bone: "M5 5l14 14M3 5a2 2 0 1 0 4 0 2 2 0 0 0-4 0M17 19a2 2 0 1 0 4 0 2 2 0 0 0-4 0",
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
const feedback = createFeedback($("#notice"));
let store,
  activeArtboard,
  selected = null,
  selectedIds = new Set(),
  tool = "select",
  space = false,
  drag = null,
  penDraft = null,
  penPointerId = null,
  cameras = {},
  generation = 0,
  savedFingerprint = "",
  status = "Local project";
const canvas = $("#scene"),
  ctx = canvas.getContext("2d"),
  hitContext = document.createElement("canvas").getContext("2d"),
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
function notice(error, kind = "error") {
  feedback.show(error, kind);
}
function clearNotice() {
  feedback.clear();
}
function project() {
  const p = store.snapshot();
  try {
    return authoring ? authoring.pose(p) : p;
  } catch (error) {
    notice(error);
    return p;
  }
}
function artboard(p = project()) {
  return p.artboards.find((a) => a.id === activeArtboard);
}
function camera() {
  return cameras[activeArtboard];
}
function editable(p, n, key) {
  return available(p, n, key);
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
  authoring?.reset();
  store = new History(p);
  activeArtboard = p.artboards[0].id;
  selected = null;
  selectedIds.clear();
  cameras = structuredClone(p.editor.cameras);
  drag = null;
  penDraft = null;
  penPointerId = null;
  setTool("select");
  render();
}
function edit(label, fn, direct = false) {
  if (!penReady()) return false;
  clearNotice();
  try {
    if (!direct && authoring && authoring.mode !== "Design") {
      authoring.recordEdit(fn);
      return true;
    }
    store.transact(label, fn);
    render();
    persist();
    return true;
  } catch (e) {
    notice(e);
    render();
    return false;
  }
}
function node() {
  return project().nodes.find((n) => n.id === selected);
}
function setSelection(ids) {
  selectedIds = new Set(ids);
  selected = [...selectedIds].at(-1) || null;
}
function select(id, additive = false) {
  if (!penReady()) return;
  if (additive && authoring?.mode === "Design") {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else if (id) next.add(id);
    setSelection(next);
  } else setSelection(id ? [id] : []);
  render();
}
function setTool(next) {
  if (next !== tool && !penReady()) return;
  if (next === "pen" && authoring?.mode !== "Design") {
    notice("Return to Design to draw a path");
    return;
  }
  cancelDrag();
  tool = next;
  $("#select-tool").setAttribute("aria-pressed", String(next === "select"));
  $("#pan-tool").setAttribute("aria-pressed", String(next === "pan"));
  $("#pen-tool").setAttribute("aria-pressed", String(next === "pen"));
  stage.style.cursor = toolCursor();
  draw();
}
function toolCursor() {
  return tool === "pan" ? "grab" : tool === "pen" ? "crosshair" : "default";
}
function penReady() {
  if (!penDraft) return true;
  notice("Finish or cancel your path before continuing.");
  return false;
}
function cancelPen() {
  penDraft = null;
  penPointerId = null;
  clearNotice();
  render();
}
function finishPen(closed = false) {
  if (!penDraft) return;
  const draft = penDraft;
  try {
    const geometry = draft.geometry(closed);
    penDraft = null;
    let id;
    if (!edit("Draw path", (p) => {
      id = addNode(p, "path", draft.parentId, draft.artboardId);
      p.nodes.find((n) => n.id === id).geometry = geometry;
    })) {
      penDraft = draft;
      draw();
      return;
    }
    penPointerId = null;
    setSelection([id]);
    setTool("select");
    render();
  } catch (error) {
    notice(error);
  }
}
function drawPen(zoom) {
  $("#pen-tool").disabled = authoring && authoring.mode !== "Design";
  $("#pen-actions").hidden = !penDraft;
  $("#finish-path").disabled = !penDraft || penDraft.points.length < 2 || penDraft.dragging;
  if (tool === "pen")
    $("#selection-status").textContent = penDraft
      ? `Unsaved draft · ${penDraft.points.length} ${penDraft.points.length === 1 ? "point" : "points"} · Enter to finish · Esc to cancel`
      : "Click for corners. Drag for curves. Click the first point to close.";
  if (penDraft) {
    $("#undo").disabled = false;
    $("#redo").disabled = true;
    $("#project-name").disabled = true;
    for (const control of document.querySelectorAll("#properties input,#properties select,#properties button"))
      control.disabled = true;
  }
  if (!penDraft?.points.length) return;
  const points = penDraft.worldPoints();
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeStyle = "#308c70";
  pathOnContext(ctx, points, false);
  ctx.stroke();
  if (penDraft.hover) {
    const hover = mapPoint(penDraft.matrix, penDraft.hover), last = points.at(-1);
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.moveTo(...last.anchor);
    ctx.bezierCurveTo(...last.out, ...hover, ...hover);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const [i, point] of points.entries()) {
    ctx.beginPath();
    ctx.moveTo(...point.in);
    ctx.lineTo(...point.anchor);
    ctx.lineTo(...point.out);
    ctx.stroke();
    for (const key of ["in", "out", "anchor"]) {
      ctx.beginPath();
      ctx.arc(...point[key], (key === "anchor" ? 4 : 2.5) / zoom, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 && key === "anchor" ? "#89e4c4" : "#fff";
      ctx.fill();
      ctx.stroke();
    }
  }
}
function add(kind) {
  if (authoring && authoring.mode !== "Design") {
    notice("Return to Design to add layers");
    return;
  }
  let created;
  edit(`Add ${kind}`, (p) => {
    const parent = selectedIds.size === 1 ? p.nodes.find((n) => n.id === selected) : null;
    const parentId =
      ["group", "bone"].includes(parent?.kind) && editable(p, parent, "locked")
        ? parent.id
        : null;
    created = addNode(p, kind, parentId, activeArtboard);
    const n = p.nodes.find((n) => n.id === created);
    if (!(kind === "bone" && parent?.kind === "bone")) {
      n.transform[4] = parentId ? 25 : artboard(p).width / 2 - 60;
      n.transform[5] = parentId ? 25 : artboard(p).height / 2 - 50;
    }
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
  return nodeBounds(p, n);
}
function draw() {
  const p = project(),
    a = artboard(p),
    c = camera(),
    r = stage.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio || 1, 2);
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
  drawScene(ctx, p, activeArtboard);
  ctx.restore();
  const n = p.nodes.find((n) => n.id === selected);
  if (n && tool !== "pen" && editable(p, n, "hidden") && authoring?.mode !== "Interact") {
    const b = selectionBounds(p, selectedIds) || bounds(p, n);
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
  if (tool !== "pen" && selectedIds.size <= 1) authoring?.overlay(ctx, p, n, c.zoom);
  if (drag?.kind === "marquee") {
    ctx.strokeStyle = "#308c70";
    ctx.fillStyle = "#308c7018";
    ctx.lineWidth = 1 / c.zoom;
    ctx.fillRect(drag.box.x, drag.box.y, drag.box.width, drag.box.height);
    ctx.strokeRect(drag.box.x, drag.box.y, drag.box.width, drag.box.height);
  }
  drawPen(c.zoom);
  ctx.restore();
  $("#zoom").textContent = Math.round(c.zoom * 100) + "%";
  $("#empty-stage").hidden = tool === "pen" || p.nodes.some(
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
function fitSelection() {
  const b = selectionBounds(project(), selectedIds);
  if (!b) return fit();
  const r = stage.getBoundingClientRect();
  const zoom = Math.max(0.1, Math.min(4, (r.width - 70) / Math.max(b.width, 1), (r.height - 70) / Math.max(b.height, 1)));
  cameras[activeArtboard] = { zoom, x: (r.width - b.width * zoom) / 2 - b.x * zoom,
    y: (r.height - b.height * zoom) / 2 - b.y * zoom };
  draw();
  persist();
}
function moveSelection(dx, dy) {
  if (!penReady()) return;
  try {
    const prepared = prepareSelectionMove(project(), selectedIds);
    edit("Move selection", (p) => applySelectionMove(p, prepared, dx, dy));
  } catch (error) { notice(error); }
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
  if (selectedIds.size > 1) {
    $("#kind-label").textContent = "SELECTION";
    const info = section(`${selectedIds.size} layers selected`);
    info.append(element("p", "Move the selection together. Choose one layer below to edit its individual properties."));
    for (const id of selectedIds) {
      const n = p.nodes.find((v) => v.id === id);
      info.append(action(n.name, () => select(id)));
    }
    host.append(info);
    const pair = element("div", undefined, "field-pair");
    for (const [label, axis] of [["Move X", 0], ["Move Y", 1]])
      pair.append(field(label, 0, (v) => moveSelection(axis === 0 ? v : 0, axis === 1 ? v : 0), "number"));
    host.append(pair, action("Fit selection", fitSelection),
      action("Delete selected layers", deleteSelection, false, "danger"));
    return;
  }
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
        locked ||
          (n.kind === "bone" &&
            p.nodes.find((v) => v.id === n.parentId)?.kind === "bone"),
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
  if (!locked) authoring?.editGeometry(p, n, host);
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
      ["group", "bone"].includes(v.kind) &&
      v.artboardId === activeArtboard &&
      v.id !== n.id,
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
  setSelection([...selectedIds].filter((id) => p.nodes.some((n) => n.id === id && n.artboardId === activeArtboard)));
  const focusedLayer = document.activeElement?.closest(".layer-select")?.dataset.nodeId;
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
        (selectedIds.has(n.id) ? " selected" : "") +
        (!editable(p, n, "hidden") ? " dim" : ""),
    );
    row.style.paddingLeft = `${depth * 12}px`;
    const button = action("", (e) => select(n.id, e.shiftKey));
    button.className = "layer-select";
    button.setAttribute("aria-label", `Select ${n.name}`);
    button.setAttribute("aria-pressed", String(selectedIds.has(n.id)));
    button.dataset.nodeId = n.id;
    button.tabIndex = n.id === selected ? 0 : -1;
    const symbol = element("span", undefined, "layer-icon");
    symbol.append(icon(n.kind));
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
  const layerButtons = [...layers.querySelectorAll(".layer-select")];
  if (layerButtons.length && !layerButtons.some((b) => b.tabIndex === 0)) layerButtons[0].tabIndex = 0;
  if (focusedLayer) layerButtons.find((b) => b.dataset.nodeId === focusedLayer)?.focus();
  if (!layers.children.length)
    layers.append(
      element(
        "p",
        search ? "No matching layers." : "Your layers will appear here.",
        "panel-note",
      ),
    );
  const n = p.nodes.find((n) => n.id === selected);
  $("#selection-status").textContent = selectedIds.size > 1 ? `${selectedIds.size} layers selected` : n
    ? `${n.name} · ${n.kind}`
    : "Select a layer to edit";
  $("#undo").disabled = !store.canUndo;
  $("#redo").disabled = !store.canRedo;
  properties(p);
  if (authoring?.mode === "Interact" || (authoring?.mode === "Animate" && !n))
    for (const control of document.querySelectorAll(
      "#properties input,#properties select,#properties button",
    ))
      control.disabled = true;
  else if (authoring?.mode === "Animate") {
    const nameField = document.querySelector('[aria-label="Layer name"]');
    if (nameField) nameField.disabled = true;
    for (const section of document.querySelectorAll("#properties section"))
      if (
        ["Organization", "Layer controls"].includes(
          section.querySelector("h3")?.textContent,
        )
      )
        for (const control of section.querySelectorAll("input,select,button"))
          control.disabled = true;
  }
  $("#project-name").disabled = authoring && authoring.mode !== "Design";
  authoring?.refresh();
  draw();
}
function deleteSelection() {
  if (!penReady()) return;
  const p = project(), targets = selectionRoots(p, selectedIds);
  if (!targets.length) return;
  if (targets.some((n) => !editable(p, n, "locked"))) { notice("Unlock the selected layers before deleting them."); return; }
  const removed = new Set(targets.map((n) => n.id));
  for (let changed = true; changed;) {
    changed = false;
    for (const n of p.nodes) if (removed.has(n.parentId) && !removed.has(n.id)) { removed.add(n.id); changed = true; }
  }
  if (!edit("Delete selected layers and descendants", (p) => {
    for (const n of [...p.nodes]) if (removed.has(n.id) && n.kind === "path") removeSubtree(p, n.id);
    for (const n of targets) if (p.nodes.some((v) => v.id === n.id)) removeSubtree(p, n.id);
  })) return;
  setSelection([]);
  render();
}
function coordinates(event) {
  const r = stage.getBoundingClientRect();
  return { x: event.clientX - r.left, y: event.clientY - r.top };
}
function hit(p, world) {
  for (const { n } of flattened(p).reverse()) {
    if (!editable(p, n, "hidden") || !editable(p, n, "locked")) continue;
    if (n.kind === "path") {
      pathOnContext(hitContext, worldPoints(p, n), n.geometry.closed);
      if (hitContext.isPointInPath(world.x, world.y)) return n;
    }
    if (n.kind === "bone" && authoring?.mode !== "Interact") {
      const m = worldTransform(p, n.id),
        a = mapPoint(m, [0, 0]),
        b = mapPoint(m, [n.geometry.length, 0]);
      const vx = b[0] - a[0],
        vy = b[1] - a[1],
        t = Math.max(
          0,
          Math.min(
            1,
            ((world.x - a[0]) * vx + (world.y - a[1]) * vy) /
              (vx * vx + vy * vy),
          ),
        );
      if (
        Math.hypot(world.x - a[0] - t * vx, world.y - a[1] - t * vy) <
        8 / camera().zoom
      )
        return n;
    }
    if (n.kind !== "rectangle") continue;
    try {
      const local = point(inverse(worldTransform(p, n.id)), world.x, world.y);
      if (
        local.x >= 0 &&
        local.x <= n.geometry.width &&
        local.y >= 0 &&
        local.y <= n.geometry.height
      )
        return n;
    } catch {}
  }
  return null;
}
stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button") || drag || penDraft?.dragging || ![0, 1].includes(e.button)) return;
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
  if (tool === "pen") {
    if (penDraft?.dragging) return;
    try {
      if (!penDraft) {
        const parent = selectedIds.size === 1 ? p.nodes.find((n) => n.id === selected) : null;
        const parentId = ["group", "bone"].includes(parent?.kind) &&
          editable(p, parent, "locked") && editable(p, parent, "hidden") ? parent.id : null;
        penDraft = new PenDraft({ artboardId: activeArtboard, parentId,
          matrix: parentId ? worldTransform(p, parentId) : undefined });
      }
      if (penDraft.down(world, c.zoom) === "close") finishPen(true);
      else {
        penPointerId = e.pointerId;
        stage.setPointerCapture(e.pointerId);
        draw();
      }
    } catch (error) {
      notice(error);
    }
    e.preventDefault();
    return;
  }
  const selectedNode = p.nodes.find((v) => v.id === selected);
  const controlHit = selectedIds.size <= 1 && authoring?.hitControl(p, selectedNode, world, c.zoom);
  if (controlHit) {
    try {
      const matrix = inverse(controlHit.matrix);
      store.begin("Move path control");
      drag = {
        kind: "control",
        start,
        c,
        id: selected,
        pointId: controlHit.pointId,
        control: controlHit.control,
        matrix,
      };
      stage.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    } catch (error) {
      notice(error);
      return;
    }
  }
  let n = hit(p, world);
  if (authoring?.mode === "Interact") {
    if (n) authoring.click(n.id);
    return;
  }
  if (n && !e.ctrlKey && !e.metaKey) {
    while (n.parentId) n = p.nodes.find((v) => v.id === n.parentId);
  }
  if (!n) {
    drag = { kind: "marquee", start, c, world, box: { x: world.x, y: world.y, width: 0, height: 0 },
      before: [...selectedIds], additive: e.shiftKey && authoring.mode === "Design", deep: e.ctrlKey || e.metaKey };
    if (!drag.additive) setSelection([]);
    stage.setPointerCapture(e.pointerId);
    render();
    e.preventDefault();
    return;
  }
  if (e.shiftKey && authoring.mode === "Design") { select(n.id, true); return; }
  if (!selectedIds.has(n.id)) setSelection([n.id]);
  render();
  if (
    n.kind === "bone" &&
    p.nodes.find((v) => v.id === n.parentId)?.kind === "bone"
  ) {
    notice(
      "Child bones attach at the parent tip. Change rotation or the parent length.",
    );
    return;
  }
  try {
    const prepared = prepareSelectionMove(p, selectedIds);
    authoring?.beginMove();
    store.begin("Move selection");
    drag = { kind: "move", start, c, prepared, id: n.id };
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  } catch (error) { notice(error); }
});
stage.addEventListener("pointermove", (e) => {
  if (!drag && penDraft && (penPointerId === null || e.pointerId === penPointerId)) {
    const now = coordinates(e), c = camera();
    penDraft.move({ x: (now.x - c.x) / c.zoom, y: (now.y - c.y) / c.zoom });
    draw();
    return;
  }
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
  if (drag.kind === "marquee") {
    const world = { x: (now.x - drag.c.x) / drag.c.zoom, y: (now.y - drag.c.y) / drag.c.zoom };
    drag.box = { x: Math.min(world.x, drag.world.x), y: Math.min(world.y, drag.world.y),
      width: Math.abs(world.x - drag.world.x), height: Math.abs(world.y - drag.world.y) };
    let candidates = marqueeTargets(project(), activeArtboard, drag.box, drag.deep);
    if (authoring.mode !== "Design") candidates = candidates.slice(-1);
    const next = new Set(drag.additive ? drag.before : []);
    for (const id of candidates) if (drag.additive && next.has(id)) next.delete(id); else next.add(id);
    setSelection(next);
    render();
    return;
  }
  try {
    store.preview((p) => {
      const n = p.nodes.find((n) => n.id === drag.id);
      if (drag.kind === "control") {
        const raw = n.geometry.points.find((v) => v.id === drag.pointId),
          local = mapPoint(drag.matrix, [
            (now.x - drag.c.x) / drag.c.zoom,
            (now.y - drag.c.y) / drag.c.zoom,
          ]);
        if (drag.control === "anchor") {
          const delta = local.map((v, i) => v - raw.anchor[i]);
          for (const k of ["anchor", "in", "out"])
            raw[k] = raw[k].map((v, i) => v + delta[i]);
        } else raw[drag.control] = local;
      } else {
        const authoredTransform = [...n.transform];
        applySelectionMove(p, drag.prepared, dx, dy);
        if (authoring.mode === "Animate") {
          authoring.writeMoveKeys(p, n.id, n.transform[4], n.transform[5]);
          n.transform = authoredTransform;
        }
      }
    });
    draw();
  } catch (error) {
    cancelDrag();
    notice(error);
  }
});
function finishDrag(e) {
  if (penDraft?.dragging && e?.pointerId === penPointerId) {
    penDraft.up();
    penPointerId = null;
    draw();
    return;
  }
  if (!drag) return;
  if (!["pan", "marquee"].includes(drag.kind)) store.commit();
  drag = null;
  render();
  persist();
}
function cancelDrag() {
  if (penDraft?.dragging) {
    penDraft.cancelGesture();
    penPointerId = null;
    if (!penDraft.points.length) penDraft = null;
    render();
  }
  if (!drag) return;
  if (drag.kind === "marquee") setSelection(drag.before);
  else if (drag.kind !== "pan") store.cancel();
  else cameras[activeArtboard] = drag.c;
  drag = null;
  render();
}
stage.addEventListener("pointerup", finishDrag);
stage.addEventListener("pointercancel", cancelDrag);
stage.addEventListener("lostpointercapture", cancelDrag);
function zoom(factor, at) {
  if (drag || penDraft?.dragging) return;
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
    if (drag || penDraft?.dragging) return;
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
  if (!penReady()) { e.target.value = activeArtboard; return; }
  cancelDrag();
  activeArtboard = e.target.value;
  setSelection([]);
  render();
});
$("#search").addEventListener("input", render);
$("#layers").addEventListener("keydown", (e) => {
  const buttons = [...$("#layers").querySelectorAll(".layer-select")];
  const current = e.target.closest(".layer-select");
  if (!current || !["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
  e.preventDefault();
  e.stopPropagation();
  let index = buttons.indexOf(current);
  index = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 :
    Math.max(0, Math.min(buttons.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)));
  const id = buttons[index].dataset.nodeId;
  select(id, e.shiftKey);
  [...$("#layers").querySelectorAll(".layer-select")].find((b) => b.dataset.nodeId === id)?.focus();
});
$("#select-tool").onclick = () => setTool("select");
$("#pan-tool").onclick = () => setTool("pan");
$("#pen-tool").onclick = () => setTool("pen");
$("#finish-path").onclick = () => finishPen();
$("#cancel-path").onclick = cancelPen;
$("#add-rectangle").onclick = () => add("rectangle");
$("#empty-add").onclick = () => add("rectangle");
$("#add-group").onclick = () => add("group");
$("#fit").onclick = fit;
$("#fit-selection").onclick = fitSelection;
$("#zoom-in").onclick = () => zoom(1.2);
$("#zoom-out").onclick = () => zoom(1 / 1.2);
function undo() {
  if (penDraft) { cancelPen(); return; }
  cancelDrag();
  store.undo();
  render();
  persist();
}
function redo() {
  if (!penReady()) return;
  cancelDrag();
  store.redo();
  render();
  persist();
}
$("#undo").onclick = undo;
$("#redo").onclick = redo;
async function save() {
  if (!penReady()) return;
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
$("#shortcuts").onclick = () => $("#help").showModal();
$("#close-help").onclick = () => $("#help").close();
window.addEventListener("keydown", (e) => {
  if ($("#help").open || $("#replace-project").open || $("#mobile-panel").open) return;
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
    if (penDraft) cancelPen();
    else if (drag) cancelDrag();
    else if (tool === "pen") setTool("select");
    else select(node()?.parentId || null);
    return;
  }
  if (penDraft && e.key === "Enter") {
    e.preventDefault();
    finishPen();
    return;
  }
  if (penDraft && (e.key === "Delete" || e.key === "Backspace")) {
    e.preventDefault();
    penDraft.removeLast();
    penPointerId = null;
    if (!penDraft.points.length) penDraft = null;
    render();
    return;
  }
  if (drag) return;
  if (mod && e.key.toLowerCase() === "a") {
    e.preventDefault();
    if (authoring.mode === "Design" && penReady()) {
      const p = project();
      setSelection(p.nodes.filter((n) => n.artboardId === activeArtboard && n.parentId === null &&
        editable(p, n, "locked") && editable(p, n, "hidden")).map((n) => n.id));
      render();
    }
    return;
  }
  if (e.key === "Enter" && !e.target.closest("button,a") && selectedIds.size === 1) {
    const child = project().nodes.find((n) => n.parentId === selected);
    if (child) { e.preventDefault(); select(child.id); }
    return;
  }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) && !e.target.closest("button,a")) {
    e.preventDefault();
    if (selectedIds.size) moveSelection((e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0) * (e.shiftKey ? 10 : 1),
      (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0) * (e.shiftKey ? 10 : 1));
    return;
  }
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
      case "p":
        setTool("pen");
        break;
      case "r":
        add("rectangle");
        break;
      case "f":
        e.shiftKey ? fitSelection() : fit();
        break;
      case "+":
      case "=":
        zoom(1.2);
        break;
      case "-":
        zoom(1 / 1.2);
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
    stage.style.cursor = toolCursor();
  }
});
window.addEventListener("blur", () => {
  space = false;
  stage.style.cursor = toolCursor();
  cancelDrag();
});
window.addEventListener("beforeunload", (e) => {
  if (
    store.active || penDraft ||
    JSON.stringify(bundle(), null, 2) + "\n" !== savedFingerprint
  ) {
    e.preventDefault();
    e.returnValue = "";
  }
});
new ResizeObserver(() => {
  if (store) {
    if (authoring && authoring.mode !== "Design") fit();
    else draw();
  }
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
authoring = mountAuthoring({
  add,
  artboardId: () => activeArtboard,
  selected: () => selected,
  authored: () => store.snapshot(),
  transact: (label, fn) => edit(label, fn, true),
  refresh: render,
  draw,
  fit,
  notice,
  cancelDrag,
  ready: penReady,
  beforeMode: () => {
    if (!penReady()) return false;
    if (selectedIds.size > 1) setSelection(selected ? [selected] : []);
    setTool("select");
    return true;
  },
});
mountPanels();
render();
document.body.classList.remove("studio-booting");
$("#studio-loading").hidden = true;
$("#workspace").setAttribute("aria-busy", "false");
$("#workspace").inert = false;
// Read-only snapshots for diagnostics and browser acceptance tests.
window.evirStudio = {
  snapshot: () => structuredClone(bundle()),
  selection: () => selected,
  selections: () => [...selectedIds],
  pose: () => structuredClone(project()),
  mode: () => authoring.mode,
};
