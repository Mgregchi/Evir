const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const { createStaticServer } = await import("../../tools/static-server.mjs");
  const server = createStaticServer(path.resolve("apps/web/dist"));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`,
    browser = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_PATH ||
        (fs.existsSync("/usr/bin/chromium")
          ? "/usr/bin/chromium"
          : chromium.executablePath()),
      args: ["--no-sandbox"],
    });
  const { createProject, worldTransform } = await import("@evir/project-model"),
    { addNode } = await import("@evir/authoring");
  const p = createProject(),
    group = addNode(p, "group"),
    nested = addNode(p, "group", group),
    leaf = addNode(p, "rectangle", nested),
    shape = addNode(p, "rectangle", group),
    target = addNode(p, "group"),
    rest = addNode(p, "rectangle", target);
  const node = (id) => p.nodes.find((n) => n.id === id);
  node(group).name = "Character";
  node(nested).name = "Details";
  node(leaf).name = "Eye";
  node(shape).name = "Body";
  node(target).name = "Accessories";
  node(rest).name = "Badge";
  node(group).transform = [0, 1, -1, 0, 320, 80];
  node(target).transform = [0.8, 0.2, 0.5, 1.2, 80, 40];
  const evidence = path.resolve("research/results/studio-navigation");
  fs.mkdirSync(evidence, { recursive: true });
  const errors = [],
    nativeDialogs = [],
    measurements = [];
  const axeCheck = async (page) => {
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
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
  };
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
        nativeDialogs.push(d.type());
        d.dismiss();
      });
      await page.goto(origin + "/editor/studio/");
      await page.waitForFunction(() => window.evirStudio);
      await page.locator("#file").setInputFiles({
        name: "organization.evir-project",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(p)),
      });
      await page.locator("#replace-confirm").click();
      await page.waitForFunction((id) => evirStudio.snapshot().id === id, p.id);
      await page.locator("#fit").click();
      const snapshot = () => page.evaluate(() => evirStudio.snapshot());
      if (width > 850) {
        const initial = await page.locator("#layers-panel").boundingBox();
        await page.locator("#left-splitter").focus();
        await page.keyboard.press("ArrowRight");
        assert.equal(
          Math.round((await page.locator("#layers-panel").boundingBox()).width),
          Math.round(initial.width) + 10,
        );
        const splitter = await page.locator("#right-splitter").boundingBox();
        await page.mouse.move(splitter.x + 3, splitter.y + 100);
        await page.mouse.down();
        await page.mouse.move(splitter.x - 25, splitter.y + 100, { steps: 5 });
        await page.mouse.up();
        assert.equal(
          Number(
            await page.locator("#right-splitter").getAttribute("aria-valuenow"),
          ),
          288,
        );
        await page.locator("#view-toggle").click();
        await page
          .getByLabel("Layers panel width", { exact: true })
          .fill("300");
        await page
          .getByLabel("Layers panel width", { exact: true })
          .press("Tab");
        assert.equal(
          await page.locator("#left-splitter").getAttribute("aria-valuenow"),
          "300",
        );
        await page.keyboard.press("Escape");
        assert((await page.locator("#stage").boundingBox()).width >= 240);
        await page.reload();
        await page.waitForFunction(() => evirStudio);
        assert.equal(
          await page.locator("#left-splitter").getAttribute("aria-valuenow"),
          "300",
        );
        assert.equal(
          await page.locator("#right-splitter").getAttribute("aria-valuenow"),
          "288",
        );
        await page.locator("#left-splitter").focus();
        await page.keyboard.press("Enter");
        assert(await page.locator("#layers-panel").isHidden());
        assert(
          await page
            .locator("#show-layers")
            .evaluate((b) => b === document.activeElement),
        );
        await page.locator("#show-layers").click();
      } else {
        await page.locator("#show-layers").click();
      }
      await page
        .getByRole("button", { name: "Collapse Character", exact: true })
        .click();
      assert(
        await page
          .getByRole("button", { name: "Select Eye", exact: true })
          .isHidden(),
      );
      await page.getByLabel("Find a layer").fill("eye");
      assert(
        await page
          .getByRole("button", { name: "Select Character", exact: true })
          .isVisible(),
      );
      assert(
        await page
          .getByRole("button", { name: "Select Details", exact: true })
          .isVisible(),
      );
      assert(
        await page
          .getByRole("button", { name: "Select Eye", exact: true })
          .isVisible(),
      );
      await page.getByLabel("Find a layer").fill("");
      await page
        .getByRole("button", { name: "Select Character", exact: true })
        .focus();
      await page.keyboard.press("ArrowRight");
      assert(
        await page
          .getByRole("button", { name: "Select Eye", exact: true })
          .isVisible(),
      );
      await page.keyboard.press("ArrowLeft");
      assert(
        await page
          .getByRole("button", { name: "Select Eye", exact: true })
          .isHidden(),
      );
      await page
        .getByRole("button", { name: "Expand Character", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Select Details", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Select multiple layers", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Select Body", exact: true })
        .click();
      assert.equal(
        (await page.evaluate(() => evirStudio.selections())).length,
        2,
      );
      const before = await snapshot();
      await page.locator("#organize-layers").click();
      assert(await page.locator("#organize-dialog").isVisible());
      assert(
        await page
          .getByLabel("Destination parent")
          .evaluate((e) => e === document.activeElement),
      );
      const options = await page
        .getByLabel("Destination parent")
        .locator("option")
        .evaluateAll((options) => options.map((o) => o.value));
      assert(!options.includes(nested));
      await page.getByLabel("Destination parent").selectOption(target);
      await page.getByLabel("Stacking position").selectOption("back");
      await axeCheck(page);
      const sheet = await page.locator("#organize-dialog").boundingBox();
      assert(sheet.y + sheet.height >= height - 17);
      assert(sheet.width <= width);
      await page.screenshot({
        path: path.join(evidence, `organization-${width}.png`),
        scale: "css",
      });
      await page.locator("#organize-apply").click();
      const after = await snapshot();
      assert.equal(after.nodes.find((n) => n.id === nested).parentId, target);
      assert.equal(after.nodes.find((n) => n.id === shape).parentId, target);
      assert.equal(after.nodes.find((n) => n.id === leaf).parentId, nested);
      for (const id of [nested, shape, leaf]) {
        const a = worldTransform(before, id),
          b = worldTransform(after, id);
        a.forEach((v, i) => assert(Math.abs(v - b[i]) < 1e-8));
      }
      assert(
        await page
          .locator("#organize-layers")
          .evaluate((e) => e === document.activeElement),
      );
      if (width <= 850) await page.locator("#close-panel").click();
      await page.locator("#undo").click();
      assert.deepEqual((await snapshot()).nodes, before.nodes);
      if (width <= 850) await page.locator("#show-layers").click();
      await page
        .getByRole("button", { name: "Lock Body", exact: true })
        .click();
      await page.locator("#organize-layers").click();
      const lockedBefore = await snapshot();
      await page.getByLabel("Destination parent").selectOption(target);
      await page.locator("#organize-apply").click();
      assert(await page.locator("#organize-dialog #notice").isVisible());
      assert.deepEqual((await snapshot()).nodes, lockedBefore.nodes);
      await page.keyboard.press("Escape");
      assert(
        await page
          .locator("#organize-layers")
          .evaluate((e) => e === document.activeElement),
      );
      if (width <= 850) await page.locator("#close-panel").click();
      await axeCheck(page);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: path.join(evidence, `workspace-${width}.png`),
        scale: "css",
      });
      measurements.push({
        width,
        height,
        sheet,
        stage: await page.locator("#stage").boundingBox(),
      });
      await context.close();
    }
    // Real Chromium touch dispatch tests interruption of a provisional edit, camera math and cancellation.
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/editor/studio/");
    await page.waitForFunction(() => evirStudio);
    await page.locator("#fit").click();
    const cdp = await context.newCDPSession(page),
      snap = () => page.evaluate(() => evirStudio.snapshot());
    const before = await snap(),
      stage = await page.locator("#stage").boundingBox(),
      camera = before.editor.cameras[before.artboards[0].id];
    const points = [
      {
        id: 1,
        x: stage.x + camera.x + 310 * camera.zoom,
        y: stage.y + camera.y + 240 * camera.zoom,
        radiusX: 2,
        radiusY: 2,
      },
      {
        id: 2,
        x: stage.x + stage.width * 0.75,
        y: stage.y + stage.height * 0.55,
        radiusX: 2,
        radiusY: 2,
      },
    ];
    const touch = (type, pts) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
    // An incidental finger cannot move or finish a mouse/stylus drag.
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down();
    const mousePreview = await page.evaluate(() => evirStudio.pose().nodes);
    await touch("touchStart", [points[1]]);
    await touch("touchMove", [{ ...points[1], x: points[1].x + 12 }]);
    await touch("touchEnd", []);
    assert.deepEqual(
      await page.evaluate(() => evirStudio.pose().nodes),
      mousePreview,
    );
    await page.mouse.move(points[0].x + 8, points[0].y + 8);
    await page.mouse.up();
    assert.notDeepEqual((await snap()).nodes, before.nodes);
    await page.locator("#undo").click();
    assert.deepEqual((await snap()).nodes, before.nodes);
    await touch("touchStart", [points[0]]);
    await touch("touchMove", [{ ...points[0], x: points[0].x + 14 }]);
    assert.notDeepEqual(
      await page.evaluate(() => evirStudio.pose().nodes),
      before.nodes,
      "first touch previews a move",
    );
    points[0].x += 14;
    await touch("touchStart", points);
    assert.deepEqual(
      await page.evaluate(() => evirStudio.pose().nodes),
      before.nodes,
      "second finger rolls back the pending edit",
    );
    const mid = {
        x: (points[0].x + points[1].x) / 2 - stage.x,
        y: (points[0].y + points[1].y) / 2 - stage.y,
      },
      distance = Math.hypot(
        points[1].x - points[0].x,
        points[1].y - points[0].y,
      );
    const moved = points.map((q) => ({
      ...q,
      x: stage.x + mid.x + 18 + (q.x - stage.x - mid.x) * 1.4,
      y: stage.y + mid.y - 12 + (q.y - stage.y - mid.y) * 1.4,
    }));
    await touch("touchMove", moved);
    const after = await snap(),
      next = after.editor.cameras[after.artboards[0].id];
    assert(Math.abs(next.zoom - camera.zoom * 1.4) < 1e-5);
    assert(
      Math.abs(
        (mid.x - camera.x) / camera.zoom - (mid.x + 18 - next.x) / next.zoom,
      ) < 1e-4,
    );
    assert(
      Math.abs(
        (mid.y - camera.y) / camera.zoom - (mid.y - 12 - next.y) / next.zoom,
      ) < 1e-4,
    );
    await touch("touchEnd", [moved[0]]);
    await touch("touchMove", [{ ...moved[0], x: moved[0].x + 20 }]);
    await touch("touchEnd", []);
    assert.deepEqual((await snap()).nodes, before.nodes);
    assert(await page.locator("#undo").isDisabled());
    await touch("touchStart", points);
    await touch("touchCancel", []);
    await page.locator("#create-toggle").click();
    await page.locator("#add-rectangle").click();
    assert.equal((await snap()).nodes.length, 14);
    await page.locator("#undo").click();
    assert.deepEqual((await snap()).nodes, before.nodes);
    // A third finger pauses navigation; normal authoring starts only after all fingers lift.
    await touch("touchStart", points);
    await touch("touchStart", [
      ...points,
      { id: 3, x: stage.x + 30, y: stage.y + 30 },
    ]);
    const third = await snap();
    await touch(
      "touchMove",
      points
        .map((q) => ({ ...q, x: q.x + 10 }))
        .concat({ id: 3, x: stage.x + 40, y: stage.y + 30 }),
    );
    assert.deepEqual((await snap()).editor.cameras, third.editor.cameras);
    await touch("touchEnd", []);
    // Touch interaction activates on release; two fingers must not fire a listener.
    const { scenes } = await import("./scenes.mjs");
    const interaction = scenes();
    await page.locator("#file").setInputFiles({
      name: "touch-interaction.evir-project",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(interaction.p)),
    });
    await page.locator("#replace-confirm").click();
    await page.waitForFunction(
      (id) => evirStudio.snapshot().id === id,
      interaction.p.id,
    );
    await page.getByRole("button", { name: "Interact", exact: true }).click();
    await page.locator("#fit").click();
    const targetScreen = async () => {
      const p = await snap(),
        c = p.editor.cameras[p.artboards[0].id],
        r = await page.locator("#stage").boundingBox();
      return {
        id: 10,
        x: r.x + c.x + 100 * c.zoom,
        y: r.y + c.y + 120 * c.zoom,
      };
    };
    const interactionBefore = await page.evaluate(
      () => evirStudio.pose().nodes,
    );
    const targetPoint = await targetScreen();
    await touch("touchStart", [targetPoint]);
    assert.deepEqual(
      await page.evaluate(() => evirStudio.pose().nodes),
      interactionBefore,
    );
    await touch("touchStart", [
      targetPoint,
      { id: 11, x: targetPoint.x + 40, y: targetPoint.y + 20 },
    ]);
    await touch("touchEnd", []);
    assert.deepEqual(
      await page.evaluate(() => evirStudio.pose().nodes),
      interactionBefore,
    );
    await touch("touchStart", [await targetScreen()]);
    await touch("touchEnd", []);
    assert.notDeepEqual(
      await page.evaluate(() => evirStudio.pose().nodes),
      interactionBefore,
      "a released single tap fires the listener",
    );
    await page.screenshot({
      path: path.join(evidence, "touch-camera.png"),
      scale: "css",
    });
    await context.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(nativeDialogs, []);
    fs.writeFileSync(
      path.join(evidence, "acceptance.json"),
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          measurements,
          checks: [
            "keyboard, pointer and numeric panel resizing",
            "stage width budget and layout recovery",
            "splitter collapse focus",
            "hierarchy collapse, keyboard and search ancestors",
            "single-pointer bulk organization and preserved affine positions",
            "one-step undo, locked rejection and feedback in sheet",
            "bottom sheets at five sizes",
            "two-finger focal zoom/pan and provisional-edit rollback",
            "one/three-finger navigation guards and touch cancellation",
            "automated WCAG checks",
          ],
          limits:
            "Chromium with synthetic touch dispatch; no physical touch, screen-reader or moderated usability certification.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log("Studio navigation and organization acceptance passed");
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
