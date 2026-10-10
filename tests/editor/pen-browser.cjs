const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PNG } = require("pngjs");
const { createHash } = require("node:crypto");
const { run } = require("../../tools/browser.cjs");
const gpu = require("../../tools/gpu_diagnostics.cjs");

(async () => {
  await require("../../tools/prepare-oracle.cjs").prepare();
  const { createProject } = await import("@evir/project-model");
  const { addNode } = await import("@evir/authoring");
  const source = createProject();
  const parentId = addNode(source, "group");
  source.nodes[0].name = "Rotated group";
  source.nodes[0].transform = [0, 1.2, -0.8, 0, 320, 80];
  await run(async (page) => {
    await gpu.install(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:8776/apps/web/dist/editor/studio/");
    await page.waitForFunction(() => window.evirStudio);
    const press = (name) => require("./actions.cjs").press(page, name);
    const snapshot = () => page.evaluate(() => evirStudio.snapshot());
    const open = async (project) => {
      await page.locator("#file").setInputFiles({
        name: "drawing.evir-project.json", mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(project)),
      });
      await page.locator("#replace-project").waitFor({ state: "visible" });
      await page.locator("#replace-confirm").click();
      await page.waitForFunction((id) => evirStudio.snapshot().id === id, project.id);
      await press("Fit");
    };
    await open(source);
    await press("Select Rotated group");
    const screen = async (x, y) => {
      const p = await snapshot(), c = p.editor.cameras[p.artboards[0].id];
      const r = await page.locator("#stage").boundingBox();
      return [r.x + c.x + x * c.zoom, r.y + c.y + y * c.zoom];
    };
    const click = async (x, y) => page.mouse.click(...await screen(x, y));
    const curve = async (x, y, hx, hy) => {
      await page.mouse.move(...await screen(x, y));
      await page.mouse.down();
      await page.mouse.move(...await screen(hx, hy), { steps: 5 });
      await page.mouse.up();
    };
    await press("Pen");
    await click(160, 120);
    await curve(300, 160, 330, 210);
    assert.deepEqual((await snapshot()).nodes, source.nodes, "draft cannot mutate committed source");
    assert.equal(await page.locator("#undo").isEnabled(), true);
    await press("Undo");
    assert.deepEqual((await snapshot()).nodes, source.nodes, "draft undo leaves older work intact");
    await click(160, 120);
    await curve(300, 160, 330, 210);
    assert.equal(await page.locator("#finish-path").isEnabled(), true);
    await press("Animate");
    assert.equal(await page.evaluate(() => evirStudio.mode()), "Design");
    assert.match(await page.locator("#notice").innerText(), /Finish or cancel/);
    await press("Save project");
    assert.match(await page.locator("#notice").innerText(), /Finish or cancel/);
    await press("Export .riv");
    assert.match(await page.locator("#notice").innerText(), /Finish or cancel/);
    // A cancelled captured gesture only removes that point, leaving prior draft points.
    await page.mouse.move(...await screen(220, 260));
    await page.mouse.down();
    await page.mouse.move(...await screen(260, 280));
    await page.locator("#stage").evaluate((stage) => stage.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 })));
    await page.mouse.up();
    assert.match(await page.locator("#selection-status").innerText(), /2 points/);
    await click(220, 280);
    await page.keyboard.press("Backspace");
    assert.match(await page.locator("#selection-status").innerText(), /2 points/);
    await click(220, 280);
    await click(160, 120); // First-anchor click closes without adding a duplicate anchor.
    const authored = await snapshot();
    const pathId = await page.evaluate(() => evirStudio.selection());
    const path = authored.nodes.find((n) => n.id === pathId);
    assert.equal(path.parentId, parentId);
    assert.equal(path.geometry.closed, true);
    assert.equal(path.geometry.points.length, 3);
    const { worldPoints } = await import("@evir/runtime/geometry");
    const points = worldPoints(authored, path);
    const near = (actual, expected) => actual.forEach((v, i) => assert(Math.abs(v - expected[i]) < 0.02));
    near(points[0].anchor, [160, 120]);
    near(points[1].anchor, [300, 160]);
    near(points[1].out, [330, 210]);
    near(points[1].in, [270, 110]);
    await press("Undo");
    assert.deepEqual((await snapshot()).nodes, source.nodes, "one undo removes the whole finished path");
    await press("Redo");
    assert.deepEqual((await snapshot()).nodes, authored.nodes);
    await press("Select " + path.name);
    // Escape and the visible Cancel leave the source and existing undo history intact.
    await press("Pen");
    await click(360, 240);
    await page.keyboard.press("Escape");
    assert.deepEqual((await snapshot()).nodes, authored.nodes);
    await click(360, 240);
    await press("Cancel path");
    assert.deepEqual((await snapshot()).nodes, authored.nodes);
    await page.mouse.move(...await screen(360, 240));
    await page.mouse.down();
    await page.locator("#stage").evaluate((stage) => stage.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 })));
    await page.mouse.up();
    assert.equal(await page.locator("#pen-actions").isHidden(), true);
    assert.equal(await page.getByLabel("Layer name", { exact: true }).isEnabled(), true);
    await click(360, 240);
    await page.keyboard.press("Enter");
    assert.match(await page.locator("#notice").innerText(), /two points/);
    await click(440, 300);
    await page.keyboard.press("Enter");
    const openPath = (await snapshot()).nodes.at(-1);
    assert.equal(openPath.geometry.closed, false);
    assert.equal(openPath.geometry.points.length, 2);
    await press("Undo");
    assert.deepEqual((await snapshot()).nodes, authored.nodes);
    await press("Select " + path.name);
    await page.getByLabel("Layer name", { exact: true }).fill("Typed P");
    await page.keyboard.press("p");
    assert.equal(await page.locator("#pen-tool").getAttribute("aria-pressed"), "false", "shortcut does not run inside text input");
    await page.keyboard.press("Escape");
    await page.getByLabel("Layer name", { exact: true }).fill("Drawn curve");
    await page.keyboard.press("Tab");
    // Use the new path's existing inspector to edit a drawn control.
    await press("Edit points");
    const pointX = page.getByLabel("Point X", { exact: true });
    const previousX = Number(await pointX.inputValue());
    await pointX.fill(String(previousX + 5));
    await pointX.press("Tab");
    assert.equal((await snapshot()).nodes.find((n) => n.id === pathId).geometry.points[0].anchor[0], previousX + 5);
    await press("Undo");
    const savedPromise = page.waitForEvent("download");
    await press("Save project");
    const saved = JSON.parse(fs.readFileSync(await (await savedPromise).path(), "utf8"));
    await open(saved);
    assert.deepEqual((await snapshot()).nodes, saved.nodes);
    await page.waitForFunction(() => document.querySelector("#save-status").textContent === "Saved in this browser");
    await page.reload();
    await page.waitForFunction(() => window.evirStudio);
    assert.deepEqual((await snapshot()).nodes, saved.nodes);
    await press("Animate");
    assert.equal(await page.locator("#pen-tool").isDisabled(), true);
    await page.locator("#stage").focus();
    await page.keyboard.press("p");
    assert.match(await page.locator("#notice").innerText(), /Return to Design/);
    await press("Design");
    await page.getByRole("button", { name: "Dismiss message" }).click();
    await press("Select " + saved.nodes.find((n) => n.id === pathId).name);
    await press("Edit points");
    fs.mkdirSync("research/results/editor-pen", { recursive: true });
    await page.screenshot({ path: "research/results/editor-pen/drawn-path.png" });
    await page.setViewportSize({ width: 1100, height: 800 });
    await press("Fit");
    await press("Pen");
    await click(240, 180);
    await page.keyboard.down("Space");
    await page.mouse.move(...await screen(260, 180));
    await page.mouse.down();
    const panStart = await screen(260, 180);
    await page.mouse.move(panStart[0] + 15, panStart[1] + 12);
    await page.mouse.up();
    await page.keyboard.up("Space");
    assert.match(await page.locator("#selection-status").innerText(), /1 point/);
    await curve(320, 220, 350, 240);
    await page.locator("#finish-path").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "research/results/editor-pen/draft-laptop.png" });
    await press("Finish path");
    assert.equal((await snapshot()).nodes.at(-1).geometry.closed, false);
    await press("Undo");
    await press("Redo");
    const downloads = [];
    page.on("download", (d) => downloads.push(d));
    await press("Export .riv");
    await page.waitForFunction(() => document.querySelector("#notice span").textContent.includes("source map downloaded"));
    for (let i = 0; i < 50 && downloads.length < 2; i++) await page.waitForTimeout(20);
    assert.equal(downloads.length, 2);
    const riv = downloads.find((d) => d.suggestedFilename().endsWith(".riv"));
    const bytes = fs.readFileSync(await riv.path());
    fs.writeFileSync("tools/.test-build/pen-authored.riv", bytes);
    const expectedProject = await snapshot();
    const checks = [];
    for (const backend of ["canvas", "webgl2"]) {
      await page.goto("http://127.0.0.1:8776/tools/runtime.html?renderer=" + backend);
      await page.evaluate(() => loadFixture("pen-authored", { src: "/tools/.test-build/pen-authored.riv", autoplay: false }));
      await page.evaluate(() => { player.stopRendering(); player.drawFrame(); });
      const expected = await page.evaluate(async (p) => {
        const { drawScene } = await import("/tools/.test-build/oracle.mjs");
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext("2d"), a = p.artboards[0];
        const scale = Math.min(256 / a.width, 256 / a.height);
        ctx.translate((256 - a.width * scale) / 2, (256 - a.height * scale) / 2);
        ctx.scale(scale, scale);
        drawScene(ctx, p, a.id);
        return Array.from(ctx.getImageData(0, 0, 256, 256).data);
      }, expectedProject);
      const actual = backend === "canvas"
        ? await page.evaluate(() => Array.from(document.querySelector("#canvas").getContext("2d").getImageData(0, 0, 256, 256).data))
        : PNG.sync.read(await page.locator("#canvas").screenshot({ omitBackground: true })).data;
      let error = 0, expectedCovered = 0, actualCovered = 0;
      for (let i = 0; i < actual.length; i += 4) {
        if (expected[i + 3]) expectedCovered++;
        if (actual[i + 3]) actualCovered++;
        for (let k = 0; k < 4; k++) error += Math.abs(actual[i + k] - expected[i + k]);
      }
      const mae = error / actual.length;
      assert(mae < 2.5, `${backend}: rendered path differs by ${mae}`);
      assert(Math.abs(expectedCovered - actualCovered) < 350);
      assert(expectedCovered > 100, "oracle includes visible geometry");
      const diagnostics = await gpu.collect(page);
      if (backend === "webgl2") {
        assert(diagnostics.contexts.length > 0, "observe the actual WebGL2 runtime context");
        assert(diagnostics.contexts.every((gl) => !gl.contextLost && !gl.errors.length));
      }
      checks.push({ backend, mae, expectedCovered, actualCovered, diagnostics });
    }
    fs.writeFileSync("research/results/editor-pen/acceptance.json", JSON.stringify({
      checkedAt: new Date().toISOString(), runtimeVersion: "2.44.0",
      exportBytes: bytes.length,
      exportSha256: createHash("sha256").update(bytes).digest("hex"),
      scope: "Desktop Pen authoring, persistence and official web-runtime export pixels. Cloud graphics; no mobile or usability claim.",
      checks,
    }, null, 2) + "\n");
    console.log("Pen browser workflow and official Canvas2D/WebGL2 export comparisons passed.",
      checks.map(({ diagnostics, ...comparison }) => comparison));
  });
})().catch((error) => { console.error(error); process.exitCode = 1; });
