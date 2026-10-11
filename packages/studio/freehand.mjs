import { PenDraft } from "./pen.mjs";
import { newId } from "@evir/project-model";
import { mapPoint } from "@evir/runtime/geometry";

export const FREEHAND_LIMITS = Object.freeze({ samples: 4096, anchors: 256 });
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function segmentDistance(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return distance(p, [a[0] + t * dx, a[1] + t * dy]);
}
// Iterative Douglas–Peucker. Preserve endpoints; refuse an over-budget fit.
function simplify(samples, tolerance, limit) {
  const keep = new Set([0, samples.length - 1]),
    pending = [[0, samples.length - 1]];
  while (pending.length) {
    const [first, last] = pending.pop();
    let furthest = -1,
      error = tolerance;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(samples[i], samples[first], samples[last]);
      if (d > error) {
        error = d;
        furthest = i;
      }
    }
    if (furthest < 0) continue;
    keep.add(furthest);
    if (keep.size > limit)
      throw Error(
        "This shape needs too many points. Increase smoothing or draw a shorter shape.",
      );
    pending.push([first, furthest], [furthest, last]);
  }
  return [...keep].sort((a, b) => a - b).map((i) => samples[i]);
}
// Each cubic stays in a narrow convex corridor around its simplified segment.
// Tangent handles shrink to respect that corridor; they never overshoot endpoints.
function handle(anchor, vector, end, tolerance) {
  const dx = end[0] - anchor[0],
    dy = end[1] - anchor[1],
    length = Math.hypot(dx, dy);
  if (!length) return [...anchor];
  const along = (vector[0] * dx + vector[1] * dy) / length;
  if (along <= 0) return [...anchor];
  const across = Math.abs(vector[0] * dy - vector[1] * dx) / length;
  const scale = Math.min(
    1,
    length / (3 * along),
    across ? tolerance / across : 1,
  );
  return anchor.map((v, i) => v + vector[i] * scale);
}
export function fitFreehand(
  samples,
  { tolerance = 2, closed = true, maxAnchors = FREEHAND_LIMITS.anchors } = {},
) {
  if (!Number.isFinite(tolerance) || tolerance <= 0)
    throw Error("Smoothing must be positive.");
  if (
    !Number.isInteger(maxAnchors) ||
    maxAnchors < 3 ||
    maxAnchors > FREEHAND_LIMITS.anchors
  )
    throw Error("Invalid point budget.");
  if (samples.length > FREEHAND_LIMITS.samples)
    throw Error("This drawing is too long. Draw a shorter shape.");
  const source = [];
  for (const p of samples) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))
      throw Error("Drawing coordinates must be finite.");
    if (!source.length || distance(p, source.at(-1)) > 1e-9)
      source.push([...p]);
  }
  if (source.length < (closed ? 3 : 2))
    throw Error("Drag to draw a shape before finishing.");
  // Close with the actual release-to-start edge; do not snap a distant endpoint.
  if (closed && distance(source[0], source.at(-1)) > 1e-9)
    source.push([...source[0]]);
  const anchors = simplify(
    source,
    tolerance / 2,
    maxAnchors + (closed ? 1 : 0),
  );
  if (closed) anchors.pop();
  if (anchors.length < (closed ? 3 : 2))
    throw Error("Draw a shape with some area, or reduce smoothing.");
  const points = anchors.map((anchor) => ({
    id: newId("point"),
    anchor: [...anchor],
    in: [...anchor],
    out: [...anchor],
  }));
  const tangent = (i) => {
    const a =
      anchors[
        closed ? (i - 1 + anchors.length) % anchors.length : Math.max(0, i - 1)
      ];
    const b =
      anchors[
        closed ? (i + 1) % anchors.length : Math.min(anchors.length - 1, i + 1)
      ];
    return b.map((v, k) => (v - a[k]) / 6);
  };
  for (let i = 0; i < anchors.length - (closed ? 0 : 1); i++) {
    const j = (i + 1) % anchors.length;
    points[i].out = handle(anchors[i], tangent(i), anchors[j], tolerance / 2);
    points[j].in = handle(
      anchors[j],
      tangent(j).map((v) => -v),
      anchors[i],
      tolerance / 2,
    );
  }
  return { closed, fill: "#64d9ad", skin: null, points };
}

export class FreehandDraft extends PenDraft {
  constructor(options) {
    super(options);
    if (
      !Number.isFinite(options.zoom) ||
      options.zoom <= 0 ||
      !Number.isFinite(options.smoothing) ||
      options.smoothing < 0.5 ||
      options.smoothing > 8
    )
      throw Error("Invalid freehand drawing options.");
    this.samples = [];
    this.zoom = options.zoom;
    this.tolerance = options.smoothing / this.zoom;
    this.closed = options.closed;
  }
  down(world) {
    this.dragging = true;
    this.sample(world, true);
  }
  sample(world, force = false) {
    const p = [world.x, world.y];
    if (!p.every(Number.isFinite))
      throw Error("Drawing coordinates must be finite.");
    const last = this.samples.at(-1);
    if (last && distance(last, p) < (force ? 1e-9 : 0.75 / this.zoom)) return;
    if (this.samples.length >= FREEHAND_LIMITS.samples)
      throw Error("This drawing is too long. Draw a shorter shape.");
    this.samples.push(p);
  }
  move(world) {
    if (this.dragging) this.sample(world);
  }
  up() {
    this.dragging = false;
    this.refit();
  }
  cancelGesture() {
    this.samples = [];
    this.points = [];
    this.dragging = false;
  }
  refit() {
    const geometry = fitFreehand(this.samples, {
      tolerance: this.tolerance,
      closed: this.closed,
    });
    this.points = geometry.points.map((p) =>
      Object.fromEntries([
        ["id", p.id],
        ...["anchor", "in", "out"].map((k) => [
          k,
          mapPoint(this.inverse, p[k]),
        ]),
      ]),
    );
  }
  geometry() {
    if (this.dragging)
      throw Error("Release the pointer before finishing the shape.");
    this.refit();
    return super.geometry(this.closed);
  }
}
