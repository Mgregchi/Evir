const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const { createStaticServer } = await import("../../tools/static-server.mjs");
  const { createProject } = await import("@evir/project-model"),
    { addNode } = await import("@evir/authoring");
  const server = createStaticServer(path.resolve("apps/web/dist"));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : chromium.executablePath()),
    args: ["--no-sandbox"],
  });
  const p = createProject(),
    a = addNode(p, "rectangle"),
    b = addNode(p, "rectangle");
  p.nodes.find((n) => n.id === a).name = "Mover";
  p.nodes.find((n) => n.id === a).transform = [1, 0, 0, 1, 30, 40];
  p.nodes.find((n) => n.id === b).name = "Reference";
  p.nodes.find((n) => n.id === b).transform = [1, 0, 0, 1, 240, 180];
  const evidence = path.resolve("research/results/studio-snapping");
  fs.mkdirSync(evidence, { recursive: true });
  const results = [],
    errors = [];
  try {
    for (const width of [320, 390, 844, 1024, 1440]) {
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
        name: "align.evir-project",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(p)),
      });
      await page.locator("#replace-confirm").click();
      await page.locator("#fit").click();
      await page.locator("#view-toggle").click();
      await page.getByLabel("Snap to alignment", { exact: true }).check();
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
      await page.keyboard.press("Escape");
      const before = await page.evaluate(() => evirStudio.snapshot());
      const stage = await page.locator("#stage").boundingBox(),
        c = before.editor.cameras[p.artboards[0].id];
      const point = (x, y) => ({
        x: Math.round(stage.x + c.x + x * c.zoom),
        y: Math.round(stage.y + c.y + y * c.zoom),
      });
      const start = point(60, 70),
        end = point(270 - 4 / c.zoom, 210 - 3 / c.zoom);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 5 });
      assert.equal((await page.evaluate(() => evirStudio.guides())).length, 2);
      assert(
        Math.abs(
          (await page.evaluate(() => evirStudio.pose())).nodes.find(
            (n) => n.id === a,
          ).transform[4] - 240,
        ) < 1e-7,
      );
      await page.screenshot({
        path: path.join(evidence, `guides-${width}.png`),
        scale: "css",
      });
      await page.mouse.up();
      assert.deepEqual(await page.evaluate(() => evirStudio.guides()), []);
      await page.locator("#undo").click();
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      // Bypass matches the raw world delta rather than the target's edge.
      await page.keyboard.down("Alt");
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 3 });
      assert.deepEqual(await page.evaluate(() => evirStudio.guides()), []);
      await page.mouse.up();
      await page.keyboard.up("Alt");
      assert(
        Math.abs(
          (await page.evaluate(() => evirStudio.snapshot())).nodes.find(
            (n) => n.id === a,
          ).transform[4] -
            (30 + (end.x - start.x) / c.zoom),
        ) < 1e-7,
      );
      await page.locator("#undo").click();
      // Cancel restores the pre-gesture source and removes transient overlays.
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      assert.deepEqual(await page.evaluate(() => evirStudio.guides()), []);
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
        .getByRole("button", { name: "Align left", exact: true })
        .click();
      let aligned = await page.evaluate(() => evirStudio.snapshot());
      assert.equal(aligned.nodes.find((n) => n.id === a).transform[4], 30);
      assert.equal(aligned.nodes.find((n) => n.id === b).transform[4], 30);
      assert(
        await page
          .getByRole("button", { name: "Align left", exact: true })
          .evaluate((e) => e === document.activeElement),
      );
      await axeCheck();
      await page.screenshot({
        path: path.join(evidence, `alignment-${width}.png`),
        scale: "css",
      });
      if (width <= 850) await page.locator("#close-panel").click();
      await page.locator("#undo").click();
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      // Browser preference survives reload, but does not enter editable source.
      assert(!Object.hasOwn(aligned.editor, "snapping"));
      await page
        .getByRole("status")
        .filter({ hasText: "Saved in this browser" })
        .waitFor();
      await page.reload();
      await page.waitForFunction(() => window.evirStudio);
      assert(await page.locator("#snap-alignment").isChecked());
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      results.push({
        width,
        height,
        zoom: c.zoom,
        snapping: true,
        bypass: true,
        cancellation: true,
        alignmentUndo: true,
        axeViolations: 0,
      });
      await context.close();
    }
    const study = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await study.goto(origin + "/editor/studio/");
    await study.waitForFunction(() => window.evirStudio);
    await study
      .locator("#file")
      .setInputFiles(
        path.resolve("apps/web/assets/examples/gather.evir-project"),
      );
    await study.locator("#replace-confirm").click();
    await study.locator("#fit").click();
    await study
      .getByRole("button", { name: "Select card 1", exact: true })
      .click();
    await study.locator("#multiple-layers").click();
    for (const name of ["card 2", "card 3"])
      await study
        .getByRole("button", { name: `Select ${name}`, exact: true })
        .click();
    await study
      .getByRole("button", { name: "Align left", exact: true })
      .click();
    const alignedStudy = await study.evaluate(() => evirStudio.snapshot());
    for (const id of [1, 2, 3])
      assert.equal(
        alignedStudy.nodes.find((n) => n.id === `gather-card-${id}`)
          .transform[4],
        96,
      );
    await study.screenshot({
      path: path.join(evidence, "gather-studio.png"),
      scale: "css",
    });
    const { press } = require("./actions.cjs");
    const downloaded = study.waitForEvent("download");
    await press(study, "Export .riv");
    const download = await downloaded;
    const { compileProject } = await import("@evir/format");
    assert.deepEqual(
      fs.readFileSync(await download.path()),
      Buffer.from(compileProject(alignedStudy).bytes),
    );
    await study.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(evidence, "browser.json"),
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          scope:
            "Chromium responsive authoring and automated accessibility; not physical device or assistive-technology evidence",
          results,
          errors,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Snapping/alignment: five viewport tasks, guide cleanup, Alt bypass, undo, preference isolation and automated accessibility passed.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
