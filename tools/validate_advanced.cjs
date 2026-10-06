const assert = require("node:assert/strict");
const fs = require("node:fs");
const { run } = require("./browser.cjs");
const { capture, sample } = require("./pixels.cjs");
run(async (page) => {
  const results = [];
  const backend = process.env.RIVE_RENDERER || "canvas";
  for (const name of [
    "weighted-skin",
    "trigger",
    "blend",
    "curve",
    "gradient",
    "clip",
    "listener",
    "rml-static",
  ]) {
    if (name === "feather" && backend === "canvas") {
      results.push({
        fixture: name,
        status: "unrun",
        reason: "Rive feathering requires the Rive Renderer",
      });
      continue;
    }
    const info = await page.evaluate(
      ([n, o]) => loadFixture("advanced/" + n, o),
      [
        name,
        ["trigger", "listener"].includes(name)
          ? { stateMachines: "Trigger" }
          : name === "blend"
            ? { stateMachines: "Blend" }
            : name === "weighted-skin"
              ? { animations: "Deform" }
              : {},
      ],
    );
    await page.waitForTimeout(100);
    const first = await capture(page);
    assert(first.count > 0, name + " renders");
    const record = { fixture: name, ...info, first, status: "passed" };
    if (name === "weighted-skin") {
      await page.evaluate(() => {
        player.pause();
        player.scrub("Deform", 0);
      });
      await page.waitForTimeout(100);
      const a = await capture(page);
      await page.evaluate(() => player.scrub("Deform", 0.5));
      await page.waitForTimeout(100);
      const b = await capture(page);
      assert(Math.abs(a.cx - 127.5) < 1 && Math.abs(a.cy - 127.5) < 1);
      assert(Math.abs(b.cx - 127.5) < 1 && Math.abs(b.cy - 151.5) < 1);
      assert(Math.abs(a.count - b.count) < 256);
      const fixed = await sample(page, 70, 100),
        moving = await sample(page, 185, 100),
        middle = await sample(page, 128, 110);
      assert(
        fixed[3] > 0 && moving[3] === 0 && middle[3] === 0,
        "spatially varying weights deform rather than translate rigidly",
      );
      record.poses = { a, b, fixed, moving, middle };
    }
    if (name === "trigger") {
      assert(Math.abs(first.cx - 63.5) < 1);
      const poses = [];
      for (const expected of [191.5, 63.5]) {
        await page.evaluate(() =>
          player.stateMachineInputs("Trigger")[0].fire(),
        );
        await page.waitForTimeout(150);
        const p = await capture(page);
        assert(Math.abs(p.cx - expected) < 1);
        await page.waitForTimeout(150);
        const hold = await capture(page);
        assert(Math.abs(hold.cx - expected) < 1, "trigger consumed once");
        poses.push(p);
      }
      record.poses = poses;
    }
    if (name === "blend") {
      record.samples = [];
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        await page.evaluate(
          (v) => (player.stateMachineInputs("Blend")[0].value = v),
          v,
        );
        await page.waitForTimeout(100);
        const p = await capture(page);
        assert(Math.abs(p.cx - (63.5 + 128 * v)) < 1, JSON.stringify({ v, p }));
        record.samples.push({ v, pixels: p });
      }
    }
    if (name === "listener") {
      assert(Math.abs(first.cx - 63.5) < 1);
      const box = await page.locator("#canvas").boundingBox();
      await page.mouse.move(box.x + 64, box.y + 128);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(150);
      const p = await capture(page);
      assert(Math.abs(p.cx - 191.5) < 1, "pointer-down listener fires trigger");
      record.after = p;
    }
    if (name === "trigger") {
      await page.evaluate(() =>
        player.reset({ stateMachines: "Trigger", autoplay: true }),
      );
      await page.waitForTimeout(150);
      const p = await capture(page);
      assert(Math.abs(p.cx - 63.5) < 1, "reset returns to initial state");
      record.reset = p;
    }
    if (name === "curve") {
      assert(Math.abs(first.cx - 127.5) < 1 && Math.abs(first.cy - 127.5) < 1);
      assert(first.count > 12800 && first.count < 13400);
    }
    if (name === "gradient") {
      const left = await sample(page, 80, 128),
        right = await sample(page, 176, 128);
      assert(left[0] > left[2] && right[2] > right[0], "red-to-blue gradient");
      assert.equal(left[3], 255);
      assert.equal(right[3], 255);
      record.colors = { left, right };
    }
    if (name === "clip") {
      assert.equal(first.count, 64 * 64);
      assert(Math.abs(first.cx - 127.5) < 1 && Math.abs(first.cy - 127.5) < 1);
    }
    if (name === "rml-static") {
      assert.equal(first.count, 48 * 48);
      assert(Math.abs(first.cx - 63.5) < 1 && Math.abs(first.cy - 127.5) < 1);
      await page.evaluate(() => loadFixture("static"));
      await page.waitForTimeout(100);
      assert.equal(
        first.hash,
        (await capture(page)).hash,
        "official RML export matches independent scene",
      );
    }
    if (name === "feather")
      assert(
        first.count > 64 * 64,
        "softened edge extends beyond hard rectangle",
      );
    results.push(record);
    console.log(backend, name, "PASS");
  }
  fs.writeFileSync(
    "research/results/advanced-validation-" + backend + ".json",
    JSON.stringify(
      { runtime: "@rive-app/" + backend + " 2.44.0", results },
      null,
      2,
    ) + "\n",
  );
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
