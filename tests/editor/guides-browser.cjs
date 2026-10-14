const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const { createStaticServer } = await import("../../tools/static-server.mjs");
  const { createProject } = await import("@evir/project-model"),
    { addNode } = await import("@evir/authoring"),
    { compileProject } = await import("@evir/format");
  const server = createStaticServer(path.resolve("apps/web/dist"));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: fs.existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : chromium.executablePath(),
    args: ["--no-sandbox"],
  });
  const p = createProject(),
    mover = addNode(p, "rectangle"),
    key = addNode(p, "rectangle");
  p.nodes.find((n) => n.id === mover).name = "Mover";
  p.nodes.find((n) => n.id === mover).transform = [1, 0, 0, 1, 30, 40];
  p.nodes.find((n) => n.id === key).name = "Reference";
  p.nodes.find((n) => n.id === key).transform = [1, 0, 0, 1, 240, 180];
  const out = "research/results/studio-guides";
  fs.mkdirSync(out, { recursive: true });
  const results = [],
    errors = [];
  try {
    for (const width of [320, 390, 844, 1440]) {
      const height = width === 844 ? 390 : 844,
        context = await browser.newContext({
          viewport: { width, height },
          reducedMotion: "reduce",
        }),
        page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (d) => {
        errors.push(`Unexpected native ${d.type()}`);
        d.dismiss();
      });
      await page.goto(origin + "/editor/studio/");
      await page.waitForFunction(() => window.evirStudio);
      await page.locator("#file").setInputFiles({
        name: "guides.evir-project",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(p)),
      });
      await page.locator("#replace-confirm").click();
      await page.waitForFunction((id) => evirStudio.snapshot().id === id, p.id);
      await page.locator("#fit").click();
      const open = async () => {
        await page.locator("#view-toggle").click();
        await page.locator("#manage-guides").click();
      };
      await open();
      await page.getByLabel("Show rulers", { exact: true }).check();
      await page
        .getByRole("button", { name: "Add vertical guide", exact: true })
        .click();
      await page.getByLabel("Vertical guide 1", { exact: true }).fill("240");
      await page
        .getByRole("button", { name: "Add horizontal guide", exact: true })
        .click();
      await page.getByLabel("Horizontal guide 2", { exact: true }).fill("180");
      await page.getByLabel("Grid spacing", { exact: true }).fill("0");
      await page
        .locator("#advanced-sheet")
        .getByRole("button", { name: "Apply", exact: true })
        .click();
      await page
        .locator("#advanced-sheet [role=alert]")
        .filter({ hasText: "Grid spacing" })
        .waitFor();
      assert.equal(
        (await page.evaluate(() => evirStudio.canvasGuides())).guides.length,
        0,
      );
      await page.getByLabel("Grid spacing", { exact: true }).fill("32");
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const checkAxe = async () =>
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
      await checkAxe();
      await page.screenshot({
        path: `${out}/guide-sheet-${width}.png`,
        scale: "css",
      });
      await page
        .locator("#advanced-sheet")
        .getByRole("button", { name: "Apply", exact: true })
        .click();
      const before = await page.evaluate(() => evirStudio.snapshot()),
        settings = await page.evaluate(() => evirStudio.canvasGuides());
      assert(
        await page
          .locator("#view-toggle")
          .evaluate((e) => e === document.activeElement),
      );
      assert.equal(settings.guides.length, 2);
      assert.equal(settings.rulers, true);
      assert(!Object.hasOwn(before.editor, "guides"));
      assert.deepEqual(
        Buffer.from(compileProject(before).bytes),
        Buffer.from(compileProject(p).bytes),
      );
      const stage = await page.locator("#stage").boundingBox(),
        c = before.editor.cameras[p.artboards[0].id],
        point = (x, y) => ({
          x: Math.round(stage.x + c.x + x * c.zoom),
          y: Math.round(stage.y + c.y + y * c.zoom),
        });
      const start = point(60, 70),
        end = point(270 - 4 / c.zoom, 210 - 3 / c.zoom);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 5 });
      assert.equal((await page.evaluate(() => evirStudio.guides())).length, 2);
      assert.equal(
        (await page.evaluate(() => evirStudio.pose())).nodes.find(
          (n) => n.id === mover,
        ).transform[4],
        240,
      );
      await page.mouse.up();
      await page.locator("#undo").click();
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      await page.keyboard.down("Alt");
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y);
      assert.deepEqual(await page.evaluate(() => evirStudio.guides()), []);
      await page.mouse.up();
      await page.keyboard.up("Alt");
      await page.locator("#undo").click();
      await open();
      await page.getByLabel("Edit guides on canvas", { exact: true }).check();
      await page
        .locator("#advanced-sheet")
        .getByRole("button", { name: "Apply", exact: true })
        .click();
      const target = point(100, 100);
      await page.mouse.move(target.x, stage.y + 10);
      await page.mouse.down();
      await page.mouse.move(target.x, target.y, { steps: 5 });
      await page.mouse.up();
      assert.equal(
        (await page.evaluate(() => evirStudio.canvasGuides())).guides.length,
        3,
      );
      const withNew = await page.evaluate(() => evirStudio.canvasGuides());
      assert(Math.abs(withNew.guides[2].position - 100) < 2 / c.zoom);
      // Cancelled guide moves never alter saved settings or source history.
      await page.mouse.move(target.x, target.y);
      await page.mouse.down();
      await page.mouse.move(target.x + 30, target.y);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      assert.deepEqual(
        await page.evaluate(() => evirStudio.canvasGuides()),
        withNew,
      );
      await page.screenshot({
        path: `${out}/canvas-guides-${width}.png`,
        scale: "css",
      });
      await page.locator("#stop-guide-editing").click();
      await open();
      const downloadEvent = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download guide preset", exact: true })
        .click();
      const download = await downloadEvent;
      assert.deepEqual(
        JSON.parse(fs.readFileSync(await download.path())),
        withNew,
      );
      await page
        .getByLabel("Import guide preset", { exact: true })
        .setInputFiles({
          name: "invalid.json",
          mimeType: "application/json",
          buffer: Buffer.from('{"extra":true}'),
        });
      await page
        .locator("#advanced-sheet [role=status]")
        .filter({ hasText: "version 1" })
        .waitFor();
      await page.getByLabel("Lock guide positions", { exact: true }).check();
      assert(
        await page
          .getByLabel("Lock guide positions", { exact: true })
          .evaluate((e) => e === document.activeElement),
      );
      assert(
        await page
          .getByRole("button", { name: "Add vertical guide", exact: true })
          .isDisabled(),
      );
      await page
        .locator("#advanced-sheet")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      assert.deepEqual(
        await page.evaluate(() => evirStudio.canvasGuides()),
        withNew,
      );
      // Key-object selection is available through the same controls on compact layouts.
      if (width <= 850) await page.locator("#show-layers").click();
      await page
        .getByRole("button", { name: "Select Mover", exact: true })
        .click();
      await page.locator("#multiple-layers").click();
      await page
        .getByRole("button", { name: "Select Reference", exact: true })
        .click();
      if (width <= 850) {
        await page.locator("#close-panel").click();
        await page.locator("#show-properties").click();
      }
      await page
        .getByLabel("Alignment reference", { exact: true })
        .selectOption(key);
      await page
        .getByRole("button", { name: "Align left", exact: true })
        .click();
      const aligned = await page.evaluate(() => evirStudio.snapshot());
      assert.equal(aligned.nodes.find((n) => n.id === mover).transform[4], 240);
      assert.deepEqual(
        aligned.nodes.find((n) => n.id === key),
        before.nodes.find((n) => n.id === key),
      );
      await checkAxe();
      await page.screenshot({
        path: `${out}/key-alignment-${width}.png`,
        scale: "css",
      });
      if (width <= 850) await page.locator("#close-panel").click();
      await page.locator("#undo").click();
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      const gridPreset = {
        ...withNew,
        rulers: false,
        guides: [],
        grid: {
          visible: true,
          snap: true,
          spacing: 48,
          originX: 0,
          originY: 0,
        },
      };
      await open();
      await page
        .getByLabel("Import guide preset", { exact: true })
        .setInputFiles({
          name: "grid.guides.json",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(gridPreset)),
        });
      await page
        .locator("#advanced-sheet [role=status]")
        .filter({ hasText: "Preset ready" })
        .waitFor();
      await page
        .locator("#advanced-sheet")
        .getByRole("button", { name: "Apply", exact: true })
        .click();
      assert.deepEqual(
        await page.evaluate(() => evirStudio.canvasGuides()),
        gridPreset,
      );
      // Imported grid alone snaps a real pointer move, then scene Undo leaves preferences intact.
      if (width <= 850) await page.locator("#show-layers").click();
      await page.locator("#multiple-layers").click();
      await page
        .getByRole("button", { name: "Select Mover", exact: true })
        .click();
      if (width <= 850) await page.locator("#close-panel").click();
      const gridEnd = point(77, 80);
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(gridEnd.x, gridEnd.y, { steps: 5 });
      const gridPose = await page.evaluate(() => evirStudio.pose());
      assert.equal(gridPose.nodes.find((n) => n.id === mover).transform[4], 48);
      assert.equal(gridPose.nodes.find((n) => n.id === mover).transform[5], 48);
      await page.mouse.up();
      await page.locator("#undo").click();
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      assert.deepEqual(
        await page.evaluate(() => evirStudio.canvasGuides()),
        gridPreset,
      );
      await page
        .getByRole("status")
        .filter({ hasText: "Saved in this browser" })
        .waitFor();
      await page.reload();
      await page.waitForFunction(() => window.evirStudio);
      assert.deepEqual(
        await page.evaluate(() => evirStudio.canvasGuides()),
        gridPreset,
      );
      assert.equal(await page.evaluate(() => evirStudio.guideEditing()), false);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      results.push({
        width,
        height,
        numericGuides: true,
        rulerCreation: true,
        guideMoveCancel: true,
        presetDownload: true,
        presetImport: true,
        gridPointerSnap: true,
        invalidPresetRejected: true,
        sourceExportUnchanged: true,
        keyReferenceFixed: true,
        oneUndo: true,
        recovery: true,
        axeViolations: 0,
      });
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      `${out}/browser.json`,
      JSON.stringify(
        {
          scope:
            "Cloud Chromium automated checks; no physical device or human accessibility claim",
          results,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Persistent guides, grid settings, fixed-reference alignment and responsive accessibility: four viewports passed.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
