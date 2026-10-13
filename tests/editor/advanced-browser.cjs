const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { run } = require("../../tools/browser.cjs");
(async () => {
  const { suite } = await import("../../apps/web/advanced-examples.mjs");
  const fixtures = await suite(),
    results = [];
  fs.mkdirSync("research/results/advanced-authoring", { recursive: true });
  await run(async (page) => {
    const press = (name) => require("./actions.cjs").press(page, name);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("http://127.0.0.1:8776/apps/web/dist/editor/studio/");
      await page.waitForFunction(() => window.evirStudio);
      const load = async (name) => {
        const p = fixtures.find((p) => p.name === name);
        await page.locator("#file").setInputFiles({
          name: name + ".evir-project",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(p)),
        });
        await page.locator("#replace-confirm").click();
        await page.waitForFunction(
          (name) => evirStudio.snapshot().name === name,
          name,
        );
      };
      const select = async (name) => {
        if (width < 850) await press("Layers");
        await press("Select " + name);
        if (width < 850) {
          await page.keyboard.press("Escape");
          await press("Properties");
        }
      };
      await load("canopy");
      await select("window");
      await press("Clipping & feather…");
      await page.getByLabel("Clipping mask", { exact: true }).selectOption("");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      assert.equal(
        await page.evaluate(() => evirStudio.snapshot().advanced.clips.length),
        0,
      );
      if (width < 850) await page.keyboard.press("Escape");
      await press("Undo");
      assert.equal(
        await page.evaluate(() => evirStudio.snapshot().advanced.clips.length),
        1,
      );
      await load("reach");
      await select("elbow");
      await press("Inverse kinematics…");
      await page.getByLabel("Chain length", { exact: true }).selectOption("2");
      await page.getByLabel("IK strength", { exact: true }).fill("2");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      assert.equal(
        await page.evaluate(
          () => evirStudio.snapshot().advanced.ik[0].strength,
        ),
        1,
      );
      assert.match(
        await page.locator("#advanced-sheet [role=alert]").innerText(),
        /strength.*\[0,1\]/,
      );
      await page.getByLabel("IK strength", { exact: true }).fill(".5");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      assert.equal(
        await page.evaluate(
          () => evirStudio.snapshot().advanced.ik[0].strength,
        ),
        0.5,
      );
      if (width < 850) await page.keyboard.press("Escape");
      await load("caption");
      await select("caption");
      await press("Edit text…");
      await page
        .getByLabel("Text content", { exact: true })
        .fill("A little story");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      assert.equal(
        await page.evaluate(() => evirStudio.snapshot().nodes[0].geometry.text),
        "A little story",
      );
      if (width < 850) await page.keyboard.press("Escape");
      await load("kite");
      await select("cloth");
      await press("Edit mesh…");
      await page.getByLabel("Vertex 0 position X", { exact: true }).fill("55");
      await press("Next vertex");
      assert.equal(
        await page
          .getByLabel("Vertex 1 position X", { exact: true })
          .inputValue(),
        "208",
      );
      await press("Previous vertex");
      assert.equal(
        await page
          .getByLabel("Vertex 0 position X", { exact: true })
          .inputValue(),
        "55",
      );
      await page.screenshot({
        path: `research/results/advanced-authoring/mesh-${width}.png`,
      });
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      assert.equal(
        await page.evaluate(
          () => evirStudio.snapshot().nodes[1].geometry.vertices[0].position[0],
        ),
        55,
      );
      if (width < 850) await page.keyboard.press("Escape");
      await load("blend");
      await press("Interact");
      if (width < 850) await press("Machine");
      await press("Blending & timing…");
      await page
        .getByLabel("Mix duration blend-start", { exact: true })
        .fill("600");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      assert.equal(
        await page.evaluate(
          () => evirStudio.snapshot().machines[0].transitions[0].durationMs,
        ),
        600,
      );
      if (width < 850) await page.keyboard.press("Escape");
      await press("Design");
      await page.locator("#create-toggle").click();
      await press("Assets…");
      await page.getByLabel("Text", { exact: true }).fill("New text");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      await page.waitForFunction(() =>
        evirStudio.snapshot().nodes.some((n) => n.kind === "text"),
      );
      assert.equal(await page.locator("#advanced-sheet").count(), 0);
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      await page.locator("#create-toggle").click();
      await press("Assets…");
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
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.keyboard.press("Escape");
      const { compileProject } = await import("@evir/format");
      await page.locator("#file").setInputFiles({
        name: "canopy.riv",
        mimeType: "application/octet-stream",
        buffer: Buffer.from(compileProject(fixtures[0]).bytes),
      });
      await page.locator("#replace-confirm").click();
      await page.waitForFunction(
        () => evirStudio.snapshot().name === "Imported Rive scene",
      );
      assert.equal(
        await page.evaluate(() => evirStudio.snapshot().advanced.clips.length),
        1,
      );
      // Unsupported streams now explain conversion failure in a sheet, before replacement.
      const before = await page.evaluate(() =>
        JSON.stringify(evirStudio.snapshot()),
      );
      await page.locator("#file").setInputFiles({
        name: "bad.riv",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("invalid"),
      });
      await page.waitForFunction(() =>
        document
          .querySelector("#riv-import-sheet pre")
          ?.textContent.includes("Expected RIVE signature"),
      );
      assert.equal(
        await page.locator("#replace-project").getAttribute("open"),
        null,
      );
      assert.equal(
        await page.evaluate(() => JSON.stringify(evirStudio.snapshot())),
        before,
      );
      fs.mkdirSync("research/results/advanced-authoring", { recursive: true });
      await page.screenshot({
        path: `research/results/advanced-authoring/studio-${width}.png`,
      });
      await page.getByRole('button',{name:'Back to Studio',exact:true}).click();
      results.push({
        width,
        flows: [
          "clip/undo",
          "IK validation/apply",
          "text edit",
          "mesh edit",
          "blend timing",
          "font asset",
          "sheet axe/reflow",
          "semantic riv import",
          "invalid import preserves scene",
        ],
      });
    }
    await page.goto("http://127.0.0.1:8776/tools/runtime.html");
    const resources = await page.evaluate(
      async ({ caption, kite }) => {
        const { CanvasRenderer } = await import(
          "/tools/.test-build/oracle.mjs"
        );
        const c = document.createElement("canvas"),
          r = new CanvasRenderer(c.getContext("2d")),
          initial = document.fonts.size;
        await r.prepare(caption);
        const font = r.assets.get(caption.assets[0].id).font;
        if (!document.fonts.has(font)) throw Error("Font not registered");
        await r.prepare(kite);
        if (document.fonts.has(font)) throw Error("Replaced font was retained");
        const bitmap = r.assets.get(kite.assets[0].id).bitmap;
        const bad = structuredClone(kite);
        bad.assets[0].sha256 = "0".repeat(64);
        let rejected = false;
        try {
          await r.prepare(bad);
        } catch {
          rejected = true;
        }
        if (!rejected || r.assets.get(kite.assets[0].id).bitmap !== bitmap)
          throw Error("Failed prepare replaced current resources");
        r.dispose();
        if (bitmap.width !== 0 || document.fonts.size !== initial)
          throw Error("Dispose retained resources");
        return {
          initialFontCount: initial,
          finalFontCount: document.fonts.size,
          closedBitmap: bitmap.width === 0,
          failedPrepareRetainedCurrent: true,
        };
      },
      {
        caption: fixtures.find((p) => p.name === "caption"),
        kite: fixtures.find((p) => p.name === "kite"),
      },
    );
    results.push({ resources });
  });
  fs.writeFileSync(
    "research/results/advanced-authoring/studio.json",
    JSON.stringify(
      {
        scope: "Automated Chromium flows; not human or screen-reader evidence",
        results,
      },
      null,
      2,
    ) + "\n",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
