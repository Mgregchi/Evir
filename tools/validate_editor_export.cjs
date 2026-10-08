const fs = require("node:fs");
const assert = require("node:assert/strict");
const { run } = require("./browser.cjs");
const { capture } = require("./pixels.cjs");
const gpu = require("./gpu_diagnostics.cjs");
const inventory = require("../research/results/editor-export-inventory.json");
const backend = process.env.RIVE_RENDERER || "canvas";
run(async (page) => {
  await gpu.install(page);
  await page.reload();
  const records = [];
  const machines = [];
  fs.mkdirSync("research/results/editor-export-screenshots", {
    recursive: true,
  });
  for (const artboard of inventory.artboards) {
    const loaded = await page.evaluate(
      async (name) =>
        loadFixture("editor-corpus/sobo", {
          artboard: name,
          autoplay: false,
          autoBind: true,
        }),
      artboard.name,
    );
    assert.deepEqual(
      [...loaded.animations].sort(),
      artboard.animations.map((a) => a.name).sort(),
      `${artboard.name}: animation inventory mismatch`,
    );
    assert.deepEqual(
      [...loaded.machines].sort(),
      [...artboard.machines].sort(),
      `${artboard.name}: machine inventory mismatch`,
    );
    await page.waitForTimeout(150);
    await page.evaluate(() => player.drawFrame());
    const initial = await capture(page);
    assert(initial.count > 0, `${artboard.name} is empty`);
    const animation =
      artboard.animations.find((a) => a.name === "Idle") ||
      artboard.animations.find((a) => a.duration > 0);
    let sampled = null;
    if (animation) {
      await page.evaluate((name) => {
        player.scrub(name, 0.5);
        player.drawFrame();
      }, animation.name);
      await page.waitForTimeout(100);
      sampled = {
        animation: animation.name,
        seconds: 0.5,
        pixels: await capture(page),
      };
      assert(sampled.pixels.count > 0);
    }
    if (backend === "webgl2")
      await page.locator("#canvas").screenshot({
        path: `research/results/editor-export-screenshots/${artboard.name}.png`,
        omitBackground: true,
      });
    for (const machine of artboard.machines) {
      const machineLoad = await page.evaluate(
        async ({ artboard, machine }) =>
          loadFixture("editor-corpus/sobo", {
            artboard,
            stateMachines: machine,
            autoplay: true,
            autoBind: true,
          }),
        { artboard: artboard.name, machine },
      );
      await page.waitForTimeout(250);
      const playing = await page.evaluate(
        () => player.playingStateMachineNames,
      );
      assert(
        playing.includes(machine),
        `${artboard.name}/${machine} did not start`,
      );
      const pixels = await capture(page);
      assert(pixels.count > 0, `${artboard.name}/${machine} is empty`);
      machines.push({
        artboard: artboard.name,
        machine,
        loadMs: machineLoad.loadMs,
        playing,
        pixels,
        status: "passed",
      });
    }
    records.push({
      artboard: artboard.name,
      loaded,
      initial,
      sampled,
      status: "passed",
    });
    console.log(`${backend}: ${artboard.name} passed`);
  }
  const result = {
    sourceSha256: inventory.sha256,
    backend,
    runtimeVersion: "2.44.0",
    scope:
      "Every artboard loads and has nonempty authored/sampled pixels. Scrub uses the pinned deprecated API. No assertion of full visual equivalence, state-machine transition correctness, or hardware performance.",
    diagnostics: await gpu.collect(page),
    records,
    machines,
  };
  fs.writeFileSync(
    `research/results/editor-export-${backend}.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
