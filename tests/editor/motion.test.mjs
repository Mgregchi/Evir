import test from "node:test";
import assert from "node:assert/strict";
import { createProject, validateProject, worldTransform, serializeProject, openProject } from "@evir/project-model";
import { addNode, History, removeSubtree } from "@evir/authoring";
import { convertRectangle, insertPoint, bindPath, setWeight, createAnimation, setKey, createMachine } from "@evir/authoring";
import { worldPoints, quantize } from "@evir/runtime/geometry";
import { evaluate, MachinePlayer, easingValue } from "@evir/runtime";
import { newId } from "@evir/project-model";
export function rigScene() {
  const p = createProject();
  p.artboards[0].width = 256;
  p.artboards[0].height = 256;
  const root = addNode(p, "bone"),
    child = addNode(p, "bone", root),
    path = addNode(p, "rectangle");
  const r = p.nodes.find((n) => n.id === root);
  r.transform = [
    Math.SQRT1_2,
    Math.SQRT1_2,
    -Math.SQRT1_2,
    Math.SQRT1_2,
    80,
    90,
  ];
  r.geometry.length = 48;
  const n = p.nodes.find((n) => n.id === path);
  n.geometry = { width: 96, height: 48, fill: "#2864dc" };
  n.transform = [1, 0, 0, 1, 64, 104];
  convertRectangle(p, path);
  bindPath(p, path, [root, child]);
  return { p, root, child, path };
}
test("v1 migration validates and retains all old content", async () => {
  const p = createProject();
  p.schemaVersion = 1;
  delete p.animations;
  delete p.machines;
  addNode(p);
  const migrated = await openProject(await serializeProject(p));
  const expected = { ...p, schemaVersion: 2, animations: [], machines: [] };
  assert.deepEqual(migrated, expected);
  const unknown = { ...p, unknown: [] };
  await assert.rejects(
    openProject(JSON.stringify(unknown)),
    /unsupported field/,
  );
});
test("curve insertion is De Casteljau subdivision and carries stable point IDs", () => {
  const p = createProject(),
    id = addNode(p, "path"),
    g = p.nodes[0].geometry;
  const old = structuredClone(g.points),
    point = insertPoint(p, id, 0);
  assert.equal(g.points.length, 5);
  assert.equal(g.points[1].id, point);
  const curve = (a, b, t) =>
    [0, 1].map(
      (i) =>
        (1 - t) ** 3 * a.anchor[i] +
        3 * (1 - t) ** 2 * t * a.out[i] +
        3 * (1 - t) * t * t * b.in[i] +
        t ** 3 * b.anchor[i],
    );
  for (let i = 0; i <= 20; i++) {
    const t = i / 20,
      want = curve(old[0], old[1], t),
      actual =
        t <= 0.5
          ? curve(g.points[0], g.points[1], t * 2)
          : curve(g.points[1], g.points[2], (t - 0.5) * 2);
    actual.forEach((v, j) => assert(Math.abs(v - want[j]) < 1e-9));
  }
  validateProject(p);
});
test("quantized one-through-four influences always sum to 255 bytes", () => {
  for (const n of [1, 2, 3, 4])
    for (let k = 0; k < 50; k++) {
      const q = quantize(
        Array.from({ length: n }, (_, i) => ["b" + i, ((k + i * 7) % 19) + 1]),
      );
      assert.equal(
        q.reduce((sum, [b, w]) => sum + Math.round(w * 255), 0),
        255,
      );
    }
  assert.deepEqual(
    quantize([
      ["a", 0.5],
      ["b", 0.5],
    ]),
    [
      ["a", 128 / 255],
      ["b", 127 / 255],
    ],
  );
});
test("nonidentity binding leaves the rest pose unchanged; child tips and independently weighted handles deform correctly", () => {
  const { p, root, child, path } = rigScene(),
    n = p.nodes.find((n) => n.id === path);
  const rest = worldPoints(p, n);
  n.geometry.points.forEach((v, i) => {
    for (const key of ["anchor", "in", "out"]) {
      assert(Math.abs(rest[i][key][0] - v[key][0] - 64) < 1e-8);
      assert(Math.abs(rest[i][key][1] - v[key][1] - 104) < 1e-8);
    }
  });
  const point = n.geometry.points[0].id;
  setWeight(p, path, point, "out", child, 1);
  setWeight(p, path, point, "anchor", child, 0);
  const a = createAnimation(p, p.artboards[0].id);
  setKey(p, a, child, "rotation", 0, 0);
  setKey(p, a, child, "rotation", 60, Math.PI / 2);
  const pose = evaluate(p, a, 60),
    deformed = worldPoints(
      pose,
      pose.nodes.find((n) => n.id === path),
    );
  assert.deepEqual(
    p.nodes.find((n) => n.id === child).transform,
    [1, 0, 0, 1, 0, 0],
  );
  assert(Math.abs(deformed[0].anchor[0] - rest[0].anchor[0]) < 1e-8);
  assert(
    Math.hypot(
      deformed[0].out[0] - rest[0].out[0],
      deformed[0].out[1] - rest[0].out[1],
    ) > 10,
  );
  const before = worldTransform(p, child);
  p.nodes.find((n) => n.id === root).geometry.length += 10;
  const after = worldTransform(p, child);
  assert(Math.abs(after[4] - before[4] - 10 * Math.SQRT1_2) < 1e-8);
  validateProject(p);
});
test("deleting a referenced bone fails atomically; deleting paths cleans tracks and listeners", () => {
  const { p, root, path } = rigScene(),
    h = new History(p);
  assert.throws(
    () => h.transact("Delete", (q) => removeSubtree(q, root)),
    /unbind/,
  );
  assert.deepEqual(h.snapshot(), p);
  const a = createAnimation(p, p.artboards[0].id);
  setKey(p, a, path, "x", 0, 64);
  removeSubtree(p, path);
  assert.equal(p.animations[0].tracks.length, 0);
  validateProject(p);
});
test("linear, hold, cubic and color keys evaluate deterministically without writing defaults", () => {
  const p = createProject(),
    nId = addNode(p),
    a = createAnimation(p, p.artboards[0].id);
  setKey(p, a, nId, "x", 0, 0);
  setKey(p, a, nId, "x", 60, 100);
  setKey(p, a, nId, "fill", 0, "#ff0000");
  setKey(p, a, nId, "fill", 60, "#0000ff");
  const before = structuredClone(p),
    mid = evaluate(p, a, 30);
  assert.equal(mid.nodes[0].transform[4], 50);
  assert.equal(mid.nodes[0].geometry.fill, "#800080ff");
  assert.deepEqual(p, before);
  assert.deepEqual(evaluate(p, a, 30), mid);
  setKey(p, a, nId, "x", 0, 0, { type: "hold", curve: null });
  assert.equal(evaluate(p, a, 59).nodes[0].transform[4], 0);
  assert.equal(evaluate(p, a, 60).nodes[0].transform[4], 100);
  assert(
    Math.abs(
      easingValue({ type: "cubic", curve: [0.42, 0, 0.58, 1] }, 0.5) - 0.5,
    ) < 1e-8,
  );
});
test("typed machine conditions, transient triggers, listeners and reset preserve the source project", () => {
  const p = createProject(),
    node = addNode(p),
    a = createAnimation(p, p.artboards[0].id),
    b = createAnimation(p, p.artboards[0].id);
  setKey(p, a, node, "x", 0, 10);
  setKey(p, b, node, "x", 0, 100);
  const mId = createMachine(p, p.artboards[0].id),
    m = p.machines[0],
    input = { id: newId("input"), name: "go", type: "trigger", value: false },
    second = {
      id: newId("state"),
      name: "Active",
      animationId: b,
      position: [220, 50],
    };
  m.inputs.push(input);
  m.states.push(second);
  m.transitions.push({
    id: newId("transition"),
    fromId: m.entryStateId,
    toId: second.id,
    conditions: [{ inputId: input.id, op: "fire", value: null }],
  });
  m.listeners.push({
    id: newId("listener"),
    targetId: node,
    event: "click",
    inputId: input.id,
    value: null,
  });
  validateProject(p);
  const before = structuredClone(p),
    player = new MachinePlayer(p, mId);
  assert.equal(player.pose().nodes[0].transform[4], 10);
  assert.equal(player.click(node).nodes[0].transform[4], 100);
  assert.equal(player.inputs[input.id], false);
  player.reset();
  assert.equal(player.pose().nodes[0].transform[4], 10);
  assert.deepEqual(p, before);
});

test("scale tracks remain independent through reflection and zero; track order does not change a pose", () => {
  const p = createProject(),
    node = addNode(p),
    a = createAnimation(p, p.artboards[0].id);
  setKey(p, a, node, "scaleX", 0, 1);
  setKey(p, a, node, "scaleX", 60, -1);
  setKey(p, a, node, "scaleY", 0, 2);
  setKey(p, a, node, "scaleY", 60, 2);
  setKey(p, a, node, "rotation", 0, Math.PI / 4);
  setKey(p, a, node, "rotation", 60, Math.PI / 4);
  const mid = evaluate(p, a, 30);
  assert.equal(mid.nodes[0].transform[0], 0);
  assert.equal(mid.nodes[0].transform[1], 0);
  assert(Math.abs(mid.nodes[0].transform[2] + Math.SQRT2) < 1e-10);
  const end = evaluate(p, a, 60);
  p.animations[0].tracks.reverse();
  assert.deepEqual(evaluate(p, a, 60), {
    ...end,
    animations: structuredClone(p.animations),
  });
});

test("immediate machines settle guarded transition chains and consume triggers only once", () => {
  const p = createProject(),
    a = createAnimation(p, p.artboards[0].id),
    mId = createMachine(p, p.artboards[0].id),
    m = p.machines[0];
  const second = {
      id: newId("state"),
      name: "Second",
      animationId: a,
      position: [200, 50],
    },
    third = {
      id: newId("state"),
      name: "Third",
      animationId: a,
      position: [400, 50],
    },
    bool = {
      id: newId("input"),
      name: "active",
      type: "boolean",
      value: false,
    },
    trigger = { id: newId("input"), name: "go", type: "trigger", value: false };
  m.states.push(second, third);
  m.inputs.push(bool, trigger);
  m.transitions.push(
    {
      id: newId("transition"),
      fromId: m.entryStateId,
      toId: second.id,
      conditions: [{ inputId: trigger.id, op: "fire", value: null }],
    },
    {
      id: newId("transition"),
      fromId: second.id,
      toId: third.id,
      conditions: [{ inputId: bool.id, op: "eq", value: true }],
    },
  );
  const player = new MachinePlayer(p, mId);
  player.set(bool.id, true);
  player.set(trigger.id, true);
  player.advance(0);
  assert.equal(player.stateId, third.id);
  assert.equal(player.inputs[trigger.id], false);
  player.reset();
  player.set(trigger.id, true);
  player.advance(0);
  assert.equal(player.stateId, second.id);
});
