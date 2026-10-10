import { inverse, newId } from "@evir/project-model";
import { mapPoint } from "@evir/runtime/geometry";

// Drawing is a transient UI draft. Only a finished, valid path enters history.
export class PenDraft {
  constructor({ artboardId, parentId = null, matrix = [1, 0, 0, 1, 0, 0] }) {
    this.artboardId = artboardId;
    this.parentId = parentId;
    this.matrix = [...matrix];
    this.inverse = inverse(matrix);
    this.points = [];
    this.dragging = false;
    this.hover = null;
  }
  down(world, zoom) {
    const first = this.points[0];
    if (this.points.length >= 3) {
      const anchor = mapPoint(this.matrix, first.anchor);
      if (Math.hypot(world.x - anchor[0], world.y - anchor[1]) < 8 / zoom)
        return "close";
    }
    const anchor = mapPoint(this.inverse, [world.x, world.y]);
    this.points.push({
      id: newId("point"), anchor, in: [...anchor], out: [...anchor],
    });
    this.start = { ...world };
    this.zoom = zoom;
    this.dragging = true;
    this.hover = null;
    return "point";
  }
  move(world) {
    if (!this.dragging) {
      this.hover = mapPoint(this.inverse, [world.x, world.y]);
      return;
    }
    const point = this.points.at(-1);
    const out =
      Math.hypot(world.x - this.start.x, world.y - this.start.y) > 3 / this.zoom
        ? mapPoint(this.inverse, [world.x, world.y])
        : [...point.anchor];
    point.out = out;
    point.in = point.anchor.map((v, i) => 2 * v - out[i]);
  }
  up() {
    this.dragging = false;
  }
  cancelGesture() {
    if (this.dragging) this.points.pop();
    this.dragging = false;
    this.hover = null;
  }
  removeLast() {
    this.points.pop();
    this.dragging = false;
    this.hover = null;
  }
  geometry(closed = false) {
    if (this.dragging)
      throw Error("Release the pointer before finishing the path.");
    if (this.points.length < (closed ? 3 : 2))
      throw Error(
        closed ? "A closed path needs three points." : "Add at least two points to finish a path.",
      );
    return {
      closed, fill: "#64d9ad", skin: null, points: structuredClone(this.points),
    };
  }
  worldPoints() {
    return this.points.map((p) => Object.fromEntries([
      ["id", p.id],
      ...["anchor", "in", "out"].map((k) => [k, mapPoint(this.matrix, p[k])]),
    ]));
  }
}
