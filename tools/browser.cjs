const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
exports.run = async function (work) {
  const server = spawn(
    "python3",
    ["-m", "http.server", "8776", "--bind", "127.0.0.1"],
    { cwd: root, stdio: "ignore" },
  );
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch("http://127.0.0.1:8776/tools/runtime.html")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!ready) throw Error("research HTTP server did not start");
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      headless: true,
      args: [
        "--no-sandbox",
        "--enable-precise-memory-info",
        "--enable-unsafe-swiftshader",
      ],
    });
    const context = await browser.newContext({
      viewport: { width: 400, height: 400 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "http://127.0.0.1:8776/tools/runtime.html?renderer=" +
        (process.env.RIVE_RENDERER || "canvas"),
    );
    await work(page, browser);
    if (errors.length) throw Error("Browser errors: " + errors.join("\n"));
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
};
