const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { PNG } = require("pngjs");
const { run } = require("./browser.cjs");
const spec = require("../research/editor-comparison/spec.json");
if (process.env.RIVE_RENDERER !== "webgl2")
  throw Error("Editor comparison requires RIVE_RENDERER=webgl2");
const provenancePath = "research/editor-comparison/provenance.json";
if (!fs.existsSync(provenancePath))
  throw Error(
    "Actual Editor exports and provenance.json are required; CLI outputs cannot satisfy this check",
  );
const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
assert.equal(provenance.exportSource, "Rive Editor");
for (const key of ["editorVersion", "exportedAt", "operator"])
  assert(typeof provenance[key] === "string" && provenance[key].trim());
for (const c of spec.cases)
  assert(
    fs.existsSync("research/fixtures/editor/" + c.name + ".riv"),
    "Missing Editor export: " + c.name,
  );
run(async (page) => {
  const results = [];
  for (const c of spec.cases) {
    const poses =
      c.name === "weighted-mesh"
        ? [0, 0.5]
        : c.name === "data-binding"
          ? ["default", "changed"]
          : ["default"];
    for (const pose of poses) {
      const images = [];
      for (const file of [c.reference, "editor/" + c.name]) {
        await page.evaluate(([f, o]) => loadFixture(f, o), [file, c.options]);
        await page.waitForTimeout(150);
        if (c.name === "weighted-mesh")
          await page.evaluate((p) => {
            player.pause();
            for (let i = 0; i < 4; i++) player.scrub("Bone" + i, p);
            player.drawFrame();
          }, pose);
        if (c.name === "data-binding" && pose === "changed")
          await page.evaluate(() => {
            const v = player.viewModelInstance;
            v.number("positionX").value = 160;
            v.number("width").value = 80;
            v.color("color").value = 0xffff0000;
            v.boolean("active").value = true;
          });
        await page.waitForTimeout(100);
        // Comparing screenshots within one backend avoids cross-backend AA differences.
        images.push(
          PNG.sync.read(
            await page.locator("#canvas").screenshot({ omitBackground: true }),
          ),
        );
      }
      const [a, b] = images;
      assert.equal(a.width, b.width);
      assert.equal(a.height, b.height);
      let error = 0,
        differentPixels = 0,
        coverageA = 0,
        coverageB = 0;
      for (let i = 0; i < a.data.length; i += 4) {
        let different = false;
        if (a.data[i + 3]) coverageA++;
        if (b.data[i + 3]) coverageB++;
        for (let j = 0; j < 4; j++) {
          const d = Math.abs(a.data[i + j] - b.data[i + j]);
          error += d;
          if (d > 2) different = true;
        }
        if (different) differentPixels++;
      }
      assert(coverageA > 0 && coverageB > 0, "Both exports must render");
      const normalizedMae = error / (a.data.length * 255);
      const differentFraction = differentPixels / (a.width * a.height);
      assert(
        normalizedMae < 0.001 && differentFraction < 0.01,
        JSON.stringify({
          name: c.name,
          pose,
          normalizedMae,
          differentFraction,
        }),
      );
      const file = "research/fixtures/editor/" + c.name + ".riv";
      results.push({
        fixture: c.name,
        pose,
        normalizedMae,
        differentFraction,
        coverageA,
        coverageB,
        bytes: fs.statSync(file).size,
        sha256: crypto
          .createHash("sha256")
          .update(fs.readFileSync(file))
          .digest("hex"),
        status: "passed",
      });
    }
  }
  fs.writeFileSync(
    "research/results/editor-comparison-" +
      (process.env.RIVE_RENDERER || "canvas") +
      ".json",
    JSON.stringify({ runtime: "2.44.0", provenance, results }, null, 2) + "\n",
  );
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
