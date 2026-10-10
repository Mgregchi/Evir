import { inverse, worldTransform } from "@evir/project-model";
import { nodeBounds } from "@evir/renderer-canvas";

export function available(p, n, key) {
  for (let current = n; current; current = p.nodes.find((v) => v.id === current.parentId))
    if (p.editor[key].includes(current.id)) return false;
  return Boolean(n);
}
export function selectionRoots(p, ids) {
  const selected = new Set(ids);
  return p.nodes.filter((n) => {
    if (!selected.has(n.id)) return false;
    for (let parent = n.parentId; parent; parent = p.nodes.find((v) => v.id === parent)?.parentId)
      if (selected.has(parent)) return false;
    return true;
  });
}
export function selectionBounds(p, ids) {
  const boxes = selectionRoots(p, ids).filter((n) => available(p, n, "hidden")).map((n) => nodeBounds(p, n));
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
  return { x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y };
}
export function marqueeTargets(p, artboardId, box, deep = false) {
  return p.nodes.filter((n) => {
    if (n.artboardId !== artboardId || !available(p, n, "hidden") || !available(p, n, "locked")) return false;
    if (deep ? n.kind === "group" : n.parentId !== null) return false;
    const b = nodeBounds(p, n);
    return b.x >= box.x && b.y >= box.y && b.x + b.width <= box.x + box.width && b.y + b.height <= box.y + box.height;
  }).map((n) => n.id);
}
export function prepareSelectionMove(p, ids) {
  return selectionRoots(p, ids).map((n) => {
    if (!available(p, n, "locked")) throw Error(`Unlock ${n.name} before moving this selection.`);
    const parent = p.nodes.find((v) => v.id === n.parentId);
    if (n.kind === "bone" && parent?.kind === "bone")
      throw Error("Child bones attach at the parent tip. Change rotation or the parent length.");
    return { id: n.id, transform: [...n.transform], parentInverse: parent
      ? inverse(worldTransform(p, parent.id)) : [1, 0, 0, 1, 0, 0] };
  });
}
export function applySelectionMove(p, prepared, dx, dy) {
  for (const { id, transform, parentInverse: m } of prepared) {
    const n = p.nodes.find((v) => v.id === id);
    n.transform = [...transform];
    n.transform[4] += m[0] * dx + m[2] * dy;
    n.transform[5] += m[1] * dx + m[3] * dy;
  }
}
