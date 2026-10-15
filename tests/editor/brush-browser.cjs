const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { createHash } = require("node:crypto"),
  { PNG } = require("pngjs");
const { run } = require("../../tools/browser.cjs"),
  gpu = require("../../tools/gpu_diagnostics.cjs");
(async () => {
  await require("../../tools/prepare-oracle.cjs").prepare();
  const { createProject } = await import("@evir/project-model"),
    { addNode } = await import("@evir/authoring");
  const { compileProject } = await import("@evir/format");
  const source = createProject(),
    parent = addNode(source, "group");
  source.nodes[0].name = "Brush group";
  source.nodes[0].transform = [0, 1.2, -0.8, 0, 320, 80];
  const output = "research/results/pressure-brush";
  fs.mkdirSync(output, { recursive: true });
  const report = {
    checkedAt: new Date().toISOString(),
    runtimeVersion: "2.44.0",
    scope:
      "Cloud Chromium synthetic pen pressure, mouse/touch and automated WCAG checks. No physical pen/device or human evidence.",
    viewports: [],
    oracles: [],
  };
  let authored, exported;
  await run(async (page) => {
    await gpu.install(page);
    const press = (name) => require("./actions.cjs").press(page, name);
    const snapshot = () => page.evaluate(() => evirStudio.snapshot());
    for (const [width, height] of [
      [320, 844],
      [390, 844],
      [844, 390],
      [1440, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("http://127.0.0.1:8776/apps/web/dist/editor/studio/");
      await page.waitForFunction(() => window.evirStudio);
      await page
        .locator("#file")
        .setInputFiles({
          name: "brush.evir-project",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(source)),
        });
      await page.locator("#replace-confirm").click();
      await press("Fit");
      if (width <= 850) await press("Layers");
      await press("Select Brush group");
      if (width <= 850) await page.keyboard.press("Escape");
      await page.locator("#stage").focus();
      await page.keyboard.press("b");
      await press("Drawing options");
      await page.getByLabel("Draw as", { exact: true }).selectOption("brush");
      assert(await page.locator("#drawing-closed-field").isHidden());
      const field = page.getByLabel("Width (artboard units)", { exact: true });
      for (const value of ["", "0", "257"]) {
        await field.fill(value);
        await press("Apply drawing options");
        assert.match(await page.locator("#drawing-error").innerText(), /width/);
      }
      await field.fill("30");
      await page
        .getByLabel("Smoothing (screen pixels)", { exact: true })
        .fill("0.5");
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const axeCheck = async () =>
        assert.deepEqual(
          await page.evaluate(async () =>
            (
              await axe.run(document, {
                runOnly: {
                  type: "tag",
                  values: [
                    "wcag2a",
                    "wcag2aa",
                    "wcag21a",
                    "wcag21aa",
                    "wcag22aa",
                  ],
                },
              })
            ).violations.map((v) => ({
              id: v.id,
              targets: v.nodes.map((n) => n.target),
            })),
          ),
          [],
        );
      await axeCheck();
      const action = await page.locator("#drawing-apply").boundingBox();
      assert(
        action.y >= 0 && action.y + action.height <= height,
        "drawing actions stay in the viewport",
      );
      if (width <= 850)
        assert.equal(
          Math.round(
            (await page.locator("#drawing-sheet").boundingBox()).width,
          ),
          width,
        );
      await page.screenshot({
        path: `${output}/options-${width}x${height}.png`,
      });
      await press("Apply drawing options");
      assert(
        await page
          .locator("#drawing-options")
          .evaluate((el) => el === document.activeElement),
      );
      const screen = async (x, y) => {
        const p = await snapshot(),
          c = p.editor.cameras[p.artboards[0].id],
          r = await page.locator("#stage").boundingBox();
        return { x: r.x + c.x + x * c.zoom, y: r.y + c.y + y * c.zoom };
      };
      const cdp = await page.context().newCDPSession(page);
      const pen = async (type, x, y, force) =>
        cdp.send("Input.dispatchMouseEvent", {
          type,
          ...(await screen(x, y)),
          pointerType: "pen",
          button: type === "mouseMoved" ? "none" : "left",
          buttons: type === "mouseReleased" ? 0 : 1,
          force,
        });
      const drawPen = async () => {
        await pen("mousePressed", 80, 160, 0.1);
        const before = await page.locator("#selection-status").textContent();
        await page
          .locator("#stage")
          .evaluate((el) =>
            el.dispatchEvent(
              new PointerEvent("pointermove", {
                pointerId: 987,
                pointerType: "pen",
                buttons: 1,
                pressure: 1,
                clientX: 0,
                clientY: 0,
              }),
            ),
          );
        assert.equal(
          await page.locator("#selection-status").textContent(),
          before,
        );
        for (let i = 1; i <= 50; i++)
          await pen("mouseMoved", 80 + i * 6, 160, 0.1 + (0.8 * i) / 50);
        assert.deepEqual(
          (await snapshot()).nodes,
          source.nodes,
          "draft is isolated",
        );
        await pen("mouseReleased", 380, 160, 0);
      };
      await drawPen();
      assert(await page.locator("#finish-path").isEnabled());
      await press("Drawing options");
      await field.fill("45");
      await press("Apply drawing options");
      await press("Drawing options");
      await field.fill("18");
      await press("Keep drawing");
      await press("Drawing options");
      assert.equal(await field.inputValue(), "45");
      await page.keyboard.press("Escape");
      await press("Finish path");
      const first = await snapshot(),
        g = first.nodes.at(-1).geometry;
      assert.equal(first.nodes.at(-1).parentId, parent);
      assert(g.closed && g.points.length >= 3 && g.points.length <= 256);
      assert(!Object.hasOwn(g, "width") && !Object.hasOwn(g, "pressure"));
      const { worldPoints } = await import("@evir/runtime/geometry");
      const pts = worldPoints(first, first.nodes.at(-1)).map((v) => v.anchor),
        span = (pred) => {
          const ys = pts.filter((p) => pred(p[0])).map((p) => p[1]);
          return Math.max(...ys) - Math.min(...ys);
        };
      assert(
        span((x) => x > 330) > span((x) => x < 140) * 1.8,
        "synthetic pen pressure visibly widens the outline",
      );
      await press("Undo");
      assert.deepEqual((await snapshot()).nodes, source.nodes);
      await press("Redo");
      assert.deepEqual((await snapshot()).nodes, first.nodes);
      // Mouse follows a constant width even with the pressure option enabled.
      await press("Freehand");
      const a = await screen(90, 270),
        b = await screen(380, 270);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 30 });
      await page.mouse.up();
      await press("Finish path");
      const second = await snapshot(),
        mouse = worldPoints(second, second.nodes.at(-1));
      assert(
        Math.abs(
          Math.max(...mouse.map((v) => v.anchor[1])) -
            Math.min(...mouse.map((v) => v.anchor[1])) -
            45,
        ) < 1,
      );
      // Cancelled pressure gestures never enter history.
      await press("Freehand");
      await pen("mousePressed", 80, 350, 0.3);
      await pen("mouseMoved", 180, 350, 0.8);
      await page.keyboard.press("Escape");
      await pen("mouseReleased", 180, 350, 0);
      assert.deepEqual((await snapshot()).nodes, second.nodes);
      if (width === 390) {
        const a = await screen(100, 360),
          b = await screen(200, 370),
          c = await screen(350, 360);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ ...a, id: 10 }],
        });
        for (const pos of [b, c])
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...pos, id: 10 }],
          });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await press("Finish path");
        const touch = await snapshot();
        assert.equal(touch.nodes.length, second.nodes.length + 1);
        await press("Undo");
      }
      await cdp.detach();
      await page.keyboard.press("Escape");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await axeCheck();
      await page.screenshot({
        path: `${output}/workspace-${width}x${height}.png`,
      });
      report.viewports.push({
        width,
        height,
        penAnchors: g.points.length,
        checks:
          "pressure/fallback/affine parent/review/refit/cancel/options/focus/undo/redo/automated WCAG/no overflow",
      });
      if (width === 1440) {
        authored = await snapshot();
        const saved = page.waitForEvent("download");
        await press("Save project");
        assert.deepEqual(
          JSON.parse(fs.readFileSync(await (await saved).path(), "utf8")).nodes,
          authored.nodes,
        );
        await page
          .getByRole("status")
          .filter({ hasText: "Saved in this browser" })
          .waitFor();
        await page.reload();
        await page.waitForFunction(() => window.evirStudio);
        assert.deepEqual((await snapshot()).nodes, authored.nodes);
        const downloads = [];
        page.on("download", (d) => downloads.push(d));
        await press("Export .riv");
        await page.waitForFunction(() =>
          document
            .querySelector("#notice span")
            .textContent.includes("source map downloaded"),
        );
        for (let i = 0; i < 100 && downloads.length < 2; i++)
          await page.waitForTimeout(20);
        exported = fs.readFileSync(
          await downloads
            .find((d) => d.suggestedFilename().endsWith(".riv"))
            .path(),
        );
        assert.deepEqual(exported, Buffer.from(compileProject(authored).bytes));
        fs.writeFileSync(
          output + "/authored.evir-project",
          JSON.stringify(authored, null, 2) + "\n",
        );
        fs.writeFileSync(output + "/authored.riv", exported);
      }
    }
    for (const backend of ["canvas", "webgl2"]) {
      await page.goto(
        "http://127.0.0.1:8776/tools/runtime.html?renderer=" + backend,
      );
      await page.evaluate(() =>
        loadFixture("brush-authored", {
          src: "/research/results/pressure-brush/authored.riv",
          autoplay: false,
        }),
      );
      await page.evaluate(() => {
        player.stopRendering();
        player.drawFrame();
      });
      const expected = await page.evaluate(async (p) => {
        const { drawScene } = await import("/tools/.test-build/oracle.mjs");
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const ctx = c.getContext("2d"),
          a = p.artboards[0],
          scale = Math.min(256 / a.width, 256 / a.height);
        ctx.translate(
          (256 - a.width * scale) / 2,
          (256 - a.height * scale) / 2,
        );
        ctx.scale(scale, scale);
        drawScene(ctx, p, a.id);
        return Array.from(ctx.getImageData(0, 0, 256, 256).data);
      }, authored);
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
          : PNG.sync.read(
              await page
                .locator("#canvas")
                .screenshot({ omitBackground: true }),
            ).data;
      let error = 0,
        expectedCovered = 0,
        actualCovered = 0;
      for (let i = 0; i < actual.length; i += 4) {
        if (expected[i + 3]) expectedCovered++;
        if (actual[i + 3]) actualCovered++;
        for (let k = 0; k < 4; k++)
          error += Math.abs(actual[i + k] - expected[i + k]);
      }
      const mae = error / actual.length;
      assert(mae < 2.5);
      assert(expectedCovered > 100);
      assert(Math.abs(expectedCovered - actualCovered) < 350);
      const diagnostics = await gpu.collect(page);
      if (backend === "webgl2")
        assert(
          diagnostics.contexts.length &&
            diagnostics.contexts.every(
              (gl) => !gl.contextLost && !gl.errors.length,
            ),
        );
      report.oracles.push({
        backend,
        mae,
        expectedCovered,
        actualCovered,
        diagnostics,
      });
    }
    report.export = {
      bytes: exported.length,
      sha256: createHash("sha256").update(exported).digest("hex"),
    };
    fs.writeFileSync(
      output + "/browser.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      "Brush: four responsive workflows, synthetic pressure, mouse/touch fallback, history/recovery/export and two official-runtime comparisons passed.",
    );
  });
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
