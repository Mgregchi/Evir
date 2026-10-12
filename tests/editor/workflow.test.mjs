import test from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  worldTransform,
  transformResolver,
  validateProject,
} from "@evir/project-model";
import {
  History,
  addNode,
  createAnimation,
  setKey,
  reparent,
} from "@evir/authoring";
import { evaluate } from "@evir/runtime";
import { sceneOrder, nodeBounds } from "@evir/renderer-canvas";
import { organizeLayers, layerDrop } from "../../packages/studio/layers.mjs";
import {
  distributionMoves,
  applyAlignment,
} from "../../packages/studio/alignment.mjs";
import { neighborKey } from "../../packages/studio/key-navigation.mjs";
import { graphViewBox } from "../../packages/studio/graph-navigation.mjs";
import { RecoveryQueue } from "../../packages/studio/recovery.mjs";
const node = (p, id) => p.nodes.find((n) => n.id === id);
const close = (a, b) => a.forEach((v, i) => assert(Math.abs(v - b[i]) < 1e-7));
test("matching static parent bases rebase animated coordinates and preserve every sampled world pose and easing", () => {
  const p = createProject(),
    a = addNode(p, "group"),
    b = addNode(p, "group"),
    shape = addNode(p, "rectangle", a),
    animation = createAnimation(p, p.artboards[0].id);
  node(p, a).transform = [0, 2, -2, 0, 100, 70];
  node(p, b).transform = [0, 2, -2, 0, -40, 10];
  for (const [property, values] of [
    ["x", [10, 80]],
    ["y", [20, 50]],
    ["rotation", [-0.2, 0.5]],
  ])
    values.forEach((v, i) =>
      setKey(p, animation, shape, property, i * 60, v, {
        type: "cubic",
        curve: [0.3, 0, 0.7, 1],
      }),
    );
  const h = new History(p);
  h.transact("Move animated layer", (q) =>
    organizeLayers(q, [shape], b, "front"),
  );
  const after = h.snapshot();
  validateProject(after);
  for (const frame of [0, 1, 12, 29, 30, 48, 59, 60])
    close(
      worldTransform(evaluate(p, animation, frame), shape),
      worldTransform(evaluate(after, animation, frame), shape),
    );
  assert.deepEqual(
    after.animations[0].tracks.map((t) => t.keys.map((k) => k.easing)),
    p.animations[0].tracks.map((t) => t.keys.map((k) => k.easing)),
  );
  h.undo();
  assert.deepEqual(h.snapshot(), p);
  h.redo();
  assert.deepEqual(h.snapshot(), after);
  node(p, b).transform[0] = 1;
  assert.throws(() => reparent(p, shape, b), /rebasing/);
});
test("relative placement and drops retain selected root ordering; invalid nesting and references reject atomically", () => {
  const p = createProject(),
    a = addNode(p),
    b = addNode(p),
    c = addNode(p),
    g = addNode(p, "group"),
    child = addNode(p, "rectangle", g),
    h = new History(p);
  h.transact("Relative move", (q) =>
    organizeLayers(q, [a, c], null, "above", b),
  );
  assert.deepEqual(
    h
      .snapshot()
      .nodes.filter((n) => n.parentId === null)
      .sort((a, b) => a.order - b.order)
      .map((n) => n.id),
    [b, a, c, g],
  );
  h.transact("Nest", (q) => layerDrop(q, [a, c], g, "inside"));
  assert.equal(node(h.snapshot(), a).parentId, g);
  const before = h.snapshot();
  assert.throws(() =>
    h.transact("Cycle", (q) => layerDrop(q, [g], child, "inside")),
  );
  assert.deepEqual(h.snapshot(), before);
  assert.throws(
    () =>
      h.transact("Selected reference", (q) =>
        organizeLayers(q, [a], g, "above", a),
      ),
    /unselected sibling/,
  );
});
test("distribution equalizes bounding-box gaps under affine parents and keeps the outside edges fixed", () => {
  const p = createProject(),
    g = addNode(p, "group"),
    ids = [
      addNode(p, "rectangle", g),
      addNode(p, "rectangle"),
      addNode(p, "rectangle"),
    ];
  node(p, g).transform = [2, 0, 0, 1, 10, 0];
  ids.forEach((id, i) => {
    node(p, id).transform[4] = [0, 250, 500][i];
    node(p, id).geometry.width = [30, 80, 40][i];
  });
  const before = ids.map((id) => nodeBounds(p, node(p, id))),
    h = new History(p);
  const moves = distributionMoves(p, ids, "x");
  h.transact("Distribute", (q) => applyAlignment(q, moves));
  const boxes = ids.map((id) =>
    nodeBounds(h.snapshot(), node(h.snapshot(), id)),
  );
  assert.equal(boxes[0].x, before[0].x);
  assert.equal(boxes[2].x, before[2].x);
  close(
    [boxes[1].x - boxes[0].x - boxes[0].width],
    [boxes[2].x - boxes[1].x - boxes[1].width],
  );
  p.editor.locked = [ids[1]];
  assert.throws(() => distributionMoves(p, ids, "x"), /Unlock/);
  h.undo();
  assert.deepEqual(h.snapshot().nodes, p.nodes);
});
test("history return-to-start gestures preserve redo, revisions reflect committed changes, and reserved IDs retain cameras", () => {
  const p = createProject();
  p.artboards[0].id = "__proto__";
  p.editor.cameras = JSON.parse('{"__proto__":{"x":0,"y":0,"zoom":1}}');
  const h = new History(p, 2);
  assert.deepEqual(h.snapshot(), p);
  h.transact("Rename", (q) => (q.name = "One"));
  assert.equal(h.revision, 1);
  h.undo();
  assert(h.canRedo);
  h.begin("Returned gesture");
  h.preview((q) => (q.name = "Draft"));
  h.preview((q) => (q.name = p.name));
  assert.equal(h.commit(), false);
  assert(h.canRedo);
  let leaked;
  h.transact("Two", (q) => {
    leaked = q;
    q.name = "Two";
  });
  leaked.editor.cameras.__proto__.x = 400;
  assert.equal(h.snapshot().editor.cameras.__proto__.x, 0);
  assert.equal(h.revision, 3);
  h.transact("Three", (q) => (q.name = "Three"));
  h.transact("Four", (q) => (q.name = "Four"));
  h.undo();
  h.undo();
  assert.equal(h.snapshot().name, "Two");
  assert.equal(h.canUndo, false);
});
test("pose-scoped transform resolver matches affine/bone transforms and traversal follows nested draw order", () => {
  const p = createProject(),
    g = addNode(p, "group"),
    b = addNode(p, "bone", g),
    tip = addNode(p, "bone", b),
    r = addNode(p, "rectangle", tip);
  node(p, g).transform = [0.8, 0.2, 0.1, 1.2, 70, 20];
  node(p, b).transform = [0, 1, -1, 0, 3, 4];
  const resolve = transformResolver(p);
  for (const n of p.nodes) close(resolve(n.id), worldTransform(p, n.id));
  assert.deepEqual(
    sceneOrder(p, p.artboards[0].id).map((n) => n.id),
    [g, b, tip, r],
  );
  node(p, g).transform[4] = 90;
  close(transformResolver(p)(r), worldTransform(p, r));
});
test("key navigation respects selection and graph fit includes negative and distant positions", () => {
  const a = {
    tracks: [
      {
        targetId: "a",
        property: "x",
        keys: [{ frame: 0 }, { frame: 30 }, { frame: 60 }],
      },
      { targetId: "b", property: "y", keys: [{ frame: 10 }, { frame: 90 }] },
    ],
  };
  assert.equal(neighborKey(a, "a", 30, 1).frame, 60);
  assert.equal(neighborKey(a, null, 30, -1).frame, 10);
  assert.equal(neighborKey(a, "a", 0, -1), null);
  const states = [{ position: [-40, -20] }, { position: [1500, 500] }],
    box = graphViewBox(states);
  assert(box[0] <= -40 && box[1] <= -20);
  assert(box[0] + box[2] >= 1620 && box[1] + box[3] >= 540);
});
test("recovery coalesces pending edits, serializes in-flight writes and reports only the newest completion", async () => {
  let value = "A",
    release;
  const writes = [],
    saved = [];
  const queue = new RecoveryQueue({
    sample: () => value,
    write: async (v) => {
      writes.push(v);
      if (v === "A") await new Promise((r) => (release = r));
    },
    saved: (v) => saved.push(v),
    failed: (e) => {
      throw e;
    },
    delay: 10000,
  });
  const a = queue.request(),
    running = queue.flush();
  await Promise.resolve();
  value = "B";
  const b = queue.request();
  value = "C";
  const c = queue.request();
  release();
  await running;
  assert.deepEqual(writes, ["A", "C"]);
  assert.deepEqual(saved, ["C"]);
  assert.deepEqual(await Promise.all([a, b, c]), [true, true, true]);
  value = "Cancelled";
  const pending = queue.request();
  queue.cancel();
  assert.equal(await pending, false);
  await queue.flush();
  assert.deepEqual(writes, ["A", "C"]);
});
test("large valid base64 assets validate without recursive-regexp overflow; malformed padding rejects", () => {
  const p = createProject();
  p.assets = [
    {
      id: "payload",
      name: "Payload",
      mimeType: "application/octet-stream",
      data: "AAAA".repeat(2 * 1024 * 1024),
      sha256: "0".repeat(64),
    },
  ];
  validateProject(p);
  for (const data of ["A", "AA=", "A===", "AB%="]) {
    p.assets[0].data = data;
    assert.throws(() => validateProject(p), /base64/);
  }
});
