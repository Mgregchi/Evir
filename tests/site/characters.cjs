const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { createHash } = require("node:crypto"),
  { chromium } = require("playwright");
(async () => {
  const { createStaticServer } = await import("../../tools/static-server.mjs"),
    { characterIds } = await import("../../apps/web/examples.mjs");
  const root = path.resolve(__dirname, "../.."),
    out = path.join(root, "research/results/characters");
  fs.mkdirSync(out, { recursive: true });
  const server = createStaticServer(path.join(root, "apps/web/dist"));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : chromium.executablePath()),
    headless: true,
    args: ["--no-sandbox"],
  });
  const report = {
    checkedAt: new Date().toISOString(),
    scope:
      "Actual vector-source browser renders, synthetic keyboard/pointer controls and automated WCAG checks. No physical-device or human/assistive-technology evidence.",
    viewports: [],
    characters: characterIds,
    checks: [],
  };
  try {
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({
          viewport: { width, height: 1000 },
          reducedMotion: "reduce",
        }),
        page = await context.newPage(),
        errors = [],
        dialogs = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (d) => {
        dialogs.push(d.type());
        d.dismiss();
      });
      await page.addInitScript(() => {
        const request = requestAnimationFrame.bind(window);
        window.frameCallbacks = 0;
        window.requestAnimationFrame = (cb) =>
          request((t) => {
            window.frameCallbacks++;
            cb(t);
          });
      });
      await page.goto(origin + "/examples/");
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const pixels = async (preview) =>
        createHash("sha256")
          .update(
            await preview
              .locator("canvas")
              .evaluate((c) =>
                Array.from(
                  c.getContext("2d").getImageData(0, 0, 512, 512).data,
                ),
              )
              .then((v) => Buffer.from(v)),
          )
          .digest("hex");
      for (const id of characterIds) {
        const article = page.locator("#" + id),
          preview = article.locator("[data-preview]");
        await preview.scrollIntoViewIfNeeded();
        await page.waitForFunction(
          (id) =>
            document.querySelector(`[data-preview=${id}]`).dataset.ready ===
            "true",
          id,
        );
        const select = preview.getByLabel("Expression", { exact: true }),
          state = preview.locator(".demo-state");
        assert.equal(await state.innerText(), "Calm");
        assert.equal(await preview.getAttribute("data-playing"), "false");
        const calm = await pixels(preview);
        await select.focus();
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        assert.equal(await select.inputValue(), "1");
        assert.equal(await state.innerText(), "Hello");
        const hello = await pixels(preview);
        assert.notEqual(
          hello,
          calm,
          "Hello changes the rendered pose while motion is paused",
        );
        if (width === 1440)
          await preview.screenshot({ path: path.join(out, id + "-hello.png") });
        await select.selectOption("2");
        assert.equal(await state.innerText(), "Delight");
        const delight = await pixels(preview);
        assert.notEqual(delight, hello);
        await preview.screenshot({
          path: path.join(out, `${id}-delight-${width}.png`),
        });
        await preview
          .getByRole("button", { name: "Play motion", exact: true })
          .click();
        await page.waitForTimeout(550);
        assert.notEqual(
          await pixels(preview),
          delight,
          "live vector motion changes pixels",
        );
        await preview
          .getByRole("button", { name: "Reset character", exact: true })
          .click();
        assert.equal(await select.inputValue(), "0");
        assert.equal(await state.innerText(), "Calm");
        assert.equal(await preview.getAttribute("data-playing"), "false");
        assert.equal(
          await pixels(preview),
          calm,
          "Reset restores the exact initial image",
        );
        await page.waitForTimeout(80);
        const frames = await page.evaluate(() => frameCallbacks);
        await page.waitForTimeout(120);
        assert.equal(
          await page.evaluate(() => frameCallbacks),
          frames,
          "paused characters schedule no frame callbacks",
        );
        const violations = await page.evaluate(
          async (id) =>
            (
              await axe.run(document.getElementById(id), {
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
          id,
        );
        assert.deepEqual(violations, []);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
      }
      await page.goto(origin + "/");
      const collection = page.locator("#character-collection");
      await collection.scrollIntoViewIfNeeded();
      assert.equal(await collection.locator("a").count(), 3);
      assert.equal(
        await collection.locator("[data-preview]").count(),
        0,
        "home collection is lightweight, with no additional live players",
      );
      await collection.locator("img").evaluateAll((imgs) =>
        Promise.all(
          imgs.map((img) => {
            img.loading = "eager";
            return img.decode();
          }),
        ),
      );
      await collection.screenshot({
        path: path.join(out, `collection-${width}.png`),
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(dialogs, []);
      report.viewports.push({
        width,
        height: 1000,
        expressions: characterIds.length * 3,
        automatedAccessibilityViolations: 0,
      });
      await context.close();
    }
    // A failed character load leaves its poster visible and disables all controls.
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    let fail = true;
    await page.route("**/assets/examples/momo.evir-project", (route) =>
      fail
        ? route.fulfill({ status: 503, body: "Test outage" })
        : route.continue(),
    );
    await page.goto(origin + "/examples/#momo");
    const preview = page.locator("[data-preview=momo]");
    await preview.locator(".retry-preview").waitFor({ state: "visible" });
    assert(await preview.locator(".demo-poster").isVisible());
    assert(await preview.locator(".character-expression").isDisabled());
    assert(await preview.locator(".character-reset").isDisabled());
    fail = false;
    await preview.getByRole("button", { name: "Try preview again" }).click();
    await page.waitForFunction(
      () =>
        document.querySelector("[data-preview=momo]").dataset.ready === "true",
    );
    assert(await preview.locator(".character-expression").isEnabled());
    await context.close();
    report.checks = [
      "keyboard expression selection",
      "number-driven state/pose changes",
      "live motion changes vector pixels",
      "reset restores exact image and pauses",
      "paused players schedule zero callbacks",
      "responsive original artwork and controls",
      "automated WCAG checks",
      "three lightweight home cards",
      "poster fallback and disabled controls on failure",
      "retry restores controls",
      "no browser-default dialogs",
    ];
    fs.writeFileSync(
      path.join(out, "browser.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      "Character collection: three styles, three expressions, keyboard/motion/reset/retry and three responsive widths passed.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
