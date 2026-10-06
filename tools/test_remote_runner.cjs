const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { run } = require("./browser.cjs");
(async () => {
  const owner = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=9223",
    ],
  });
  const original = process.env.EVIR_CDP_URL;
  try {
    const ownedPage = await owner.newPage();
    await ownedPage.setContent("<title>Owner remains connected</title>");
    for (let i = 0; i < 30; i++) {
      try {
        if ((await fetch("http://127.0.0.1:9223/json/version")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    process.env.EVIR_CDP_URL = "http://127.0.0.1:9223";
    await run(async (page) => {
      await page.evaluate(() => loadFixture("static"));
      await page.waitForTimeout(100);
      assert.equal((await page.evaluate(() => pixels())).count, 48 * 48);
    });
    assert.equal(await ownedPage.title(), "Owner remains connected");
    fs.writeFileSync(
      "research/results/device-runner-smoke.json",
      JSON.stringify(
        {
          status: "passed",
          transport: "local CDP connection",
          physicalDevice: false,
          checks: [
            "static scene renders through remote runner",
            "disconnect leaves owner browser/page usable",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Remote connection and ownership checks PASS; local software smoke only",
    );
  } finally {
    if (original === undefined) delete process.env.EVIR_CDP_URL;
    else process.env.EVIR_CDP_URL = original;
    await owner.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
