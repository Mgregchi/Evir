import test from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  validateProject,
  serializeProject,
  openProject,
  History,
  addNode,
  reparent,
  removeSubtree,
  reorder,
  worldTransform,
} from "../../editor/model.mjs";
const clone = (p) => structuredClone(p);
const close = (a, b) =>
  a.forEach((v, i) => assert(Math.abs(v - b[i]) < 1e-9, `${a} != ${b}`));
function scene() {
  const p = createProject();
  const a = addNode(p, "group"),
    b = addNode(p, "group"),
    child = addNode(p, "rectangle", a);
  p.nodes.find((n) => n.id === a).transform = [0, 2, -3, 0, 80, 30];
  p.nodes.find((n) => n.id === b).transform = [1, 0.2, 0.5, 2, -15, 90];
  p.nodes.find((n) => n.id === child).transform = [0.7, 0.1, 0.3, 0.9, 20, 10];
  return { p, a, b, child };
}
test("save/open retains IDs, affine transforms, authoring controls and verified asset bytes", async () => {
  const { p, child } = scene();
  p.editor.locked = [child];
  p.editor.hidden = [child];
  p.editor.cameras[p.artboards[0].id] = { x: -37, y: 44, zoom: 1.75 };
  const bytes = new TextEncoder().encode("original asset bytes");
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
  p.assets.push({
    id: "asset-original",
    name: "Sample asset",
    mimeType: "application/octet-stream",
    sha256,
    data: btoa("original asset bytes"),
  });
  const opened = await openProject(await serializeProject(p));
  assert.deepEqual(opened, p);
  opened.nodes[0].name = "Changed";
  assert.notEqual(opened.nodes[0].name, p.nodes[0].name);
  const corrupt = clone(p);
  corrupt.assets[0].data = btoa("replaced");
  await assert.rejects(serializeProject(corrupt), /content hash mismatch/);
  await assert.rejects(
    openProject(JSON.stringify(corrupt)),
    /content hash mismatch/,
  );
});
test("opening rejects unknown versions, future fields, broken ownership, cycles and nonfinite transforms", async () => {
  const { p, a, b, child } = scene();
  for (const [change, pattern] of [
    [(q) => (q.schemaVersion = 99), /unsupported version/],
    [(q) => (q.timelines = []), /unsupported field/],
    [(q) => (q.nodes[0].parentId = b), /parent cycle/],
    [
      (q) => (q.nodes.find((n) => n.id === child).parentId = "absent"),
      /missing parent/,
    ],
    [(q) => (q.nodes[1].id = a), /duplicate ID/],
    [(q) => (q.nodes[0].transform[2] = Infinity), /finite affine/],
    [(q) => (q.editor.locked = ["absent"]), /missing node/],
    [(q) => (q.nodes[0].artboardId = "other"), /missing artboard/],
    [(q) => (q.nodes[0].geometry = {}), /geometry must be null/],
    [(q) => (q.nodes[2].geometry.width = -5), /positive finite/],
  ]) {
    const q = clone(p);
    change(q);
    if (pattern.source === "parent cycle") q.nodes[1].parentId = a;
    assert.throws(() => validateProject(q), pattern);
  }
  await assert.rejects(openProject("{"), /invalid JSON/);
});
test("reparent preserves world matrix under rotated, scaled and sheared parents and across undo/redo", () => {
  const { p, b, child } = scene(),
    before = worldTransform(p, child),
    h = new History(p);
  h.transact("Reparent", (q) => reparent(q, child, b));
  close(worldTransform(h.snapshot(), child), before);
  h.undo();
  assert.deepEqual(h.snapshot(), p);
  h.redo();
  close(worldTransform(h.snapshot(), child), before);
  h.transact("To artboard", (q) => reparent(q, child, null));
  close(worldTransform(h.snapshot(), child), before);
});
test("singular, cross-artboard and cyclic reparent failures leave committed state and history unchanged", () => {
  const { p, a, b, child } = scene();
  p.nodes.find((n) => n.id === b).transform = [0, 0, 0, 0, 1, 2];
  const h = new History(p);
  assert.throws(
    () => h.transact("Invalid", (q) => reparent(q, child, b)),
    /singular/,
  );
  assert.deepEqual(h.snapshot(), p);
  assert.equal(h.canUndo, false);
  assert.throws(() => h.transact("Invalid", (q) => reparent(q, a, a)), /cycle/);
  assert.deepEqual(h.snapshot(), p);
  const other = clone(p);
  other.artboards.push({ id: "other", name: "Other", width: 10, height: 10 });
  other.editor.cameras.other = { x: 0, y: 0, zoom: 1 };
  other.nodes.find((n) => n.id === b).artboardId = "other";
  const h2 = new History(other);
  assert.throws(
    () => h2.transact("Invalid", (q) => reparent(q, child, b)),
    /same artboard/,
  );
  assert.deepEqual(h2.snapshot(), other);
});
test("preview is isolated, cancellation restores exact state, many drag updates create one undo entry", () => {
  const { p, child } = scene(),
    h = new History(p);
  h.begin("Drag");
  for (let x = 0; x < 30; x++)
    h.preview((q) => (q.nodes.find((n) => n.id === child).transform[4] = x));
  assert.deepEqual(h.committed(), p);
  assert.equal(h.canUndo, false);
  h.cancel();
  assert.deepEqual(h.snapshot(), p);
  h.begin("Drag");
  for (let x = 0; x < 30; x++)
    h.preview((q) => (q.nodes.find((n) => n.id === child).transform[4] = x));
  h.commit();
  assert.equal(h.snapshot().nodes.find((n) => n.id === child).transform[4], 29);
  h.undo();
  assert.deepEqual(h.snapshot(), p);
  assert.equal(h.canUndo, false);
  h.redo();
  assert.equal(h.snapshot().nodes.find((n) => n.id === child).transform[4], 29);
});
test("rejected and throwing edits are atomic; caller references cannot mutate stored data", () => {
  const { p, child } = scene(),
    h = new History(p);
  let leaked;
  h.transact("Rename", (q) => {
    leaked = q;
    q.name = "Updated";
  });
  leaked.name = "Corrupt";
  assert.equal(h.snapshot().name, "Updated");
  const before = h.snapshot();
  assert.throws(
    () =>
      h.transact("Fail", (q) => {
        q.name = "Lost";
        throw Error("stop");
      }),
    /stop/,
  );
  assert.deepEqual(h.snapshot(), before);
  assert.throws(
    () =>
      h.transact(
        "Fail",
        (q) => (q.nodes.find((n) => n.id === child).parentId = "missing"),
      ),
    /missing parent/,
  );
  assert.deepEqual(h.snapshot(), before);
  const snapshot = h.snapshot();
  snapshot.name = "Untracked";
  assert.equal(h.snapshot().name, "Updated");
});
test("subtree deletion removes descendant settings and undo restores every record", () => {
  const { p, a, child } = scene();
  p.editor.hidden = [child];
  p.editor.locked = [a];
  const h = new History(p);
  h.transact("Delete subtree", (q) => removeSubtree(q, a));
  assert.equal(
    h.snapshot().nodes.some((n) => n.id === child),
    false,
  );
  assert.deepEqual(h.snapshot().editor.locked, []);
  assert.deepEqual(h.snapshot().editor.hidden, []);
  h.undo();
  assert.deepEqual(h.snapshot(), p);
});
test("draw order is explicit; branching discards redo and no-op edits preserve it", () => {
  const p = createProject(),
    a = addNode(p),
    b = addNode(p),
    h = new History(p);
  h.transact("Reorder", (q) => reorder(q, b, -1));
  assert(
    h.snapshot().nodes.find((n) => n.id === b).order <
      h.snapshot().nodes.find((n) => n.id === a).order,
  );
  h.undo();
  assert.equal(h.canRedo, true);
  h.transact("No op", () => {});
  assert.equal(h.canRedo, true);
  h.transact("Branch", (q) => (q.name = "Branch"));
  assert.equal(h.canRedo, false);
  h.undo();
  assert.deepEqual(h.snapshot(), p);
});
