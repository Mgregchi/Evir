const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { run } = require("../../tools/browser.cjs");
run(async (page) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:8776/apps/web/dist/editor/studio/");
  await page.waitForFunction(() => window.evirStudio);
  await page.locator(".brand-wordmark").evaluate((img) => img.decode());
  assert(
    (await page
      .locator(".brand-wordmark")
      .evaluate((img) => img.naturalWidth)) > 0,
  );
  const snapshot = () => page.evaluate(() => evirStudio.snapshot()),
    pose = () => page.evaluate(() => evirStudio.pose()),
    press = (name) => require("./actions.cjs").press(page, name);
  const change = async (name, value) => {
    const f = page.getByLabel(name, { exact: true });
    await f.fill(String(value));
    await f.press("Tab");
  };
  await press("Path");
  let p = await snapshot(),
    pathId = await page.evaluate(() => evirStudio.selection());
  assert.equal(p.nodes.find((n) => n.id === pathId).kind, "path");
  await press("Edit points");
  await change("Point X", 145);
  let n = (await snapshot()).nodes.find((n) => n.id === pathId);
  assert.equal(n.geometry.points[0].anchor[0], 145);
  await press("Split next segment");
  assert.equal(
    (await snapshot()).nodes.find((n) => n.id === pathId).geometry.points
      .length,
    5,
  );
  await press("Remove point");
  assert.equal(
    (await snapshot()).nodes.find((n) => n.id === pathId).geometry.points
      .length,
    4,
  );
  // A direct vertex drag uses stage coordinates, and cancellation restores it.
  n = (await snapshot()).nodes.find((n) => n.id === pathId);
  p = await snapshot();
  let stage = await page.locator("#stage").boundingBox(),
    cam = p.editor.cameras[p.artboards[0].id],
    v = n.geometry.points[0].anchor;
  const x = stage.x + cam.x + (n.transform[4] + v[0]) * cam.zoom,
    y = stage.y + cam.y + (n.transform[5] + v[1]) * cam.zoom;
  const before = structuredClone(n.geometry);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y + 12);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.deepEqual(
    (await snapshot()).nodes.find((n) => n.id === pathId).geometry,
    before,
  );
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y + 12);
  await page.mouse.up();
  assert.notDeepEqual(
    (await snapshot()).nodes.find((n) => n.id === pathId).geometry,
    before,
  );
  await press("Undo");
  assert.deepEqual(
    (await snapshot()).nodes.find((n) => n.id === pathId).geometry,
    before,
  );
  await press("Bone");
  const root = await page.evaluate(() => evirStudio.selection());
  await change("Layer name", "Shoulder");
  await change("Bone length", 80);
  await press("Add child bone");
  const child = await page.evaluate(() => evirStudio.selection());
  await change("Layer name", "Elbow");
  assert.equal(
    (await snapshot()).nodes.find((n) => n.id === child).parentId,
    root,
  );
  const pathName = (await snapshot()).nodes.find((n) => n.id === pathId).name;
  await press("Select " + pathName);
  await page.getByLabel("Bind Shoulder", { exact: true }).check();
  await page.getByLabel("Bind Elbow", { exact: true }).check();
  await press("Bind selected bones");
  assert.equal(
    (await snapshot()).nodes.find((n) => n.id === pathId).geometry.skin.bones
      .length,
    2,
  );
  await change("Weight Elbow", 1);
  assert.equal(
    (await snapshot()).nodes
      .find((n) => n.id === pathId)
      .geometry.skin.weights[0].anchor.find(([id]) => id === child)[1],
    1,
  );
  await press("Select Elbow");
  await press("Animate");
  await press("+ Animation"); // Choose rotation for a child attached to the parent tip.
  await page
    .getByLabel("Key property", { exact: true })
    .selectOption("rotation");
  await press("Set key");
  await page.getByLabel("Playhead", { exact: true }).fill("60");
  await change("Rotation", 90);
  p = await snapshot();
  assert.deepEqual(
    p.nodes.find((n) => n.id === child).transform,
    [1, 0, 0, 1, 0, 0],
  );
  assert.equal(
    p.animations[0].tracks.find((t) => t.property === "rotation").keys.at(-1)
      .frame,
    60,
  );
  assert(
    Math.abs(
      (await pose()).nodes.find((n) => n.id === child).transform[1] - 1,
    ) < 1e-8,
  );
  await page.getByRole("button", { name: "◆ 60", exact: true }).click();
  await page.getByLabel("Key easing", { exact: true }).selectOption("cubic");
  await change("Ease X1", 0.3);
  assert.equal(
    (await snapshot()).animations[0].tracks
      .find((t) => t.property === "rotation")
      .keys.at(-1).easing.curve[0],
    0.3,
  );
  await press("+ Animation");
  await change("Animation name", "Active");
  await change("Rotation", -30);
  fs.mkdirSync("research/results/editor-prototype", { recursive: true });
  await page.screenshot({
    path: "research/results/editor-prototype/animation.png",
  });
  await press("Interact");
  await press("+ Machine");
  await page
    .getByLabel("State animation", { exact: true })
    .selectOption((await snapshot()).animations[1].id);
  await press("Add state");
  await change("New input name", "go");
  await page
    .getByLabel("New input type", { exact: true })
    .selectOption("trigger");
  await press("Add input");
  await press("Add transition");
  await change("New input name", "amount");
  await page
    .getByLabel("New input type", { exact: true })
    .selectOption("number");
  await press("Add input");
  const amount = (await snapshot()).machines[0].inputs.find(
    (i) => i.name === "amount",
  );
  await page
    .getByLabel("Condition input", { exact: true })
    .selectOption(amount.id);
  await page.getByLabel("Comparison", { exact: true }).selectOption("ge");
  await change("Comparison value", "2");
  await press("Add AND condition");
  assert.equal(
    (await snapshot()).machines[0].transitions[0].conditions.length,
    2,
  );
  await press("Fire go");
  assert(
    Math.abs((await pose()).nodes.find((n) => n.id === child).transform[1]) <
      1e-8,
  );
  await press("Select " + pathName);
  await press("Add click listener");
  await page.waitForFunction(() => {
    const p = evirStudio.snapshot(),
      a = p.artboards[0],
      c = p.editor.cameras[a.id],
      stage = document.querySelector("#stage").getBoundingClientRect();
    return c.y >= 0 && c.y + a.height * c.zoom <= stage.height + 1;
  });
  const source = await snapshot();
  await change("Test amount", 2);
  await press("Fire go");
  assert(
    Math.abs(
      (await pose()).nodes.find((n) => n.id === child).transform[1] + 0.5,
    ) < 1e-8,
  );
  assert.deepEqual(await snapshot(), source);
  await page
    .locator("#authoring-panel")
    .evaluate((panel) => (panel.scrollTop = 0));
  await page.screenshot({
    path: "research/results/editor-prototype/interaction.png",
  });
  await press("Reset preview");
  assert(
    Math.abs((await pose()).nodes.find((n) => n.id === child).transform[1]) <
      1e-8,
  );
  await press("Design");
  assert.deepEqual((await snapshot()).nodes, source.nodes);
  assert.deepEqual((await snapshot()).animations, source.animations);
  assert.deepEqual((await snapshot()).machines, source.machines);
  // Save/open preserves all editable features, export comes from the same source.
  const downloadPromise = page.waitForEvent("download");
  await press("Save project");
  const download = await downloadPromise;
  const file = await download.path();
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(saved.schemaVersion, 2);
  assert.deepEqual(saved.animations, source.animations);
  assert.deepEqual(saved.machines, source.machines);
  await page.locator("#file").setInputFiles({
    name: "authored.evir-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  // Open flow may request replacement of an existing project.
  await page.locator("#replace-project").waitFor({ state: "visible" });
  await page.locator("#replace-confirm").click();
  await page.locator("#replace-project").waitFor({ state: "hidden" });
  await page.waitForFunction(() => evirStudio.snapshot().machines.length === 1);
  const exports = [];
  page.on("download", (d) => exports.push(d));
  await press("Export .riv");
  await page.waitForFunction(() =>
    document
      .querySelector("#notice span")
      .textContent.includes("source map downloaded"),
  );
  await page.waitForTimeout(100);
  assert.equal(exports.length, 2);
  const riv = exports.find((d) => d.suggestedFilename().endsWith(".riv"));
  const mapDownload = exports.find((d) =>
    d.suggestedFilename().endsWith(".riv-map.json"),
  );
  const sourceMap = JSON.parse(
    fs.readFileSync(await mapDownload.path(), "utf8"),
  );
  assert.equal(sourceMap.nodes[pathId].type, "Shape");
  assert.equal(sourceMap.nodes[child].type, "Bone");
  const bytes = fs.readFileSync(await riv.path());
  assert.equal(bytes.subarray(0, 4).toString(), "RIVE");
  fs.mkdirSync("research/fixtures/editor-authoring", { recursive: true });
  fs.writeFileSync(
    "research/fixtures/editor-authoring/browser-authored.riv",
    bytes,
  );
  fs.writeFileSync(
    "research/fixtures/editor-authoring/browser-authored.riv-map.json",
    JSON.stringify(sourceMap, null, 2) + "\n",
  );
  fs.writeFileSync(
    "research/fixtures/editor-authoring/browser-authored.evir-project",
    JSON.stringify(await snapshot(), null, 2) + "\n",
  );
  await page.screenshot({ path: "/tmp/evir-authoring-design.png" });
  await press("Select " + pathName);
  await press("Edit points");
  await page.screenshot({
    path: "research/results/editor-prototype/rigging.png",
  });
  await page.setViewportSize({ width: 1100, height: 800 });
  assert((await page.locator("#stage").boundingBox()).width >= 240);
  console.log(
    "Authoring browser flow passed: editable paths, pointer controls, bone chain/weights, timeline, trigger/listener/reset, save/open, binary export.",
  );
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
