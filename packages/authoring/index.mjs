import {
  ProjectError,
  newId as id,
  newId,
  worldTransform,
  multiply,
  inverse,
  validateProject,
  upgradeAdvanced,
  strokeValue,
  pathPoints,pointContour,pathContours,
} from "@evir/project-model";
import {bindSkin,setSkinWeights} from './skin.mjs';
export {bindSkin,setSkinWeights} from './skin.mjs';
import { shareState } from "./shared-state.mjs";
export { joinPaths, planPathJoin, PATH_JOIN_LIMIT } from './path-joining.mjs';
export { SHAPES, shapeGeometry, addShape,setShapeParameters,detachShape } from './shapes.mjs';
import { quantize, components } from "@evir/runtime/geometry";
const copy = (x) => structuredClone(x),
  clone = copy,
  identity = () => [1, 0, 0, 1, 0, 0];
export function pathGeometry() {
  const k = 0.5522847498 * 60;
  return {
    closed: true,
    fill: "#64d9ad",
    skin: null,
    points: [
      {
        id: newId("point"),
        anchor: [120, 60],
        in: [120, 60 - k],
        out: [120, 60 + k],
      },
      {
        id: newId("point"),
        anchor: [60, 120],
        in: [60 + k, 120],
        out: [60 - k, 120],
      },
      {
        id: newId("point"),
        anchor: [0, 60],
        in: [0, 60 + k],
        out: [0, 60 - k],
      },
      {
        id: newId("point"),
        anchor: [60, 0],
        in: [60 - k, 0],
        out: [60 + k, 0],
      },
    ],
  };
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
    name: {
      group: "Group",
      rectangle: "Rectangle",
      path: "Path",
      bone: "Bone",
    }[kind],
    kind,
    artboardId,
    parentId,
    order: Math.max(-1, ...siblings.map((n) => n.order)) + 1,
    transform: identity(),
    geometry:
      kind === "rectangle"
        ? { width: 120, height: 100, fill: "#64d9ad" }
        : kind === "path"
          ? pathGeometry()
          : kind === "bone"
            ? { length: 80 }
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
  if (
    parent &&
    (parent.artboardId !== n.artboardId ||
      !["group", "bone"].includes(parent.kind))
  )
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
  const oldParent = p.nodes.find((v) => v.id === n.parentId);
  const oldSpace = oldParent ? worldTransform(p, oldParent.id) : identity();
  const newSpace = parent ? worldTransform(p, parent.id) : identity();
  const basis = multiply(inverse(newSpace), oldSpace);
  const ancestorIds = new Set();
  for (const start of [oldParent, parent])
    for (let v = start; v; v = p.nodes.find((q) => q.id === v.parentId))
      ancestorIds.add(v.id);
  const poseProperties = new Set([
    "x",
    "y",
    "rotation",
    "scaleX",
    "scaleY",
    "length",
  ]);
  const tracks = (p.animations || [])
    .flatMap((a) => a.tracks)
    .filter((t) => poseProperties.has(t.property));
  if (tracks.some((t) => ancestorIds.has(t.targetId)))
    throw new ProjectError([
      "reparent: animated parents need animation-key rebasing; choose static parents or keep the current parent",
    ]);
  const ownTracks = tracks.filter((t) => t.targetId === nodeId);
  if (
    ownTracks.length &&
    basis.slice(0, 4).some((v, i) => Math.abs(v - [1, 0, 0, 1][i]) > 1e-8)
  )
    throw new ProjectError([
      "reparent: changed parent rotation/scale needs animation-key rebasing; only matching static parent bases are supported for animated layers",
    ]);
  const local = parent
    ? multiply(inverse(worldTransform(p, parentId)), before)
    : before;
  if (!local.every(Number.isFinite))
    throw new ProjectError(["reparent: resulting transform is not finite"]);
  if (n.kind === "bone" && parent?.kind === "bone") {
    if (
      Math.abs(local[4] - parent.geometry.length) > 1e-6 ||
      Math.abs(local[5]) > 1e-6
    )
      throw new ProjectError([
        "reparent: a child bone must meet its parent tip; place the root at that tip first",
      ]);
    local[4] = 0;
    local[5] = 0;
  }
  n.transform = local;
  for (const t of ownTracks)
    if (t.property === "x" || t.property === "y")
      for (const k of t.keys) k.value += basis[t.property === "x" ? 4 : 5];
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
  for (const n of p.nodes)
    if (
      !removed.has(n.id) &&
      n.geometry?.skin?.bones.some((b) => removed.has(b.boneId))
    )
      throw new ProjectError([
        `delete: unbind ${n.name} before deleting its influencing bone`,
      ]);
  if (p.animations)
    for (const a of p.animations)
      a.tracks = a.tracks.filter((t) => !removed.has(t.targetId));
  if (p.machines)
    for (const m of p.machines)
      m.listeners = m.listeners.filter((l) => !removed.has(l.targetId));
  if (p.advanced) {
    p.advanced.clips = p.advanced.clips.filter(
      (c) => !removed.has(c.targetId) && !removed.has(c.maskId),
    );
    p.advanced.feathers = p.advanced.feathers.filter(
      (c) => !removed.has(c.targetId),
    );
    p.advanced.ik = p.advanced.ik.filter(
      (c) => !removed.has(c.boneId) && !removed.has(c.targetId),
    );
  }
  p.nodes = p.nodes.filter((n) => !removed.has(n.id));
  if(p.editor.weightLocks){p.editor.weightLocks=p.editor.weightLocks.filter(l=>!removed.has(l.nodeId));if(!p.editor.weightLocks.length)delete p.editor.weightLocks;}
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
  #revision = 0;
  constructor(project, limit = 100) {
    validateProject(project);
    if (!Number.isInteger(limit) || limit < 1)
      throw new RangeError("history limit must be positive");
    this.#project = shareState(undefined, copy(project));
    this.#limit = limit;
  }
  get active() {
    return this.#pending !== null;
  }
  get revision() {
    return this.#revision;
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
  // Read-only tools can share the deeply frozen committed version. Existing
  // snapshot/committed APIs keep returning detached, editable copies.
  readCommitted() {
    return this.#project;
  }
  begin(label) {
    if (this.active)
      throw new ProjectError(["transaction: another edit is active"]);
    this.#pending = {
      label,
      before: this.#project,
      after: this.#project,
    };
  }
  preview(edit) {
    if (!this.active)
      throw new ProjectError(["transaction: begin an edit first"]);
    const candidate = copy(this.#pending.after);
    edit(candidate);
    validateProject(candidate);
    this.#pending.after = shareState(this.#pending.after, candidate);
  }
  commit() {
    if (!this.active) throw new ProjectError(["transaction: no active edit"]);
    const t = this.#pending;
    this.#pending = null;
    t.after = shareState(t.before, t.after);
    if (t.before === t.after) return false;
    this.#project = t.after;
    this.#undo.push(t);
    if (this.#undo.length > this.#limit) this.#undo.shift();
    this.#redo = [];
    this.#revision++;
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
      this.#revision++;
    }
  }
  redo() {
    if (this.active)
      throw new ProjectError(["redo: finish or cancel the current edit"]);
    const t = this.#redo.pop();
    if (t) {
      this.#project = t.after;
      this.#undo.push(t);
      this.#revision++;
    }
  }
}
export function convertRectangle(p, id) {
  const n = p.nodes.find((n) => n.id === id),
    { width: w, height: h, fill } = n.geometry;
  n.kind = "path";
  n.geometry = {
    closed: true,
    fill,
    skin: null,
    points: [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ].map((v) => ({
      id: newId("point"),
      anchor: [...v],
      in: [...v],
      out: [...v],
    })),
  };
}
export function insertPoint(p, nodeId, index,contourIndex=0) {
  const n = p.nodes.find((n) => n.id === nodeId),
    g = pathContours(n.geometry)[contourIndex];
  if(n.geometry.shape)throw Error('Convert the live shape to a free path before editing points');
  if (!g)throw Error('Choose an existing contour');
  if (n.geometry.skin) throw Error("Unbind the path before changing its topology");
  if (!g.closed && index === g.points.length - 1)
    throw Error("Select a segment before the final point");
  const a = g.points[index],
    b = g.points[(index + 1) % g.points.length],
    mix = (a, b) => a.map((v, i) => (v + b[i]) / 2),
    ab = mix(a.anchor, a.out),
    bc = mix(a.out, b.in),
    cd = mix(b.in, b.anchor),
    abc = mix(ab, bc),
    bcd = mix(bc, cd);
  const v = { id: newId("point"), anchor: mix(abc, bcd), in: abc, out: bcd };
  a.out = ab;
  b.in = cd;
  g.points.splice(index + 1, 0, v);
  return v.id;
}
export function removePoint(p, nodeId, pointId) {
  const geometry=p.nodes.find((n)=>n.id===nodeId).geometry,g=pointContour(geometry,pointId);
  if(geometry.shape)throw Error('Convert the live shape to a free path before editing points');
  if(!g)throw Error('Choose an existing point');
  if (g.points.length <= (g.closed ? 3 : 2))
    throw Error("A closed path needs three points; an open path needs two");
  const points=g.points.filter(v=>v.id!==pointId);g.points.splice(0,g.points.length,...points);
  if (geometry.skin)
    geometry.skin.weights = geometry.skin.weights.filter((w) => w.pointId !== pointId);
  if(p.editor.weightLocks){p.editor.weightLocks=p.editor.weightLocks.filter(l=>l.nodeId!==nodeId||l.pointId!==pointId);if(!p.editor.weightLocks.length)delete p.editor.weightLocks;}
}
export function bindPath(p, nodeId, boneIds) {
  if(p.nodes.find(n=>n.id===nodeId)?.kind!=="path")throw Error("Select a path");
  return bindSkin(p,nodeId,boneIds);
}
export function setWeight(p,nodeId,pointId,control,boneId,value){
  return setSkinWeights(p,nodeId,[{pointId,control,boneId,value}]);
}
export function setValue(n, property, value) {
  if (property.startsWith("stroke.")) return strokeValue(n, property, value);
  if (["width", "height", "length", "fill"].includes(property)) {
    n.geometry[property] = value;
    return;
  }
  if (property === "x" || property === "y") {
    n.transform[property === "x" ? 4 : 5] = value;
    return;
  }
  const c = components(n.transform);
  if (property === "rotation") {
    const delta = value - c.rotation,
      cos = Math.cos(delta),
      sin = Math.sin(delta),
      [a, b, c0, d] = n.transform;
    n.transform[0] = cos * a - sin * b;
    n.transform[1] = sin * a + cos * b;
    n.transform[2] = cos * c0 - sin * d;
    n.transform[3] = sin * c0 + cos * d;
  } else {
    const base = c[property];
    if (Math.abs(base) < 1e-12) throw Error("Cannot animate a singular scale");
    const start = property === "scaleX" ? 0 : 2;
    n.transform[start] *= value / base;
    n.transform[start + 1] *= value / base;
  }
}
export function createAnimation(p, artboardId) {
  const a = {
    id: newId("animation"),
    name: `Animation ${p.animations.filter((a) => a.artboardId === artboardId).length + 1}`,
    artboardId,
    fps: 60,
    duration: 120,
    loop: true,
    tracks: [],
  };
  p.animations.push(a);
  return a.id;
}
export function setKey(
  p,
  animationId,
  targetId,
  property,
  frame,
  value,
  easing = { type: "linear", curve: null },
) {
  if (property.startsWith("paint.") || property.startsWith("stroke.")) upgradeAdvanced(p);
  const a = p.animations.find((a) => a.id === animationId);
  let t = a.tracks.find(
    (t) => t.targetId === targetId && t.property === property,
  );
  if (!t) {
    t = { targetId, property, keys: [] };
    a.tracks.push(t);
  }
  t.keys = t.keys.filter((k) => k.frame !== frame);
  t.keys.push({ frame, value, easing: clone(easing) });
  t.keys.sort((a, b) => a.frame - b.frame);
}
export function createMachine(p, artboardId) {
  const animations = p.animations.filter((a) => a.artboardId === artboardId);
  if (!animations.length)
    throw Error("Create an animation before a state machine");
  const state = {
    id: newId("state"),
    name: animations[0].name,
    animationId: animations[0].id,
    position: [30, 50],
  };
  const m = {
    id: newId("machine"),
    name: `Machine ${p.machines.filter((m) => m.artboardId === artboardId).length + 1}`,
    artboardId,
    inputs: [],
    states: [state],
    entryStateId: state.id,
    transitions: [],
    listeners: [],
  };
  p.machines.push(m);
  return m.id;
}

export {prepareCompound,commitCompound,combinePaths,releaseCompound,COMPOUND_OPERATIONS} from './compound.mjs';

export {smoothConnection} from './smooth-connection.mjs';

export {unbindSkin} from './skin.mjs';

export {setSkinLocks,autoSkinWeights,smoothSkinWeights} from './skin-editing.mjs';
