import test from "node:test";
import assert from "node:assert/strict";
import { createProject, worldTransform } from "@evir/project-model";
import { addNode, History, createAnimation, setKey } from "@evir/authoring";
import {
  gestureCamera,
  touchFrame,
} from "../../packages/studio/navigation.mjs";
import { panelWidths } from "../../packages/studio/layout.mjs";
import {
  ancestors,
  layerRows,
  parentChoices,
  organizeLayers,
} from "../../packages/studio/layers.mjs";
const node = (p, id) => p.nodes.find((n) => n.id === id);
const close = (actual, expected) =>
  actual.forEach((n, i) => assert(Math.abs(n - expected[i]) < 1e-8));
test("Two-finger camera preserves the midpoint world position with translation and clamped zoom", () => {
  const camera = { x: 24, y: 18, zoom: 0.5 },
    start = { x: 120, y: 100, distance: 50 },
    next = { x: 145, y: 80, distance: 110 };
  const result = gestureCamera(camera, start, next);
  close(
    [(next.x - result.x) / result.zoom, (next.y - result.y) / result.zoom],
    [(start.x - camera.x) / camera.zoom, (start.y - camera.y) / camera.zoom],
  );
  assert.equal(result.zoom, 1.1);
  assert.equal(
    gestureCamera(camera, start, { ...next, distance: 5000 }).zoom,
    4,
  );
  assert.equal(
    gestureCamera(camera, start, { ...next, distance: 1 }).zoom,
    0.1,
  );
  assert.deepEqual(
    touchFrame(
      new Map([
        [1, { x: 0, y: 0 }],
        [2, { x: 0, y: 0 }],
      ]),
    ),
    { x: 0, y: 0, distance: 1 },
  );
});
test("Desktop panels reserve a usable stage under either resizing direction", () => {
  for (const viewport of [851, 1024, 1440])
    for (const active of ["left", "right"])
      for (const left of [180, 236, 420, 1000])
        for (const right of [180, 260, 420, 1000]) {
          const w = panelWidths({ left, right }, viewport, active);
          assert(w.left >= 180 && w.right >= 180);
          assert(w.left <= 420 && w.right <= 420);
          assert(viewport - 60 - w.left - w.right >= 240);
        }
});
test("Collapsed hierarchy and search retain matching ancestors without changing source", () => {
  const p = createProject(),
    g = addNode(p, "group"),
    nested = addNode(p, "group", g),
    shape = addNode(p, "rectangle", nested),
    sibling = addNode(p, "rectangle");
  node(p, shape).name = "Needle";
  const before = structuredClone(p),
    collapsed = new Set([g]);
  assert.deepEqual(
    layerRows(p, p.artboards[0].id, collapsed).map((r) => r.n.id),
    [sibling, g],
  );
  assert.deepEqual(
    layerRows(p, p.artboards[0].id, collapsed, "needle").map((r) => r.n.id),
    [g, nested, shape],
  );
  assert.deepEqual(ancestors(p, shape), [nested, g]);
  assert.deepEqual(p, before);
  assert(
    !parentChoices(p, [g], p.artboards[0].id).some((n) =>
      [g, nested].includes(n.id),
    ),
  );
});
test("Bulk organization preserves affine world positions and descendant IDs in one Undo step", () => {
  const p = createProject(),
    g = addNode(p, "group"),
    nested = addNode(p, "group", g),
    child = addNode(p, "rectangle", nested),
    a = addNode(p, "rectangle", g),
    dest = addNode(p, "group"),
    rest = addNode(p, "rectangle", dest);
  node(p, g).transform = [0, 2, -0.5, 0, 180, 60];
  node(p, dest).transform = [0.8, 0.2, 0.5, 1.2, 30, 40];
  const before = [nested, child, a].map((id) => worldTransform(p, id)),
    h = new History(p);
  h.transact("Organize", (p) =>
    organizeLayers(p, [a, child, nested], dest, "back"),
  );
  const result = h.committed();
  [nested, child, a].forEach((id, i) =>
    close(worldTransform(result, id), before[i]),
  );
  assert.equal(node(result, child).parentId, nested);
  assert.deepEqual(
    result.nodes
      .filter((n) => n.parentId === dest)
      .sort((a, b) => a.order - b.order)
      .map((n) => n.id),
    [nested, a, rest],
  );
  h.undo();
  assert.deepEqual(h.committed(), p);
  h.redo();
  assert.deepEqual(h.committed(), result);
});
test("Invalid destinations, locked selections, singular transforms and rig constraints leave History unchanged", () => {
  const p = createProject(),
    g = addNode(p, "group"),
    child = addNode(p, "group", g),
    r = addNode(p, "rectangle"),
    dest = addNode(p, "group"),
    bone = addNode(p, "bone"),
    bone2 = addNode(p, "bone");
  const check = (ids, parent, pattern) => {
    const h = new History(p);
    assert.throws(
      () =>
        h.transact("Organize", (p) => organizeLayers(p, ids, parent, "front")),
      pattern,
    );
    assert.deepEqual(h.committed(), p);
    assert.equal(h.canUndo, false);
  };
  check([g], child, /outside/);
  p.editor.locked = [g];
  check([r, g], dest, /Unlock/);
  p.editor.locked = [];
  node(p, dest).transform = [0, 0, 0, 0, 0, 0];
  check([r], dest, /singular/);
  check([bone], bone2, /parent tip/);
});
test("Organization does not silently break animation keys by changing parent spaces", () => {
  const p = createProject(),
    g = addNode(p, "group"),
    r = addNode(p, "rectangle"),
    a = createAnimation(p, p.artboards[0].id);
  setKey(p, a, g, "x", 0, 0);
  setKey(p, a, g, "x", 60, 100);
  const h = new History(p);
  assert.throws(
    () => h.transact("Organize", (p) => organizeLayers(p, [r], g, "front")),
    /rebasing/,
  );
  assert.deepEqual(h.committed(), p);
  h.transact("Stacking", (p) => organizeLayers(p, [g], null, "back"));
  assert.deepEqual(h.committed().animations, p.animations);
});
