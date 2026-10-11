import test from "node:test";
import assert from "node:assert/strict";
import { createProject, worldTransform } from "@evir/project-model";
import { addNode, History } from "@evir/authoring";
import { nodeBounds } from "@evir/renderer-canvas";
import {
  snapTargets,
  snapMove,
  alignmentMoves,
  applyAlignment,
} from "../../packages/studio/alignment.mjs";
const fixture = () => {
  const p = createProject(),
    a = addNode(p, "rectangle"),
    b = addNode(p, "rectangle");
  p.nodes.find((n) => n.id === a).transform = [1, 0, 0, 1, 30, 40];
  p.nodes.find((n) => n.id === b).transform = [1, 0, 0, 1, 240, 180];
  return { p, a, b };
};
test("Snapping uses six screen pixels at different zooms, separate axes and Alt bypass", () => {
  const { p, a, b } = fixture(),
    box = nodeBounds(
      p,
      p.nodes.find((n) => n.id === a),
    );
  const targets = snapTargets(p, [a], p.artboards[0].id);
  const near = snapMove(box, targets, 208, 139, 1);
  assert.equal(near.dx, 210);
  assert.equal(near.dy, 140);
  assert.equal(near.guides.length, 2);
  assert.equal(near.guides.find((g) => g.axis === "x").target.id, b);
  assert.equal(snapMove(box, targets, 202, 0, 1).dx, 202);
  assert.equal(snapMove(box, targets, 202, 0, 0.5).dx, 210);
  assert.equal(snapMove(box, targets, 208, 139, 4).dx, 208);
  assert.deepEqual(snapMove(box, targets, 208, 139, 1, true), {
    dx: 208,
    dy: 139,
    guides: [],
  });
});
test("Targets exclude moving ancestors and descendants, hidden ancestry and other artboards", () => {
  const { p, a, b } = fixture(),
    g = addNode(p, "group"),
    child = addNode(p, "rectangle", g),
    hidden = addNode(p, "group"),
    leaf = addNode(p, "rectangle", hidden);
  p.nodes.find((n) => n.id === a).parentId = g;
  p.editor.hidden.push(hidden);
  p.editor.locked.push(b);
  p.artboards.push({ id: "other", name: "Other", width: 640, height: 480 });
  const other = addNode(p, "rectangle", null, "other");
  // addNode uses active first board; explicitly move it to the other board.
  p.nodes.find((n) => n.id === other).artboardId = "other";
  const ids = new Set(
    snapTargets(p, [g, a], p.artboards[0].id).x.map((t) => t.box.id),
  );
  for (const id of [g, a, child, hidden, leaf, other]) assert(!ids.has(id));
  assert(ids.has(b));
  assert(!snapTargets(p, [a], p.artboards[0].id).x.some((t) => t.box.id === g));
});
test("One root aligns to artboard; several align bounding edges and centers under affine parents with one undo", () => {
  const { p, a, b } = fixture(),
    g = addNode(p, "group");
  p.nodes.find((n) => n.id === g).transform = [0, 2, -0.5, 0, 360, 80];
  p.nodes.find((n) => n.id === b).parentId = g;
  const h = new History(p);
  const original = [a, b].map((id) => worldTransform(p, id));
  for (const mode of ["left", "center", "right", "top", "middle", "bottom"]) {
    const moves = alignmentMoves(p, [a, b], mode);
    h.transact("Align", (q) => applyAlignment(q, moves));
    const boxes = [a, b].map((id) =>
      nodeBounds(
        h.committed(),
        h.committed().nodes.find((n) => n.id === id),
      ),
    );
    const value = (box) =>
      mode === "left"
        ? box.x
        : mode === "center"
          ? box.x + box.width / 2
          : mode === "right"
            ? box.x + box.width
            : mode === "top"
              ? box.y
              : mode === "middle"
                ? box.y + box.height / 2
                : box.y + box.height;
    assert(Math.abs(value(boxes[0]) - value(boxes[1])) < 1e-8);
    [a, b].forEach((id, i) =>
      assert.deepEqual(
        worldTransform(h.committed(), id).slice(0, 4),
        original[i].slice(0, 4),
      ),
    );
    h.undo();
    assert.deepEqual(h.committed(), p);
  }
  const moves = alignmentMoves(p, [g, b], "right");
  h.transact("Align root", (q) => applyAlignment(q, moves));
  const box = nodeBounds(
    h.committed(),
    h.committed().nodes.find((n) => n.id === g),
  );
  assert.equal(box.x + box.width, p.artboards[0].width);
});
test("Invalid selected members reject alignment without partial changes", () => {
  const { p, a, b } = fixture();
  p.editor.locked.push(b);
  const before = structuredClone(p);
  assert.throws(() => alignmentMoves(p, [a, b], "left"), /Unlock/);
  assert.deepEqual(p, before);
  p.editor.locked = [];
  p.editor.hidden.push(b);
  assert.throws(() => alignmentMoves(p, [a, b], "left"), /Show/);
  p.editor.hidden = [];
  const parent = addNode(p, "group");
  p.nodes.find((n) => n.id === parent).transform = [0, 0, 0, 1, 0, 0];
  p.nodes.find((n) => n.id === b).parentId = parent;
  assert.throws(() => alignmentMoves(p, [a, b], "left"), /singular/);
  const root = addNode(p, "bone"),
    tip = addNode(p, "bone", root);
  assert.throws(() => alignmentMoves(p, [a, tip], "left"), /Child bones/);
});
test("Snap targets are immutable drag snapshots and artboard centers are valid references", () => {
  const { p, a } = fixture(),
    box = nodeBounds(
      p,
      p.nodes.find((n) => n.id === a),
    ),
    targets = snapTargets(p, [a], p.artboards[0].id),
    saved = structuredClone(targets);
  const dx = p.artboards[0].width / 2 - box.x - box.width / 2 - 2;
  const move = snapMove(box, targets, dx, 300, 1);
  assert.equal(move.dx, dx + 2);
  p.nodes[1].transform[4] += 90;
  assert.deepEqual(targets, saved);
});

test("Coincident targets retain the same stable reference when approached from either side", () => {
  const box = { x: 0, y: 0, width: 10, height: 10 },
    first = { id: "first" },
    second = { id: "second" };
  const targets = {
    x: [
      { value: 20, box: first },
      { value: 20, box: second },
    ],
    y: [],
  };
  for (const dx of [19, 21])
    assert.equal(snapMove(box, targets, dx, 0, 1).guides[0].target.id, "first");
});
