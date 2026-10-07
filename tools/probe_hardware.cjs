const fs = require("node:fs");
const { run } = require("./browser.cjs");
const gpu = require("./gpu_diagnostics.cjs");
run(async (page) => {
  await gpu.install(page);
  await page.goto("http://127.0.0.1:8776/tools/runtime.html?renderer=webgl2");
  await page.evaluate(() =>
    loadFixture("static", { useOffscreenRenderer: false }),
  );
  await page.waitForTimeout(100);
  const diagnostics = await gpu.collect(page);
  let status = "hardware-candidate-needs-device-provenance",
    reason = null;
  try {
    gpu.requireHardware(diagnostics);
  } catch (error) {
    status = "hardware-unavailable";
    reason = error.message;
    process.exitCode = 1;
  }
  fs.writeFileSync(
    "research/results/hardware-probe.json",
    JSON.stringify(
      { diagnostics, status, reason, physicalDeviceVerified: false },
      null,
      2,
    ) + "\n",
  );
  console.log(
    status,
    reason || "Record the physical device before reporting hardware results",
  );
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
