const assert = require("node:assert/strict");
const fs = require("node:fs");
const { run } = require("../../tools/browser.cjs");
run(async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:8776/editor/");
  await page.waitForFunction(() => window.evirStudio);
  await page
    .getByRole("status")
    .filter({ hasText: "Saved in this browser" })
    .waitFor();
  const snapshot = () => page.evaluate(() => evirStudio.snapshot());
  const start = await snapshot();
  assert.equal(start.name, "Little explorer");
  assert.equal(start.nodes.length, 13);
  // Search and exact layer selection make a nested shape discoverable.
  await page.getByLabel("Find a layer").fill("Body");
  await page.getByRole("button", { name: "Select Body", exact: true }).click();
  assert.equal(
    await page.getByLabel("Layer name", { exact: true }).inputValue(),
    "Body",
  );
  await page.getByLabel("X", { exact: true }).fill("32");
  await page.getByLabel("X", { exact: true }).press("Tab");
  assert.equal(
    (await snapshot()).nodes.find((n) => n.name === "Body").transform[4],
    32,
  );
  await page.getByRole("button", { name: "↶ Undo", exact: true }).click();
  assert.equal(
    (await snapshot()).nodes.find((n) => n.name === "Body").transform[4],
    10,
  );
  await page.getByRole("button", { name: "↷ Redo", exact: true }).click();
  assert.equal(
    (await snapshot()).nodes.find((n) => n.name === "Body").transform[4],
    32,
  );
  // Editing in a text field must not trigger global tool shortcuts.
  await page.getByLabel("Layer name", { exact: true }).fill("Body renamed");
  await page.getByLabel("Layer name", { exact: true }).press("Tab");
  assert.equal((await snapshot()).nodes.length, 13);
  await page.getByLabel("Find a layer").fill("");
  await page
    .getByRole("button", { name: "Select Explorer", exact: true })
    .click();
  const stage = await page.locator("#stage").boundingBox(),
    p = await snapshot();
  const c = p.editor.cameras[p.artboards[0].id],
    group = p.nodes.find((n) => n.name === "Explorer");
  const x = stage.x + c.x + (group.transform[4] + 91) * c.zoom,
    y = stage.y + c.y + (group.transform[5] + 160) * c.zoom;
  // A canceled drag must not leak into autosave or the command history.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 50, y + 25, { steps: 5 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.deepEqual(
    (await snapshot()).nodes.find((n) => n.id === group.id).transform,
    group.transform,
  );
  // A multi-event drag is one undo step.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 20, { steps: 8 });
  await page.mouse.up();
  const moved = (await snapshot()).nodes.find((n) => n.id === group.id);
  assert(
    Math.abs(moved.transform[4] - group.transform[4] - 40 / c.zoom) < 1e-6,
  );
  await page.keyboard.press("Control+z");
  assert.deepEqual(
    (await snapshot()).nodes.find((n) => n.id === group.id).transform,
    group.transform,
  );
  await page.keyboard.press("Control+Shift+z");
  assert.deepEqual(
    (await snapshot()).nodes.find((n) => n.id === group.id).transform,
    moved.transform,
  );
  // Keyboard focus and help are visible, and saving produces the actual model.
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save project", exact: false })
    .click();
  const download = await downloadPromise;
  const downloaded = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  assert.deepEqual(downloaded, await snapshot());
  await page.getByLabel("Project name", { exact: true }).fill("Explorer study");
  const shortcutDownload = page.waitForEvent("download");
  await page.getByLabel("Project name", { exact: true }).press("Control+s");
  const shortcutFile = await shortcutDownload;
  assert.equal(
    JSON.parse(fs.readFileSync(await shortcutFile.path(), "utf8")).name,
    "Explorer study",
  );
  // Invalid imports leave the current project intact and give a usable error.
  const before = await snapshot();
  await page.locator("#file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...before, schemaVersion: 99 })),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "unsupported version" })
    .waitFor();
  assert.deepEqual(await snapshot(), before);
  await page.getByRole("button", { name: "Dismiss message" }).click();
  // Valid imports, including asset bytes, are restored atomically after confirmation.

  const importData = structuredClone(before);
  importData.name = "Imported explorer";
  importData.assets.push({
    id: "browser-asset",
    name: "Source bytes",
    mimeType: "application/octet-stream",
    sha256: require("node:crypto")
      .createHash("sha256")
      .update("browser asset")
      .digest("hex"),
    data: Buffer.from("browser asset").toString("base64"),
  });
  await page.locator("#file").setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(importData)),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Open project", exact: true })
    .click();
  await page.waitForFunction(
    () => evirStudio.snapshot().name === "Imported explorer",
  );
  await page
    .getByRole("status")
    .filter({ hasText: "Saved in this browser" })
    .waitFor();
  await page.reload();
  await page.waitForFunction(() => window.evirStudio);
  assert.deepEqual(await snapshot(), importData);
  await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
  assert(await page.getByRole("dialog").isVisible());
  await page.getByRole("button", { name: "Back to creating" }).click();
  fs.mkdirSync("research/results/editor-prototype", { recursive: true });
  await page.screenshot({
    path: "research/results/editor-prototype/workspace.png",
  });
  // At a common laptop width, the stage remains usable and controls do not overflow.
  await page.setViewportSize({ width: 1100, height: 760 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const compact = await page.locator("#stage").boundingBox();
  assert(compact.width >= 400);
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await page.getByRole("button", { name: "Select Head", exact: true }).click();
  await page.screenshot({
    path: "research/results/editor-prototype/workspace-laptop.png",
  });
  // Deep selection, inherited locks, visibility, replacement cancellation and empty state.
  const laptop = await snapshot(),
    head = laptop.nodes.find((n) => n.name === "Head"),
    root = laptop.nodes.find((n) => n.name === "Explorer"),
    cam = laptop.editor.cameras[laptop.artboards[0].id],
    area = await page.locator("#stage").boundingBox();
  await page.keyboard.down("Control");
  await page.mouse.click(
    area.x + cam.x + (root.transform[4] + 90) * cam.zoom,
    area.y + cam.y + (root.transform[5] + 15) * cam.zoom,
  );
  await page.keyboard.up("Control");
  assert.equal(await page.evaluate(() => evirStudio.selection()), head.id);
  // Space activates a focused control instead of hijacking it for stage panning.
  await page
    .getByRole("button", { name: "Select Explorer", exact: true })
    .focus();
  await page.keyboard.press("Space");
  assert.equal(await page.evaluate(() => evirStudio.selection()), root.id);
  await page.getByRole("button", { name: "Select Head", exact: true }).focus();
  await page.keyboard.press("Space");
  assert.equal(await page.evaluate(() => evirStudio.selection()), head.id);
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  assert(await page.getByLabel("Layer name", { exact: true }).isDisabled());
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  assert(await page.getByLabel("Layer name", { exact: true }).isEnabled());
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  assert((await snapshot()).editor.hidden.includes(head.id));
  await page.getByRole("button", { name: "Show", exact: true }).click();
  const retained = await snapshot();
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  assert.deepEqual(await snapshot(), retained);
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.waitForFunction(() => evirStudio.snapshot().nodes.length === 0);
  assert.equal((await snapshot()).nodes.length, 0);
  await page
    .getByRole("button", { name: "Add a rectangle", exact: true })
    .click();
  assert.equal((await snapshot()).nodes.length, 1);
  // Storage failure keeps edits in memory and explains recovery.
  await page.evaluate(() => {
    window.originalStorageSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Download a project copy" })
    .waitFor();
  assert.equal((await snapshot()).nodes.length, 2);
  await page.evaluate(() => {
    Storage.prototype.setItem = window.originalStorageSet;
    delete window.originalStorageSet;
  });
  const recoveryDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save project", exact: false })
    .click();
  await recoveryDownload;
  await page
    .getByRole("status")
    .filter({ hasText: "Saved in this browser" })
    .waitFor();
  fs.writeFileSync(
    "research/results/editor-prototype/acceptance.json",
    JSON.stringify(
      {
        status: "passed",
        browser: await page.evaluate(() => navigator.userAgent),
        viewports: [
          { width: 1440, height: 900 },
          { width: 1100, height: 760 },
        ],
        checks: [
          "search and nested selection",
          "inspector edit and undo/redo",
          "text-field shortcut isolation",
          "drag cancellation",
          "single-step drag undo",
          "download fidelity",
          "save shortcut commits focused field",
          "invalid import preserves project",
          "valid open and local recovery",
          "keyboard-help dialog",
          "laptop layout",
          "modifier deep selection",
          "Space activates focused controls",
          "locked inspector",
          "hide/show",
          "replacement cancellation",
          "empty-state creation",
          "storage failure and recovery",
        ],
        scope:
          "Functional prototype checks, not representative user usability testing.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Editor browser workflows passed");
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
