import test from "node:test";
import assert from "node:assert/strict";
import { pointerPressure, brushOutline } from "../../packages/studio/brush.mjs";
import { fitBrush, FreehandDraft } from "../../packages/studio/freehand.mjs";
import { createProject, worldTransform } from "@evir/project-model";
import { addNode, History } from "@evir/authoring";
import { worldPoints } from "@evir/runtime/geometry";
import { compileProject } from "@evir/format";
const line = (p) => Array.from({ length: 101 }, (_, i) => [i * 3, 80, p]);
const height = (g) =>
  Math.max(...g.points.map((p) => p.anchor[1])) -
  Math.min(...g.points.map((p) => p.anchor[1]));
test("pressure obeys pen ownership, active range and release; mouse/touch always use midpoint", () => {
  for (const pointerType of ["mouse", "touch", ""])
    assert.equal(
      pointerPressure({ pointerType, buttons: 1, pressure: 0.9 }),
      0.5,
    );
  for (const pressure of [0, 0.2, 0.5, 1])
    assert.equal(
      pointerPressure({ pointerType: "pen", buttons: 1, pressure }),
      pressure,
    );
  assert.equal(
    pointerPressure({ pointerType: "pen", buttons: 0, pressure: 0 }, 0.7),
    0.7,
  );
  for (const pressure of [-1, 2, NaN, Infinity])
    assert.equal(
      pointerPressure({ pointerType: "pen", buttons: 1, pressure }, 0.4),
      0.4,
    );
});
test("real pressure changes outline width; disabled pressure has identical constant-width shape and round ends", () => {
  const thin = fitBrush(line(0.1), { width: 30, tolerance: 0.5 }),
    wide = fitBrush(line(0.9), { width: 30, tolerance: 0.5 });
  assert(height(wide) > height(thin) * 2.5);
  const a = fitBrush(line(0.1), { width: 30, pressure: false, tolerance: 0.5 });
  const b = fitBrush(line(0.9), { width: 30, pressure: false, tolerance: 0.5 });
  assert.deepEqual(
    a.points.map((p) => p.anchor),
    b.points.map((p) => p.anchor),
  );
  assert(Math.abs(height(a) - 30) < 1);
  assert(Math.min(...a.points.map((p) => p.anchor[0])) < -14);
  assert(Math.max(...a.points.map((p) => p.anchor[0])) > 314);
  assert(a.closed && a.points.length <= 256);
});
test("sharp turns, repeated coordinates and pressure extremes stay finite; resources and options reject atomically", () => {
  for (const samples of [
    [
      [0, 0, 0],
      [60, 0, 1],
      [0, 0, 0],
      [0, 60, 1],
    ],
    [
      [0, 0, 0.5],
      [0, 0, 0.9],
      [100, 0, 0.5],
    ],
    line(0),
    line(1),
  ]) {
    const g = fitBrush(samples, { width: 20, tolerance: 0.5 });
    assert(g.points.length >= 3 && g.points.length <= 256);
    assert(
      g.points.every((p) =>
        ["anchor", "in", "out"].every((k) => p[k].every(Number.isFinite)),
      ),
    );
  }
  for (const width of [0, 257, NaN, Infinity])
    assert.throws(() => brushOutline([], { width }), /width/);
  for (const pressure of [-1, 2, NaN])
    assert.throws(() => brushOutline([[0, 0, pressure]]), /pressure/);
  assert.throws(
    () =>
      fitBrush([
        [0, 0, 0.5],
        [0, 0, 0.8],
      ]),
    /Drag/,
  );
  assert.throws(
    () => brushOutline(Array.from({ length: 4097 }, (_, i) => [i, 0, 0.5])),
    /too long/,
  );
  const d = new FreehandDraft({
    artboardId: "b",
    zoom: 1,
    smoothing: 1,
    closed: false,
    style: "brush",
    width: 20,
  });
  d.down({ x: 0, y: 0, pressure: 0.2 });
  d.move({ x: 100, y: 0, pressure: 0.8 });
  d.up();
  const original = d.geometry();
  assert.throws(
    () =>
      d.configure({ smoothing: 1, closed: false, style: "brush", width: 0 }),
    /width/,
  );
  assert.deepEqual(
    d.geometry().points.map((p) => p.anchor),
    original.points.map((p) => p.anchor),
  );
  assert.throws(
    () =>
      d.configure({ smoothing: 1, closed: true, style: "shape", width: 20 }),
    /Drag/,
  );
  assert.equal(d.style, "brush");
  assert.equal(d.width, 20);
  d.configure({
    smoothing: 1,
    closed: false,
    style: "brush",
    width: 40,
    pressure: false,
  });
  assert(height(d.geometry()) > height(original));
  d.cancelGesture();
  assert.equal(d.samples.length, 0);
  assert.equal(d.pressures.length, 0);
});
test("brush width is in artboard space, affine parenting preserves the outline, one history step exports ordinary filled geometry", () => {
  const p = createProject(),
    id = addNode(p, "group");
  p.nodes[0].transform = [0, 2, -0.5, 0, 200, 60];
  for (const zoom of [0.25, 1, 4]) {
    const d = new FreehandDraft({
      artboardId: p.artboards[0].id,
      parentId: id,
      matrix: worldTransform(p, id),
      zoom,
      smoothing: 0.5,
      closed: false,
      style: "brush",
      width: 24,
    });
    d.down({ x: 20, y: 100, pressure: 0.1 });
    for (let i = 1; i <= 100; i++)
      d.move({
        x: 20 + 3 * i,
        y: 100 + 30 * Math.sin(i / 35),
        pressure: 0.1 + (0.8 * i) / 100,
      });
    assert.throws(() => d.geometry(), /Release/);
    d.up();
    const expected = d.worldPoints();
    const history = new History(p);
    history.transact("Draw brush", (p) => {
      const n = addNode(p, "path", id);
      p.nodes.find((v) => v.id === n).geometry = d.geometry();
    });
    const result = history.committed(),
      g = result.nodes.at(-1).geometry;
    assert(g.closed);
    assert(!("pressure" in g));
    assert(!("width" in g));
    assert(compileProject(result).bytes.length > 100);
    worldPoints(result, result.nodes.at(-1)).forEach((v, i) =>
      ["anchor", "in", "out"].forEach((k) =>
        v[k].forEach((n, j) => assert(Math.abs(n - expected[i][k][j]) < 1e-8)),
      ),
    );
    history.undo();
    assert.deepEqual(history.committed(), p);
    history.redo();
    assert.deepEqual(history.committed(), result);
  }
});

test("pressure changes survive subpixel capture without duplicating stationary coordinates", () => {
  const d = new FreehandDraft({
    artboardId: "b",
    zoom: 1,
    smoothing: 1,
    closed: true,
    style: "brush",
    width: 16,
  });
  d.down({ x: 0, y: 0, pressure: 0.1 });
  d.move({ x: 0.1, y: 0, pressure: 0.11 });
  assert.equal(d.samples.length, 1);
  d.move({ x: 0.1, y: 0, pressure: 0.8 });
  assert.equal(d.samples.length, 2);
  assert.equal(d.pressures.at(-1), 0.8);
  d.move({ x: 0.1, y: 0, pressure: 0.7 });
  assert.equal(d.samples.length, 2);
  assert.equal(d.pressures.at(-1), 0.7);
});
