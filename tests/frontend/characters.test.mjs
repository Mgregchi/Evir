import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { characterIds } from "../../apps/web/examples.mjs";
import { validateProject } from "@evir/project-model";
import { compileProject } from "@evir/format";
import { createRuntime, evaluate } from "@evir/runtime";
import { worldPoints } from "@evir/runtime/geometry";
const source = (id) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../apps/web/assets/examples/${id}.evir-project`,
        import.meta.url,
      ),
    ),
  );
for (const id of characterIds)
  test(`${id}: original curves stay editable, all expression transitions reset pose, loops keep moving`, () => {
    const p = source(id);
    validateProject(p);
    assert.equal(p.assets.length, 0);
    assert(p.nodes.every((n) => ["path", "group", "bone"].includes(n.kind)));
    assert(
      p.nodes.filter(
        (n) =>
          n.kind === "path" &&
          n.geometry.points.some(
            (v) =>
              v.in.some((a, i) => a !== v.anchor[i]) ||
              v.out.some((a, i) => a !== v.anchor[i]),
          ),
      ).length >= 15,
    );
    assert(p.nodes.some((n) => n.id === `${id}-left-eye`));
    assert(p.nodes.some((n) => n.name === "smile"));
    assert.deepEqual(
      p.animations.map((a) => a.name),
      ["Calm", "Hello", "Delight"],
    );
    assert(p.animations.every((a) => a.loop && a.duration === 120));
    assert.deepEqual(
      Buffer.from(compileProject(p).bytes),
      readFileSync(
        new URL(`../../apps/web/assets/examples/${id}.riv`, import.meta.url),
      ),
    );
    const r = createRuntime(p, { machineId: p.machines[0].id });
    for (const expression of [0, 1, 2, 0, 2, 1, 0]) {
      r.setInput("expression", expression);
      assert.equal(r.state.name, p.animations[expression].name);
      assert.deepEqual(
        r.pose().nodes,
        evaluate(p, p.animations[expression].id, 0).nodes,
      );
      const start = JSON.stringify(r.pose().nodes);
      r.advance(0.5);
      assert.notEqual(JSON.stringify(r.pose().nodes), start);
    }
    r.setInput("expression", 2);
    r.reset();
    assert.equal(r.state.name, "Calm");
    assert.deepEqual(r.pose().nodes, evaluate(p, p.animations[0].id, 0).nodes);
    const eye = p.nodes.find((n) => n.id === `${id}-left-eye`);
    assert(
      evaluate(p, p.animations[0].id, 46).nodes.find((n) => n.id === eye.id)
        .transform[3] < 0.1,
    );
  });
test("Nura scarf has differing control weights and deforms relative to the body", () => {
  const p = source("nura"),
    n = p.nodes.find((n) => n.id === "nura-floating-scarf");
  assert.equal(n.geometry.skin.bones.length, 2);
  assert(
    n.geometry.skin.weights.some(
      (w) => JSON.stringify(w.anchor) !== JSON.stringify(w.out),
    ),
  );
  const before = worldPoints(evaluate(p, "nura-hello", 0), n),
    after = worldPoints(evaluate(p, "nura-hello", 60), n);
  assert(
    after.some(
      (v, i) =>
        Math.hypot(
          v.anchor[0] - before[i].anchor[0],
          v.anchor[1] - before[i].anchor[1],
        ) > 2,
    ),
  );
});
