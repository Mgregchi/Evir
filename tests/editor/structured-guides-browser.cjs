const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const { createStaticServer } = await import("../../tools/static-server.mjs"),
    { compileProject } = await import("@evir/format");
  const server = createStaticServer(path.resolve("apps/web/dist"));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : chromium.executablePath()),
    args: ["--no-sandbox"],
  });
  const p = JSON.parse(
      fs.readFileSync("apps/web/assets/examples/loom.evir-project"),
    ),
    preset = JSON.parse(
      fs.readFileSync("apps/web/assets/examples/loom.guides.json"),
    );
  p.editor.locked.push("loom-reference-patch");
  const out = "research/results/structured-guides";
  fs.mkdirSync(out, { recursive: true });
  const results = [],
    errors = [];
  const get = (p, id) => p.nodes.find((n) => n.id === id);
  try {
    for (const width of [320, 390, 844, 1440]) {
      const height = width === 844 ? 390 : 844,
        context = await browser.newContext({
          viewport: { width, height },
          reducedMotion: "reduce",
        }),
        page = await context.newPage();
      context.setDefaultTimeout(20000);
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (d) => {
        errors.push(`Unexpected browser ${d.type()}`);
        d.dismiss();
      });
      await page.goto(origin + "/editor/studio/");
      await page.waitForFunction(() => window.evirStudio);
      await page.locator("#file").setInputFiles({
        name: "loom.evir-project",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(p)),
      });
      await page.locator("#replace-confirm").click();
      await page.waitForFunction(
        () => evirStudio.snapshot().id === "loom-project",
      );
      await page.locator("#fit").click();
      const initial = await page.evaluate(() => evirStudio.snapshot());
      const guides = () => page.evaluate(() => evirStudio.canvasGuides());
      const openGuides = async () => {
        await page.locator("#view-toggle").click();
        await page.locator("#manage-guides").click();
      };
      const apply = () =>
        page
          .locator("#advanced-sheet")
          .getByRole("button", { name: "Apply", exact: true })
          .click();
      await openGuides();
      await page
        .getByLabel("Import guide preset", { exact: true })
        .setInputFiles(
          path.resolve("apps/web/assets/examples/loom.guides.json"),
        );
      await page
        .locator("#advanced-sheet [role=status]")
        .filter({ hasText: "Preset ready" })
        .waitFor();
      await page
        .locator("summary")
        .filter({ hasText: /^Columns 1$/ })
        .click();
      await page
        .getByLabel("Columns 1 track count", { exact: true })
        .fill("33");
      await apply();
      await page
        .locator("#advanced-sheet [role=alert]")
        .filter({ hasText: "1–32" })
        .waitFor();
      assert.equal((await guides()).components.length, 0);
      await page.getByLabel("Columns 1 track count", { exact: true }).fill("3");
      await page.getByLabel("Columns 1 width", { exact: true }).fill("200");
      await apply();
      await page
        .locator("#advanced-sheet [role=alert]")
        .filter({ hasText: "must fit" })
        .waitFor();
      await page.getByLabel("Columns 1 width", { exact: true }).fill("96");
      await page
        .getByRole("button", { name: "Duplicate columns 1", exact: true })
        .click();
      assert.equal(await page.locator("[data-component-id]").count(), 3);
      await page
        .getByRole("button", { name: "Remove columns 2", exact: true })
        .click();
      assert.equal(await page.locator("[data-component-id]").count(), 2);
      await page.getByLabel("Lock guide positions", { exact: true }).check();
      assert(
        await page
          .getByRole("button", { name: "Add columns", exact: true })
          .isDisabled(),
      );
      assert(
        await page
          .getByLabel("Columns 1 track count", { exact: true })
          .isDisabled(),
      );
      await page.getByLabel("Lock guide positions", { exact: true }).uncheck();
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      assert.deepEqual(
        (
          await page.evaluate(() =>
            axe.run(document.querySelector("#advanced-sheet")),
          )
        ).violations,
        [],
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page
        .locator('[data-component-id="loom-columns"]')
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${out}/guide-sheet-${width}x${height}.png`,
      });
      await apply();
      assert.deepEqual(await guides(), preset);
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        initial.nodes,
      );
      assert.deepEqual(
        Buffer.from(
          compileProject(await page.evaluate(() => evirStudio.snapshot()))
            .bytes,
        ),
        fs.readFileSync("apps/web/assets/examples/loom.riv"),
      );
      await page.screenshot({ path: `${out}/bands-${width}x${height}.png` });
      // Pointer snapping uses the actual imported column geometry. Alt bypasses it.
      const selectLayer = async (name) => {
        if (width < 850) await require("./actions.cjs").press(page, "Layers");
        await page
          .getByRole("button", { name: "Select " + name, exact: true })
          .click();
        if (width < 850) await page.keyboard.press("Escape");
      };
      await selectLayer("patch 1 1");
      const drag = async (alt) => {
        const source = await page.evaluate(() => evirStudio.snapshot()),
          a = source.artboards[0],
          c = source.editor.cameras[a.id],
          n = get(source, "loom-patch-1-1"),
          stage = await page.locator("#stage").boundingBox();
        const x = stage.x + c.x + (n.transform[4] + 12) * c.zoom,
          y = stage.y + c.y + (n.transform[5] + 16) * c.zoom;
        if (alt) await page.keyboard.down("Alt");
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + (82 - n.transform[4]) * c.zoom, y, {
          steps: 5,
        });
        await page.mouse.up();
        if (alt) await page.keyboard.up("Alt");
      };
      await drag(false);
      let snapshot = await page.evaluate(() => evirStudio.snapshot());
      assert(
        Math.abs(get(snapshot, "loom-patch-1-1").transform[4] - 84) < 1e-6,
      );
      await require("./actions.cjs").press(page, "Undo");
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        initial.nodes,
      );
      await drag(true);
      snapshot = await page.evaluate(() => evirStudio.snapshot());
      assert(
        Math.abs(get(snapshot, "loom-patch-1-1").transform[4] - 82) < 1e-6,
      );
      await require("./actions.cjs").press(page, "Undo");
      // Three roots around a locked reference use the numeric bottom sheet.
      if (width < 850) await require("./actions.cjs").press(page, "Layers");
      await page
        .getByRole("button", { name: "Select multiple layers", exact: true })
        .click();
      // Existing single selection is retained when Multiple is enabled.
      for (const name of ["reference patch", "patch 1 3"])
        await page
          .getByRole("button", { name: "Select " + name, exact: true })
          .click();
      if (width < 850) {
        await page.keyboard.press("Escape");
        await require("./actions.cjs").press(page, "Properties");
      }
      await page
        .getByLabel("Alignment reference", { exact: true })
        .selectOption("loom-reference-patch");
      const before = await page.evaluate(() => evirStudio.snapshot());
      await page
        .getByRole("button", { name: "Distribute horizontal", exact: true })
        .click();
      await page.getByLabel("Fixed gap", { exact: true }).fill("");
      await apply();
      await page
        .locator("#advanced-sheet [role=alert]")
        .filter({ hasText: "finite gap" })
        .waitFor();
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      await page.getByLabel("Fixed gap", { exact: true }).fill("-1");
      await apply();
      await page
        .locator("#advanced-sheet [role=alert]")
        .filter({ hasText: "finite gap" })
        .waitFor();
      await page.getByLabel("Fixed gap", { exact: true }).fill("28");
      await page
        .locator("#advanced-sheet")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      await page
        .getByRole("button", { name: "Distribute horizontal", exact: true })
        .click();
      await page.getByLabel("Fixed gap", { exact: true }).fill("28");
      assert.deepEqual(
        (
          await page.evaluate(() =>
            axe.run(document.querySelector("#advanced-sheet")),
          )
        ).violations,
        [],
      );
      await page.screenshot({
        path: `${out}/spacing-sheet-${width}x${height}.png`,
      });
      await apply();
      const spaced = await page.evaluate(() => evirStudio.snapshot());
      assert.equal(get(spaced, "loom-patch-1-1").transform[4], 84);
      assert.equal(get(spaced, "loom-patch-1-3").transform[4], 332);
      assert.deepEqual(
        get(spaced, "loom-reference-patch"),
        get(before, "loom-reference-patch"),
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Distribute horizontal", exact: true })
          .evaluate((n) => n === document.activeElement),
        true,
      );
      if (width < 850) await page.keyboard.press("Escape");
      await require("./actions.cjs").press(page, "Undo");
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      await require("./actions.cjs").press(page, "Redo");
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        spaced.nodes,
      );
      await page.waitForFunction(
        () =>
          document.querySelector("#save-status").textContent ===
          "Saved in this browser",
      );
      await page.reload();
      await page.waitForFunction(() => window.evirStudio);
      assert.deepEqual(await guides(), preset);
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        spaced.nodes,
      );
      const downloaded = page.waitForEvent("download");
      await require("./actions.cjs").press(page, "Export .riv");
      const file = await downloaded;
      assert.deepEqual(
        fs.readFileSync(await file.path()),
        Buffer.from(compileProject(spaced).bytes),
      );
      if (width === 1440) {
        fs.writeFileSync(
          `${out}/loom-spaced.evir-project`,
          JSON.stringify(spaced, null, 2) + "\n",
        );
        fs.writeFileSync(
          `${out}/loom-spaced.riv`,
          compileProject(spaced).bytes,
        );
      }
      await openGuides();
      const event = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download guide preset", exact: true })
        .click();
      const downloadedPreset = await event;
      assert.deepEqual(
        JSON.parse(fs.readFileSync(await downloadedPreset.path())),
        preset,
      );
      await page
        .locator("#advanced-sheet")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await openGuides();
      await page.getByRole("button", { name: "Add rows", exact: true }).click();
      await page
        .getByLabel("Rows 2 sizing", { exact: true })
        .selectOption("stretch");
      await page.getByLabel("Rows 2 gutter", { exact: true }).fill("10");
      await page
        .locator("#advanced-sheet")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      assert.deepEqual(await guides(), preset);
      if (width === 1440) {
        await selectLayer("reference patch");
        await page
          .getByRole("button", { name: "Select multiple layers", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Select patch 2 2", exact: true })
          .click();
        await page
          .getByLabel("Alignment reference", { exact: true })
          .selectOption("loom-reference-patch");
        const verticalBefore = await page.evaluate(() => evirStudio.snapshot());
        assert(
          await page
            .getByRole("button", { name: "Distribute vertical", exact: true })
            .isEnabled(),
        );
        await page
          .getByRole("button", { name: "Distribute vertical", exact: true })
          .click();
        await page.getByLabel("Fixed gap", { exact: true }).fill("38");
        await apply();
        const vertical = await page.evaluate(() => evirStudio.snapshot());
        assert.equal(get(vertical, "loom-patch-2-2").transform[5], 275);
        assert.deepEqual(
          get(vertical, "loom-reference-patch"),
          get(verticalBefore, "loom-reference-patch"),
        );
        await require("./actions.cjs").press(page, "Undo");
        assert.deepEqual(
          (await page.evaluate(() => evirStudio.snapshot())).nodes,
          verticalBefore.nodes,
        );
      }
      results.push({
        width,
        height,
        checks: [
          "v2 preset import/download/reload",
          "component numeric validation and fit rejection",
          "duplicate/remove",
          "lock",
          "zero sheet axe violations",
          "reflow",
          "source/export excludes guides",
          "actual pointer snapping and Alt bypass",
          "fixed-gap locked reference",
          "blank/negative rejection",
          "Cancel preserves source/preferences",
          "one-step Undo/Redo",
          "keyboard focus after Apply",
          "official-compatible exported spaced scene",
          ...(width === 1440 ? ["two-root vertical spacing and Undo"] : []),
        ],
      });
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      `${out}/browser.json`,
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          scope:
            "Automated Chromium software workflows, no physical-device/human testing",
          results,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Structured guides: four responsive workflows, pointer snapping, reusable presets, fixed-gap reference spacing and source/export isolation passed",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
