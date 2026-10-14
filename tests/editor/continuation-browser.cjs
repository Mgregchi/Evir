const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const { createStaticServer } = await import("../../tools/static-server.mjs");
  const { createProject, serializeProject, openProject, worldTransform } =
      await import("@evir/project-model"),
    { addNode } = await import("@evir/authoring"),
    { compileProject } = await import("@evir/format"),
    { mapPoint } = await import("@evir/runtime/geometry");
  const server = createStaticServer(path.resolve("apps/web/dist"));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: fs.existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : chromium.executablePath(),
    args: ["--no-sandbox"],
  });
  const out = "research/results/path-continuation";
  fs.mkdirSync(out, { recursive: true });
  const errors = [],
    results = [];
  const p = createProject(),
    group = addNode(p, "group"),
    id = addNode(p, "path", group);
  p.nodes.find((n) => n.id === group).transform = [0, 1.2, -0.8, 0, 320, 80];
  const node = p.nodes.find((n) => n.id === id);
  node.name = "Growing curve";
  node.geometry.closed = false;
  node.geometry.points = node.geometry.points.slice(0, 3);
  node.geometry.fill = {
    type: "linear",
    start: [0, 0],
    end: [120, 100],
    stops: [
      { position: 0, color: "#a8d7be" },
      { position: 1, color: "#355445" },
    ],
  };
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
        name: "seed.evir-project",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(p)),
      });
      await page.locator("#replace-confirm").click();
      await page.waitForFunction((id) => evirStudio.snapshot().id === id, p.id);
      await page.locator("#fit").click();
      const before = await page.evaluate(() => evirStudio.snapshot());
      const begin = async (endpoint = "last", closed = false) => {
        if (width <= 850) await page.locator("#show-layers").click();
        await page
          .getByRole("button", { name: "Select Growing curve", exact: true })
          .click();
        if (width <= 850) {
          await page.locator("#close-panel").click();
          await page.locator("#show-properties").click();
        }
        await page
          .getByRole("button", { name: "Continue path…", exact: true })
          .click();
        await page
          .getByLabel("Continue from", { exact: true })
          .selectOption(endpoint);
        if (closed)
          await page.getByLabel("Close when finished", { exact: true }).check();
        await page
          .locator("#advanced-sheet")
          .getByRole("button", { name: "Apply", exact: true })
          .click();
        try {
          await page.waitForFunction(
            () =>
              !document.querySelector("dialog[open]") &&
              document.activeElement.id === "stage",
            null,
            { timeout: 4000 },
          );
        } catch (error) {
          throw Error(
            JSON.stringify(
              await page.evaluate(() => ({
                dialogs: [...document.querySelectorAll("dialog[open]")].map(
                  (d) => d.id,
                ),
                focus: document.activeElement.outerHTML.slice(0, 240),
                draft: evirStudio.pathDraft(),
                notice: document.querySelector("#notice").innerText,
              })),
            ) +
              " " +
              error.message,
          );
        }
      };
      await begin();
      assert.equal(
        (await page.evaluate(() => evirStudio.pathDraft())).added,
        0,
      );
      assert(await page.locator("#finish-path").isDisabled());
      await page.keyboard.press("Backspace");
      assert.equal(
        (await page.evaluate(() => evirStudio.pathDraft())).points.length,
        3,
      );
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
      // Enter on the numeric button activates it instead of finishing the draft.
      await page.locator("#numeric-path-point").focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("heading", { name: "Add a path point", exact: true })
        .waitFor();
      await page.getByLabel("New point X", { exact: true }).fill("1000001");
      await page
        .locator("#advanced-sheet")
        .getByRole("button", { name: "Apply", exact: true })
        .click();
      await page
        .locator("#advanced-sheet [role=alert]")
        .filter({ hasText: "finite" })
        .waitFor();
      assert.equal(
        (await page.evaluate(() => evirStudio.pathDraft())).added,
        0,
      );
      await page.getByLabel("New point X", { exact: true }).fill("160");
      assert.equal(
        await page.locator('#advanced-sheet [role="alert"]').innerText(),
        "",
      );
      await page.getByLabel("New point Y", { exact: true }).fill("150");
      await page.getByLabel("Curved point", { exact: true }).check();
      await page.getByLabel("Curve handle X", { exact: true }).fill("180");
      await page.getByLabel("Curve handle Y", { exact: true }).fill("170");
      await axeCheck();
      const actions = await page
        .locator("#advanced-sheet .dialog-actions")
        .boundingBox();
      assert(actions.y >= 0 && actions.y + actions.height <= height + 1);
      for (const button of await page
        .locator("#advanced-sheet .dialog-actions button")
        .all()) {
        assert(
          await button.evaluate((n) => {
            const r = n.getBoundingClientRect();
            return (
              document
                .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
                ?.closest("button") === n
            );
          }),
        );
      }
      await page.screenshot({
        path: `${out}/numeric-point-${width}.png`,
        scale: "css",
      });
      await page
        .locator("#advanced-sheet")
        .getByRole("button", { name: "Apply", exact: true })
        .click();
      assert(
        await page
          .locator("#numeric-path-point")
          .evaluate((e) => e === document.activeElement),
      );
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      assert.equal(
        (await page.evaluate(() => evirStudio.pathDraft())).added,
        1,
      );
      // A captured, cancelled pointer edit removes only that newly pending point.
      const stage = await page.locator("#stage").boundingBox(),
        camera = before.editor.cameras[p.artboards[0].id],
        screen = (x, y) => ({
          x: stage.x + camera.x + x * camera.zoom,
          y: stage.y + camera.y + y * camera.zoom,
        });
      const start = screen(220, 260),
        end = screen(245, 278);
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 3 });
      await page
        .locator("#stage")
        .evaluate((s) =>
          s.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 })),
        );
      await page.mouse.up();
      assert.equal(
        (await page.evaluate(() => evirStudio.pathDraft())).added,
        1,
      );
      const pointer = screen(235, 300),
        handle = screen(255, 320);
      await page.mouse.move(pointer.x, pointer.y);
      await page.mouse.down();
      await page.mouse.move(handle.x, handle.y, { steps: 4 });
      await page.mouse.up();
      assert.equal(
        (await page.evaluate(() => evirStudio.pathDraft())).added,
        2,
      );
      await page.screenshot({
        path: `${out}/draft-${width}.png`,
        scale: "css",
      });
      await page.locator("#finish-path").click();
      const after = await page.evaluate(() => evirStudio.snapshot()),
        finished = after.nodes.find((n) => n.id === id);
      assert.equal(after.nodes.length, before.nodes.length);
      assert.equal(finished.geometry.points.length, 5);
      assert.equal(finished.geometry.closed, false);
      assert.deepEqual(finished.geometry.fill, node.geometry.fill);
      assert.deepEqual(
        finished.geometry.points.slice(0, 3),
        node.geometry.points,
      );
      assert.deepEqual(finished.geometry.points[3].anchor, [160, 150]);
      assert.deepEqual(finished.geometry.points[3].in, [140, 130]);
      assert.deepEqual(finished.geometry.points[3].out, [180, 170]);
      for (const [key, expected] of [
        ["anchor", [235, 300]],
        ["out", [255, 320]],
      ])
        mapPoint(
          worldTransform(after, id),
          finished.geometry.points.at(-1)[key],
        ).forEach((v, i) =>
          assert(Math.abs(v - expected[i]) < 0.02 / camera.zoom),
        );
      await page.locator("#undo").click();
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      await page.locator("#redo").click();
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        after.nodes,
      );
      await page.locator("#undo").click();
      // Source saving/reopening and native export include the retained layer ID.
      await openProject(await serializeProject(after));
      compileProject(after);
      await begin("first", true);
      await page.locator("#numeric-path-point").click();
      await page.getByLabel("New point X", { exact: true }).fill("-60");
      await page.getByLabel("New point Y", { exact: true }).fill("-30");
      await page
        .locator("#advanced-sheet")
        .getByRole("button", { name: "Apply", exact: true })
        .click();
      await page.locator("#finish-path").click();
      const prepended = (
        await page.evaluate(() => evirStudio.snapshot())
      ).nodes.find((n) => n.id === id);
      assert.equal(prepended.geometry.closed, true);
      assert.deepEqual(
        prepended.geometry.points.slice(1),
        node.geometry.points,
      );
      assert.deepEqual(prepended.geometry.points[0].anchor, [-60, -30]);
      await page.locator("#undo").click();
      await begin();
      await page.locator("#numeric-path-point").click();
      await page
        .locator("#advanced-sheet")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      assert.equal(
        (await page.evaluate(() => evirStudio.pathDraft())).added,
        0,
      );
      // Standard button activation cancels, while draft Undo does not consume source history.
      await page.locator("#advanced-sheet").waitFor({ state: "detached" });
      await page.locator("#cancel-path").focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => evirStudio.pathDraft()), null);
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      await begin();
      await page.locator("#undo").click();
      assert.equal(await page.evaluate(() => evirStudio.pathDraft()), null);
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      await axeCheck();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page
        .getByRole("status")
        .filter({ hasText: "Saved in this browser" })
        .waitFor();
      await page.reload();
      await page.waitForFunction(() => window.evirStudio);
      assert.deepEqual(
        (await page.evaluate(() => evirStudio.snapshot())).nodes,
        before.nodes,
      );
      assert.equal(await page.evaluate(() => evirStudio.pathDraft()), null);
      results.push({
        width,
        height,
        endpointChoice: true,
        numericCurve: true,
        nativeButtonKeyboard: true,
        pointCancel: true,
        originalPointsProtected: true,
        paintAndIdsRetained: true,
        oneUndo: true,
        firstEndpointClosed: true,
        recoveryExcludesDraft: true,
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
            "Cloud Chromium automated workflow, not physical or human accessibility evidence",
          results,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Path continuation: four responsive workflows, both endpoints, numeric curves, cancellation, source identity, history and accessibility passed.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
