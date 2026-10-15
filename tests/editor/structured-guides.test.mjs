import test from "node:test";
import assert from "node:assert/strict";
import { createProject } from "@evir/project-model";
import { addNode, History } from "@evir/authoring";
import { nodeBounds } from "@evir/renderer-canvas";
import {
  defaultGuides,
  validateGuides,
  parseGuidePreset,
  componentBands,
  layoutBands,
  snapWithGuides,
  newGuideComponent,
  guidePreferences,
} from "../../packages/studio/guides.mjs";
import {
  distributionMoves,
  applyAlignment,
} from "../../packages/studio/alignment.mjs";
const board = { width: 512, height: 512 };
const component = () => ({
  ...newGuideComponent("x"),
  id: "columns",
  count: 3,
  mode: "fixed",
  size: 96,
  gap: 28,
  margin: 48,
});
const close = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test("v1 guide presets and cached preferences upgrade without changing manual guides or grid", () => {
  const old = defaultGuides();
  delete old.components;
  old.version = 1;
  old.rulers = true;
  old.guides = [{ id: "old", axis: "x", position: 17.5, visible: true }];
  const copy = structuredClone(old),
    next = parseGuidePreset(JSON.stringify(old));
  assert.equal(next.version, 2);
  assert.deepEqual(next.components, []);
  assert.deepEqual(next.guides, old.guides);
  assert.deepEqual(next.grid, old.grid);
  assert.deepEqual(old, copy);
  const pref = guidePreferences({
    getItem: () =>
      JSON.stringify([{ project: "p", artboard: "a", value: old }]),
    setItem() {},
  });
  assert.deepEqual(pref.get("p", "a"), next);
  assert.throws(() => validateGuides({ ...old, components: [] }), /preset/);
});
test("fixed and stretch bands retain margins/gutters, anchor modes and bounded track geometry", () => {
  const c = component();
  assert.deepEqual(
    componentBands(c, board).map((b) => b.start),
    [84, 208, 332],
  );
  assert.equal(componentBands({ ...c, align: "start" }, board)[0].start, 48);
  assert.equal(componentBands({ ...c, align: "end" }, board).at(-1).end, 464);
  for (const axis of ["x", "y"])
    for (const count of [1, 3, 7, 32]) {
      const bands = componentBands(
        { ...c, axis, mode: "stretch", count, gap: 2 },
        board,
      );
      assert.equal(bands.length, count);
      close(bands[0].start, 48);
      close(bands.at(-1).end, 464);
      bands.slice(1).forEach((b, i) => close(b.start - bands[i].end, 2));
    }
  assert.throws(() => componentBands({ ...c, count: 32 }, board), /fit/);
  assert.throws(
    () =>
      componentBands({ ...c, mode: "stretch", count: 32, gap: 1000 }, board),
    /fit/,
  );
});
test("component schema rejects unbounded, duplicate or malformed presets atomically", () => {
  const s = defaultGuides();
  s.components = [component()];
  const before = structuredClone(s);
  for (const mutate of [
    (v) => (v.components[0].count = 33),
    (v) => (v.components[0].count = 1.5),
    (v) => (v.components[0].size = 0),
    (v) => (v.components[0].gap = -1),
    (v) => (v.components[0].margin = NaN),
    (v) => (v.components[0].mode = "auto"),
    (v) => (v.components[0].align = "edge"),
    (v) => (v.components[0].snap = "yes"),
    (v) => (v.components[0].extra = true),
    (v) =>
      (v.components = Array.from({ length: 9 }, (_, i) => ({
        ...component(),
        id: String(i),
      }))),
    (v) =>
      (v.guides = [{ id: "columns", axis: "x", position: 2, visible: true }]),
  ]) {
    const copy = structuredClone(s);
    mutate(copy);
    assert.throws(() => validateGuides(copy));
  }
  assert.deepEqual(s, before);
  const next = validateGuides(s);
  next.components[0].count = 1;
  assert.deepEqual(s, before);
});
test("component boundaries/centers snap in screen units, with visibility, per-component snap and Alt bypass", () => {
  const s = defaultGuides();
  s.components = [component()];
  const box = { x: 0, y: 0, width: 20, height: 20 };
  let result = snapWithGuides(box, null, s, board, 83, 300, 1);
  assert.equal(result.dx, 84);
  assert.equal(result.guides[0].target.name, "Column guide");
  assert.equal(snapWithGuides(box, null, s, board, 130, 300, 1).dx, 132);
  assert.equal(snapWithGuides(box, null, s, board, 81, 300, 4).dx, 81);
  assert.equal(snapWithGuides(box, null, s, board, 83, 300, 1, true).dx, 83);
  for (const change of [
    (v) => (v.visible = false),
    (v) => (v.snap = false),
    (v) => (v.components[0].visible = false),
    (v) => (v.components[0].snap = false),
  ]) {
    const copy = structuredClone(s);
    change(copy);
    assert.equal(snapWithGuides(box, null, copy, board, 83, 300, 1).dx, 83);
  }
});
test("non-fitting resized components stay inactive without suppressing valid guides; bands cap at 256", () => {
  const s = defaultGuides();
  s.components = [
    component(),
    {
      ...component(),
      id: "rows",
      axis: "y",
      mode: "stretch",
      count: 2,
      size: 1,
      gap: 8,
      margin: 10,
    },
  ];
  const resized = { width: 100, height: 512 };
  assert.equal(layoutBands(s, resized).length, 2);
  assert.throws(() => layoutBands(s, resized, true), /fit/);
  const big = defaultGuides();
  big.components = Array.from({ length: 8 }, (_, i) => ({
    ...newGuideComponent(i % 2 ? "y" : "x"),
    id: String(i),
    count: 32,
    gap: 2,
    margin: 0,
  }));
  validateGuides(big);
  assert.equal(layoutBands(big, board).length, 256);
});
function scene(axis = "x") {
  const p = createProject(),
    key = addNode(p),
    parent = addNode(p, "group"),
    left = addNode(p, "rectangle", parent),
    right = addNode(p);
  p.nodes.find((n) => n.id === parent).transform = [0, 2, -0.5, 0, 100, 30];
  p.nodes.find((n) => n.id === left).geometry = {
    width: 40,
    height: 20,
    fill: "#ff0000",
  };
  p.nodes.find((n) => n.id === key).transform = [1, 0, 0, 1, 200, 200];
  p.nodes.find((n) => n.id === key).geometry = {
    width: 80,
    height: 70,
    fill: "#00ff00",
  };
  p.nodes.find((n) => n.id === right).transform = [1, 0, 0, 1, 400, 400];
  p.editor.locked.push(key);
  return { p, key, left, right };
}
test("fixed-gap distribution keeps locked key fixed and uses affine world bounds with one undo/redo", () => {
  for (const axis of ["x", "y"]) {
    const { p, key, left, right } = scene(),
      before = structuredClone(p),
      h = new History(p),
      ids = [key, left, right];
    const moves = distributionMoves(p, ids, axis, { keyId: key, gap: 28 });
    assert.equal(moves.length, 2);
    h.transact("Space around key", (q) => applyAlignment(q, moves));
    const after = h.committed(),
      size = axis === "x" ? "width" : "height",
      boxes = [left, key, right].map((id) =>
        nodeBounds(
          after,
          after.nodes.find((n) => n.id === id),
        ),
      );
    close(boxes[1][axis] - boxes[0][axis] - boxes[0][size], 28);
    close(boxes[2][axis] - boxes[1][axis] - boxes[1][size], 28);
    assert.deepEqual(
      after.nodes.find((n) => n.id === key),
      before.nodes.find((n) => n.id === key),
    );
    const other = axis === "x" ? "y" : "x";
    for (const id of ids)
      close(
        nodeBounds(
          after,
          after.nodes.find((n) => n.id === id),
        )[other],
        nodeBounds(
          before,
          before.nodes.find((n) => n.id === id),
        )[other],
      );
    h.undo();
    assert.deepEqual(h.committed(), before);
    h.redo();
    assert.deepEqual(h.committed(), after);
  }
});
test("fixed-gap spacing supports two roots and reference at either end without reordering", () => {
  const { p, key, left, right } = scene();
  for (const keyId of [left, right]) {
    const q = structuredClone(p);
    q.editor.locked = [];
    const ids = [left, right];
    applyAlignment(q, distributionMoves(q, ids, "x", { keyId, gap: 0 }));
    const a = nodeBounds(
        q,
        q.nodes.find((n) => n.id === left),
      ),
      b = nodeBounds(
        q,
        q.nodes.find((n) => n.id === right),
      );
    close(b.x - a.x - a.width, 0);
    assert.deepEqual(
      q.nodes.find((n) => n.id === keyId),
      p.nodes.find((n) => n.id === keyId),
    );
  }
});
test("invalid fixed-gap selection, visibility, locks and gaps reject before any mutation", () => {
  const { p, key, left, right } = scene(),
    original = structuredClone(p);
  for (const fixed of [
    { keyId: "missing", gap: 2 },
    { keyId: key, gap: NaN },
    { keyId: key, gap: -1 },
    { keyId: key, gap: 1e6 + 1 },
  ])
    assert.throws(() => distributionMoves(p, [key, left, right], "x", fixed));
  assert.deepEqual(p, original);
  p.editor.locked.push(left);
  assert.throws(
    () => distributionMoves(p, [key, left, right], "x", { keyId: key, gap: 2 }),
    /Unlock/,
  );
  p.editor.locked = [key];
  p.editor.hidden.push(right);
  assert.throws(
    () => distributionMoves(p, [key, left, right], "x", { keyId: key, gap: 2 }),
    /Show/,
  );
});
