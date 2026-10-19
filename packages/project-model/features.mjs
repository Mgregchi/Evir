import { strokeProperties, validateStroke } from "./stroke.mjs";
import { paintProperties, isColorProperty } from "./advanced.mjs";
import { validatePaint } from "./paint.mjs";
import { inverse } from "./primitives.mjs";
import { validatePlayback } from './playback.mjs';
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
  const fill = typeof n.geometry?.fill === "string" ? ["fill"] : [];
  return [
    "x",
    "y",
    "rotation",
    "scaleX",
    "scaleY",
    ...paintProperties(n),
    ...strokeProperties(n),
    ...(n.kind === "rectangle"
      ? ["width", "height", ...fill]
      : n.kind === "path"
        ? fill
        : n.kind === "bone"
          ? ["length"]
          : n.kind === "text"
            ? ["fontSize", "fill"]
            : []),
  ];
}
export function validateFeatures(
  p,
  problem,
  identifier,
  { editorState = true } = {},
) {
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
    if (!rec(g, path + ".geometry", ["closed", "fill", "points", "skin", ...(Object.hasOwn(g ?? {}, "stroke") ? ["stroke"] : [])]))
      continue;
    if (typeof g.closed !== "boolean")
      problem(path + ".closed", "expected boolean");
    if (g.fill !== null || !g.stroke) validatePaint(g.fill, path + ".fill", problem);
    validateStroke(n, p, problem);
    if (!p.advanced && g.skin !== null && typeof g.fill !== "string")
      problem(
        path + ".fill",
        "gradient paint on skinned paths is outside the supported contract",
      );
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
        ...(a && Object.hasOwn(a, 'playback') ? ['playback'] : ['loop']),
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
    if (Object.hasOwn(a, 'playback')) validatePlayback(a.playback, path + '.playback', problem);
    else if (typeof a.loop !== "boolean") problem(path, "loop must be boolean");
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
        if (!p.advanced && t.property.startsWith("paint."))
          problem(path, "paint keys require advanced source version 3");
        if (t.property.startsWith("stroke.") && !p.advanced) problem(path, "stroke keys require advanced source");
        if (isColorProperty(t.property)) color(k.value, path + ".key");
        else if (
          !Number.isFinite(k.value) ||
          (t.property === "stroke.width" && (k.value < 0 || k.value > 256)) ||
          (["stroke.trimStart","stroke.trimEnd"].includes(t.property) && (k.value < 0 || k.value > 1)) ||
          (t.property === "stroke.trimOffset" && Math.abs(k.value) > 1) ||
          (t.property === "stroke.dashOffset" && Math.abs(k.value) > 16384) ||
          (["width", "height", "length", "fontSize"].includes(t.property) &&
            k.value <= 0) || (t.property === "fontSize" && k.value > 512) ||
          (t.property.endsWith(".position") && (k.value < 0 || k.value > 1))
        )
          problem(path + ".key", "invalid numeric value");
        if (!rec(k.easing, path + ".easing", ["type", "curve"])) continue;
        if (!["hold", "linear", "cubic"].includes(k.easing.type))
          problem(path, "unsupported easing");
        if (k.easing.type === "cubic") {
          vec(k.easing.curve, path + ".curve", 4);
          if ((t.property.startsWith("stroke.") || (n?.geometry?.stroke && ["width","height"].includes(t.property))) && !isColorProperty(t.property) && Array.isArray(k.easing.curve) && [k.easing.curve[1],k.easing.curve[3]].some(v=>v<0 || v>1)) problem(path,"stroke easing value handles must stay in [0,1]");
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
        !rec(state, path + ".state", [
          "id",
          "name",
          "animationId",
          ...(editorState ? ["position"] : []),
          ...(state?.blend ? ["blend"] : []),
        ])
      )
        continue;
      identifier(state.id, path + ".state.id");
      text(state.name, path + ".state.name");
      states.add(state.id);
      if (anims.get(state.animationId)?.artboardId !== m.artboardId)
        problem(path, "state needs an animation in its artboard");
      if (state.blend) {
        const b = state.blend;
        if (!p.advanced) problem(path, "blend states require advanced source");
        const direct=b.type==='direct';
        if (rec(b, path + ".blend", direct ? ["type","children"] : ["type", "inputId", "children"])) {
          if (!direct && (b.type !== "1d" || inputs.get(b.inputId)?.type !== "number"))
            problem(path, "1D blend needs a number input");
          if(direct && (m.states.length!==1 || m.transitions.length))
            problem(path,"Direct blending currently needs one state and no transitions");
          if (arr(b.children, path + ".children")) {
            if (b.children.length < 2 || (direct && b.children.length>8))
              problem(path, direct ? "Direct blending needs 2–8 ordered children" : "two blend children required");
            let previous = -Infinity;
            for (const child of b.children) {
              if (!rec(child, path + ".child", direct ? ["animationId",...(Object.hasOwn(child??{},'weight') ? ['weight'] : ['inputId'])] : ["animationId", "position"])) continue;
              if (anims.get(child.animationId)?.artboardId !== m.artboardId)
                problem(path,"Blend child needs an animation in this artboard");
              if(direct){
                if('weight' in child){if(!Number.isFinite(child.weight)||child.weight<0||child.weight>100)problem(path,'Direct weight must be in [0,100]');}
                else if(inputs.get(child.inputId)?.type!=="number")problem(path,"Direct weight needs a number input");
              }else{
                if(!Number.isFinite(child.position)||child.position<=previous)
                  problem(path,"blend children need animations and increasing positions");
                previous=child.position;
              }
            }
            if(direct && state.animationId!==b.children[0]?.animationId)
              problem(path,"Direct state animation must match its first child");
          }
        }
      }
      if (editorState) vec(state.position, path + ".position");
    }
    if (!states.has(m.entryStateId)) problem(path, "missing entry state");
    for (const t of m.transitions) {
      if (
        !rec(t, path + ".transition", [
          "id",
          "fromId",
          "toId",
          "conditions",
          ...("durationMs" in t ? ["durationMs"] : []),
          ...("exitTimeMs" in t ? ["exitTimeMs"] : []),
        ])
      )
        continue;
      identifier(t.id, path + ".transition.id");
      if (!states.has(t.fromId) || !states.has(t.toId))
        problem(path, "missing transition state");
      if (!arr(t.conditions, path + ".conditions")) continue;
      for (const k of ["durationMs", "exitTimeMs"])
        if (
          k in t &&
          (!p.advanced || !Number.isInteger(t[k]) || t[k] < 0 || t[k] > 600000)
        )
          problem(
            path,
            "transition times require advanced source and integer milliseconds 0–600000",
          );
      if (!t.conditions.length && !("exitTimeMs" in t))
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
  const directClips=new Set(p.machines.flatMap(m=>(Array.isArray(m?.states)?m.states:[]).flatMap(s=>s?.blend?.type==='direct'&&Array.isArray(s.blend.children)?s.blend.children.map(c=>c?.animationId):[])));
  for(const m of p.machines)for(const s of m.states)if(s.blend?.type!=='direct'){
    const clips=Array.isArray(s.blend?.children)?s.blend.children.map(c=>c?.animationId):[s.animationId];
    if(clips.some(id=>directClips.has(id)))problem('machine '+m.id,'Direct child animations cannot also drive ordinary/1D states; use separate timelines');
  }

}
