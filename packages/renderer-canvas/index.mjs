import { strokePathOnContext, strokeStyle } from "./stroke.mjs";
export { strokePathOnContext, strokeStyle, strokeContours } from "./stroke.mjs";
import { SceneAssets } from "./assets.mjs";
export { SceneAssets } from "./assets.mjs";
import {
  worldTransform,
  inverse,
  transformResolver,
} from "@evir/project-model";
import { worldPoints, mapPoint, controlMatrix } from "@evir/runtime/geometry";
export function paintOnContext(ctx, fill) {
  if (typeof fill === "string") return fill;
  const [x, y] = fill.start,
    [ex, ey] = fill.end;
  const gradient =
    fill.type === "linear"
      ? ctx.createLinearGradient(x, y, ex, ey)
      : ctx.createRadialGradient(x, y, 0, x, y, Math.hypot(ex - x, ey - y));
  for (const stop of [...fill.stops].sort((a, b) => a.position - b.position))
    gradient.addColorStop(stop.position, stop.color);
  return gradient;
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

export function sceneOrder(p, artboardId) {
  const children = new Map(),
    out = [];
  for (const n of p.nodes) {
    if (n.artboardId !== artboardId) continue;
    if (!children.has(n.parentId)) children.set(n.parentId, []);
    children.get(n.parentId).push(n);
  }
  for (const list of children.values()) list.sort((a, b) => b.order - a.order);
  const stack = [...(children.get(null) || [])];
  while (stack.length) {
    const n = stack.pop();
    out.push(n);
    for (const child of children.get(n.id) || []) stack.push(child);
  }
  return out;
}
export function isHidden(p, n) {
  let current = n;
  while (current) {
    if (p.editor?.hidden?.includes(current.id)) return true;
    current = p.nodes.find((v) => v.id === current.parentId);
  }
  return false;
}
export function drawScene(
  ctx,
  p,
  artboardId,
  { ignoreEditorState = false, assets } = {},
) {
  const nodes = new Map(p.nodes.map((n) => [n.id, n])),
    resolve = transformResolver(p);
  const clips = new Map((p.advanced?.clips || []).map((c) => [c.targetId, c]));
  const feathers = new Map(
    (p.advanced?.feathers || []).map((f) => [f.targetId, f]),
  );
  const maskArtworkHidden = new Set(
    (p.advanced?.clips || []).filter((c) => !c.visible).map((c) => c.maskId),
  );
  const hidden = new Set(ignoreEditorState ? [] : p.editor?.hidden || []);
  for (const n of sceneOrder(p, artboardId)) {
    let invisible = false;
    for (let ancestor = n; ancestor; ancestor = nodes.get(ancestor.parentId))
      if (hidden.has(ancestor.id)) {
        invisible = true;
        break;
      }
    if (invisible) continue;
    if (maskArtworkHidden.has(n.id)) continue;
    ctx.save();
    try {
      let ancestor = n;
      while (ancestor) {
        const clip = clips.get(ancestor.id);
        if (clip) {
          const mask = nodes.get(clip.maskId);
          shapePath(ctx, p, mask, resolve);
          ctx.clip("nonzero");
        }
        ancestor = nodes.get(ancestor.parentId);
      }
      const feather = feathers.get(n.id);
      if (feather?.strength) {
        if (!("filter" in ctx))
          throw Error("Outer feather requires Canvas2D filter support");
        const m = ctx.getTransform();
        ctx.filter = `blur(${feather.strength * 0.5 * Math.hypot(m.a, m.b)}px)`;
      }
      if (n.kind === "rectangle") {
        ctx.save();
        ctx.transform(...resolve(n.id));
        if (n.geometry.fill !== null) {
          ctx.fillStyle = paintOnContext(ctx, n.geometry.fill);
          ctx.fillRect(0, 0, n.geometry.width, n.geometry.height);
        }
        if (n.geometry.stroke?.width) {strokeStyle(ctx,n.geometry);strokePathOnContext(ctx,n.geometry);ctx.stroke();}
        ctx.restore();
      } else if (n.kind === "path") {
        ctx.save();
        const gradient = n.geometry.fill !== null && typeof n.geometry.fill !== "string";
        if (gradient) ctx.transform(...resolve(n.id));
        const points = worldPoints(p, n, resolve);
        const paintInverse = gradient ? inverse(resolve(n.id)) : null;
        const local = gradient
          ? points.map((v) => ({
              ...v,
              ...Object.fromEntries(
                ["anchor", "in", "out"].map((k) => [
                  k,
                  mapPoint(paintInverse, v[k]),
                ]),
              ),
            }))
          : points;
        pathOnContext(ctx, local, n.geometry.closed);
        if (n.geometry.fill !== null) {ctx.fillStyle = paintOnContext(ctx, n.geometry.fill);ctx.fill("nonzero");}
        ctx.restore();
        if (n.geometry.stroke?.width) {
          ctx.save();ctx.transform(...resolve(n.id));
          strokeStyle(ctx,n.geometry);strokePathOnContext(ctx,n.geometry);ctx.stroke();ctx.restore();
        }
      } else if (n.kind === "text") {
        ctx.save();
        ctx.transform(...resolve(n.id));
        ctx.font = `${n.geometry.fontSize}px "${assets.get(n.geometry.fontAssetId).family}"`;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        ctx.fillStyle = n.geometry.fill;
        ctx.fillText(n.geometry.text, 0, 0);
        ctx.restore();
      } else if (n.kind === "image") {
        ctx.save();
        ctx.transform(...resolve(n.id));
        ctx.drawImage(
          assets.get(n.geometry.assetId).bitmap,
          0,
          0,
          n.geometry.width,
          n.geometry.height,
        );
        ctx.restore();
      } else if (n.kind === "mesh")
        drawMesh(ctx, p, n, assets.get(n.geometry.assetId).bitmap, resolve);
    } finally {
      ctx.restore();
    }
  }
}
function shapePath(ctx, p, n, resolve) {
  if (n.kind === "path")
    pathOnContext(ctx, worldPoints(p, n, resolve), n.geometry.closed);
  else {
    const m = resolve(n.id),
      g = n.geometry,
      points = [
        [0, 0],
        [g.width, 0],
        [g.width, g.height],
        [0, g.height],
      ].map((v) => mapPoint(m, v));
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const v of points.slice(1)) ctx.lineTo(...v);
    ctx.closePath();
  }
}
function drawMesh(ctx, p, n, image, resolve) {
  const vertices = n.geometry.vertices.map((v) => ({
    position: mapPoint(
      controlMatrix(p, n, v.id, "anchor", resolve),
      v.position,
    ),
    uv: [v.uv[0] * image.width, v.uv[1] * image.height],
  }));
  for (let i = 0; i < n.geometry.triangles.length; i += 3) {
    const [a, b, c] = n.geometry.triangles
      .slice(i, i + 3)
      .map((j) => vertices[j]);
    const [u, v] = a.uv,
      [du, dv] = [b.uv[0] - u, b.uv[1] - v],
      [eu, ev] = [c.uv[0] - u, c.uv[1] - v],
      det = du * ev - dv * eu;
    const dx = b.position[0] - a.position[0],
      dy = b.position[1] - a.position[1],
      ex = c.position[0] - a.position[0],
      ey = c.position[1] - a.position[1];
    const m = [
      (dx * ev - ex * dv) / det,
      (dy * ev - ey * dv) / det,
      (ex * du - dx * eu) / det,
      (ey * du - dy * eu) / det,
    ];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...a.position);
    ctx.lineTo(...b.position);
    ctx.lineTo(...c.position);
    ctx.closePath();
    ctx.clip();
    ctx.transform(
      ...m,
      a.position[0] - m[0] * u - m[2] * v,
      a.position[1] - m[1] * u - m[3] * v,
    );
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }
}
export function nodeBounds(p, n) {
  let nodes = [n];
  if (n.kind === "group" || n.kind === "bone")
    nodes = p.nodes.filter((v) => {
      let parent = v;
      while (parent) {
        if (parent.id === n.id) return true;
        parent = p.nodes.find((v) => v.id === parent.parentId);
      }
      return false;
    });
  const points = nodes
    .filter((v) => !isHidden(p, v))
    .flatMap((v) => {
      if (v.kind === "path")
        return worldPoints(p, v).flatMap((p) => [p.anchor, p.in, p.out]);
      if (v.kind === "bone") {
        const m = worldTransform(p, v.id);
        return [mapPoint(m, [0, 0]), mapPoint(m, [v.geometry.length, 0])];
      }
      if (v.kind === "mesh")
        return v.geometry.vertices.map((vertex) =>
          mapPoint(controlMatrix(p, v, vertex.id, "anchor"), vertex.position),
        );
      if (v.kind === "text") {
        const m = worldTransform(p, v.id),
          g = v.geometry;
        return [
          [0, -g.fontSize],
          [
            Math.max(g.fontSize, g.text.length * g.fontSize * 0.65),
            g.fontSize * 0.3,
          ],
        ].map((v) => mapPoint(m, v));
      }
      if (["rectangle", "image"].includes(v.kind)) {
        const m = worldTransform(p, v.id);
        return [
          [0, 0],
          [v.geometry.width, 0],
          [v.geometry.width, v.geometry.height],
          [0, v.geometry.height],
        ].map((v) => mapPoint(m, v));
      }
      return [];
    });
  if (!points.length) {
    const [x, y] = mapPoint(worldTransform(p, n.id), [0, 0]);
    return { x: x - 12, y: y - 12, width: 24, height: 24 };
  }
  // Conservative local miter/round/square envelope, transformed per shape.
  for (const v of nodes.filter(v => !isHidden(p,v) && v.geometry?.stroke)) {
    const s=v.geometry.stroke, pad=s.width*(s.join==="miter"?2:Math.SQRT1_2),m=worldTransform(p,v.id);
    const source=v.kind==="path"?v.geometry.points.flatMap(p=>[p.anchor,p.in,p.out]):[[0,0],[v.geometry.width,v.geometry.height]];
    for(const point of source)for(const dx of [-pad,pad])for(const dy of [-pad,pad])points.push(mapPoint(m,[point[0]+dx,point[1]+dy]));
  }
  const xs = points.map((v) => v[0]),
    ys = points.map((v) => v[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

// Host adapter: sizing and scheduling belong to the app; scene drawing belongs
// to this backend. No DOM lookup, storage or editor panels are required.
export class CanvasRenderer {
  constructor(context) {
    if (!context?.canvas || typeof context.save !== "function")
      throw new TypeError("A Canvas2D context is required");
    this.context = context;
    this.assets = new SceneAssets();
  }
  async prepare(project) {
    return this.assets.load(project);
  }
  dispose() {
    this.assets.dispose();
  }
  draw(pose, artboardId) {
    const board = pose.artboards.find((a) => a.id === artboardId);
    if (!board) throw new RangeError("Missing artboard");
    const ctx = this.context,
      { width, height } = ctx.canvas;
    const scale = Math.min(width / board.width, height / board.height);
    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(
        (width - board.width * scale) / 2,
        (height - board.height * scale) / 2,
      );
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.rect(0, 0, board.width, board.height);
      ctx.clip();
      drawScene(ctx, pose, artboardId, {
        ignoreEditorState: true,
        assets: this.assets,
      });
    } finally {
      ctx.restore();
    }
  }
}
