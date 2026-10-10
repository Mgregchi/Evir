import test from "node:test";
import assert from "node:assert/strict";
import { PenDraft } from "../../packages/studio/pen.mjs";
import { createProject, worldTransform, validateProject, serializeProject, openProject } from "@evir/project-model";
import { addNode, History } from "@evir/authoring";
import { mapPoint } from "@evir/runtime/geometry";
import { compileProject, runtimeSchema } from "@evir/format";

test("Pen drawing preserves world anchors and mirrored handles under an affine parent", async () => {
  const p = createProject(), parentId = addNode(p, "group");
  p.nodes[0].transform = [0, 2, -0.5, 0, 240, 80];
  const matrix = worldTransform(p, parentId);
  const draft = new PenDraft({ artboardId: p.artboards[0].id, parentId, matrix });
  draft.down({ x: 160, y: 100 }, 1.25);
  draft.move({ x: 140, y: 130 });
  draft.up();
  draft.down({ x: 280, y: 160 }, 1.25);
  draft.up();
  assert.deepEqual(draft.worldPoints()[0], {
    id: draft.points[0].id, anchor: [160, 100], in: [180, 70], out: [140, 130],
  });
  assert.deepEqual(draft.points[1].in, draft.points[1].anchor);
  const history = new History(p), before = history.committed();
  history.transact("Draw path", (source) => {
    const id = addNode(source, "path", parentId);
    source.nodes.find((n) => n.id === id).geometry = draft.geometry();
  });
  const authored = history.committed();
  validateProject(authored);
  const restored = await openProject(await serializeProject(authored));
  assert.deepEqual(restored.nodes, authored.nodes);
  assert.equal(compileProject(authored, runtimeSchema).mapping.nodes[authored.nodes[1].id].type, "Shape");
  history.undo();
  assert.deepEqual(history.committed(), before);
  history.redo();
  assert.deepEqual(history.committed(), authored);
});

test("Pen drafts enforce valid topology, close in screen space and cancel interrupted gestures", () => {
  const draft = new PenDraft({ artboardId: "board", matrix: [2, 0, 0, 2, 40, 20] });
  assert.throws(() => draft.geometry(), /two points/);
  for (const world of [{ x: 80, y: 60 }, { x: 180, y: 60 }]) {
    draft.down(world, 2);
    assert.throws(() => draft.geometry(), /Release/);
    draft.up();
  }
  assert.throws(() => draft.geometry(true), /three points/);
  const before = draft.geometry();
  draft.down({ x: 130, y: 140 }, 2);
  draft.move({ x: 150, y: 150 });
  draft.cancelGesture();
  assert.deepEqual(draft.geometry(), before);
  draft.down({ x: 130, y: 140 }, 2);
  draft.up();
  assert.equal(draft.down({ x: 83, y: 60 }, 2), "close");
  assert.equal(draft.points.length, 3);
  assert.equal(draft.geometry(true).closed, true);
  draft.removeLast();
  assert.deepEqual(draft.geometry(), before);
  assert.deepEqual(mapPoint(draft.matrix, draft.points[0].anchor), [80, 60]);
  assert.throws(() => new PenDraft({ artboardId: "board", matrix: [0, 0, 0, 1, 0, 0] }), /singular/);
});
