const fs = require("node:fs");
const { run } = require("./browser.cjs");
const { capture } = require("./pixels.cjs");
if (process.env.RIVE_RENDERER !== "webgl2")
  throw Error("Run with RIVE_RENDERER=webgl2");
run(async (page) => {
  const results = [];
  const messages = [];
  page.on("console", (m) => {
    if (m.type() === "warning" || m.type() === "error") messages.push(m.text());
  });
  for (const name of ["feather", "rml-feather"])
    for (const offscreen of [false, true]) {
      await page.goto(
        "http://127.0.0.1:8776/tools/runtime.html?renderer=webgl2",
      );
      await page.evaluate(
        ([n, o]) => loadFixture("advanced/" + n, { useOffscreenRenderer: o }),
        [name, offscreen],
      );
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => player.drawFrame());
        await page.waitForTimeout(50);
      }
      const p = await capture(page);
      results.push({
        fixture: name,
        offscreen,
        pixels: p,
        status: p.count > 0 ? "rendered" : "failed-empty-capture",
      });
    }
  fs.writeFileSync(
    "research/results/feather-probe.json",
    JSON.stringify({ runtime: "@rive-app/webgl2 2.44.0", results }, null, 2) +
      "\n",
  );
  console.log(results);
  if (results.some((r) => !r.pixels.count)) process.exitCode = 1;
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
