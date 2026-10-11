const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { PNG } = require("pngjs");
const { run } = require("../../tools/browser.cjs"),
  gpu = require("../../tools/gpu_diagnostics.cjs");
(async () => {
  await require("../../tools/prepare-oracle.cjs").prepare();
  const { paintScene } = await import("./paint-scenes.mjs"),
    { compileProject } = await import("@evir/format");
  const { p: source, linear, path, animation } = paintScene(),
    dir = "research/results/studio-gradients";
  fs.mkdirSync(dir, { recursive: true });
  const report = {
    checkedAt: new Date().toISOString(),
    runtimeVersion: "2.44.0",
    scope:
      "Automated cloud Chromium editing and software graphics; not physical-device, human or screen-reader evidence.",
    viewports: [],
    backends: [],
  };
  fs.writeFileSync(
    `${dir}/paint.evir-project`,
    JSON.stringify(source, null, 2) + "\n",
  );
  fs.writeFileSync(`${dir}/paint.riv`, compileProject(source).bytes);
  if (!process.env.EVIR_PAINT_ORACLE_ONLY)
    await run(async (page) => {
      const press = (name) => require("./actions.cjs").press(page, name),
        snapshot = () => page.evaluate(() => evirStudio.snapshot());
      for (const width of [320, 390, 844, 1024, 1440]) {
        await page.setViewportSize({
          width,
          height: width === 844 ? 390 : 844,
        });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("http://127.0.0.1:8776/apps/web/dist/editor/studio/");
        await page.waitForFunction(() => window.evirStudio);
        await page.locator("#file").setInputFiles({
          name: "paint.evir-project",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(source)),
        });
        await page.locator("#replace-confirm").click();
        if (width <= 850) await press("Layers");
        await press("Select Linear rectangle");
        if (width <= 850) await page.keyboard.press("Escape");
        if (width <= 850) await press("Properties");
        await press("Edit fill");
        const before = (await snapshot()).nodes;
        await page.getByLabel("End X", { exact: true }).fill("0");
        await page.getByLabel("End Y", { exact: true }).fill("0");
        await page.getByLabel("Start X", { exact: true }).fill("0");
        await page.getByLabel("Start Y", { exact: true }).fill("0");
        await press("Apply fill");
        assert.match(
          await page.locator("#paint-error").innerText(),
          /distinct/,
        );
        assert.deepEqual((await snapshot()).nodes, before);
        await page.getByLabel("End X", { exact: true }).fill("160");
        await page.getByLabel("End Y", { exact: true }).fill("120");
        await page
          .getByLabel("Fill type", { exact: true })
          .selectOption("radial");
        await press("Add stop");
        assert.equal(await page.locator("#paint-sheet fieldset").count(), 4);
        await page
          .getByLabel("Stop 2 color opacity (%)", { exact: true })
          .fill("50");
        await page.addScriptTag({
          path: require.resolve("axe-core/axe.min.js"),
        });
        assert.deepEqual(
          await page.evaluate(async () =>
            (
              await axe.run(document, {
                runOnly: {
                  type: "tag",
                  values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
                },
              })
            ).violations.map((v) => ({
              id: v.id,
              targets: v.nodes.map((n) => n.target),
            })),
          ),
          [],
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        const sheet = await page.locator("#paint-sheet").boundingBox();
        assert(sheet.x >= -1 && sheet.x + sheet.width <= width + 1);
        if (width === 390)
          await page.locator("#paint-sheet").evaluate((sheet) => {
            sheet.scrollTop = 0;
          });
        if (width === 390)
          await page.screenshot({ path: `${dir}/fill-sheet-390x844.png` });
        await press("Apply fill");
        await page.waitForSelector("#paint-sheet", { state: "detached" });
        assert.equal(
          await page.evaluate(() => document.activeElement.textContent),
          "Edit fill",
        );
        const painted = (await snapshot()).nodes.find((n) => n.id === linear)
          .geometry.fill;
        assert.equal(painted.type, "radial");
        assert.equal(painted.stops.length, 4);
        if (width <= 850) await page.keyboard.press("Escape");
        await press("Undo");
        assert.deepEqual((await snapshot()).nodes, before);
        await press("Redo");
        assert.deepEqual(
          (await snapshot()).nodes.find((n) => n.id === linear).geometry.fill,
          painted,
        );
        if (width <= 850) await press("Properties");
        await press("Edit fill");
        await page
          .getByLabel("Fill type", { exact: true })
          .selectOption("solid");
        await page.keyboard.press("Escape");
        assert.deepEqual(
          (await snapshot()).nodes.find((n) => n.id === linear).geometry.fill,
          painted,
        );
        await press("Edit fill");
        await page
          .getByLabel("Fill type", { exact: true })
          .selectOption("solid");
        await press("Apply fill");
        assert.equal(
          typeof (await snapshot()).nodes.find((n) => n.id === linear).geometry
            .fill,
          "string",
        );
        if (width <= 850) await page.keyboard.press("Escape");
        await press("Undo");
        // Path Inspector uses the same sheet. Cancel remains atomic.
        if (width <= 850) await press("Layers");
        await press("Select Radial path");
        if (width <= 850) {
          await page.keyboard.press("Escape");
          await press("Properties");
        }
        await press("Edit fill");
        await press("Cancel fill");
        assert.deepEqual(
          (await snapshot()).nodes.find((n) => n.id === linear).geometry.fill,
          painted,
        );
        if (width <= 850) await page.keyboard.press("Escape");
        const saved = page.waitForEvent("download");
        await press("Save project");
        const file = await saved;
        const actual = JSON.parse(fs.readFileSync(await file.path()));
        assert.deepEqual(
          actual.nodes.find((n) => n.id === linear).geometry.fill,
          painted,
        );
        const exported = page.waitForEvent("download");
        await press("Export .riv");
        assert.deepEqual(
          fs.readFileSync(await (await exported).path()),
          Buffer.from(compileProject(actual).bytes),
        );
        report.viewports.push({
          width,
          height: width === 844 ? 390 : 844,
          checks: [
            "invalid draft atomic",
            "type/endpoints/stops/opacity",
            "responsive sheet",
            "automated accessibility",
            "apply one undo",
            "focus returns",
            "cancel atomic",
            "path sheet",
            "saved source and exported bytes",
          ],
        });
      }
    });
  for (const backend of ["canvas", "webgl2"]) {
    process.env.RIVE_RENDERER = backend;
    await run(async (page) => {
      await gpu.install(page);
      await page.reload();
      const checks = [];
      for (const frame of [0, 30]) {
        await page.evaluate(() =>
          loadFixture("paint", {
            src: "/research/results/studio-gradients/paint.riv",
            autoplay: false,
            animations: "Turn",
          }),
        );
        await page.evaluate((frame) => {
          player.scrub("Turn", frame / 60);
          player.stopRendering();
          player.drawFrame();
        }, frame);
        const expected = await page.evaluate(
          async ({ p, id, frame }) => {
            const { drawScene, evaluate } = await import(
              "/tools/.test-build/oracle.mjs"
            );
            const c = document.createElement("canvas");
            c.width = c.height = 256;
            const ctx = c.getContext("2d");
            ctx.scale(0.5, 0.5);
            drawScene(ctx, evaluate(p, id, frame), p.artboards[0].id);
            return Array.from(ctx.getImageData(0, 0, 256, 256).data);
          },
          { p: source, id: animation, frame },
        );
        const actual =
          backend === "canvas"
            ? await page.evaluate(() =>
                Array.from(
                  document
                    .getElementById("canvas")
                    .getContext("2d")
                    .getImageData(0, 0, 256, 256).data,
                ),
              )
            : PNG.sync.read(
                await page
                  .locator("#canvas")
                  .screenshot({ omitBackground: true }),
              ).data;
        let total = 0;
        for (let i = 0; i < actual.length; i++)
          total += Math.abs(actual[i] - expected[i]);
        const mae = total / actual.length;
        checks.push({ frame, mae });
        console.log(backend, checks.at(-1));
        assert(
          mae < 2.5,
          `${backend} local gradient affine/alpha pixels ${mae}`,
        );
      }
      report.backends.push({
        backend,
        checks,
        diagnostics: await gpu.collect(page),
      });
    });
  }
  fs.writeFileSync(
    `${dir}/browser.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
