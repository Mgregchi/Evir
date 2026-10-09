import { validateFeatures } from "./features.mjs";
import { ProjectError, newId as id } from "./primitives.mjs";
export { ProjectError, newId, mapPoint, multiply, inverse, worldTransform } from "./primitives.mjs";
export { ANIMATABLE, propertiesFor } from "./features.mjs";
const copy = value => structuredClone(value);
export function createProject() {
  const artboardId = id("artboard");
  return {
    format: "evir-project",
    schemaVersion: 2,
    id: id("project"),
    name: "Untitled character",
    artboards: [
      { id: artboardId, name: "Artboard 1", width: 640, height: 480 },
    ],
    nodes: [],
    assets: [],
    animations: [],
    machines: [],
    editor: {
      locked: [],
      hidden: [],
      cameras: { [artboardId]: { x: 0, y: 0, zoom: 1 } },
    },
  };
}
export function validateProject(p) {
  return validateDocument(p, false);
}
export function validateRuntimeProject(p) {
  return validateDocument(p, true);
}
function validateDocument(p, runtime) {
  if (!p || typeof p !== "object") throw new ProjectError(["project: expected object"]);
  const sceneVersion = runtime ? 2 : p.schemaVersion;
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
      ...(runtime ? [] : ["editor"]),
      ...(sceneVersion === 2 ? ["animations", "machines"] : []),
    ])
  )
    throw new ProjectError(issues);
  if (p.format !== (runtime ? "evir-runtime" : "evir-project"))
    problem("project.format", runtime ? "expected evir-runtime" : "expected evir-project");
  if (!(runtime ? p.schemaVersion === 1 : [1, 2].includes(p.schemaVersion)))
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
      else if (!["group", "bone"].includes(parent.kind))
        problem(`${path}.parentId`, "only groups or bones can own children");
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
    } else if (!(sceneVersion === 2 && ["path", "bone"].includes(n.kind)))
      problem(`${path}.kind`, "unsupported node type");
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
  if (!runtime && record(p.editor, "editor", ["locked", "hidden", "cameras"])) {
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
  if (!issues.length && sceneVersion === 2)
    validateFeatures(p, problem, identifier, { editorState: !runtime });
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
  if (p.schemaVersion === 1)
    p = { ...p, schemaVersion: 2, animations: [], machines: [] };
  return copy(p);
}

// A runtime snapshot carries scene content only. Authoring cameras, visibility,
// locks and state-graph positions stay in the editable source.
export function toRuntimeProject(project) {
  validateProject(project);
  const { editor, ...scene } = copy(project);
  scene.format = "evir-runtime";
  scene.schemaVersion = 1;
  scene.animations ??= [];
  scene.machines ??= [];
  for (const machine of scene.machines)
    machine.states = machine.states.map(({ position, ...state }) => state);
  return validateRuntimeProject(scene);
}

export async function openRuntimeProject(text) {
  let scene;
  try { scene = JSON.parse(text); }
  catch { throw new ProjectError(["project: invalid JSON"]); }
  if (scene.format === "evir-project") scene = toRuntimeProject(scene);
  else validateRuntimeProject(scene);
  await verifyAssets(scene);
  return copy(scene);
}
