import { nodeBounds } from "@evir/renderer-canvas";
import {
  available,
  selectionRoots,
  selectionBounds,
  prepareSelectionMove,
  applySelectionMove,
} from "./selection.mjs";

const anchors = (b, axis) =>
  axis === "x"
    ? [b.x, b.x + b.width / 2, b.x + b.width]
    : [b.y, b.y + b.height / 2, b.y + b.height];

// Captured once per gesture. Exclude moving descendants and enclosing ancestors:
// neither is an independent reference for the moving selection.
export function snapTargets(p, ids, artboardId) {
  const nodes = new Map(p.nodes.map((n) => [n.id, n]));
  const excluded = new Set(selectionRoots(p, ids).map((n) => n.id));
  for (const id of [...excluded]) {
    for (
      let parent = nodes.get(id)?.parentId;
      parent;
      parent = nodes.get(parent)?.parentId
    )
      excluded.add(parent);
  }
  const moving = new Set(selectionRoots(p, ids).map((n) => n.id));
  const a = p.artboards.find((a) => a.id === artboardId);
  const boxes = [
    { id: a.id, name: a.name, x: 0, y: 0, width: a.width, height: a.height },
  ];
  for (const n of p.nodes) {
    if (
      n.artboardId !== artboardId ||
      excluded.has(n.id) ||
      !available(p, n, "hidden")
    )
      continue;
    let inside = false;
    for (let parent = n.parentId; parent; parent = nodes.get(parent)?.parentId)
      if (moving.has(parent)) {
        inside = true;
        break;
      }
    if (!inside) boxes.push({ id: n.id, name: n.name, ...nodeBounds(p, n) });
  }
  return Object.fromEntries(
    ["x", "y"].map((axis) => [
      axis,
      boxes
        .flatMap((box) => anchors(box, axis).map((value) => ({ value, box })))
        .sort((a, b) => a.value - b.value),
    ]),
  );
}

function lowerBound(entries, value) {
  let lo = 0,
    hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (entries[mid].value < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function snapMove(box, targets, dx, dy, zoom, bypass = false) {
  const result = { dx, dy, guides: [] };
  if (!box || !targets || bypass) return result;
  const moved = { ...box, x: box.x + dx, y: box.y + dy };
  for (const axis of ["x", "y"]) {
    const entries = targets[axis];
    let best = null;
    for (const value of anchors(moved, axis)) {
      const i = lowerBound(entries, value);
      // Prefer the first stable target at a shared coordinate from either side.
      const previous =
        i > 0 ? entries[lowerBound(entries, entries[i - 1].value)] : null;
      for (const candidate of [entries[i], previous]) {
        if (!candidate) continue;
        const delta = candidate.value - value;
        if (
          Math.abs(delta) > 6 / zoom ||
          (best && Math.abs(delta) >= Math.abs(best.delta))
        )
          continue;
        best = { ...candidate, delta };
      }
    }
    if (best) {
      result[axis === "x" ? "dx" : "dy"] += best.delta;
      result.guides.push({ axis, value: best.value, target: best.box });
    }
  }
  return result;
}

// One selected root aligns to its artboard; several roots align to their union.
// Prepare all members before changing anything, preserving atomic rejection.
export function alignmentMoves(p, ids, alignment) {
  const rules = {
    left: ["x", 0],
    center: ["x", 1],
    right: ["x", 2],
    top: ["y", 0],
    middle: ["y", 1],
    bottom: ["y", 2],
  };
  if (!rules[alignment]) throw Error("Unknown alignment.");
  const roots = selectionRoots(p, ids);
  if (!roots.length) return [];
  if (roots.some((n) => !available(p, n, "hidden")))
    throw Error("Show the selected layers before aligning them.");
  if (new Set(roots.map((n) => n.artboardId)).size !== 1)
    throw Error("Align layers on the same artboard.");
  const prepared = prepareSelectionMove(p, ids);
  const a = p.artboards.find((a) => a.id === roots[0].artboardId);
  const reference =
    roots.length === 1
      ? { x: 0, y: 0, width: a.width, height: a.height }
      : selectionBounds(p, ids);
  const [axis, index] = rules[alignment];
  const value = anchors(reference, axis)[index];
  return prepared.map((item) => {
    const box = nodeBounds(
      p,
      p.nodes.find((n) => n.id === item.id),
    );
    const delta = value - anchors(box, axis)[index];
    return {
      prepared: item,
      dx: axis === "x" ? delta : 0,
      dy: axis === "y" ? delta : 0,
    };
  });
}

export function applyAlignment(p, moves) {
  for (const move of moves)
    applySelectionMove(p, [move.prepared], move.dx, move.dy);
}
