import { worldTransform } from "./model.mjs";
import { worldPoints, pathOnContext, mapPoint } from "./motion.mjs";
export function sceneOrder(p, artboardId) {
  const out = [];
  function visit(parentId) {
    for (const n of p.nodes
      .filter((n) => n.artboardId === artboardId && n.parentId === parentId)
      .sort((a, b) => a.order - b.order)) {
      out.push(n);
      visit(n.id);
    }
  }
  visit(null);
  return out;
}
export function isHidden(p, n) {
  let current = n;
  while (current) {
    if (p.editor.hidden.includes(current.id)) return true;
    current = p.nodes.find((v) => v.id === current.parentId);
  }
  return false;
}
export function drawScene(
  ctx,
  p,
  artboardId,
  { ignoreEditorState = false } = {},
) {
  for (const n of sceneOrder(p, artboardId)) {
    if (!ignoreEditorState && isHidden(p, n)) continue;
    if (n.kind === "rectangle") {
      ctx.save();
      ctx.transform(...worldTransform(p, n.id));
      ctx.fillStyle = n.geometry.fill;
      ctx.fillRect(0, 0, n.geometry.width, n.geometry.height);
      ctx.restore();
    } else if (n.kind === "path") {
      pathOnContext(ctx, worldPoints(p, n), n.geometry.closed);
      ctx.fillStyle = n.geometry.fill;
      ctx.fill("nonzero");
    }
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
      if (v.kind === "rectangle") {
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
  const xs = points.map((v) => v[0]),
    ys = points.map((v) => v[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
