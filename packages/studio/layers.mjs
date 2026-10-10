import { reparent } from "@evir/authoring";
import { available, selectionRoots } from "./selection.mjs";

export function ancestors(p, id) {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  return ancestorIds(byId, id);
}
function ancestorIds(byId, id) {
  const result = [];
  for (
    let parent = byId.get(id)?.parentId;
    parent;
    parent = byId.get(parent)?.parentId
  )
    result.push(parent);
  return result;
}
export function layerRows(p, artboardId, collapsed = new Set(), search = "") {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const children = new Map();
  for (const n of p.nodes.filter((n) => n.artboardId === artboardId)) {
    if (!children.has(n.parentId)) children.set(n.parentId, []);
    children.get(n.parentId).push(n);
  }
  for (const list of children.values()) list.sort((a, b) => b.order - a.order);
  const matches = new Set();
  if (search)
    for (const n of p.nodes)
      if (
        n.artboardId === artboardId &&
        n.name.toLowerCase().includes(search)
      ) {
        matches.add(n.id);
        for (const id of ancestorIds(byId, n.id)) matches.add(id);
      }
  const result = [];
  const visit = (parent, depth) => {
    for (const n of children.get(parent) || []) {
      if (search && !matches.has(n.id)) continue;
      result.push({ n, depth, hasChildren: children.has(n.id) });
      if (search || !collapsed.has(n.id)) visit(n.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}
export function parentChoices(p, ids, artboardId) {
  const roots = new Set(selectionRoots(p, ids).map((n) => n.id));
  return p.nodes.filter(
    (n) =>
      n.artboardId === artboardId &&
      ["group", "bone"].includes(n.kind) &&
      available(p, n, "locked") &&
      !roots.has(n.id) &&
      !ancestors(p, n.id).some((id) => roots.has(id)),
  );
}
export function organizeLayers(p, ids, parentId, position) {
  const roots = selectionRoots(p, ids);
  if (!roots.length) throw Error("Select a layer to organize.");
  const artboardId = roots[0].artboardId;
  if (roots.some((n) => n.artboardId !== artboardId))
    throw Error("Choose layers from one artboard.");
  for (const n of roots)
    if (!available(p, n, "locked"))
      throw Error(`Unlock ${n.name} before organizing this selection.`);
  if (
    parentId &&
    !parentChoices(p, ids, artboardId).some((n) => n.id === parentId)
  )
    throw Error("Choose an unlocked parent outside this selection.");
  if (!["front", "back"].includes(position))
    throw Error("Choose a stacking position.");
  // Local animation keys cannot simply be carried into a different parent space.
  // Keep stacking edits available, but reject a reparent that needs key rebasing.
  const transformProperties = new Set([
    "x",
    "y",
    "rotation",
    "scaleX",
    "scaleY",
    "length",
  ]);
  const animated = new Set(
    p.animations.flatMap((a) =>
      a.tracks
        .filter((t) => transformProperties.has(t.property))
        .map((t) => t.targetId),
    ),
  );
  for (const n of roots)
    if (n.parentId !== parentId) {
      const affected = [
        n.id,
        ...ancestors(p, n.id),
        ...(parentId ? [parentId, ...ancestors(p, parentId)] : []),
      ];
      if (affected.some((id) => animated.has(id)))
        throw Error(
          "This parent change needs animation-key rebasing. Keep the current parent; stacking changes are available.",
        );
    }
  // Preserve scene order within the selected set, even when clicks came in another order.
  const ordered = layerRows(p, artboardId)
    .reverse()
    .filter(({ n }) => roots.some((r) => r.id === n.id))
    .map(({ n }) => n);
  for (const n of ordered) reparent(p, n.id, parentId);
  const moving = new Set(ordered.map((n) => n.id));
  const rest = p.nodes
    .filter(
      (n) =>
        n.artboardId === artboardId &&
        n.parentId === parentId &&
        !moving.has(n.id),
    )
    .sort((a, b) => a.order - b.order);
  const siblings =
    position === "front" ? [...rest, ...ordered] : [...ordered, ...rest];
  siblings.forEach((n, i) => (n.order = i));
}
