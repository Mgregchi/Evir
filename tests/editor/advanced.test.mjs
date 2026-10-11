import { test } from "node:test";
import assert from "node:assert/strict";
import { suite } from "../../apps/web/advanced-examples.mjs";
import {
  validateProject,
  toRuntimeProject,
  worldTransform,
  mapPoint,
} from "@evir/project-model";
import { compileProject, importRiv, readRiv } from "@evir/format";
import { evaluate, MachinePlayer, createRuntime } from "@evir/runtime";
import { removeSubtree, History } from "@evir/authoring";
const scenes = await suite();
test("advanced source and runtime preserve contracts; .riv import recovers semantics and motion", async () => {
  assert.deepEqual(
    await suite(),
    scenes,
    "Original study generation is reproducible, including point and skin references",
  );
  for (const p of scenes) {
    const before = structuredClone(p),
      exported = compileProject(p),
      restored = await importRiv(exported.bytes);
    validateProject(restored);
    const scene = toRuntimeProject(p);
    assert.equal(scene.schemaVersion, 2);
    assert(!("editor" in scene));
    assert.deepEqual(p, before);
    assert.equal(restored.nodes.length, p.nodes.length);
    assert.equal(restored.assets.length, p.assets.length);
    assert.equal(restored.animations.length, p.animations.length);
    assert.equal(restored.advanced.clips.length, p.advanced.clips.length);
    for (const n of p.nodes) {
      const other = restored.nodes.find((v) => v.name === n.name);
      assert.equal(other.kind, n.kind);
      for (const frame of [0, 30, 60]) {
        const a = evaluate(p, p.animations[0]?.id, frame),
          b = evaluate(restored, restored.animations[0]?.id, frame);
        const x = worldTransform(a, n.id),
          y = worldTransform(b, other.id);
        x.forEach((v, i) =>
          assert(
            Math.abs(v - y[i]) < 1e-4,
            `${p.name} ${n.name} world transform`,
          ),
        );
      }
    }
    assert.equal(compileProject(restored).bytes.length, exported.bytes.length);
  }
});
test("IK reaches an independent moving target and clamps unreachable distances without mutating rest", () => {
  const p = scenes.find((p) => p.name === "reach"),
    before = structuredClone(p);
  for (const frame of [0, 30, 60]) {
    const pose = evaluate(p, p.animations[0].id, frame),
      tip = pose.nodes.find((n) => n.name === "elbow"),
      target = pose.nodes.find((n) => n.name === "target"),
      actual = mapPoint(worldTransform(pose, tip.id), [tip.geometry.length, 0]),
      wanted = mapPoint(worldTransform(pose, target.id), [0, 0]);
    const root = pose.nodes.find((n) => n.name === "shoulder"),
      origin = mapPoint(worldTransform(pose, root.id), [0, 0]);
    const distance = Math.hypot(wanted[0] - origin[0], wanted[1] - origin[1]);
    if (distance <= 120)
      assert(Math.hypot(actual[0] - wanted[0], actual[1] - wanted[1]) < 1e-6);
    else
      assert(
        Math.abs(
          Math.hypot(actual[0] - origin[0], actual[1] - origin[1]) - 120,
        ) < 1e-6,
      );
  }
  const unreachable = structuredClone(p);
  unreachable.nodes.find((n) => n.name === "target").transform[4] = 1000;
  const pose = evaluate(unreachable, null, 0);
  assert(pose.nodes.every((n) => n.transform.every(Number.isFinite)));
  assert.deepEqual(p, before);
});
test("timed transitions mix and 1D blends interpolate inputs; reset restores defaults", () => {
  const p = scenes.find((p) => p.name === "blend"),
    player = new MachinePlayer(p, p.machines[0].id),
    x = () => player.pose().nodes[0].transform[4];
  player.set("blend-level", 1);
  player.set("blend-on", true);
  player.advance(0.1);
  assert.equal(x(), 35);
  player.advance(0.1);
  assert.equal(x(), 35);
  player.advance(0.2);
  assert.equal(x(), 110.5);
  player.advance(0.2);
  assert.equal(x(), 186);
  player.set("blend-level", 0.25);
  assert.equal(x(), 72.75);
  const single = new MachinePlayer(p, p.machines[0].id);
  single.set("blend-level", 1);
  single.set("blend-on", true);
  single.advance(0.6);
  assert.equal(single.pose().nodes[0].transform[4], 186);
  player.reset();
  assert.equal(x(), 35);
  assert.equal(player.inputs["blend-level"], 0);
  assert.equal(player.mixing, null);
});
test("invalid clips, mesh UV/topology, IK overlap and transition fields reject atomically", () => {
  const changes = [
    [
      "canopy",
      (p) => (p.advanced.clips[0].maskId = p.advanced.clips[0].targetId),
    ],
    ["kite", (p) => (p.nodes[1].geometry.triangles[0] = 900)],
    ["kite", (p) => (p.nodes[1].geometry.vertices[0].uv[0] = 2)],
    ["kite", (p) => (p.nodes[1].geometry.vertices[0].uv = null)],
    ["kite", (p) => (p.nodes[1].geometry.vertices[0].position = null)],
    ["reach", (p) => p.advanced.ik.push(structuredClone(p.advanced.ik[0]))],
    ["blend", (p) => (p.machines[0].transitions[0].durationMs = -1)],
    ["caption", (p) => (p.nodes[0].geometry.text = "two\nlines")],
  ];
  for (const [name, fn] of changes) {
    const p = scenes.find((p) => p.name === name),
      h = new History(p),
      before = h.snapshot();
    assert.throws(() => h.transact("invalid", fn));
    assert.deepEqual(h.snapshot(), before);
  }
});
test("binary reader reports malformed and unsupported streams before exposing a partial scene", async () => {
  const bytes = compileProject(scenes[0]).bytes;
  for (const end of [0, 3, 6, bytes.length - 1])
    assert.throws(() => readRiv(bytes.subarray(0, end)));
  const mutated = bytes.slice();
  mutated[8] = 255;
  mutated[9] = 127;
  assert.throws(() => readRiv(mutated), /Unsupported Rive type/);
  const wrong = bytes.slice();
  wrong[4] = 8;
  await assert.rejects(importRiv(wrong), /Unsupported Rive major/);
});
test("deleting masks and targets cleans effects; influencing mesh bones cannot be discarded", () => {
  const p = structuredClone(scenes[0]);
  removeSubtree(p, p.advanced.clips[0].maskId);
  validateProject(p);
  assert.equal(p.advanced.clips.length, 0);
  const rig = structuredClone(scenes.find((p) => p.name === "reach"));
  removeSubtree(rig, rig.advanced.ik[0].targetId);
  validateProject(rig);
  assert.equal(rig.advanced.ik.length, 0);
  const mesh = scenes.find((p) => p.name === "kite");
  const h = new History(mesh);
  assert.throws(
    () => h.transact("delete bone", (p) => removeSubtree(p, p.nodes[0].id)),
    /unbind/,
  );
});

test("Editor-style property tables use four entries per word and reject duplicate keys", () => {
  const bytes = compileProject(scenes[0]).bytes;
  const keys = [13, 14, 15, 16, 17, 18, 20, 21, 0],
    table = [170, 0, 0, 0, 170, 0, 0, 0];
  const encoded = Uint8Array.from([
    ...bytes.slice(0, 7),
    ...keys,
    ...table,
    ...bytes.slice(8),
  ]);
  assert.deepEqual(
    readRiv(encoded).records,
    readRiv(bytes).records.map((r) => ({
      ...r,
      offset: r.offset + keys.length + table.length - 1,
    })),
  );
  assert.throws(
    () =>
      readRiv(
        Uint8Array.from([
          ...bytes.slice(0, 7),
          13,
          13,
          0,
          0,
          0,
          0,
          0,
          ...bytes.slice(8),
        ]),
      ),
    /Duplicate Rive header/,
  );
});
