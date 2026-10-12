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
export function organizeLayers(p, ids, parentId, position, referenceId = null) {
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
  if (!["front", "back", "above", "below"].includes(position))
    throw Error("Choose a stacking position.");
  const reference = p.nodes.find((n) => n.id === referenceId);
  if (
    ["above", "below"].includes(position) &&
    (!reference ||
      reference.parentId !== parentId ||
      reference.artboardId !== artboardId ||
      roots.some((n) => n.id === referenceId))
  )
    throw Error("Choose an unselected sibling as the reference layer.");
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
  let siblings =
    position === "front" ? [...rest, ...ordered] : [...ordered, ...rest];
  if (["above", "below"].includes(position)) {
    siblings = [...rest];
    siblings.splice(
      rest.findIndex((n) => n.id === referenceId) +
        (position === "above" ? 1 : 0),
      0,
      ...ordered,
    );
  }
  siblings.forEach((n, i) => (n.order = i));
}

export function layerDrop(p, ids, targetId, placement) {
  const target = p.nodes.find((n) => n.id === targetId);
  if (!target) throw Error("Choose a layer as the drop destination.");
  if (!["above", "below", "inside"].includes(placement))
    throw Error("Choose a drop position.");
  organizeLayers(
    p,
    ids,
    placement === "inside" ? target.id : target.parentId,
    placement === "inside" ? "front" : placement,
    targetId,
  );
}
