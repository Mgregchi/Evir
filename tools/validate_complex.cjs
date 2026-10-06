const assert = require("node:assert/strict");
const fs = require("node:fs");
const { run } = require("./browser.cjs");
const { capture, sample } = require("./pixels.cjs");
const gpu = require("./gpu_diagnostics.cjs");

run(async (page) => {
  const backend = process.env.RIVE_RENDERER || "canvas";
  await gpu.install(page);
  await page.goto(
    "http://127.0.0.1:8776/tools/runtime.html?renderer=" + backend,
  );
  const results = [];
  const names = [
    "nonzero-same",
    "nonzero-opposite",
    "evenodd-same",
    "evenodd-opposite",
    "self-intersection",
    "overlap-red-blue",
    "overlap-blue-red",
    "nested-clip",
    "round-stroke",
    "radial-gradient",
    "direct-blend",
    "layers",
    "rml-winding",
    "rml-direct-blend",
  ];
  for (const name of names) {
    const direct = name.endsWith("direct-blend");
    const options = direct
      ? { stateMachines: "Direct", autoplay: false }
      : name === "layers"
        ? { stateMachines: "Layers" }
        : {};
    await page.evaluate(
      ([name, options]) => loadFixture("complex/" + name, options),
      [name, options],
    );
    await page.waitForTimeout(100);
    const pixels = await capture(page);
    assert(pixels.count > 0, name + " renders");
    const record = { fixture: name, pixels, status: "passed" };
    if (
      name.includes("zero-") ||
      name.includes("evenodd-") ||
      name === "rml-winding"
    ) {
      const hole = name !== "nonzero-same";
      assert.equal(pixels.count, 160 * 160 - (hole ? 64 * 64 : 0));
      assert.equal((await sample(page, 128, 128))[3], hole ? 0 : 255);
      assert.equal((await sample(page, 64, 128))[3], 255);
      if (name === "rml-winding") {
        await page.evaluate(() => loadFixture("complex/evenodd-same"));
        await page.waitForTimeout(100);
        assert.equal(
          pixels.hash,
          (await capture(page)).hash,
          "official winding export equals independent scene",
        );
      }
    }
    if (name === "self-intersection") {
      assert(Math.abs(pixels.count - (128 * 128) / 2) <= 256);
      assert.equal((await sample(page, 128, 80))[3], 255);
      assert.equal((await sample(page, 80, 128))[3], 0);
    }
    if (name.startsWith("overlap-")) {
      assert.equal(pixels.count, 144 * 96);
      const center = await sample(page, 128, 128);
      const left = await sample(page, 80, 128);
      const right = await sample(page, 176, 128);
      const redFirst = name === "overlap-red-blue";
      // Drawables are stacked in reverse declaration order: the first shape is on top.
      const expected = redFirst ? [170, 0, 85, 192] : [85, 0, 170, 192];
      expected.forEach((v, i) =>
        assert(Math.abs(center[i] - v) <= 1, "source-over alpha and order"),
      );
      assert.equal(left[3], 128);
      assert.equal(right[3], 128);
      record.colors = { center, left, right };
    }
    if (name === "nested-clip") {
      assert.equal(pixels.count, 96 * 64);
      assert.equal((await sample(page, 128, 128))[3], 255);
      for (const [x, y] of [
        [64, 128],
        [128, 80],
      ])
        assert.equal((await sample(page, x, y))[3], 0);
    }
    if (name === "round-stroke") {
      assert(Math.abs(pixels.count - (128 * 16 + Math.PI * 8 * 8)) < 100);
      assert.equal(
        (await sample(page, 58, 128))[3],
        255,
        "round cap extends beyond endpoint",
      );
      assert.equal((await sample(page, 54, 128))[3], 0);
      assert.equal((await sample(page, 128, 128))[3], 255);
    }
    if (name === "radial-gradient") {
      const center = await sample(page, 128, 128),
        edge = await sample(page, 186, 128);
      assert(
        center[0] > 240 && center[2] < 15 && edge[2] > 220 && edge[0] < 35,
      );
      assert.equal(center[3], 255);
      record.colors = { center, edge };
    }
    if (name === "layers") {
      assert.equal(pixels.count, 48 * 48);
      assert(
        Math.abs(pixels.cx - 159.5) < 1 && Math.abs(pixels.cy - 79.5) < 1,
        "both layers apply independent properties",
      );
    }
    if (direct) {
      record.sequences = [];
      // Private pinned-package harness access gives deterministic ticks without RAF timing.
      for (const values of [
        [100, 0],
        [75, 25],
        [50, 50],
        [25, 75],
        [0, 100],
        [200, -50],
        [0, 0],
        [100, 100],
      ]) {
        await page.evaluate(
          ([name, values]) =>
            loadFixture("complex/" + name, {
              stateMachines: "Direct",
              autoplay: false,
            }).then(() => {
              player.pause();
              player.stopRendering();
              const inputs = player.stateMachineInputs("Direct");
              inputs[0].value = values[0];
              inputs[1].value = values[1];
            }),
          [name, values],
        );
        let x = 64;
        const ticks = [];
        const [a, b] = values.map((v) => Math.max(0, Math.min(1, v / 100)));
        for (let tick = 1; tick <= 4; tick++) {
          x = (x * (1 - a) + 64 * a) * (1 - b) + 192 * b;
          await page.evaluate(() => {
            player.animator.stateMachines[0].advanceAndApply(0);
            player.drawFrame();
          });
          await page.waitForTimeout(30);
          const p = await capture(page);
          assert(
            Math.abs(p.cx - (x - 0.5)) <= 0.6,
            JSON.stringify({ name, values, tick, x, p }),
          );
          ticks.push({ tick, expectedX: x, pixels: p });
        }
        record.sequences.push({ inputs: values, ticks });
      }
    }
    results.push(record);
    console.log(backend, name, "PASS");
  }
  const diagnostics = await gpu.collect(page);
  for (const c of diagnostics.contexts)
    assert(!c.contextLost && c.errors.length === 0);
  fs.writeFileSync(
    "research/results/complex-validation-" + backend + ".json",
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
