const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { createHash } = require("node:crypto");
const { run } = require("../../tools/browser.cjs");
(async () => {
  const { createProject } = await import("@evir/project-model");
  const results = [],
    out = "research/results/studio-workflow";
  fs.mkdirSync(out, { recursive: true });
  await run(async (page, browser) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("http://127.0.0.1:8776/apps/web/dist/editor/studio/");
      await page.waitForFunction(() => window.evirStudio);
      const press = (name) => require("./actions.cjs").press(page, name);
      const load = async (name) => {
        await page
          .locator("#file")
          .setInputFiles(
            path.resolve(`apps/web/assets/examples/${name}.evir-project`),
          );
        await page.locator("#replace-confirm").click();
        await page.waitForFunction(
          (name) => evirStudio.snapshot().id === name + "-project",
          name,
        );
      };
      await load("arrange");
      if (width < 850) await press("Layers");
      await press("Select multiple layers");
      for (const name of ["card 1", "card 2", "card 3"])
        await press("Select " + name);
      if (width < 850) {
        await page.keyboard.press("Escape");
        await press("Properties");
      }
      await press("Distribute horizontal");
      assert.equal(
        await page.evaluate(
          () =>
            evirStudio.snapshot().nodes.find((n) => n.id === "arrange-card-2")
              .transform[4],
        ),
        212,
      );
      if (width < 850) await page.keyboard.press("Escape");
      await press("Undo");
      if (width < 850) await press("Layers");
      await press("Select multiple layers");
      await press("Select card 3");
      await press("Organize selection");
      await page
        .getByLabel("Stacking position", { exact: true })
        .selectOption("above");
      await page
        .getByLabel("Reference layer", { exact: true })
        .selectOption("arrange-card-1");
      await press("Apply organization");
      const ordered = await page.evaluate(() =>
        evirStudio
          .snapshot()
          .nodes.filter((n) => n.parentId === null)
          .sort((a, b) => a.order - b.order)
          .map((n) => n.id),
      );
      assert.equal(
        ordered.indexOf("arrange-card-3"),
        ordered.indexOf("arrange-card-1") + 1,
      );
      if (width < 850) await page.keyboard.press("Escape");
      await press("Undo");
      if (width === 1440) {
        for (let i = 1; i <= 6; i++) await press("Collapse card " + i);
        await page
          .getByRole("button", { name: "Select card 3", exact: true })
          .dragTo(
            page.getByRole("button", { name: "Select card 1", exact: true }),
            { targetPosition: { x: 45, y: 2 } },
          );
        const order = await page.evaluate(() =>
          evirStudio
            .snapshot()
            .nodes.filter((n) => n.parentId === null)
            .sort((a, b) => a.order - b.order)
            .map((n) => n.id),
        );
        assert.equal(
          order.indexOf("arrange-card-3"),
          order.indexOf("arrange-card-1") + 1,
        );
        await press("Undo");
      }
      await load("milo");
      if (width < 850) await press("Layers");
      await press("Select shoulder");
      if (width < 850) await page.keyboard.press("Escape");
      await press("Animate");
      if (width < 850) await press("Timeline");
      await press("Next key");
      assert.equal(await page.locator("#frame-label").innerText(), "60f");
      await press("Previous key");
      assert.equal(await page.locator("#frame-label").innerText(), "0f");
      if (width < 850) await page.keyboard.press("Escape");
      await press("Interact");
      if (width < 850) await press("Machine");
      await page
        .getByRole("button", { name: "Edit state Hello", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await page.getByLabel("State name", { exact: true }).inputValue(),
        "Hello",
      );
      await press("Focus state");
      const box = await page
        .locator(".machine-graph svg")
        .getAttribute("viewBox");
      assert.equal(box.split(" ").at(2), "160");
      await press("Fit graph");
      await press("Focus state");
      const state = page.getByRole("button", {
        name: "Edit state Hello",
        exact: true,
      });
      await state.scrollIntoViewIfNeeded();
      const bounds = await state.boundingBox();
      const before = await page.evaluate(
        () =>
          evirStudio
            .snapshot()
            .machines[0].states.find((s) => s.name === "Hello").position,
      );
      await page.mouse.move(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        bounds.x + bounds.width / 2 + 35,
        bounds.y + bounds.height / 2 + 15,
        { steps: 4 },
      );
      await page.mouse.up();
      const after = await page.evaluate(
        () =>
          evirStudio
            .snapshot()
            .machines[0].states.find((s) => s.name === "Hello").position,
      );
      assert.notDeepEqual(after, before);
      if (width < 850) await page.keyboard.press("Escape");
      await press("Undo");
      assert.deepEqual(
        await page.evaluate(
          () =>
            evirStudio
              .snapshot()
              .machines[0].states.find((s) => s.name === "Hello").position,
        ),
        before,
      );
      if (width < 850) await press("Machine");
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const violations = await page.evaluate(async () =>
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
      );
      assert.deepEqual(violations, []);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({ path: `${out}/graph-${width}.png` });
      results.push({
        width,
        checks: [
          "distribution/undo",
          "relative organization",
          ...(width === 1440
            ? ["native desktop layer drag between visible rows"]
            : []),
          "key navigation",
          "graph keyboard selection/focus/drag/undo",
          "automated axe/reflow",
        ],
      });
    }
    // A fresh origin storage context exercises migration from the old recovery key.
    const context = await browser.newContext({
        viewport: { width: 1440, height: 844 },
      }),
      p = await context.newPage();
    await p.goto("http://127.0.0.1:8776/tools/runtime.html");
    const legacy = JSON.parse(
      fs.readFileSync("apps/web/assets/examples/arrange.evir-project"),
    );
    legacy.name = "Legacy recovery";
    await p.evaluate(
      (project) =>
        localStorage.setItem("evir.studio.project.v1", JSON.stringify(project)),
      legacy,
    );
    await p.goto("http://127.0.0.1:8776/apps/web/dist/editor/studio/");
    await p.waitForFunction(
      () =>
        window.evirStudio && evirStudio.snapshot().name === "Legacy recovery",
    );
    await p
      .getByRole("status")
      .filter({ hasText: "Saved in this browser" })
      .waitFor();
    assert.equal(
      await p.evaluate(() => localStorage.getItem("evir.studio.project.v1")),
      null,
    );
    const large = createProject();
    large.id = "large-project";
    large.name = "Large recovery";
    const board = (large.artboards[0].id = "large-board");
    large.editor.cameras = { [board]: { x: 0, y: 0, zoom: 1 } };
    large.nodes = Array.from({ length: 1000 }, (_, i) => ({
      id: "large-" + i,
      name: "Tile " + i,
      kind: "rectangle",
      artboardId: board,
      parentId: null,
      order: i,
      transform: [1, 0, 0, 1, (i % 40) * 12, Math.floor(i / 40) * 12],
      geometry: { width: 10, height: 10, fill: "#89dcc0" },
    }));
    const bytes = Buffer.alloc(4 * 1024 * 1024, 42);
    large.assets = [
      {
        id: "recovery-bytes",
        name: "Original recovery workload",
        mimeType: "application/octet-stream",
        data: bytes.toString("base64"),
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    ];
    const inputBytes = Buffer.from(JSON.stringify(large));
    assert(inputBytes.length > 5 * 1024 * 1024);
    await p.locator("#file").setInputFiles({
      name: "large.evir-project",
      mimeType: "application/json",
      buffer: inputBytes,
    });
    await p.locator("#replace-confirm").click();
    await p.waitForFunction(() => evirStudio.snapshot().id === "large-project");
    await p
      .getByRole("status")
      .filter({ hasText: "Saved in this browser" })
      .waitFor();
    assert.equal(await p.locator("#layers .layer-select").count(), 120);
    await p
      .getByRole("button", { name: "Select Tile 999", exact: true })
      .focus();
    await p.keyboard.press("End");
    assert.equal(await p.evaluate(() => evirStudio.selection()), "large-0");
    assert((await p.locator("#layers .layer-select").count()) <= 120);
    await p.getByLabel("Find a layer", { exact: true }).fill("Tile 750");
    assert.equal(await p.locator("#layers .layer-select").count(), 1);
    await p
      .getByRole("button", { name: "Select Tile 750", exact: true })
      .click();
    await p.getByLabel("Find a layer", { exact: true }).fill("");
    assert((await p.locator("#layers .layer-select").count()) <= 120);
    await p.reload();
    await p.waitForFunction(
      () => window.evirStudio && evirStudio.snapshot().id === "large-project",
    );
    const restored = await p.evaluate(() => evirStudio.snapshot());
    assert.equal(restored.nodes.length, 1000);
    assert.equal(restored.assets[0].sha256, large.assets[0].sha256);
    assert.equal(restored.assets[0].data.length, large.assets[0].data.length);
    await p
      .getByRole("status")
      .filter({ hasText: "Saved in this browser" })
      .waitFor();
    await p.evaluate(async () => {
      const { ProjectRecovery } = await import("/packages/studio/recovery.mjs");
      const recovery = new ProjectRecovery();
      const before = (await recovery.read()).project;
      let rejected = false;
      try {
        await recovery.transaction("readwrite", (store) => {
          const req = store.put(
            { ...before, name: "Aborted write" },
            "current",
          );
          req.onsuccess = () => store.transaction.abort();
          return req;
        });
      } catch {
        rejected = true;
      }
      if (!rejected || (await recovery.read()).project.name !== before.name)
        throw Error("Aborted transaction changed durable recovery");
      await recovery.close();
    });
    await p.screenshot({ path: `${out}/large-workspace.png` });
    results.push({
      recovery: [
        "legacy migration after durable commit",
        "1000-node panel bounded to 120 rows",
        "cross-page keyboard/search selection",
        "4 MiB asset/over-5 MiB encoded project reload",
        "aborted transaction retains previous durable project",
      ],
      inputProjectBytes: inputBytes.length,
      inputProjectSha256: createHash("sha256").update(inputBytes).digest("hex"),
      scope: "Real headless browser storage, not device memory",
    });
    await context.close();
  });
  fs.writeFileSync(
    `${out}/browser.json`,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        scope: "Automated software Chromium; no physical-device/human evidence",
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Workflow and large recovery browser checks passed");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
