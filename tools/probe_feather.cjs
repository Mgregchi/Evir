const assert = require("node:assert/strict");
const fs = require("node:fs");
const { run } = require("./browser.cjs");
const { capture, sample } = require("./pixels.cjs");
const gpu = require("./gpu_diagnostics.cjs");
if (process.env.RIVE_RENDERER !== "webgl2")
  throw Error("Run with RIVE_RENDERER=webgl2");
run(async (page) => {
  await gpu.install(page);
  const results = [];
  for (const name of [
    "advanced/feather",
    "advanced/rml-feather",
    "complex/feather-zero",
    "complex/feather-one",
    "complex/feather-four",
    "complex/feather-clockwise",
    "complex/feather-inner",
    "complex/feather-offset",
    "complex/feather-clip",
  ])
    for (const offscreen of [false, true]) {
      const messages = [];
      const listener = (m) => {
        if (["warning", "error"].includes(m.type())) messages.push(m.text());
      };
      page.on("console", listener);
      await page.goto(
        "http://127.0.0.1:8776/tools/runtime.html?renderer=webgl2",
      );
      await page.evaluate(
        ([n, o]) => loadFixture(n, { useOffscreenRenderer: o }),
        [name, offscreen],
      );
      await page.waitForTimeout(200);
      const pixels = await capture(page);
      const diagnostics = await gpu.collect(page);
      const record = {
        fixture: name,
        offscreen,
        pixels,
        diagnostics,
        messages,
      };
      page.off("console", listener);
      try {
        for (const c of diagnostics.contexts)
          assert(!c.contextLost && c.errors.length === 0);
        assert(
          diagnostics.contexts.length > 0,
          "actual WebGL context observed",
        );
        if (["complex/feather-one", "complex/feather-four"].includes(name)) {
          assert.equal(
            pixels.count,
            0,
            "non-clockwise feathered fills are skipped by the renderer",
          );
          record.status = "confirmed-skipped-invalid-fill-rule";
        } else if (name === "complex/feather-zero") {
          assert.equal(pixels.count, 64 * 64);
          assert.equal((await sample(page, 92, 128))[3], 0);
          record.status = "passed-zero-strength-control";
        } else {
          const rml = name === "advanced/rml-feather";
          const center =
            name === "complex/feather-offset" ? 144 : rml ? 64 : 128;
          const half = rml ? 24 : 32;
          const colors = {
            outside: await sample(page, center - half - 4, 128),
            inside: await sample(page, center - half + 4, 128),
            center: await sample(page, center, 128),
            far: await sample(page, center - half - 32, 128),
          };
          record.colors = colors;
          if (name === "complex/feather-inner") {
            assert.equal(colors.outside[3], 0);
            assert(colors.inside[3] > 0 && colors.inside[3] < 255);
            assert.equal(
              colors.center[3],
              0,
              "inner feather paints an interior edge rather than a solid center",
            );
            assert(pixels.count > 0 && pixels.count <= 64 * 64);
          } else {
            assert(colors.inside[3] > 0 && colors.inside[3] < 255);
            assert.equal(colors.center[3], 255);
            assert.equal(colors.far[3], 0);
            if (name === "complex/feather-clip") {
              assert.equal(colors.outside[3], 0);
              assert.equal(pixels.count, 64 * 64);
            } else {
              assert(
                colors.outside[3] > 0 && colors.outside[3] < colors.inside[3],
              );
              assert(pixels.count > (half * 2) ** 2);
            }
          }
          assert(
            Math.abs(pixels.cx - center) < 1 && Math.abs(pixels.cy - 128) < 1,
          );
          record.status = "passed-soft-edge-checks";
        }
      } catch (error) {
        record.status = "failed";
        record.error = error.message;
        process.exitCode = 1;
      }
      results.push(record);
      console.log(name, offscreen, record.status);
    }
  fs.writeFileSync(
    "research/results/feather-probe.json",
    JSON.stringify({ runtime: "@rive-app/webgl2 2.44.0", results }, null, 2) +
      "\n",
  );
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
