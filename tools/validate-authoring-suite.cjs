const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { PNG } = require("pngjs");
const { run } = require("./browser.cjs");
const { createHash } = require("node:crypto");
const gpu = require("./gpu_diagnostics.cjs");
(async () => {
  await require("./prepare-oracle.cjs").prepare();
  const { generate } = await import("./generate-authoring-suite.mjs"),
    projects = await generate(),
    results = [];
  let browserVersion, diagnostics;
  await run(async (page, browser) => {
    browserVersion = browser.version();
    await gpu.install(page);
    await page.reload();
    for (const p of projects) {
      const options = p.animations.length
        ? { animations: p.animations[0].name }
        : {};
      await page.evaluate(
        async ({ name, options }) => {
          await loadFixture("advanced-authoring/" + name, {
            autoplay: false,
            ...options,
          });
          player.stopRendering();
          player.drawFrame();
          player.stopRendering();
        },
        { name: p.name, options },
      );
      for (const frame of [0, 30, 60]) {
        if (p.animations.length)
          await page.evaluate(
            ([name, seconds]) => {
              player.scrub(name, seconds);
              player.drawFrame();
              player.stopRendering();
            },
            [p.animations[0].name, frame / 60],
          );
        const expected = await page.evaluate(
          async ({ p, frame }) => {
            const { evaluate, CanvasRenderer } = await import(
              "/tools/.test-build/oracle.mjs"
            );
            const c = document.createElement("canvas");
            c.width = c.height = 256;
            const r = new CanvasRenderer(c.getContext("2d"));
            await r.prepare(p);
            r.draw(evaluate(p, p.animations[0]?.id, frame), p.artboards[0].id);
            const data = Array.from(
              c.getContext("2d").getImageData(0, 0, 256, 256).data,
            );
            r.dispose();
            return data;
          },
          { p, frame },
        );
        const backend = process.env.RIVE_RENDERER || "canvas";
        const actual =
          backend === "canvas"
            ? await page.evaluate(() =>
                Array.from(
                  document
                    .querySelector("#canvas")
                    .getContext("2d")
                    .getImageData(0, 0, 256, 256).data,
                ),
              )
            : Array.from(
                PNG.sync.read(
                  await page
                    .locator("#canvas")
                    .screenshot({ omitBackground: true }),
                ).data,
              );
        let mae = 0,
          count = 0;
        for (let i = 0; i < actual.length; i++) {
          mae += Math.abs(expected[i] - actual[i]);
          if (i % 4 === 3 && actual[i]) count++;
        }
        mae /= actual.length;
        const row = { scene: p.name, frame, mae, covered: count, backend };
        results.push(row);
        console.log(row);
        if (p.name !== "halo") {
          assert(count > 0, p.name + " has visible output");
          assert(mae < 3, p.name + " visual comparison");
        } else {
          assert(count > 0, "feather fixture remains visible");
          assert(
            mae < (backend === "webgl2" ? 6 : 17),
            "documented feather approximation stays within measured envelope",
          );
          row.comparison =
            "Approximate Canvas blur; Canvas oracle ignores feather; WebGL2 oracle feathers";
        }
      }
    }
    const source = projects.find((p) => p.name === "blend");
    await page.evaluate(async (p) => {
      await loadFixture("advanced-authoring/blend", {
        autoplay: false,
        stateMachines: "Motion",
      });
      player.stopRendering();
      const { createRuntime } = await import("/tools/.test-build/oracle.mjs");
      window.evirMotion = createRuntime(p, { machineId: p.machines[0].id });
      player.animator.stateMachines[0].advanceAndApply(0);
      player.lastRenderTime = document.timeline.currentTime;
      player.drawFrame();
      player.stopRendering();
      evirMotion.setInput("position", 1);
      evirMotion.setInput("active", true);
      const inputs = player.stateMachineInputs("Motion");
      inputs.find((i) => i.name === "position").value = 1;
      inputs.find((i) => i.name === "active").value = true;
    }, source);
    for (const [dt, level] of [
      [0, null],
      [0.1, null],
      [0.1, null],
      [0.2, null],
      [0.2, null],
      [0, 0.25],
    ]) {
      const expected = await page.evaluate(
        async ({ dt, level }) => {
          if (level !== null) {
            evirMotion.setInput("position", level);
            player
              .stateMachineInputs("Motion")
              .find((i) => i.name === "position").value = level;
          }
          player.animator.stateMachines[0].advanceAndApply(dt);
          player.lastRenderTime = document.timeline.currentTime;
          player.drawFrame();
          player.stopRendering();
          const { CanvasRenderer } = await import(
            "/tools/.test-build/oracle.mjs"
          );
          const c = document.createElement("canvas");
          c.width = c.height = 256;
          const renderer = new CanvasRenderer(c.getContext("2d"));
          renderer.draw(evirMotion.advance(dt), evirMotion.artboard.id);
          return Array.from(
            c.getContext("2d").getImageData(0, 0, 256, 256).data,
          );
        },
        { dt, level },
      );
      const backend = process.env.RIVE_RENDERER || "canvas",
        actual =
          backend === "canvas"
            ? await page.evaluate(() =>
                Array.from(
                  document
                    .querySelector("#canvas")
                    .getContext("2d")
                    .getImageData(0, 0, 256, 256).data,
                ),
              )
            : Array.from(
                PNG.sync.read(
                  await page
                    .locator("#canvas")
                    .screenshot({ omitBackground: true }),
                ).data,
              );
      const mae =
        actual.reduce((sum, v, i) => sum + Math.abs(v - expected[i]), 0) /
        actual.length;
      assert(mae < 1, "timed machine and blend pixels agree");
      results.push({ scene: "blend-machine", dt, level, mae, backend });
    }
    diagnostics = await gpu.collect(page);
  });
  fs.mkdirSync("research/results/advanced-authoring", { recursive: true });
  fs.writeFileSync(
    `research/results/advanced-authoring/${process.env.RIVE_RENDERER || "canvas"}.json`,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        runtimeVersion: "2.44.0",
        browserVersion,
        diagnostics,
        fixtures: Object.fromEntries(
          projects.map((p) => [
            p.name,
            Object.fromEntries(
              ["evir-project", "riv"].map((extension) => [
                extension,
                createHash("sha256")
                  .update(
                    fs.readFileSync(
                      `research/fixtures/advanced-authoring/${p.name}.${extension}`,
                    ),
                  )
                  .digest("hex"),
              ]),
            ),
          ]),
        ),
        environment:
          "headless Chromium; software rendering; no physical-device evidence",
        results,
      },
      null,
      2,
    ) + "\n",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
