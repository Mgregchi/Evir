import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compileProject } from "@evir/format";
import { createProject } from "@evir/project-model";
import { addNode } from "@evir/authoring";
import { scenes } from "./scenes.mjs";
const schema = JSON.parse(
  fs.readFileSync(
    new URL("../../packages/format/schema/runtime.json", import.meta.url),
  ),
);
test("compiler preserves source, produces stable bytes and explicit component/source namespaces", () => {
  const { p, root, child, path, a, m } = scenes(),
    before = structuredClone(p),
    first = compileProject(p, schema),
    second = compileProject(p, schema);
  assert.deepEqual(first.bytes, second.bytes);
  assert.deepEqual(p, before);
  assert.equal(new TextDecoder().decode(first.bytes.slice(0, 4)), "RIVE");
  assert.equal(first.mapping.nodes[root].type, "RootBone");
  assert.equal(first.mapping.nodes[child].type, "Bone");
  assert.equal(first.mapping.nodes[path].type, "Shape");
  assert.equal(first.mapping.animations[a].index, 0);
  assert.equal(first.mapping.machines[m].index, 0);
  assert.equal(
    Object.keys(first.mapping.points).length,
    p.nodes.find((n) => n.id === path).geometry.points.length,
  );
});
test("unsupported assets, shear, singular transforms and float32 overflow fail before download", () => {
  const p = createProject(),
    id = addNode(p);
  p.nodes[0].name = "Skewed";
  p.nodes[0].transform = [1, 0, 0.5, 1, 0, 0];
  assert.throws(() => compileProject(p, schema), /Skewed: shear/);
  p.nodes[0].transform = [0, 0, 0, 1, 0, 0];
  assert.throws(() => compileProject(p, schema), /singular/);
  p.nodes[0].transform = [1, 0, 0, 1, 1e100, 0];
  assert.throws(() => compileProject(p, schema), /float32/);
  p.nodes[0].transform = [1, 0, 0, 1, 0, 0];
  p.assets.push({
    id: "asset",
    name: "Bytes",
    mimeType: "application/octet-stream",
    sha256: "0".repeat(64),
    data: "AA==",
  });
  assert.throws(() => compileProject(p, schema), /Attached assets/);
});

test("source IDs remain opaque even when they match JavaScript prototype names", () => {
  const p = createProject(),
    id = addNode(p);
  p.nodes.find((n) => n.id === id).id = "__proto__";
  const result = compileProject(p, schema),
    map = JSON.parse(JSON.stringify(result.mapping));
  assert(Object.hasOwn(map.nodes, "__proto__"));
  assert.equal(map.nodes.__proto__.type, "Shape");
});
