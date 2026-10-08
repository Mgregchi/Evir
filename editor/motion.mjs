import {
  worldTransform,
  multiply,
  inverse,
  ProjectError,
  validateProject,
} from "./model.mjs";
export const newId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const clone = (x) => structuredClone(x);
const I = [1, 0, 0, 1, 0, 0];
export const mapPoint = (m, p) => [
  m[0] * p[0] + m[2] * p[1] + m[4],
  m[1] * p[0] + m[3] * p[1] + m[5],
];
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
export const ANIMATABLE = [
  "x",
  "y",
  "rotation",
  "scaleX",
  "scaleY",
  "width",
  "height",
  "fill",
  "length",
];
export function propertiesFor(n) {
  return [
    "x",
    "y",
    "rotation",
    "scaleX",
    "scaleY",
    ...(n.kind === "rectangle"
      ? ["width", "height", "fill"]
      : n.kind === "path"
        ? ["fill"]
        : n.kind === "bone"
          ? ["length"]
          : []),
  ];
}
export function validateFeatures(p, problem, identifier) {
  const rec = (v, path, keys) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      problem(path, "expected object");
      return false;
    }
    for (const k of keys)
      if (!Object.hasOwn(v, k)) problem(path + "." + k, "required");
    for (const k of Object.keys(v))
      if (!keys.includes(k)) problem(path + "." + k, "unsupported field");
    return true;
  };
  const arr = (v, path) => {
    if (!Array.isArray(v)) {
      problem(path, "expected array");
      return false;
    }
    return true;
  };
  const vec = (v, path, size = 2) => {
    if (!Array.isArray(v) || v.length !== size || !v.every(Number.isFinite))
      problem(path, `expected ${size} finite values`);
  };
  const color = (v, path) => {
    if (typeof v !== "string" || !/^#[\da-fA-F]{6}([\da-fA-F]{2})?$/.test(v))
      problem(path, "expected hex color");
  };
  const text = (v, path) => {
    if (typeof v !== "string" || !v.trim())
      problem(path, "expected nonempty name");
  };
  const nodes = new Map(p.nodes.map((n) => [n.id, n]));
  for (const n of p.nodes) {
    const path = "node " + n.id,
      g = n.geometry;
    if (n.kind === "bone" && rec(g, path + ".geometry", ["length"])) {
      if (!Number.isFinite(g.length) || g.length <= 0)
        problem(path, "bone length must be positive");
      if (
        nodes.get(n.parentId)?.kind === "bone" &&
        (n.transform[4] !== 0 || n.transform[5] !== 0)
      )
        problem(
          path,
          "child bones are anchored to the parent tip (local X/Y must be zero)",
        );
    }
    if (n.kind !== "path") continue;
    if (!rec(g, path + ".geometry", ["closed", "fill", "points", "skin"]))
      continue;
    if (typeof g.closed !== "boolean")
      problem(path + ".closed", "expected boolean");
    color(g.fill, path + ".fill");
    if (!arr(g.points, path + ".points")) continue;
    if (g.points.length < (g.closed ? 3 : 2))
      problem(path + ".points", "too few control points");
    const pointIds = new Set();
    for (const v of g.points) {
      if (!rec(v, path + ".point", ["id", "anchor", "in", "out"])) continue;
      identifier(v.id, path + ".point.id");
      pointIds.add(v.id);
      for (const k of ["anchor", "in", "out"]) vec(v[k], path + "." + k);
    }
    if (g.skin === null) continue;
    if (!rec(g.skin, path + ".skin", ["bindWorld", "bones", "weights"]))
      continue;
    vec(g.skin.bindWorld, path + ".bindWorld", 6);
    if (
      !arr(g.skin.bones, path + ".bones") ||
      !arr(g.skin.weights, path + ".weights")
    )
      continue;
    if (!g.skin.bones.length || g.skin.bones.length > 255)
      problem(path + ".bones", "one to 255 bones required");
    const bones = new Set();
    for (const b of g.skin.bones) {
      if (!rec(b, path + ".bone", ["boneId", "bind"])) continue;
      if (
        nodes.get(b.boneId)?.kind !== "bone" ||
        nodes.get(b.boneId)?.artboardId !== n.artboardId
      )
        problem(path + ".bone", "must reference a bone in the same artboard");
      if (bones.has(b.boneId)) problem(path + ".bone", "duplicate bone");
      bones.add(b.boneId);
      vec(b.bind, path + ".bind", 6);
      try {
        inverse(b.bind);
      } catch {
        problem(path + ".bind", "singular bone bind matrix");
      }
    }
    const weighted = new Set();
    for (const w of g.skin.weights) {
      if (!rec(w, path + ".weights", ["pointId", "anchor", "in", "out"]))
        continue;
      if (!pointIds.has(w.pointId) || weighted.has(w.pointId))
        problem(path + ".weight", "missing or duplicate point");
      weighted.add(w.pointId);
      for (const k of ["anchor", "in", "out"]) {
        if (!arr(w[k], path + "." + k)) continue;
        if (w[k].length < 1 || w[k].length > 4)
          problem(path + "." + k, "one to four influences required");
        let sum = 0;
        const unique = new Set();
        for (const entry of w[k]) {
          if (!Array.isArray(entry) || entry.length !== 2) {
            problem(path + ".weight", "expected bone/weight pair");
            continue;
          }
          const [b, v] = entry;
          if (!bones.has(b) || unique.has(b))
            problem(path + ".weight", "missing or duplicate tendon");
          unique.add(b);
          if (!Number.isFinite(v) || v < 0)
            problem(path + ".weight", "nonnegative finite weight required");
          sum += v;
        }
        if (Math.abs(sum - 1) > 1e-8)
          problem(path + ".weight", "weights must sum to one");
      }
    }
    if (weighted.size !== pointIds.size)
      problem(path + ".weights", "every control point needs weights");
  }
  if (!arr(p.animations, "animations") || !arr(p.machines, "machines")) return;
  const anims = new Map();
  for (const a of p.animations) {
    const path = "animation " + a?.id;
    if (
      !rec(a, path, [
        "id",
        "name",
        "artboardId",
        "fps",
        "duration",
        "loop",
        "tracks",
      ])
    )
      continue;
    identifier(a.id, path + ".id");
    text(a.name, path + ".name");
    anims.set(a.id, a);
    if (!p.artboards.some((b) => b.id === a.artboardId))
      problem(path, "missing artboard");
    if (!Number.isInteger(a.fps) || a.fps < 1 || a.fps > 240)
      problem(path, "fps must be 1 to 240");
    if (!Number.isInteger(a.duration) || a.duration < 1)
      problem(path, "duration must be positive frames");
    if (typeof a.loop !== "boolean") problem(path, "loop must be boolean");
    if (!arr(a.tracks, path + ".tracks")) continue;
    const tracks = new Set();
    for (const t of a.tracks) {
      if (!rec(t, path + ".track", ["targetId", "property", "keys"])) continue;
      const n = nodes.get(t.targetId);
      if (
        !n ||
        n.artboardId !== a.artboardId ||
        !propertiesFor(n).includes(t.property)
      )
        problem(path + ".track", "invalid target/property");
      if (
        n?.kind === "bone" &&
        nodes.get(n.parentId)?.kind === "bone" &&
        ["x", "y"].includes(t.property)
      )
        problem(path + ".track", "child bone position follows parent length");
      const unique = t.targetId + "/" + t.property;
      if (tracks.has(unique)) problem(path, "duplicate track");
      tracks.add(unique);
      if (!arr(t.keys, path + ".keys")) continue;
      if (!t.keys.length) problem(path, "empty track");
      let previous = -1;
      for (const k of t.keys) {
        if (!rec(k, path + ".key", ["frame", "value", "easing"])) continue;
        if (
          !Number.isInteger(k.frame) ||
          k.frame < 0 ||
          k.frame > a.duration ||
          k.frame <= previous
        )
          problem(path, "keys must be sorted, unique frames within duration");
        previous = k.frame;
        if (t.property === "fill") color(k.value, path + ".key");
        else if (
          !Number.isFinite(k.value) ||
          (["width", "height", "length"].includes(t.property) && k.value <= 0)
        )
          problem(path + ".key", "invalid numeric value");
        if (!rec(k.easing, path + ".easing", ["type", "curve"])) continue;
        if (!["hold", "linear", "cubic"].includes(k.easing.type))
          problem(path, "unsupported easing");
        if (k.easing.type === "cubic") {
          vec(k.easing.curve, path + ".curve", 4);
          if (
            Array.isArray(k.easing.curve) &&
            (!(k.easing.curve[0] >= 0 && k.easing.curve[0] <= 1) ||
              !(k.easing.curve[2] >= 0 && k.easing.curve[2] <= 1))
          )
            problem(path, "cubic time handles must be in [0,1]");
        } else if (k.easing.curve !== null)
          problem(path, "only cubic easing carries a curve");
      }
    }
  }
  for (const m of p.machines) {
    const path = "machine " + m?.id;
    if (
      !rec(m, path, [
        "id",
        "name",
        "artboardId",
        "inputs",
        "states",
        "entryStateId",
        "transitions",
        "listeners",
      ])
    )
      continue;
    identifier(m.id, path + ".id");
    text(m.name, path + ".name");
    if (!p.artboards.some((a) => a.id === m.artboardId))
      problem(path, "missing artboard");
    if (
      !["inputs", "states", "transitions", "listeners"].every((k) =>
        arr(m[k], path + "." + k),
      )
    )
      continue;
    const inputs = new Map(),
      states = new Set();
    for (const input of m.inputs) {
      if (!rec(input, path + ".input", ["id", "name", "type", "value"]))
        continue;
      identifier(input.id, path + ".input.id");
      text(input.name, path + ".input.name");
      if ([...inputs.values()].some((i) => i.name === input.name))
        problem(path, "duplicate input name");
      inputs.set(input.id, input);
      if (
        !["boolean", "number", "trigger"].includes(input.type) ||
        (input.type === "number"
          ? !Number.isFinite(input.value)
          : typeof input.value !== "boolean") ||
        (input.type === "trigger" && input.value !== false)
      )
        problem(path, "invalid input default");
    }
    for (const state of m.states) {
      if (
        !rec(state, path + ".state", ["id", "name", "animationId", "position"])
      )
        continue;
      identifier(state.id, path + ".state.id");
      text(state.name, path + ".state.name");
      states.add(state.id);
      if (anims.get(state.animationId)?.artboardId !== m.artboardId)
        problem(path, "state needs an animation in its artboard");
      vec(state.position, path + ".position");
    }
    if (!states.has(m.entryStateId)) problem(path, "missing entry state");
    for (const t of m.transitions) {
      if (!rec(t, path + ".transition", ["id", "fromId", "toId", "conditions"]))
        continue;
      identifier(t.id, path + ".transition.id");
      if (!states.has(t.fromId) || !states.has(t.toId))
        problem(path, "missing transition state");
      if (!arr(t.conditions, path + ".conditions")) continue;
      if (!t.conditions.length)
        problem(path, "a conditional transition needs at least one condition");
      for (const c of t.conditions) {
        if (!rec(c, path + ".condition", ["inputId", "op", "value"])) continue;
        const input = inputs.get(c.inputId);
        if (!input) problem(path, "missing condition input");
        if (!["eq", "ne", "gt", "ge", "lt", "le", "fire"].includes(c.op))
          problem(path, "unsupported comparator");
        if (
          input?.type === "trigger"
            ? c.op !== "fire" || c.value !== null
            : input?.type === "boolean"
              ? !["eq", "ne"].includes(c.op) || typeof c.value !== "boolean"
              : !Number.isFinite(c.value) || c.op === "fire"
        )
          problem(path, "condition type does not match input");
      }
    }
    for (const l of m.listeners) {
      if (
        !rec(l, path + ".listener", [
          "id",
          "targetId",
          "event",
          "inputId",
          "value",
        ])
      )
        continue;
      identifier(l.id, path + ".listener.id");
      const input = inputs.get(l.inputId);
      if (
        nodes.get(l.targetId)?.artboardId !== m.artboardId ||
        !input ||
        l.event !== "click"
      )
        problem(path, "invalid click listener target/input");
      if (
        input?.type === "trigger"
          ? l.value !== null
          : input?.type === "boolean"
            ? typeof l.value !== "boolean"
            : !Number.isFinite(l.value)
      )
        problem(path, "invalid listener value");
    }
  }
  for (const collection of [p.animations, p.machines]) {
    const names = new Set();
    for (const item of collection) {
      if (!item) continue;
      const key = item.artboardId + "/" + item.name;
      if (names.has(key))
        problem(
          "names",
          "animation/machine names must be unique within the artboard",
        );
      names.add(key);
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
export function insertPoint(p, nodeId, index) {
  const n = p.nodes.find((n) => n.id === nodeId),
    g = n.geometry;
  if (g.skin) throw Error("Unbind the path before changing its topology");
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
  const g = p.nodes.find((n) => n.id === nodeId).geometry;
  if (g.points.length <= (g.closed ? 3 : 2))
    throw Error("A closed path needs three points; an open path needs two");
  g.points = g.points.filter((v) => v.id !== pointId);
  if (g.skin)
    g.skin.weights = g.skin.weights.filter((w) => w.pointId !== pointId);
}
export function quantize(influences) {
  const total = influences.reduce((v, [b, w]) => v + w, 0);
  if (!Number.isFinite(total) || total <= 0)
    throw Error("Weights need a positive total");
  const scaled = influences.map(([b, w]) => (w / total) * 255),
    bytes = scaled.map(Math.floor);
  const ranks = bytes
    .map((v, i) => i)
    .sort((a, b) => scaled[b] - bytes[b] - (scaled[a] - bytes[a]) || a - b);
  const remaining = 255 - bytes.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) bytes[ranks[i]]++;
  return influences.map(([b, w], i) => [b, bytes[i] / 255]);
}
export function bindPath(p, nodeId, boneIds) {
  const n = p.nodes.find((n) => n.id === nodeId);
  if (n.kind !== "path" || !boneIds.length || boneIds.length > 4)
    throw Error("Select a path and one to four bones");
  const bindWorld = worldTransform(p, nodeId),
    bones = boneIds.map((boneId) => {
      const bone = p.nodes.find((v) => v.id === boneId);
      if (bone?.kind !== "bone" || bone.artboardId !== n.artboardId)
        throw Error("Choose bones in the same artboard");
      const bind = worldTransform(p, boneId);
      inverse(bind);
      return { boneId, bind };
    });
  const weights = quantize(boneIds.map((b) => [b, 1 / boneIds.length]));
  n.geometry.skin = {
    bindWorld,
    bones,
    weights: n.geometry.points.map((v) => ({
      pointId: v.id,
      anchor: clone(weights),
      in: clone(weights),
      out: clone(weights),
    })),
  };
}
export function setWeight(p, nodeId, pointId, control, boneId, value) {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw Error("Weight must be between 0 and 1");
  const entry = p.nodes
      .find((n) => n.id === nodeId)
      .geometry.skin.weights.find((w) => w.pointId === pointId),
    weights = entry[control];
  if (weights.length === 1) {
    entry[control] = [[boneId, 1]];
    return;
  }
  const rest = weights.filter(([b]) => b !== boneId),
    sum = rest.reduce((v, [b, w]) => v + w, 0);
  entry[control] = quantize(
    weights.map(([b, w]) => [
      b,
      b === boneId
        ? value
        : (1 - value) * (sum > 0 ? w / sum : 1 / rest.length),
    ]),
  );
}
export function controlMatrix(p, n, pointId, control) {
  if (!n.geometry.skin) return worldTransform(p, n.id);
  const skin = n.geometry.skin,
    w = skin.weights.find((v) => v.pointId === pointId)[control],
    matrix = [0, 0, 0, 0, 0, 0];
  for (const [boneId, weight] of quantize(w)) {
    const bind = skin.bones.find((b) => b.boneId === boneId).bind,
      m = multiply(worldTransform(p, boneId), inverse(bind));
    m.forEach((v, i) => (matrix[i] += v * weight));
  }
  return multiply(matrix, skin.bindWorld);
}
export function worldPoints(p, n) {
  return n.geometry.points.map((v) => ({
    id: v.id,
    ...Object.fromEntries(
      ["anchor", "in", "out"].map((k) => [
        k,
        mapPoint(controlMatrix(p, n, v.id, k), v[k]),
      ]),
    ),
  }));
}
export function pathOnContext(ctx, points, closed) {
  ctx.beginPath();
  ctx.moveTo(...points[0].anchor);
  for (let i = 1; i < points.length; i++)
    ctx.bezierCurveTo(
      ...points[i - 1].out,
      ...points[i].in,
      ...points[i].anchor,
    );
  if (closed) {
    ctx.bezierCurveTo(
      ...points.at(-1).out,
      ...points[0].in,
      ...points[0].anchor,
    );
    ctx.closePath();
  }
}
export function components(m) {
  const sx = Math.hypot(m[0], m[1]);
  if (sx < 1e-12) throw Error("Singular transform");
  const rotation = Math.atan2(m[1], m[0]),
    sy = (m[0] * m[3] - m[1] * m[2]) / sx;
  return { x: m[4], y: m[5], rotation, scaleX: sx, scaleY: sy };
}
export function getValue(n, property) {
  if (["width", "height", "length", "fill"].includes(property))
    return n.geometry[property];
  return components(n.transform)[property];
}
export function setValue(n, property, value) {
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
export function easingValue(e, t) {
  if (e.type === "hold") return 0;
  if (e.type === "linear") return t;
  const [x1, y1, x2, y2] = e.curve;
  const cubic = (a, b, s) =>
    3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
  let low = 0,
    high = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (cubic(x1, x2, mid) < t) low = mid;
    else high = mid;
  }
  return cubic(y1, y2, (low + high) / 2);
}
function rgba(color) {
  const hex = color.slice(1);
  return [0, 2, 4, 6].map((i) =>
    i === 6 && hex.length === 6 ? 255 : parseInt(hex.slice(i, i + 2), 16),
  );
}
export function keyValue(track, frame) {
  const keys = track.keys;
  if (frame <= keys[0].frame) return keys[0].value;
  if (frame >= keys.at(-1).frame) return keys.at(-1).value;
  const next = keys.findIndex((k) => k.frame > frame),
    a = keys[next - 1],
    b = keys[next],
    t = easingValue(a.easing, (frame - a.frame) / (b.frame - a.frame));
  if (track.property === "fill") {
    const from = rgba(a.value),
      to = rgba(b.value);
    return (
      "#" +
      from
        .map((v, i) =>
          Math.max(0, Math.min(255, Math.round(v + (to[i] - v) * t)))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  }
  return a.value + (b.value - a.value) * t;
}
export function evaluate(p, animationId, frame) {
  const pose = clone(p),
    a = p.animations.find((a) => a.id === animationId);
  if (!a) return pose;
  const changes = new Map();
  for (const track of a.tracks) {
    if (!changes.has(track.targetId)) changes.set(track.targetId, {});
    changes.get(track.targetId)[track.property] = keyValue(
      track,
      Math.max(0, Math.min(a.duration, frame)),
    );
  }
  for (const [id, values] of changes) {
    const n = pose.nodes.find((n) => n.id === id),
      base = components(n.transform),
      m = n.transform;
    const sx = values.scaleX === undefined ? 1 : values.scaleX / base.scaleX,
      sy = values.scaleY === undefined ? 1 : values.scaleY / base.scaleY;
    const delta = (values.rotation ?? base.rotation) - base.rotation,
      c = Math.cos(delta),
      s = Math.sin(delta),
      [aa, bb, cc, dd] = m;
    m[0] = (c * aa - s * bb) * sx;
    m[1] = (s * aa + c * bb) * sx;
    m[2] = (c * cc - s * dd) * sy;
    m[3] = (s * cc + c * dd) * sy;
    if (values.x !== undefined) m[4] = values.x;
    if (values.y !== undefined) m[5] = values.y;
    for (const key of ["width", "height", "length", "fill"])
      if (values[key] !== undefined) n.geometry[key] = values[key];
  }
  return pose;
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
export class MachinePlayer {
  constructor(p, machineId) {
    this.project = clone(p);
    this.machine = this.project.machines.find((m) => m.id === machineId);
    this.reset();
  }
  reset() {
    this.stateId = this.machine.entryStateId;
    this.time = 0;
    this.inputs = Object.fromEntries(
      this.machine.inputs.map((i) => [i.id, i.value]),
    );
    return this.advance(0);
  }
  set(inputId, value) {
    const input = this.machine.inputs.find((i) => i.id === inputId);
    if (
      !input ||
      (input.type === "number"
        ? !Number.isFinite(value)
        : typeof value !== "boolean")
    )
      throw Error("Invalid test input");
    this.inputs[inputId] = value;
  }
  advance(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw Error("Invalid delta time");
    this.time += dt;
    for (let iteration = 0; iteration < 100; iteration++) {
      const t = this.machine.transitions.find(
        (t) =>
          t.fromId === this.stateId &&
          t.toId !== this.stateId &&
          t.conditions.every((c) => {
            const v = this.inputs[c.inputId];
            return {
              eq: () => v === c.value,
              ne: () => v !== c.value,
              gt: () => v > c.value,
              ge: () => v >= c.value,
              lt: () => v < c.value,
              le: () => v <= c.value,
              fire: () => v === true,
            }[c.op]();
          }),
      );
      if (!t) break;
      this.stateId = t.toId;
      this.time = 0;
      for (const condition of t.conditions)
        if (condition.op === "fire") this.inputs[condition.inputId] = false;
      if (iteration === 99)
        throw Error(
          "State machine has a continuously enabled transition cycle",
        );
    }
    for (const i of this.machine.inputs)
      if (i.type === "trigger") this.inputs[i.id] = false;
    return this.pose();
  }
  click(targetId) {
    for (const l of this.machine.listeners.filter(
      (l) => l.targetId === targetId,
    ))
      this.set(
        l.inputId,
        this.machine.inputs.find((i) => i.id === l.inputId).type === "trigger"
          ? true
          : l.value,
      );
    return this.advance(0);
  }
  pose() {
    const state = this.machine.states.find((s) => s.id === this.stateId),
      a = this.project.animations.find((a) => a.id === state.animationId);
    return evaluate(
      this.project,
      a.id,
      a.loop
        ? (this.time * a.fps) % a.duration
        : Math.min(a.duration, this.time * a.fps),
    );
  }
}
