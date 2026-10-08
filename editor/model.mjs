// Editable authoring data. This module does not import or export .riv.
export class ProjectError extends Error {
  constructor(issues) {
    super(issues.join("\n"));
    this.name = "ProjectError";
    this.issues = issues;
  }
}
const copy = (value) => structuredClone(value);
const identity = () => [1, 0, 0, 1, 0, 0];
const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;
export function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export function inverse(m) {
  const d = m[0] * m[3] - m[1] * m[2];
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12)
    throw new ProjectError([
      "transform: parent matrix is singular; cannot preserve world transform",
    ]);
  return [
    m[3] / d,
    -m[1] / d,
    -m[2] / d,
    m[0] / d,
    (m[2] * m[5] - m[3] * m[4]) / d,
    (m[1] * m[4] - m[0] * m[5]) / d,
  ];
}
export function createProject() {
  const artboardId = id("artboard");
  return {
    format: "evir-project",
    schemaVersion: 1,
    id: id("project"),
    name: "Untitled character",
    artboards: [
      { id: artboardId, name: "Artboard 1", width: 640, height: 480 },
    ],
    nodes: [],
    assets: [],
    editor: {
      locked: [],
      hidden: [],
      cameras: { [artboardId]: { x: 0, y: 0, zoom: 1 } },
    },
  };
}
export function validateProject(p) {
  const issues = [],
    seen = new Set();
  const problem = (path, text) => issues.push(`${path}: ${text}`);
  const record = (v, path, keys) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      problem(path, "expected object");
      return false;
    }
    for (const k of keys)
      if (!Object.hasOwn(v, k)) problem(`${path}.${k}`, "required");
    for (const k of Object.keys(v))
      if (!keys.includes(k))
        problem(`${path}.${k}`, "unsupported field; refusing to discard it");
    return true;
  };
  const text = (v, path) => {
    if (typeof v !== "string" || !v.trim())
      problem(path, "expected nonempty text");
  };
  const identifier = (v, path) => {
    if (typeof v !== "string" || !/^[a-zA-Z0-9_-]+$/.test(v))
      problem(path, "expected stable ID");
    else if (seen.has(v)) problem(path, "duplicate ID");
    else seen.add(v);
  };
  const positive = (v, path) => {
    if (!Number.isFinite(v) || v <= 0)
      problem(path, "expected positive finite number");
  };
  if (
    !record(p, "project", [
      "format",
      "schemaVersion",
      "id",
      "name",
      "artboards",
      "nodes",
      "assets",
      "editor",
    ])
  )
    throw new ProjectError(issues);
  if (p.format !== "evir-project")
    problem("project.format", "expected evir-project");
  if (p.schemaVersion !== 1)
    problem(
      "project.schemaVersion",
      "unsupported version; no implicit migration",
    );
  identifier(p.id, "project.id");
  text(p.name, "project.name");
  for (const k of ["artboards", "nodes", "assets"])
    if (!Array.isArray(p[k])) problem(`project.${k}`, "expected array");
  if (issues.length) throw new ProjectError(issues);
  if (!p.artboards.length)
    problem("project.artboards", "at least one artboard is required");
  const artboards = new Set();
  p.artboards.forEach((a, i) => {
    const path = `artboards[${i}]`;
    if (!record(a, path, ["id", "name", "width", "height"])) return;
    identifier(a.id, `${path}.id`);
    text(a.name, `${path}.name`);
    positive(a.width, `${path}.width`);
    positive(a.height, `${path}.height`);
    artboards.add(a.id);
  });
  const nodes = new Map(p.nodes.map((n) => [n?.id, n]));
  const orders = new Set();
  p.nodes.forEach((n, i) => {
    const path = `nodes[${i}]`;
    if (
      !record(n, path, [
        "id",
        "name",
        "kind",
        "artboardId",
        "parentId",
        "order",
        "transform",
        "geometry",
      ])
    )
      return;
    identifier(n.id, `${path}.id`);
    text(n.name, `${path}.name`);
    if (!artboards.has(n.artboardId))
      problem(`${path}.artboardId`, "missing artboard");
    if (n.parentId !== null) {
      const parent = nodes.get(n.parentId);
      if (!parent) problem(`${path}.parentId`, "missing parent");
      else if (parent.artboardId !== n.artboardId)
        problem(`${path}.parentId`, "parent belongs to another artboard");
      else if (parent.kind !== "group")
        problem(
          `${path}.parentId`,
          "only groups can own children in version 1",
        );
    }
    if (!Number.isInteger(n.order) || n.order < 0)
      problem(`${path}.order`, "expected nonnegative integer");
    const order = JSON.stringify([n.artboardId, n.parentId, n.order]);
    if (orders.has(order))
      problem(`${path}.order`, "duplicate sibling draw order");
    orders.add(order);
    if (
      !Array.isArray(n.transform) ||
      n.transform.length !== 6 ||
      !n.transform.every(Number.isFinite)
    )
      problem(`${path}.transform`, "expected six finite affine values");
    if (n.kind === "rectangle") {
      if (record(n.geometry, `${path}.geometry`, ["width", "height", "fill"])) {
        positive(n.geometry.width, `${path}.geometry.width`);
        positive(n.geometry.height, `${path}.geometry.height`);
        if (
          typeof n.geometry.fill !== "string" ||
          !/^#[\da-fA-F]{6}([\da-fA-F]{2})?$/.test(n.geometry.fill)
        )
          problem(`${path}.geometry.fill`, "expected #RRGGBB or #RRGGBBAA");
      }
    } else if (n.kind === "group") {
      if (n.geometry !== null)
        problem(`${path}.geometry`, "group geometry must be null");
    } else problem(`${path}.kind`, "unsupported node type");
    const chain = new Set([n.id]);
    let parent = nodes.get(n.parentId);
    while (parent) {
      if (chain.has(parent.id)) {
        problem(`${path}.parentId`, "parent cycle");
        break;
      }
      chain.add(parent.id);
      parent = nodes.get(parent.parentId);
    }
  });
  p.assets.forEach((a, i) => {
    const path = `assets[${i}]`;
    if (!record(a, path, ["id", "name", "mimeType", "sha256", "data"])) return;
    identifier(a.id, `${path}.id`);
    text(a.name, `${path}.name`);
    text(a.mimeType, `${path}.mimeType`);
    if (typeof a.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(a.sha256))
      problem(`${path}.sha256`, "expected SHA-256 hex digest");
    if (
      typeof a.data !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        a.data,
      )
    )
      problem(`${path}.data`, "expected base64 asset bytes");
  });
  if (record(p.editor, "editor", ["locked", "hidden", "cameras"])) {
    for (const k of ["locked", "hidden"]) {
      if (!Array.isArray(p.editor[k]))
        problem(`editor.${k}`, "expected ID array");
      else {
        const unique = new Set();
        for (const v of p.editor[k]) {
          if (!nodes.has(v)) problem(`editor.${k}`, "missing node");
          if (unique.has(v)) problem(`editor.${k}`, "duplicate node");
          unique.add(v);
        }
      }
    }
    const cameras = p.editor.cameras;
    if (!cameras || typeof cameras !== "object" || Array.isArray(cameras))
      problem("editor.cameras", "expected artboard camera map");
    else {
      for (const a of artboards)
        if (!Object.hasOwn(cameras, a))
          problem(`editor.cameras.${a}`, "missing camera");
      for (const [key, camera] of Object.entries(cameras)) {
        if (!artboards.has(key))
          problem(`editor.cameras.${key}`, "missing artboard");
        if (record(camera, `editor.cameras.${key}`, ["x", "y", "zoom"])) {
          if (!Number.isFinite(camera.x) || !Number.isFinite(camera.y))
            problem(`editor.cameras.${key}`, "expected finite camera position");
          positive(camera.zoom, `editor.cameras.${key}.zoom`);
        }
      }
    }
  }
  if (issues.length) throw new ProjectError(issues);
  return p;
}
async function verifyAssets(p) {
  for (const a of p.assets) {
    const bytes = Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0));
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== a.sha256)
      throw new ProjectError([`asset ${a.id}: content hash mismatch`]);
  }
}
export async function serializeProject(p) {
  validateProject(p);
  await verifyAssets(p);
  return JSON.stringify(p, null, 2) + "\n";
}
export async function openProject(text) {
  let p;
  try {
    p = JSON.parse(text);
  } catch {
    throw new ProjectError(["project: invalid JSON"]);
  }
  validateProject(p);
  await verifyAssets(p);
  return copy(p);
}
export function worldTransform(p, nodeId) {
  const n = p.nodes.find((n) => n.id === nodeId);
  if (!n) throw new ProjectError([`node ${nodeId}: not found`]);
  return n.parentId === null
    ? [...n.transform]
    : multiply(worldTransform(p, n.parentId), n.transform);
}
export function addNode(
  p,
  kind = "rectangle",
  parentId = null,
  activeArtboardId = p.artboards[0].id,
) {
  const parent = p.nodes.find((n) => n.id === parentId);
  const artboardId = parent?.artboardId || activeArtboardId;
  const siblings = p.nodes.filter(
    (n) => n.artboardId === artboardId && n.parentId === parentId,
  );
  const n = {
    id: id("node"),
    name: kind === "group" ? "Group" : "Rectangle",
    kind,
    artboardId,
    parentId,
    order: Math.max(-1, ...siblings.map((n) => n.order)) + 1,
    transform: identity(),
    geometry:
      kind === "rectangle"
        ? { width: 120, height: 100, fill: "#64d9ad" }
        : null,
  };
  p.nodes.push(n);
  return n.id;
}
export function reparent(p, nodeId, parentId) {
  const n = p.nodes.find((n) => n.id === nodeId),
    parent = p.nodes.find((n) => n.id === parentId);
  if (!n) throw new ProjectError(["reparent: missing node"]);
  if (parentId !== null && !parent)
    throw new ProjectError(["reparent: missing parent"]);
  if (parent && (parent.artboardId !== n.artboardId || parent.kind !== "group"))
    throw new ProjectError([
      "reparent: target must be a group in the same artboard",
    ]);
  if (parentId === n.parentId) return;
  let ancestor = parent;
  while (ancestor) {
    if (ancestor.id === nodeId)
      throw new ProjectError(["reparent: would create a cycle"]);
    ancestor = p.nodes.find((n) => n.id === ancestor.parentId);
  }
  const before = worldTransform(p, nodeId);
  const local = parent
    ? multiply(inverse(worldTransform(p, parentId)), before)
    : before;
  if (!local.every(Number.isFinite))
    throw new ProjectError(["reparent: resulting transform is not finite"]);
  n.transform = local;
  n.parentId = parentId;
  n.order =
    Math.max(
      -1,
      ...p.nodes
        .filter(
          (v) =>
            v.id !== nodeId &&
            v.artboardId === n.artboardId &&
            v.parentId === parentId,
        )
        .map((v) => v.order),
    ) + 1;
}
export function removeSubtree(p, nodeId) {
  if (!p.nodes.some((n) => n.id === nodeId))
    throw new ProjectError(["delete: missing node"]);
  const removed = new Set([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of p.nodes)
      if (removed.has(n.parentId) && !removed.has(n.id)) {
        removed.add(n.id);
        changed = true;
      }
  }
  p.nodes = p.nodes.filter((n) => !removed.has(n.id));
  for (const k of ["locked", "hidden"])
    p.editor[k] = p.editor[k].filter((v) => !removed.has(v));
}
export function reorder(p, nodeId, direction) {
  const n = p.nodes.find((n) => n.id === nodeId);
  if (!n) throw new ProjectError(["reorder: missing node"]);
  if (![-1, 1].includes(direction))
    throw new ProjectError(["reorder: expected -1 or 1"]);
  const siblings = p.nodes
    .filter((v) => v.artboardId === n.artboardId && v.parentId === n.parentId)
    .sort((a, b) => a.order - b.order);
  const index = siblings.findIndex((v) => v.id === nodeId),
    target = index + direction;
  if (target < 0 || target >= siblings.length) return;
  [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  siblings.forEach((v, i) => (v.order = i));
}
export class History {
  #project;
  #pending = null;
  #undo = [];
  #redo = [];
  #limit;
  constructor(project, limit = 100) {
    validateProject(project);
    if (!Number.isInteger(limit) || limit < 1)
      throw new RangeError("history limit must be positive");
    this.#project = copy(project);
    this.#limit = limit;
  }
  get active() {
    return this.#pending !== null;
  }
  get canUndo() {
    return !this.active && this.#undo.length > 0;
  }
  get canRedo() {
    return !this.active && this.#redo.length > 0;
  }
  snapshot() {
    return copy(this.#pending?.after || this.#project);
  }
  committed() {
    return copy(this.#project);
  }
  begin(label) {
    if (this.active)
      throw new ProjectError(["transaction: another edit is active"]);
    this.#pending = {
      label,
      before: copy(this.#project),
      after: copy(this.#project),
    };
  }
  preview(edit) {
    if (!this.active)
      throw new ProjectError(["transaction: begin an edit first"]);
    const candidate = copy(this.#pending.after);
    edit(candidate);
    validateProject(candidate);
    this.#pending.after = copy(candidate);
  }
  commit() {
    if (!this.active) throw new ProjectError(["transaction: no active edit"]);
    const t = this.#pending;
    this.#pending = null;
    if (JSON.stringify(t.before) === JSON.stringify(t.after)) return false;
    this.#project = t.after;
    this.#undo.push(t);
    if (this.#undo.length > this.#limit) this.#undo.shift();
    this.#redo = [];
    return true;
  }
  cancel() {
    this.#pending = null;
  }
  transact(label, edit) {
    this.begin(label);
    try {
      this.preview(edit);
      return this.commit();
    } catch (e) {
      this.cancel();
      throw e;
    }
  }
  undo() {
    if (this.active)
      throw new ProjectError(["undo: finish or cancel the current edit"]);
    const t = this.#undo.pop();
    if (t) {
      this.#project = t.before;
      this.#redo.push(t);
    }
  }
  redo() {
    if (this.active)
      throw new ProjectError(["redo: finish or cancel the current edit"]);
    const t = this.#redo.pop();
    if (t) {
      this.#project = t.after;
      this.#undo.push(t);
    }
  }
}
