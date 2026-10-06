const fs = require("node:fs");
const os = require("node:os");
const { run } = require("./browser.cjs");
function stats(v) {
  v = [...v].sort((a, b) => a - b);
  return {
    median:
      v.length % 2
        ? v[Math.floor(v.length / 2)]
        : (v[v.length / 2 - 1] + v[v.length / 2]) / 2,
    p95: v[Math.min(v.length - 1, Math.ceil(v.length * 0.95) - 1)],
    min: v[0],
    max: v.at(-1),
  };
}
run(async (page, browser) => {
  const { capture } = require("./pixels.cjs");
  const fixtures = [
    "static",
    "static-explicit-defaults",
    "animated",
    "bones",
    "state-machine",
    "characters-25",
    "stress-100",
    "states-2",
    "states-8",
    "states-32",
    "states-128",
  ];
  const rows = [];
  const system = await browser.newBrowserCDPSession();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  for (const name of fixtures) {
    const opts = name.startsWith("states-")
      ? { stateMachines: "Selector" }
      : ["state-machine", "characters-25"].includes(name)
        ? { stateMachines: "Controller" }
        : name === "bones"
          ? { animations: ["Wave", "Bend"] }
          : name === "stress-100"
            ? { animations: Array.from({ length: 100 }, (_, i) => "Move" + i) }
            : name === "animated"
              ? { animations: "Move" }
              : {};
    const cold = [];
    for (let i = 0; i < 3; i++) {
      const coldPage = await page.context().newPage();
      await coldPage.goto(
        "http://127.0.0.1:8776/tools/runtime.html?renderer=" +
          (process.env.RIVE_RENDERER || "canvas"),
      );
      const x = await coldPage.evaluate(
        ([n, o]) => loadFixture(n, o),
        [name, opts],
      );
      cold.push(x.loadMs);
      await coldPage.close();
    }
    const warm = [];
    for (let i = 0; i < 12; i++) {
      const x = await page.evaluate(
        ([n, o]) => loadFixture(n, o),
        [name, opts],
      );
      warm.push(x.loadMs);
    }
    await page.evaluate((n) => {
      if (n.startsWith("states-"))
        player.stateMachineInputs("Selector")[0].value =
          Number(n.split("-")[1]) - 1;
      else if (["characters-25", "state-machine"].includes(n))
        player.stateMachineInputs("Controller")[0].value = true;
    }, name);
    await page.waitForTimeout(250);
    const before = await capture(page);
    if (!before.count) throw Error(name + " did not render");
    await cdp.send("HeapProfiler.collectGarbage");
    const startMetrics = (await cdp.send("Performance.getMetrics")).metrics;
    const renderedBefore = await page.evaluate(() => player.frameCount);
    const frames = await page.evaluate(
      (name) =>
        new Promise((resolve) => {
          const dt = [];
          let last, start;
          function tick(t) {
            if (name.startsWith("states-")) {
              const n = Number(name.split("-")[1]);
              player.stateMachineInputs("Selector")[0].value = dt.length % n;
            }
            if (start === undefined) {
              start = t;
              last = t;
            } else {
              dt.push(t - last);
              last = t;
            }
            if (t - start >= 2000) resolve(dt);
            else requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        }),
      name,
    );
    const after = await page.evaluate(() => ({
      renderedFrames: player.frameCount,
      frameCpuMs: [...player.durations],
      jsHeap: performance.memory?.usedJSHeapSize,
      wasmLinearCapacity: player.runtime?.HEAPU8?.buffer.byteLength || null,
    }));
    const endMetrics = (await cdp.send("Performance.getMetrics")).metrics;
    after.pixels = await capture(page);
    const get = (m, n) => m.find((x) => x.name === n)?.value;
    const taskMs =
      (get(endMetrics, "TaskDuration") - get(startMetrics, "TaskDuration")) *
      1000;
    const proc = (
      await system.send("SystemInfo.getProcessInfo")
    ).processInfo.filter((p) => p.type === "renderer");
    const rss = proc.map((p) => {
      try {
        const s = fs.readFileSync(`/proc/${p.id}/status`, "utf8");
        return {
          pid: p.id,
          rssKiB: Number(s.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0),
        };
      } catch {
        return { pid: p.id, rssKiB: null };
      }
    });
    if (
      ["animated", "bones", "characters-25", "stress-100"].includes(name) &&
      before.hash === after.pixels.hash
    ) {
      // An integer number of loop periods may coincide; check a non-loop-aligned interval.
      await page.waitForTimeout(137);
      if (before.hash === (await capture(page)).hash)
        throw Error(name + " animation did not change");
    }
    const row = {
      fixture: name,
      bytes: fs.statSync(`research/fixtures/${name}.riv`).size,
      cold_page_load_ms: stats(cold),
      warm_load_ms: stats(warm),
      cold_samples: 3,
      warm_samples: 12,
      raf_fps: (1000 * frames.length) / frames.reduce((a, b) => a + b, 0),
      raf_frame_ms: stats(frames),
      raf_frames: frames.length,
      runtime_frame_callbacks: after.renderedFrames - renderedBefore,
      runtime_callback_cpu_ms: after.frameCpuMs.length
        ? stats(after.frameCpuMs)
        : null,
      runtime_callback_cpu_samples: after.frameCpuMs.length,
      task_ms_over_observation: taskMs,
      js_heap_bytes: after.jsHeap,
      wasm_linear_capacity_bytes: after.wasmLinearCapacity,
      renderer_process_rss: rss,
      visible_pixels: after.pixels.count,
    };
    rows.push(row);
    console.log(
      name,
      JSON.stringify({
        warmMs: row.warm_load_ms.median,
        fps: row.raf_fps,
        jsHeap: row.js_heap_bytes,
      }),
    );
  }
  const graphics = await page.evaluate(() => {
    const c = document.createElement("canvas");
    const g = c.getContext("webgl2");
    if (!g) return null;
    const e = g.getExtension("WEBGL_debug_renderer_info");
    return {
      vendor: g.getParameter(e ? e.UNMASKED_VENDOR_WEBGL : g.VENDOR),
      renderer: g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER),
    };
  });
  const version = await browser.version();
  const out = {
    environment: {
      runtime:
        "@rive-app/" + (process.env.RIVE_RENDERER || "canvas") + " 2.44.0",
      playwright: require("playwright/package.json").version,
      chromium: version,
      node: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory_bytes: os.totalmem(),
      viewport: "256x256 canvas",
      headless: true,
      graphics,
      renderer: process.env.RIVE_RENDERER || "canvas",
    },
    method:
      "3 fresh-page loads (HTTP cache may be warm), 12 warm loads in shared WASM runtime; 2-second rAF observation after 250 ms warmup. FPS is scheduler cadence, not isolated GPU throughput. State selectors change target every rAF. Runtime callback CPU timings come from the pinned runtime private rolling one-second durations array, include advance and submitted rendering work (or draw-skip), and exclude asynchronous GPU completion. Memory after GC; JS heap, WASM capacity and renderer RSS overlap and must not be summed. RSS includes shared pages.",
    results: rows,
  };
  fs.writeFileSync(
    "research/results/runtime-benchmark-" +
      (process.env.RIVE_RENDERER || "canvas") +
      ".json",
    JSON.stringify(out, null, 2) + "\n",
  );
}).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
