const assert = require("node:assert/strict");
const fs = require("node:fs");
const { run } = require("./browser.cjs");
run(async (page) => {
  await page.goto("http://127.0.0.1:8776/tools/vector_lab.html");
  const result = await page.evaluate(() => experiment());
  assert(result.triangles === result.vertices - 2);
  for (const r of result.results)
    assert(Math.abs(r.alphaArea - result.polygonArea) < 100, "area preserved");
  assert(
    result.results.at(-1).edgeMeanAbsoluteError <
      result.results[0].edgeMeanAbsoluteError,
    "supersampling improves this test edge",
  );
  fs.writeFileSync(
    "research/results/vector-lab.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(result);
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
