const assert = require("node:assert/strict");
const fs = require("node:fs");
const { run } = require("./browser.cjs");
const { capture, sample } = require("./pixels.cjs");
const gpu = require("./gpu_diagnostics.cjs");
const animations = ["Bone0", "Bone1", "Bone2", "Bone3"];
async function tick(page, dt = 0) {
  await page.evaluate((dt) => {
    player.animator.stateMachines[0].advanceAndApply(dt);
    player.drawFrame();
  }, dt);
  await page.waitForTimeout(30);
  return capture(page);
}
async function input(page, name, value) {
  await page.evaluate(
    ([n, v]) => {
      player.stateMachineInputs("Controller").find((i) => i.name === n).value =
        v;
    },
    [name, value],
  );
}
async function pause(page) {
  await page.evaluate(() => {
    player.pause();
    player.stopRendering();
  });
}
function xcheck(p, x) {
  assert(Math.abs(p.cx - (x - 0.5)) < 0.7, JSON.stringify({ expectedX: x, p }));
}
run(async (page) => {
  const backend = process.env.RIVE_RENDERER || "canvas";
  await gpu.install(page);
  await page.goto(
    "http://127.0.0.1:8776/tools/runtime.html?renderer=" + backend,
  );
  const names = [
    "plain-mesh",
    "weighted-mesh",
    "weighted-mesh-rotation",
    "rml-weighted-mesh",
    "data-binding",
    "rml-data-binding",
    "timed-transition",
    "exit-time",
    "disabled-transition",
    "condition-conjunction",
    "pointer-enter-exit",
    "pointer-number",
    "reentry-reset-flag",
    "reentry-default",
    "feather-curve",
    "feather-hole",
    "feather-gradient",
    "feather-stroke",
    "invalid-mesh-index",
  ];
  const results = [];
  for (const name of names) {
    if (name.startsWith("feather-") && backend === "canvas") {
      results.push({
        fixture: name,
        status: "unrun-unsupported-backend",
        reason: "Vector feathering requires the Rive Renderer",
      });
      continue;
    }
    if (name === "invalid-mesh-index") {
      const rejected = await page.evaluate(() =>
        loadFixture("closure/invalid-mesh-index").then(
          () => false,
          () => true,
        ),
      );
      assert(rejected, "official runtime rejects out-of-range triangle index");
      results.push({
        fixture: name,
        status: "confirmed-rejected-invalid-index",
      });
      continue;
    }
    const mesh = name.includes("weighted-mesh");
    const rotation = name === "weighted-mesh-rotation";
    const meshAnimations = rotation ? ["Rotate"] : animations;
    const binding = name.includes("data-binding");
    const machine = !name.includes("mesh") && !name.startsWith("feather-");
    const options = mesh
      ? { animations: meshAnimations, autoplay: false }
      : machine
        ? {
            stateMachines: "Controller",
            autoBind: binding,
            autoplay: binding || name.startsWith("pointer-"),
          }
        : {};
    const info = await page.evaluate(
      ([n, o]) => loadFixture("closure/" + n, o),
      [name, options],
    );
    await page.waitForTimeout(100);
    if (mesh) {
      await page.evaluate(() => {
        for (const a of player.animationNames) player.scrub(a, 0);
        player.drawFrame();
      });
      await page.waitForTimeout(80);
    }
    const initial = await capture(page);
    assert(initial.count > 0, name + " renders");
    const r = { fixture: name, info, initial, status: "passed" };
    if (name === "plain-mesh") {
      assert.equal(initial.count, 128 * 128);
      r.colors = [];
      for (const [x, y, want] of [
        [80, 80, [240, 40, 40]],
        [176, 80, [40, 220, 60]],
        [80, 176, [40, 80, 240]],
        [176, 176, [240, 220, 40]],
      ]) {
        const c = await sample(page, x, y);
        assert.deepEqual(c, want.concat(255));
        r.colors.push({ x, y, color: c });
      }
    }
    if (mesh) {
      await page.evaluate(() => {
        player.pause();
        for (const a of player.animationNames) player.scrub(a, 0);
      });
      await page.waitForTimeout(60);
      r.bind = await capture(page);
      assert.equal(r.bind.count, 128 * 128);
      xcheck(r.bind, 128);
      await page.evaluate(() => {
        for (const a of player.animationNames) player.scrub(a, 0.5);
      });
      await page.waitForTimeout(60);
      r.deformed = await capture(page);
      if (rotation) {
        const points = [
          [64, 64],
          [128, 64],
          [192, 64],
          [192, 128],
          [192, 192],
          [128, 192],
          [64, 192],
          [64, 128],
        ];
        const weights = [1, 128 / 255, 0, 0, 0, 0, 0, 127 / 255];
        const c = Math.SQRT1_2;
        const polygon = points.map(([x, y], i) => [
          x * (1 - weights[i]) +
            (128 + c * (x - 128) - c * (y - 128)) * weights[i],
          y * (1 - weights[i]) +
            (128 + c * (x - 128) + c * (y - 128)) * weights[i],
        ]);
        let twiceArea = 0,
          cx = 0,
          cy = 0;
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i],
            b = polygon[(i + 1) % polygon.length],
            cross = a[0] * b[1] - b[0] * a[1];
          twiceArea += cross;
          cx += (a[0] + b[0]) * cross;
          cy += (a[1] + b[1]) * cross;
        }
        r.analytic = {
          area: twiceArea / 2,
          cx: cx / (3 * twiceArea),
          cy: cy / (3 * twiceArea),
        };
        assert(Math.abs(r.deformed.count - r.analytic.area) < 384);
        assert(Math.abs(r.deformed.cx - (r.analytic.cx - 0.5)) < 1);
        assert(Math.abs(r.deformed.cy - (r.analytic.cy - 0.5)) < 1);
        assert.equal(
          (await sample(page, 80, 80))[3],
          0,
          "rotating the weighted corner around its nonzero bind origin moves its old pixels",
        );
      } else {
        assert(Math.abs(r.deformed.count - 19456) < 256);
        xcheck(r.deformed, 128);
        assert(Math.abs(r.deformed.cy - 151.5) < 1);
        r.samples = [];
        for (const [x, y, want] of [
          [80, 80, [240, 40, 40, 255]],
          [180, 80, [0, 0, 0, 0]],
          [120, 148, [240, 40, 40, 255]],
          [120, 156, [40, 80, 240, 255]],
          [190, 230, [240, 220, 40, 255]],
          [80, 208, [40, 80, 240, 255]],
        ]) {
          const c = await sample(page, x, y);
          assert.deepEqual(c, want);
          r.samples.push({ x, y, color: c });
        }
      }
    }

    if (binding) {
      assert.equal(initial.count, 48 * 48);
      xcheck(initial, 64);
      await page.evaluate(() => {
        const v = player.viewModelInstance;
        if (!v) throw Error("No bound view model");
        v.number("positionX").value = 160;
        v.number("width").value = 80;
        v.color("color").value = 0xffff0000;
        v.boolean("active").value = true;
      });
      await page.waitForTimeout(100);
      r.changed = await capture(page);
      assert.equal(r.changed.count, 80 * 48);
      xcheck(r.changed, 160);
      assert(Math.abs(r.changed.cy - 79.5) < 1);
      assert.deepEqual(await sample(page, 160, 80), [255, 0, 0, 255]);
      await page.evaluate(
        () => (player.viewModelInstance.boolean("active").value = false),
      );
      await page.waitForTimeout(100);
      r.returned = await capture(page);
      assert(Math.abs(r.returned.cy - 127.5) < 1);
      const box = await page.locator("#canvas").boundingBox();
      await page.mouse.click(box.x + 160, box.y + 128);
      await page.waitForTimeout(100);
      assert.equal(
        await page.evaluate(
          () => player.viewModelInstance.boolean("active").value,
        ),
        true,
      );
      r.listener = await capture(page);
      assert(Math.abs(r.listener.cy - 79.5) < 1);
      await page.evaluate(() => {
        player.bindViewModelInstance(
          player.viewModelByName("Model").defaultInstance(),
        );
      });
      await page.waitForTimeout(100);
      r.freshInstance = await capture(page);
      assert.equal(r.freshInstance.count, 48 * 48);
      xcheck(r.freshInstance, 64);
      assert(Math.abs(r.freshInstance.cy - 127.5) < 1);
    }
    if (
      [
        "timed-transition",
        "exit-time",
        "disabled-transition",
        "condition-conjunction",
      ].includes(name)
    ) {
      await pause(page);
      await input(page, "active", true);
      r.ticks = [];
      if (name === "condition-conjunction") {
        for (const [active, level, want] of [
          [false, 75, 64],
          [true, 50, 64],
          [true, 49, 64],
          [true, 51, 192],
        ]) {
          await input(page, "active", active);
          await input(page, "level", level);
          const p = await tick(page);
          xcheck(p, want);
          r.ticks.push({ active, level, pixels: p });
        }
      } else {
        let elapsed = 0;
        for (const dt of [0, 0.1, 0.1, 0.1, 0.1, 0.2]) {
          elapsed += dt;
          const p = await tick(page, dt);
          const want =
            name === "timed-transition"
              ? 64 + 128 * Math.min(1, elapsed / 0.4)
              : name === "exit-time" && elapsed >= 0.5
                ? 192
                : 64;
          xcheck(p, want);
          r.ticks.push({ elapsed, pixels: p });
        }
      }
    }
    if (name === "pointer-enter-exit") {
      const box = await page.locator("#canvas").boundingBox();
      await page.mouse.move(box.x + 64, box.y + 128);
      await page.waitForTimeout(80);
      r.entered = await capture(page);
      xcheck(r.entered, 192);
      await page.mouse.move(box.x + 8, box.y + 8);
      await page.waitForTimeout(80);
      r.exited = await capture(page);
      xcheck(r.exited, 64);
    }
    if (name === "pointer-number") {
      const box = await page.locator("#canvas").boundingBox();
      await page.mouse.click(box.x + 64, box.y + 128);
      await page.waitForTimeout(80);
      assert.equal(
        await page.evaluate(
          () =>
            player
              .stateMachineInputs("Controller")
              .find((i) => i.name === "level").value,
        ),
        75,
      );
      r.level = 75;
    }
    if (name.startsWith("reentry-")) {
      await pause(page);
      await input(page, "active", true);
      xcheck(await tick(page), 64);
      r.progress = await tick(page, 0.25);
      xcheck(r.progress, 96);
      await input(page, "active", false);
      xcheck(await tick(page), 64);
      await input(page, "active", true);
      r.reentered = await tick(page);
      xcheck(r.reentered, 64);
      r.progressAgain = await tick(page, 0.25);
      xcheck(r.progressAgain, 96);
    }
    if (name === "feather-curve") {
      assert(initial.count > Math.PI * 64 * 64);
      const c = await sample(page, 128, 128),
        edge = await sample(page, 196, 128),
        far = await sample(page, 224, 128);
      assert.equal(c[3], 255);
      assert(edge[3] > 0 && edge[3] < 255);
      assert.equal(far[3], 0);
      r.colors = { c, edge, far };
    }
    if (name === "feather-hole") {
      const c = await sample(page, 128, 128),
        edge = await sample(page, 94, 128),
        outer = await sample(page, 44, 128),
        solid = await sample(page, 72, 128);
      assert.equal(c[3], 0);
      assert(edge[3] > 0 && edge[3] < 255);
      assert(outer[3] > 0 && outer[3] < 255);
      assert.equal(solid[3], 255);
      r.colors = { c, edge, outer, solid };
    }
    if (name === "feather-gradient") {
      const left = await sample(page, 80, 128),
        right = await sample(page, 176, 128),
        edge = await sample(page, 128, 92);
      assert(left[0] > left[2] && right[2] > right[0]);
      assert(edge[3] > 0 && edge[3] < 255);
      r.colors = { left, right, edge };
    }
    if (name === "feather-stroke") {
      const on = await sample(page, 96, 96),
        side = await sample(page, 96, 106),
        far = await sample(page, 96, 140);
      assert(on[3] > side[3] && side[3] > 0);
      assert.equal(far[3], 0);
      r.colors = { on, side, far };
    }
    if (name === "rml-weighted-mesh") {
      const reference = results.find((r) => r.fixture === "weighted-mesh");
      assert.equal(r.bind.hash, reference.bind.hash);
      assert.equal(r.deformed.hash, reference.deformed.hash);
    }
    if (name === "rml-data-binding") {
      const reference = results.find((r) => r.fixture === "data-binding");
      for (const pose of ["initial", "changed", "returned", "freshInstance"])
        assert.equal(r[pose].hash, reference[pose].hash);
    }
    results.push(r);
    console.log(backend, name, "PASS");
  }
  const diagnostics = await gpu.collect(page);
  for (const c of diagnostics.contexts)
    assert(!c.contextLost && c.errors.length === 0);
  fs.writeFileSync(
    "research/results/closure-validation-" + backend + ".json",
    JSON.stringify(
      { runtime: "@rive-app/" + backend + " 2.44.0", diagnostics, results },
      null,
      2,
    ) + "\n",
  );
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
