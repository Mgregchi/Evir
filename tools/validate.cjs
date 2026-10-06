const assert = require("node:assert/strict");
const fs = require("node:fs");
const { run } = require("./browser.cjs");
run(async (page) => {
  const { capture } = require("./pixels.cjs");
  const results = [];
  for (const name of [
    "static",
    "static-explicit-defaults",
    "animated",
    "bones",
    "state-machine",
    "stress-100",
  ]) {
    const opts =
      name === "state-machine"
        ? { stateMachines: "Controller" }
        : name === "stress-100"
          ? { animations: "Move0", stateMachines: "Controller" }
          : name === "bones"
            ? { animations: ["Wave", "Bend"] }
            : { animations: name === "animated" ? "Move" : undefined };
    const info = await page.evaluate(
      ([n, o]) => loadFixture(n, o),
      [name, opts],
    );
    await page.waitForTimeout(250);
    const first = await capture(page);
    assert(first.count > 0, name + " renders");
    if (name === "static" || name === "static-explicit-defaults") {
      assert(Math.abs(first.cx - 63.5) < 1);
      assert(Math.abs(first.cy - 127.5) < 1);
      assert.equal(first.count, 48 * 48);
    }
    if (name === "animated" || name === "bones") {
      await page.evaluate((n) => {
        player.pause();
        for (const a of player.animationNames) player.scrub(a, 0);
      }, name);
      await page.waitForTimeout(100);
      const a = await capture(page);
      await page.evaluate(() => {
        for (const a of player.animationNames) player.scrub(a, 0.5);
      });
      await page.waitForTimeout(100);
      const b = await capture(page);
      assert.notEqual(a.hash, b.hash, name + " geometry changes");
      if (name === "animated") {
        assert(Math.abs(a.cx - 63.5) < 1);
        assert(Math.abs(b.cx - 191.5) < 1);
      }
      info.sampled = { start: a, mid: b };
    }
    if (name === "state-machine") {
      const before = await capture(page);
      assert(Math.abs(before.cx - 63.5) < 1);
      await page.evaluate(() => {
        const input = player
          .stateMachineInputs("Controller")
          .find((i) => i.name === "active");
        if (!input) throw Error("missing bool input");
        input.value = true;
      });
      await page.waitForTimeout(150);
      const after = await capture(page);
      assert(Math.abs(after.cx - 191.5) < 1);
      await page.evaluate(
        () => (player.stateMachineInputs("Controller")[0].value = false),
      );
      await page.waitForTimeout(150);
      const back = await capture(page);
      assert(Math.abs(back.cx - 63.5) < 1);
      info.transitions = { before, after, back };
    }
    results.push({ fixture: name, ...info, pixels: first });
    console.log(name, "PASS");
  }
  for (const n of [2, 8, 32, 128]) {
    const info = await page.evaluate(
      (n) => loadFixture("states-" + n, { stateMachines: "Selector" }),
      n,
    );
    const samples = [];
    for (const target of [0, n - 1, Math.floor(n / 2)]) {
      await page.evaluate(
        (t) => (player.stateMachineInputs("Selector")[0].value = t),
        target,
      );
      await page.waitForTimeout(100);
      const p = await capture(page);
      assert(Math.abs(p.cx - (31.5 + (192 * target) / (n - 1))) < 1);
      samples.push({ target, pixels: p });
    }
    results.push({ fixture: "states-" + n, ...info, samples });
    console.log("states-" + n, "PASS");
  }
  const info = await page.evaluate(() =>
    loadFixture("characters-25", { stateMachines: "Controller" }),
  );
  await page.waitForTimeout(100);
  const idle = await capture(page);
  assert(idle.count > 0);
  await page.evaluate(
    () => (player.stateMachineInputs("Controller")[0].value = true),
  );
  await page.waitForTimeout(300);
  const dance = await capture(page);
  assert.notEqual(idle.hash, dance.hash);
  results.push({ fixture: "characters-25", ...info, idle, dance });
  console.log("characters-25", "PASS");
  assert.equal(
    results[0].pixels.hash,
    results[1].pixels.hash,
    "omitted defaults render identically",
  );
  fs.writeFileSync(
    "research/results/runtime-validation-" +
      (process.env.RIVE_RENDERER || "canvas") +
      ".json",
    JSON.stringify(
      {
        runtime:
          "@rive-app/" + (process.env.RIVE_RENDERER || "canvas") + " 2.44.0",
        results,
      },
      null,
      2,
    ) + "\n",
  );
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
