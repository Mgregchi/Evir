import test from "node:test";
import assert from "node:assert/strict";
import {
  fitFreehand,
  FreehandDraft,
  FREEHAND_LIMITS,
  segmentDistance,
} from "../../packages/studio/freehand.mjs";
import {
  createProject,
  worldTransform,
  serializeProject,
  openProject,
} from "@evir/project-model";
import { addNode, History } from "@evir/authoring";
import { compileProject } from "@evir/format";
import { worldPoints } from "@evir/runtime/geometry";
const cubic = (a, b, c, d, t) =>
  a.map(
    (v, i) =>
      (1 - t) ** 3 * v +
      3 * (1 - t) ** 2 * t * b[i] +
      3 * (1 - t) * t * t * c[i] +
      t ** 3 * d[i],
  );
const segments = (geometry) =>
  geometry.points.flatMap((p, i) => {
    if (!geometry.closed && i === geometry.points.length - 1) return [];
    const q = geometry.points[(i + 1) % geometry.points.length];
    const points = Array.from({ length: 129 }, (_, j) =>
      cubic(p.anchor, p.out, q.in, q.anchor, j / 128),
    );
    return points.slice(1).map((v, j) => [points[j], v]);
  });
export const samples = {
  wave: Array.from({ length: 401 }, (_, i) => [i, 90 + 40 * Math.sin(i / 55)]),
  ring: Array.from({ length: 401 }, (_, i) => [
    200 + 100 * Math.cos((i / 400) * 2 * Math.PI),
    200 + 75 * Math.sin((i / 400) * 2 * Math.PI),
  ]),
  corner: [
    [0, 0],
    ...Array.from({ length: 100 }, (_, i) => [i, 0]),
    ...Array.from({ length: 100 }, (_, i) => [100, i]),
  ],
  noisy: Array.from({ length: 401 }, (_, i) => [
    i,
    Math.sin(i * 2) * 0.2 + 40 * Math.sin(i / 55),
  ]),
};
for (const [name, source] of Object.entries(samples))
  test(`${name}: cubic fitting retains sampled shape with fewer editable anchors`, () => {
    const geometry = fitFreehand(source, {
      tolerance: 2,
      closed: name === "ring",
    });
    const edges = segments(geometry);
    const error = Math.max(
      ...source.map((p) =>
        Math.min(...edges.map(([a, b]) => segmentDistance(p, a, b))),
      ),
    );
    assert(error <= 2.02, `${name} deviation ${error}`);
    assert(geometry.points.length < source.length / 4);
    assert(geometry.points.length <= FREEHAND_LIMITS.anchors);
    assert.deepEqual(geometry.points[0].anchor, source[0]);
    if (!geometry.closed)
      assert.deepEqual(geometry.points.at(-1).anchor, source.at(-1));
    assert(
      geometry.points.every((p) =>
        ["anchor", "in", "out"].every((k) => p[k].every(Number.isFinite)),
      ),
    );
  });

test("freehand budgets reject complexity without silently weakening requested fidelity", () => {
  assert.throws(
    () => fitFreehand(Array.from({ length: 4097 }, (_, i) => [i, i % 2])),
    /too long/,
  );
  assert.throws(
    () =>
      fitFreehand(
        Array.from({ length: 800 }, (_, i) => [i, (i % 2) * 50]),
        { tolerance: 0.5, closed: false },
      ),
    /too many points/,
  );
  for (const tolerance of [0, NaN, Infinity])
    assert.throws(() => fitFreehand(samples.wave, { tolerance }), /Smoothing/);
  assert.throws(
    () =>
      fitFreehand([
        [0, 0],
        [NaN, 2],
        [1, 1],
      ]),
    /finite/,
  );
  assert.throws(
    () =>
      fitFreehand([
        [0, 0],
        [0, 0],
        [0, 0],
      ]),
    /Drag/,
  );
  assert.throws(
    () =>
      fitFreehand([
        [0, 0],
        [5, 0],
        [10, 0],
      ]),
    /area/,
  );
});

test("coalesced-sized draft sampling, interruption and zoom use bounded world-space coordinates", () => {
  for (const zoom of [0.25, 1, 4]) {
    const draft = new FreehandDraft({
      artboardId: "board",
      zoom,
      smoothing: 2,
      closed: false,
    });
    draft.down({ x: 0, y: 0 });
    for (let i = 0; i <= 400; i++)
      draft.move({ x: i / zoom, y: (Math.sin(i / 55) * 40) / zoom });
    assert.throws(() => draft.geometry(), /Release/);
    draft.up();
    const screen = draft
      .worldPoints()
      .map((p) => p.anchor.map((v) => v * zoom));
    assert(screen.length < 40);
    assert.deepEqual(screen[0], [0, 0]);
    draft.cancelGesture();
    assert.equal(draft.samples.length, 0);
    assert.equal(draft.points.length, 0);
  }
});

test("affine parent, one-step history and editable source/export keep freehand controls", async () => {
  const project = createProject(),
    parentId = addNode(project, "group");
  project.nodes[0].transform = [0, 2, -0.5, 0, 240, 80];
  const draft = new FreehandDraft({
    artboardId: project.artboards[0].id,
    parentId,
    matrix: worldTransform(project, parentId),
    zoom: 1,
    smoothing: 2,
    closed: true,
  });
  draft.down({ x: samples.ring[0][0], y: samples.ring[0][1] });
  for (const [x, y] of samples.ring.slice(1)) draft.move({ x, y });
  draft.up();
  const expected = draft.worldPoints(),
    history = new History(project),
    before = history.committed();
  history.transact("Draw freehand shape", (p) => {
    const id = addNode(p, "path", parentId);
    p.nodes.find((n) => n.id === id).geometry = draft.geometry();
  });
  const committed = history.committed(),
    shape = committed.nodes.at(-1);
  worldPoints(committed, shape).forEach((p, i) =>
    ["anchor", "in", "out"].forEach((k) =>
      p[k].forEach((v, j) => assert(Math.abs(v - expected[i][k][j]) < 1e-8)),
    ),
  );
  assert.deepEqual(
    (await openProject(await serializeProject(committed))).nodes,
    committed.nodes,
  );
  assert(compileProject(committed).bytes.length > 100);
  history.undo();
  assert.deepEqual(history.committed(), before);
  history.redo();
  assert.deepEqual(history.committed(), committed);
  assert.throws(
    () =>
      new FreehandDraft({
        artboardId: "board",
        matrix: [0, 0, 0, 1, 0, 0],
        zoom: 1,
        smoothing: 2,
        closed: true,
      }),
    /singular/,
  );
});
