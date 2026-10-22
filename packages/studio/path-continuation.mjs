import {smoothConnection} from '@evir/authoring';
import { newId, worldTransform } from "@evir/project-model";
import { mapPoint } from "@evir/runtime/geometry";
import { available } from "./selection.mjs";
import { PenDraft } from "./pen.mjs";

export const CONTINUATION_LIMITS = Object.freeze({ added: 256, total: 4096 });
const reversed = (points) =>
  [...points].reverse().map((p) => ({
    id: p.id,
    anchor: [...p.anchor],
    in: [...p.out],
    out: [...p.in],
  }));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function target(project, id) {
  const node = project.nodes.find((n) => n.id === id);
  if (node?.kind !== "path")
    throw Error("Select an existing path to continue.");
  if (!available(project, node, "locked"))
    throw Error("Unlock the path and its parents before continuing.");
  if (!available(project, node, "hidden"))
    throw Error("Show the path and its parents before continuing.");
  if(node.geometry.shape)throw Error('Convert the live shape to a free path before continuing.');
  if (node.geometry.closed)
    throw Error("Open the path in Path controls before continuing.");
  if(node.geometry.contours?.length)throw Error('Release compound contours before continuing this path.');
  if (node.geometry.skin)
    throw Error(
      "Unbind the path before adding points. Existing weights cannot describe new vertices.",
    );
  if (node.geometry.points.length >= CONTINUATION_LIMITS.total)
    throw Error("Continuation supports paths with fewer than 4,096 points.");
  return node;
}

// Keep existing geometry outside History until Finish. A reversed working copy
// lets Pen grow from either endpoint; commit restores the source direction.
export class ContinuationDraft extends PenDraft {
  constructor(project, nodeId, { endpoint = "last", closed = false, smooth = false } = {}) {
    const node = target(project, nodeId);
    if (!["first", "last"].includes(endpoint) || (typeof closed !== "boolean" || typeof smooth !== "boolean"))
      throw Error("Choose First or Last endpoint and a path closure.");
    super({
      artboardId: node.artboardId,
      parentId: node.parentId,
      matrix: worldTransform(project, nodeId),
    });
    this.targetId = nodeId;
    this.original = structuredClone(node);
    this.endpoint = endpoint;
    this.closed = closed;
    this.smooth = smooth;
    this.points =
      endpoint === "first"
        ? reversed(node.geometry.points)
        : structuredClone(node.geometry.points);
    this.originalCount = this.points.length;
  }
  get addedCount() {
    return this.points.length - this.originalCount;
  }
  budget() {
    if (
      this.addedCount >= CONTINUATION_LIMITS.added ||
      this.points.length >= CONTINUATION_LIMITS.total
    )
      throw Error(
        "Finish this extension before adding more points (256 new / 4,096 total).",
      );
  }
  down(world, zoom) {
    // Closing adds no point, so it remains available at the drawing budget.
    const first = mapPoint(this.matrix, this.points[0].anchor);
    if (
      !(
        this.points.length >= 3 &&
        Math.hypot(world.x - first[0], world.y - first[1]) < 8 / zoom
      )
    )
      this.budget();
    return super.down(world, zoom);
  }
  appendLocal(anchor, out = anchor) {
    if (this.dragging)
      throw Error("Release the pointer before adding a point.");
    this.budget();
    if (
      ![anchor, out].every(
        (p) =>
          Array.isArray(p) &&
          p.length === 2 &&
          p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e6),
      )
    )
      throw Error(
        "Point coordinates must be finite and within ±1,000,000 local units.",
      );
    const incoming = anchor.map((v, i) => 2 * v - out[i]);
    if (incoming.some((v) => Math.abs(v) > 1e6))
      throw Error("The mirrored handle exceeds the point coordinate limit.");
    this.points.push({
      id: newId("point"),
      anchor: [...anchor],
      in: incoming,
      out: [...out],
    });
    this.hover = null;
  }
  removeLast() {
    if (!this.addedCount) return;
    super.removeLast();
  }
  worldPoints() {
    const points=structuredClone(this.points);
    if(this.smooth&&this.addedCount)smoothConnection(points[this.originalCount-1],points[this.originalCount]);
    return points.map(p=>({id:p.id,...Object.fromEntries(["anchor","in","out"].map(k=>[k,mapPoint(this.matrix,p[k])]))}));
  }
  geometry(closed = this.closed) {
    if (typeof closed !== "boolean")
      throw Error("Choose whether the finished path is open or closed.");
    if (!this.addedCount)
      throw Error("Add at least one point before finishing an extension.");
    const geometry = super.geometry(closed);
    if(this.smooth)smoothConnection(geometry.points[this.originalCount-1],geometry.points[this.originalCount]);
    return {
      ...this.original.geometry,
      closed: geometry.closed,
      points:
        this.endpoint === "first" ? reversed(geometry.points) : geometry.points,
    };
  }
  apply(project, geometry) {
    const node = target(project, this.targetId);
    if (
      !equal(node, this.original) ||
      !equal(worldTransform(project, node.id), this.matrix)
    )
      throw Error(
        "The path or its parent changed during this draft. Cancel and reopen continuation.",
      );
    node.geometry = structuredClone(geometry);
    return node.id;
  }
}
