import test from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  validateProject,
  propertiesFor,
  serializeProject,
  openProject,
  toRuntimeProject,
  openRuntimeProject,
} from "@evir/project-model";
import {
  addNode,
  History,
  convertRectangle,
  setKey,
  createAnimation,
} from "@evir/authoring";
import { compileProject } from "@evir/format";
export const gradient = (type) => ({
  type,
  start: [0, 0],
  end: [120, 100],
  stops: [
    { position: 0, color: "#f5e4ca" },
    { position: 0.35, color: "#e9b49580" },
    { position: 1, color: "#254131" },
  ],
});
function scene(type = "linear") {
  const p = createProject(),
    id = addNode(p);
  p.nodes[0].geometry.fill = gradient(type);
  return { p, id };
}
test("local gradient colors, alpha, endpoints and source IDs survive history, path conversion and both document loaders", async () => {
  for (const type of ["linear", "radial"]) {
    const { p, id } = scene(type),
      store = new History(p);
    store.transact("Convert", (q) => convertRectangle(q, id));
    assert.deepEqual(store.snapshot().nodes[0].geometry.fill, gradient(type));
    store.undo();
    assert.deepEqual(store.snapshot(), p);
    assert.deepEqual(await openProject(await serializeProject(p)), p);
    const runtime = toRuntimeProject(p);
    assert.deepEqual(
      await openRuntimeProject(JSON.stringify(runtime)),
      runtime,
    );
    assert(!Object.hasOwn(runtime, "editor"));
    assert(!propertiesFor(p.nodes[0]).includes("fill"));
  }
});
test("invalid paint cannot enter a transaction; positions, alpha, budgets and unsupported contracts have diagnostics", () => {
  const { p } = scene();
  for (const change of [
    (g) => (g.type = "conic"),
    (g) => (g.start = [NaN, 0]),
    (g) => (g.end = [0, 0]),
    (g) => {
      g.start = [-1e308, 0];
      g.end = [1e308, 0];
    },
    (g) => (g.start = [0]),
    (g) => (g.extra = true),
    (g) => (g.stops = []),
    (g) =>
      (g.stops = Array.from({ length: 17 }, (_, i) => ({
        position: i / 16,
        color: "#ffffff",
      }))),
    (g) => (g.stops[1].position = 0),
    (g) => (g.stops[1].position = 2),
    (g) => (g.stops[0].color = "#ffffffzz"),
    (g) => (g.stops[0].opacity = 0.5),
  ]) {
    const store = new History(p);
    assert.throws(() =>
      store.transact("bad", (q) => change(q.nodes[0].geometry.fill)),
    );
    assert.deepEqual(store.snapshot(), p);
  }
  const old = structuredClone(p);
  old.schemaVersion = 1;
  delete old.animations;
  delete old.machines;
  assert.throws(() => validateProject(old), /require source version 2/);
  const solid = structuredClone(p);
  solid.nodes[0].geometry.fill = "#ffffff";
  const a = createAnimation(solid, solid.artboards[0].id);
  setKey(solid, a, solid.nodes[0].id, "fill", 0, "#ffffff");
  solid.nodes[0].geometry.fill = gradient("linear");
  assert.throws(() => validateProject(solid), /invalid target\/property/);
  const skinned = structuredClone(p);
  convertRectangle(skinned, skinned.nodes[0].id);
  skinned.nodes[0].geometry.skin = {
    bindWorld: [1, 0, 0, 1, 0, 0],
    bones: [],
    weights: [],
  };
  assert.throws(
    () => validateProject(skinned),
    /gradient paint on skinned paths/,
  );
});
test("gradient compiler is deterministic, immutable and rejects float32 overflow before download", () => {
  for (const type of ["linear", "radial"]) {
    const { p } = scene(type),
      before = structuredClone(p);
    assert.deepEqual(
      compileProject(p).bytes,
      compileProject(structuredClone(p)).bytes,
    );
    assert.deepEqual(p, before);
    p.nodes[0].geometry.fill.end[0] = 1e100;
    assert.throws(() => compileProject(p), /float32/);
  }
});
