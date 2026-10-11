const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { createHash } = require("node:crypto"),
  { PNG } = require("pngjs");
const { run } = require("../../tools/browser.cjs"),
  gpu = require("../../tools/gpu_diagnostics.cjs");
(async () => {
  await require("../../tools/prepare-oracle.cjs").prepare();
  const { createProject } = await import("@evir/project-model"),
    { addNode } = await import("@evir/authoring"),
    { compileProject } = await import("@evir/format");
  const source = createProject(),
    parentId = addNode(source, "group");
  source.nodes[0].name = "Drawing group";
  source.nodes[0].transform = [0, 1.2, -0.8, 0, 320, 80];
  const output = "research/results/studio-freehand";
  fs.mkdirSync(output, { recursive: true });
  const report = {
    checkedAt: new Date().toISOString(),
    runtimeVersion: "2.44.0",
    scope:
      "Cloud Chromium pointer/touch dispatch and actual downloaded export pixels; no physical-device, screen-reader or human usability evidence.",
    viewports: [],
    oracles: [],
  };
  await run(async (page) => {
    await gpu.install(page);
    const press = (name) => require("./actions.cjs").press(page, name);
    const snapshot = () => page.evaluate(() => evirStudio.snapshot());
    let exported, authored;
    for (const width of [320, 390, 844, 1024, 1440]) {
      const height = width === 844 ? 390 : 844;
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("http://127.0.0.1:8776/apps/web/dist/editor/studio/");
      await page.waitForFunction(() => window.evirStudio);
      await page.locator("#file").setInputFiles({
        name: "freehand.evir-project",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(source)),
      });
      await page.locator("#replace-confirm").click();
      await press("Fit");
      if (width <= 850) {
        await press("Layers");
      }
      await press("Select Drawing group");
      if (width <= 850) await page.keyboard.press("Escape");
      await page.locator("#stage").focus();
      await page.keyboard.press("b");
      assert.equal(
        await page.locator("#freehand-tool").getAttribute("aria-pressed"),
        "true",
      );
      const screen = async (x, y) => {
        const p = await snapshot(),
          c = p.editor.cameras[p.artboards[0].id],
          r = await page.locator("#stage").boundingBox();
        return [r.x + c.x + x * c.zoom, r.y + c.y + y * c.zoom];
      };
      const start = () => screen(375, 220);
      const draw = async () => {
        const baseline = (await snapshot()).nodes;
        await page.mouse.move(...(await start()));
        await page.mouse.down();
        for (let i = 1; i <= 64; i++) {
          const t = (i / 64) * Math.PI * 2;
          await page.mouse.move(
            ...(await screen(280 + 95 * Math.cos(t), 220 + 72 * Math.sin(t))),
          );
        }
        assert.deepEqual(
          (await snapshot()).nodes,
          baseline,
          "raw drawing stays outside committed project",
        );
        await page.mouse.up();
      };
      await draw();
      assert.equal(await page.locator("#finish-path").isEnabled(), true);
      await press("Animate");
      assert.equal(await page.evaluate(() => evirStudio.mode()), "Design");
      assert.match(
        await page.locator("#notice").innerText(),
        /Finish or cancel/,
      );
      await press("Save project");
      assert.match(
        await page.locator("#notice").innerText(),
        /Finish or cancel/,
      );
      await press("Drawing options");
      await page
        .getByLabel("Smoothing (screen pixels)", { exact: true })
        .fill("0");
      await press("Apply drawing options");
      assert.match(await page.locator("#drawing-error").innerText(), /between/);
      await page
        .getByLabel("Smoothing (screen pixels)", { exact: true })
        .fill("2");
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const accessibility = async () =>
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
      await accessibility();
      if (width === 390)
        await page.screenshot({ path: output + "/drawing-options-390.png" });
      await press("Apply drawing options");
      assert.equal(
        await page
          .locator("#drawing-options")
          .evaluate((el) => el === document.activeElement),
        true,
      );
      if (width === 390) {
        await press("Drawing options");
        await page
          .getByLabel("Smoothing (screen pixels)", { exact: true })
          .fill("8");
        await press("Keep drawing");
        await press("Drawing options");
        assert.equal(
          await page
            .getByLabel("Smoothing (screen pixels)", { exact: true })
            .inputValue(),
          "2",
        );
        await page.keyboard.press("Escape");
        assert.equal(
          await page
            .locator("#drawing-options")
            .evaluate((el) => el === document.activeElement),
          true,
        );
      }
      await page.screenshot({ path: `${output}/draft-${width}x${height}.png` });
      await press("Finish path");
      const first = await snapshot(),
        shape = first.nodes.at(-1);
      assert.equal(shape.parentId, parentId);
      assert.equal(shape.geometry.closed, true);
      assert(
        shape.geometry.points.length >= 8 && shape.geometry.points.length < 64,
      );
      await press("Undo");
      assert.deepEqual((await snapshot()).nodes, source.nodes);
      await press("Redo");
      assert.deepEqual((await snapshot()).nodes, first.nodes);
      await press("Freehand");
      await page.mouse.move(...(await start()));
      await page.mouse.down();
      await page.mouse.move(...(await screen(390, 245)));
      await page.locator("#stage").evaluate((stage) =>
        stage.dispatchEvent(
          new PointerEvent("pointercancel", {
            pointerId: 1,
            pointerType: "mouse",
          }),
        ),
      );
      await page.mouse.up();
      assert.equal(await page.locator("#pen-actions").isHidden(), true);
      assert.deepEqual((await snapshot()).nodes, first.nodes);
      await draw();
      await page.keyboard.press("Escape");
      assert.deepEqual((await snapshot()).nodes, first.nodes);
      await page.mouse.move(...(await start()));
      await page.mouse.down();
      await page.mouse.move(...(await screen(390, 245)));
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.mouse.up();
      assert.equal(await page.locator("#pen-actions").isHidden(), true);
      // Coalesced input fallback/ownership: a different stylus cannot append points.
      await page.mouse.move(...(await start()));
      await page.mouse.down();
      const beforeCount = await page.locator("#selection-status").textContent();
      await page.locator("#stage").evaluate((stage) =>
        stage.dispatchEvent(
          new PointerEvent("pointermove", {
            pointerId: 99,
            pointerType: "pen",
            clientX: 20,
            clientY: 20,
          }),
        ),
      );
      assert.equal(
        await page.locator("#selection-status").textContent(),
        beforeCount,
      );
      // Exercise coalesced positions while a real captured mouse pointer owns the draft.
      const raw = await screen(350, 240);
      await page.locator("#stage").evaluate((stage, [x, y]) => {
        const e = new PointerEvent("pointermove", {
          pointerId: 1,
          pointerType: "mouse",
          clientX: x,
          clientY: y,
        });
        Object.defineProperty(e, "getCoalescedEvents", {
          value: () => [
            new PointerEvent("pointermove", {
              clientX: x - 15,
              clientY: y + 10,
            }),
            new PointerEvent("pointermove", { clientX: x - 8, clientY: y + 5 }),
          ],
        });
        stage.dispatchEvent(e);
      }, raw);
      assert.equal(
        Number(
          (await page.locator("#selection-status").textContent()).match(
            /(\d+) samples/,
          )[1],
        ),
        Number(beforeCount.match(/(\d+) samples/)[1]) + 3,
      );
      await page.keyboard.press("Escape");
      await page.mouse.up();
      if (width === 390) {
        const cdp = await page.context().newCDPSession(page);
        const [x, y] = await start();
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y, id: 11 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x - 20, y: y + 20, id: 11 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { x: x - 20, y: y + 20, id: 11 },
            { x: x + 20, y: y + 40, id: 12 },
          ],
        });
        assert.equal(
          await page.locator("#pen-actions").isHidden(),
          true,
          "second finger cancels drawing",
        );
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        assert.deepEqual((await snapshot()).nodes, first.nodes);
        // Actual one-finger closed drawing using Chromium touch dispatch.
        const points = [];
        for (let i = 0; i <= 32; i++) {
          const t = (i / 32) * Math.PI * 2;
          points.push(
            await screen(280 + 60 * Math.cos(t), 220 + 45 * Math.sin(t)),
          );
        }
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: points[0][0], y: points[0][1], id: 14 }],
        });
        for (const [x, y] of points.slice(1))
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y, id: 14 }],
          });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await press("Finish path");
        assert.equal((await snapshot()).nodes.length, first.nodes.length + 1);
        await press("Undo");
        await cdp.detach();
      }
      await page.keyboard.press("Escape"); // Exit empty Freehand tool.
      assert(
        !(await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )),
        "workspace has no horizontal overflow",
      );
      await accessibility();
      report.viewports.push({
        width,
        height,
        anchors: shape.geometry.points.length,
        checks:
          "draft/affine parent/options/keyboard/undo/redo/cancel/blur/pointer ownership/no overflow/automated accessibility",
      });
      if (width === 1440) {
        await press("Select " + shape.name);
        await press("Edit points");
        const input = page.getByLabel("Point X", { exact: true });
        const previous = Number(await input.inputValue());
        await input.fill(String(previous + 3));
        await input.press("Tab");
        assert.equal(
          (await snapshot()).nodes.at(-1).geometry.points[0].anchor[0],
          previous + 3,
        );
        await press("Undo");
        const saved = page.waitForEvent("download");
        await press("Save project");
        const restored = JSON.parse(
          fs.readFileSync(await (await saved).path(), "utf8"),
        );
        await page.reload();
        await page.waitForFunction(() => window.evirStudio);
        assert.deepEqual((await snapshot()).nodes, restored.nodes);
        authored = await snapshot();
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
        fs.mkdirSync("tools/.test-build", { recursive: true });
        fs.writeFileSync("tools/.test-build/freehand-authored.riv", exported);
        fs.writeFileSync(
          output + "/authored.evir-project",
          JSON.stringify(authored, null, 2) + "\n",
        );
        fs.writeFileSync(output + "/authored.riv", exported);
        await press("Animate");
        assert.equal(await page.locator("#freehand-tool").isDisabled(), true);
        await press("Design");
      }
    }
    for (const backend of ["canvas", "webgl2"]) {
      await page.goto(
        "http://127.0.0.1:8776/tools/runtime.html?renderer=" + backend,
      );
      await page.evaluate(() =>
        loadFixture("freehand-authored", {
          src: "/tools/.test-build/freehand-authored.riv",
          autoplay: false,
        }),
      );
      await page.evaluate(() => {
        player.stopRendering();
        player.drawFrame();
      });
      const expected = await page.evaluate(async (p) => {
        const { drawScene } = await import("/tools/.test-build/oracle.mjs");
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext("2d"),
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
      "Freehand: five responsive workflows, touch cancellation/drawing, editable persistence and two official-runtime pixel comparisons passed.",
    );
  });
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
