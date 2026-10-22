import { assetBudget } from "./assets.mjs";
import { ProjectError, inverse } from "./primitives.mjs";
export function upgradeAdvanced(p) {
  if (p.format !== "evir-project")
    throw new ProjectError(["Only editable source can be upgraded"]);
  p.schemaVersion = 3;
  p.advanced ??= { clips: [], feathers: [], ik: [] };
  return p;
}
export const isColorProperty = (p) =>
  p === "fill" || p === "stroke.color" || /^(?:stroke\.)?paint\.stop\.\d+\.color$/.test(p);
export function paintProperties(n) {
  const f = n.geometry?.fill;
  return f && typeof f !== "string"
    ? [
        "paint.startX",
        "paint.startY",
        "paint.endX",
        "paint.endY",
        ...f.stops.flatMap((_, i) => [
          `paint.stop.${i}.position`,
          `paint.stop.${i}.color`,
        ]),
      ]
    : [];
}
export function paintValue(n, p, value) {
  const bits = p.split("."),
    f = n.geometry.fill;
  const host =
    bits[1] === "stop"
      ? f.stops[Number(bits[2])]
      : f[bits[1].startsWith("start") ? "start" : "end"];
  const key = bits[1] === "stop" ? bits[3] : bits[1].endsWith("X") ? 0 : 1;
  if (arguments.length === 3)
    host[key] = key === "position" ? Math.max(0, Math.min(1, value)) : value;
  return host[key];
}
export function validateAdvanced(p, problem, identifier) {
  try {
    assetBudget(p.assets);
  } catch (e) {
    problem("assets", e.message);
  }
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
  const finite = (v, path, lo = -1e6, hi = 1e6) => {
    if (!Number.isFinite(v) || v < lo || v > hi)
      problem(path, `expected number in [${lo},${hi}]`);
  };
  const vec = (v, path) => {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite))
      problem(path, "expected two finite coordinates");
  };
  const mat = (m, path) => {
    if (!Array.isArray(m) || m.length !== 6 || !m.every(Number.isFinite)) {
      problem(path, "expected six finite bind values");
      return;
    }
    try {
      inverse(m);
    } catch {
      problem(path, "singular bind matrix");
    }
  };
  const unit = (m) =>
    Math.abs(Math.hypot(m[0], m[1]) - 1) < 1e-6 &&
    Math.abs(Math.hypot(m[2], m[3]) - 1) < 1e-6 &&
    Math.abs(m[0] * m[3] - m[1] * m[2] - 1) < 1e-6;
  const nodes = new Map(p.nodes.map((n) => [n.id, n])),
    assets = new Map(p.assets.map((a) => [a.id, a]));
  for (const n of p.nodes) {
    const g = n.geometry,
      path = "node " + n.id;
    if (n.kind === "text") {
      if (!rec(g, path, ["text", "fontAssetId", "fontSize", "fill"])) continue;
      if (
        typeof g.text !== "string" ||
        g.text.length > 8192 ||
        /[\n\r]/.test(g.text)
      )
        problem(path, "single-line text required; maximum 8192 characters");
      finite(g.fontSize, path + ".fontSize", 1, 512);
      if (
        typeof g.fill !== "string" ||
        !/^#[\da-fA-F]{6}([\da-fA-F]{2})?$/.test(g.fill)
      )
        problem(path, "text requires a solid color");
      if (
        !["font/ttf", "font/otf"].includes(assets.get(g.fontAssetId)?.mimeType)
      )
        problem(path, "embedded TTF/OTF font required");
    }
    if (n.kind === "image" || n.kind === "mesh") {
      const keys =
        n.kind === "image"
          ? ["assetId", "width", "height"]
          : ["assetId", "vertices", "triangles", "skin"];
      if (!rec(g, path, keys)) continue;
      if (assets.get(g.assetId)?.mimeType !== "image/png")
        problem(path, "embedded PNG required");
      if (n.kind === "image") {
        finite(g.width, path + ".width", 0.01);
        finite(g.height, path + ".height", 0.01);
        continue;
      }
      if (
        !Array.isArray(g.vertices) ||
        g.vertices.length < 3 ||
        g.vertices.length > 65535
      ) {
        problem(path, "3–65535 mesh vertices required");
        continue;
      }
      const points = new Set();
      for (const v of g.vertices) {
        if (!rec(v, path + ".vertex", ["id", "position", "uv"])) continue;
        identifier(v.id, path + ".vertex.id");
        points.add(v.id);
        vec(v.position, path + ".position");
        vec(v.uv, path + ".uv");
        if (Array.isArray(v.uv) && v.uv.some((x) => x < 0 || x > 1))
          problem(path, "UV coordinates must be normalized");
      }
      if (
        !Array.isArray(g.triangles) ||
        !g.triangles.length ||
        g.triangles.length % 3 ||
        g.triangles.some(
          (i) => !Number.isInteger(i) || i < 0 || i >= g.vertices.length,
        )
      )
        problem(path, "triangle indices must reference vertices in triples");
      if (Array.isArray(g.triangles))
        for (let i = 0; i < g.triangles.length; i += 3) {
          const vs = g.triangles.slice(i, i + 3).map((j) => g.vertices[j]);
          if (vs.some((v) => !v)) continue;
          for (const k of ["position", "uv"]) {
            const [a, b, c] = vs.map((v) => v[k]);
            if ([a, b, c].some((v) => !Array.isArray(v) || v.length !== 2))
              continue;
            if (
              Math.abs(
                (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
              ) < 1e-10
            )
              problem(path, "degenerate mesh triangle");
          }
        }
      if (g.skin !== null) {
        if (!rec(g.skin, path + ".skin", ["bindWorld", "bones", "weights"]))
          continue;
        mat(g.skin.bindWorld, path + ".bindWorld");
        if (
          !Array.isArray(g.skin.bones) ||
          !g.skin.bones.length ||
          !Array.isArray(g.skin.weights)
        ) {
          problem(path, "mesh skin needs bones and weights");
          continue;
        }
        const bones = new Set();
        for (const b of g.skin.bones) {
          if (!rec(b, path + ".bone", ["boneId", "bind"])) continue;
          const bone = nodes.get(b.boneId);
          if (
            bone?.kind !== "bone" ||
            bone.artboardId !== n.artboardId ||
            bones.has(b.boneId)
          )
            problem(path, "invalid mesh tendon");
          bones.add(b.boneId);
          mat(b.bind, path + ".bind");
        }
        const weighted = new Set();
        for (const w of g.skin.weights) {
          if (!rec(w, path + ".weight", ["pointId", "anchor", "in", "out"]))
            continue;
          if (!points.has(w.pointId) || weighted.has(w.pointId))
            problem(path, "invalid mesh vertex weight");
          weighted.add(w.pointId);
          for (const k of ["anchor", "in", "out"]) {
            const pairs = w[k];
            if (!Array.isArray(pairs) || !pairs.length || pairs.length > 4) {
              problem(path, "one to four influences required");
              continue;
            }
            const unique = new Set();
            let total = 0;
            for (const pair of pairs) {
              if (
                !Array.isArray(pair) ||
                pair.length !== 2 ||
                !bones.has(pair[0]) ||
                unique.has(pair[0]) ||
                !Number.isFinite(pair[1]) ||
                pair[1] < 0
              )
                problem(path, "invalid mesh influence");
              unique.add(pair?.[0]);
              total += pair?.[1] ?? 0;
            }
            if (Math.abs(total - 1) > 1e-8)
              problem(path, "mesh influences must sum to one");
          }
          if (
            JSON.stringify(w.anchor) !== JSON.stringify(w.in) ||
            JSON.stringify(w.anchor) !== JSON.stringify(w.out)
          )
            problem(path, "mesh controls share vertex influences");
        }
        if (weighted.size !== points.size)
          problem(path, "all mesh vertices require weights");
      }
    }
  }
  if (!rec(p.advanced, "advanced", ["clips", "feathers", "ik"])) return;
  for (const k of ["clips", "feathers", "ik"])
    if (!Array.isArray(p.advanced[k])) {
      problem("advanced." + k, "expected array");
      return;
    }
  const refs = (n, id, path) => {
    const t = nodes.get(id);
    if (!t || !n || t.artboardId !== n.artboardId)
      problem(path, "missing target or cross-artboard reference");
    return t;
  };
  const ancestor = (id, parent) => {
    while (id) {
      if (id === parent) return true;
      id = nodes.get(id)?.parentId;
    }
    return false;
  };
  const clips = new Set();
  for (const c of p.advanced.clips) {
    if (!rec(c, "clip", ["targetId", "maskId", "visible",...(Object.hasOwn(c??{},"fillRule")?["fillRule"]:[])])) continue;
    if(c.fillRule!==undefined&&!['nonzero','evenodd'].includes(c.fillRule))problem("clip","invalid fill rule");
    const n = nodes.get(c.targetId),
      mask = refs(n, c.maskId, "clip");
    if (clips.has(c.targetId)) problem("clip", "one mask per target");
    clips.add(c.targetId);
    if (
      !["rectangle", "path"].includes(mask?.kind) ||
      ancestor(c.maskId, c.targetId) ||
      typeof c.visible !== "boolean"
    )
      problem(
        "clip",
        "mask must be an external rectangle/path; cannot clip its ancestor",
      );
  }
  const feathers = new Set();
  for (const f of p.advanced.feathers) {
    if (!rec(f, "feather", ["targetId", "strength"])) continue;
    const n = nodes.get(f.targetId);
    if (!["rectangle", "path"].includes(n?.kind) || feathers.has(f.targetId))
      problem("feather", "one outer feather per shape");
    feathers.add(f.targetId);
    finite(f.strength, "feather.strength", 0, 64);
  }
  const constrained = new Set();
  for (const c of p.advanced.ik) {
    if (!rec(c, "ik", ["boneId", "targetId", "count", "invert", "strength"]))
      continue;
    const tip = nodes.get(c.boneId),
      target = refs(tip, c.targetId, "ik");
    if (
      tip?.kind !== "bone" ||
      (!Number.isInteger(c.count)||c.count<1||c.count>8) ||
      typeof c.invert !== "boolean" ||
      ancestor(target?.id, c.boneId)
    )
      problem("ik", "IK needs one to eight bones and an independent target");
    finite(c.strength, "ik.strength", 0, 1);
    let b = tip;
    for (let i = 0; i < c.count; i++, b = nodes.get(b?.parentId)) {
      if (b?.kind !== "bone" || constrained.has(b.id)) {
        problem("ik", "missing or overlapping bone chain");
        break;
      }
      constrained.add(b.id);
      const m = b.transform,
        sx = Math.hypot(m[0], m[1]),
        sy = Math.hypot(m[2], m[3]);
      if (!unit(m)) problem("ik", "IK bones require unit positive scales");
    }
    let parent = nodes.get(b?.id);
    while (parent) {
      const m = parent.transform;
      if (!unit(m)) problem("ik", "IK ancestors require unit scales");
      parent = nodes.get(parent.parentId);
    }
  }
  for (const c of p.advanced.ik) {
    let target = nodes.get(c.targetId);
    while (target) {
      if (constrained.has(target.id))
        problem("ik", "target must be independent of every constrained chain");
      target = nodes.get(target.parentId);
    }
  }
  for (const a of p.animations)
    for (const t of a.tracks)
      if (["scaleX", "scaleY"].includes(t.property)) {
        let affects = false;
        for (const id of constrained)
          if (ancestor(id, t.targetId)) affects = true;
        if (
          affects &&
          t.keys.some(
            (k) =>
              k.value !== 1 ||
              (k.easing.type === "cubic" &&
                (k.easing.curve[1] < 0 || k.easing.curve[3] > 1)),
          )
        )
          problem("ik", "scale animation is outside unit-scale IK contract");
      }
}
