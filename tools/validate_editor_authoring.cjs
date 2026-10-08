const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { PNG } = require("pngjs");
const { createHash } = require("node:crypto"),
  gpu = require("./gpu_diagnostics.cjs");
const { run } = require("./browser.cjs");
(async () => {
  const { scenes } = await import("../tests/editor/scenes.mjs"),
    { compileProject } = await import("../editor/export-riv.mjs");
  const { p, a, b } = scenes(),
    schema = JSON.parse(fs.readFileSync("research/schema/runtime.json"));
  const compiled = compileProject(p, schema);
  fs.mkdirSync("research/fixtures/editor-authoring", { recursive: true });
  fs.writeFileSync(
    "research/fixtures/editor-authoring/authoring.riv",
    compiled.bytes,
  );
  fs.writeFileSync(
    "research/fixtures/editor-authoring/authoring.evir-project",
    JSON.stringify(p, null, 2) + "\n",
  );
  fs.writeFileSync(
    "research/fixtures/editor-authoring/authoring.riv-map.json",
    JSON.stringify(compiled.mapping, null, 2) + "\n",
  );
  await run(async (page) => {
    await gpu.install(page);
    await page.reload();
    const backend = process.env.RIVE_RENDERER || "canvas",
      results = [];
    async function pixels() {
      if (backend === "canvas")
        return page.evaluate(() =>
          Array.from(
            document
              .getElementById("canvas")
              .getContext("2d")
              .getImageData(0, 0, 256, 256).data,
          ),
        );
      return Array.from(
        PNG.sync.read(
          await page.locator("#canvas").screenshot({ omitBackground: true }),
        ).data,
      );
    }
    async function compare(label, animationId, frame, source = p) {
      const expected = await page.evaluate(
        async ({ p, id, frame }) => {
          const { evaluate } = await import("/editor/motion.mjs"),
            { drawScene } = await import("/editor/render-scene.mjs");
          const pose = id ? evaluate(p, id, frame) : p,
            canvas = document.createElement("canvas");
          canvas.width = canvas.height = 256;
          const ctx = canvas.getContext("2d"),
            board = p.artboards[0],
            scale = Math.min(256 / board.width, 256 / board.height);
          ctx.translate(
            (256 - board.width * scale) / 2,
            (256 - board.height * scale) / 2,
          );
          ctx.scale(scale, scale);
          ctx.beginPath();
          ctx.rect(0, 0, board.width, board.height);
          ctx.clip();
          drawScene(ctx, pose, p.artboards[0].id, { ignoreEditorState: true });
          return Array.from(
            canvas.getContext("2d").getImageData(0, 0, 256, 256).data,
          );
        },
        { p: source, id: animationId, frame },
      );
      const actual = await pixels();
      let error = 0,
        count = 0,
        actualCount = 0;
      for (let i = 0; i < actual.length; i += 4) {
        if (expected[i + 3]) count++;
        if (actual[i + 3]) actualCount++;
        for (let j = 0; j < 4; j++)
          error += Math.abs(actual[i + j] - expected[i + j]);
      }
      const mae = error / actual.length;
      results.push({
        label,
        mae,
        expectedCovered: count,
        runtimeCovered: actualCount,
      });
      console.log(results.at(-1));
      assert(mae < 2.5, label + " pixels agree within antialias tolerance");
      assert(Math.abs(actualCount - count) < 350, label + " coverage agrees");
    }
    async function load(options = {}) {
      await page.evaluate(
        (options) =>
          loadFixture("editor-authoring/authoring", {
            autoplay: false,
            ...options,
          }),
        options,
      );
      await page.evaluate(() => {
        player.stopRendering();
        player.drawFrame();
      });
    }
    await load();
    await compare("rest", null, 0);
    for (const [name, id, frame] of [
      ["Bend", a, 0],
      ["Bend", a, 15],
      ["Bend", a, 30],
      ["Bend", a, 60],
      ["Active", b, 30],
      ["Active", b, 60],
    ]) {
      await load({ animations: name });
      await page.evaluate(
        ([name, seconds]) => {
          player.scrub(name, seconds);
          player.drawFrame();
        },
        [name, frame / 60],
      );
      await compare(name + " " + frame, id, frame);
    }
    const advance = () =>
      page.evaluate(() => {
        player.stopRendering();
        player.animator.stateMachines[0].advanceAndApply(0);
        player.drawFrame();
      });
    const input = async (name, value) => {
      await page.evaluate(
        ([name, value]) => {
          const i = player
            .stateMachineInputs("Controller")
            .find((i) => i.name === name);
          if (i.type === rive.StateMachineInputType.Trigger) i.fire();
          else i.value = value;
        },
        [name, value],
      );
      await advance();
    };
    await load({ stateMachines: "Controller" });
    await advance();
    await compare("entry", a, 0);
    await input("enabled", true);
    await compare("AND guard", a, 0);
    await input("amount", 2);
    await compare("numeric transition", b, 0);
    await input("enabled", false);
    await input("amount", -1);
    await compare("bool false + numeric return", a, 0);
    await load({ stateMachines: "Controller" });
    await advance();
    await input("go", true);
    await compare("trigger", b, 0);
    await load({ stateMachines: "Controller" });
    await advance();
    await compare("reset", a, 0);
    await page.evaluate(() => {
      player.play("Controller");
      player.stopRendering();
    });
    const target = await page.locator("#canvas").boundingBox();
    await page.mouse.click(target.x + 110, target.y + 120);
    await advance();
    await compare("click listener", b, 0);
    const authored = JSON.parse(
      fs.readFileSync(
        "research/fixtures/editor-authoring/browser-authored.evir-project",
      ),
    );
    for (const animation of authored.animations)
      for (const frame of [0, 30, 60]) {
        await page.evaluate(
          (name) =>
            loadFixture("editor-authoring/browser-authored", {
              autoplay: false,
              animations: name,
            }),
          animation.name,
        );
        await page.evaluate(
          ([name, seconds]) => {
            player.stopRendering();
            player.scrub(name, seconds);
            player.drawFrame();
          },
          [animation.name, frame / animation.fps],
        );
        await compare(
          "browser authored " + animation.name + " " + frame,
          animation.id,
          frame,
          authored,
        );
      }
    fs.mkdirSync("research/results", { recursive: true });
    fs.writeFileSync(
      "research/results/editor-authoring-" + backend + ".json",
      JSON.stringify(
        {
          runtime: "2.44.0",
          backend,
          diagnostics: await gpu.collect(page),
          fixtureSHA256: Object.fromEntries(
            ["authoring", "browser-authored"].map((name) => [
              name,
              createHash("sha256")
                .update(
                  fs.readFileSync(
                    "research/fixtures/editor-authoring/" + name + ".riv",
                  ),
                )
                .digest("hex"),
            ]),
          ),
          checks: results,
          exportBytes: compiled.bytes.length,
          scope: compiled.scope,
        },
        null,
        2,
      ) + "\n",
    );
  });
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
