import { createProject } from "@evir/project-model";
import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { cpus } from "node:os";
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
const baselineCommit = "7375759";
const baseline = process.argv.includes("--baseline");
const single = process.argv.includes("--sample");
if (!global.gc)
  throw Error(
    "Run with node --expose-gc to compare retained heap after collection",
  );
let authoring, renderer;
if (baseline) {
  await mkdir("tools/.test-build/workflow-baseline", { recursive: true });
  for (const name of ["authoring", "renderer-canvas"]) {
    const source = execFileSync(
      "git",
      ["show", `${baselineCommit}:packages/${name}/index.mjs`],
      { encoding: "utf8" },
    );
    await build({
      stdin: {
        contents: source,
        resolveDir: path.resolve(`packages/${name}`),
        sourcefile: "index.mjs",
      },
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node24",
      outfile: `tools/.test-build/workflow-baseline/${name}.mjs`,
    });
  }
  authoring = await import("./.test-build/workflow-baseline/authoring.mjs");
  renderer = await import(
    "./.test-build/workflow-baseline/renderer-canvas.mjs"
  );
} else {
  authoring = await import("@evir/authoring");
  renderer = await import("@evir/renderer-canvas");
}
const p = createProject();
p.id = "workload-project";
p.artboards[0].id = "workload-board";
p.editor.cameras = { "workload-board": { x: 0, y: 0, zoom: 1 } };
p.nodes = Array.from({ length: 1000 }, (_, i) => ({
  id: "node-" + i,
  name: "Tile " + i,
  kind: "rectangle",
  artboardId: "workload-board",
  parentId: null,
  order: i,
  transform: [1, 0, 0, 1, (i % 40) * 12, Math.floor(i / 40) * 12],
  geometry: { width: 10, height: 10, fill: "#89dcc0" },
}));
const bytes = Buffer.alloc(128 * 1024, 42);
p.assets = [
  {
    id: "retained-asset",
    name: "History workload bytes",
    mimeType: "application/octet-stream",
    data: bytes.toString("base64"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  },
];
const samples = [];
if (!single) {
  for (let i = 0; i < 3; i++) {
    const flags = baseline ? ["--baseline", "--sample"] : ["--sample"];
    const child = JSON.parse(
      execFileSync(
        process.execPath,
        ["--expose-gc", fileURLToPath(import.meta.url), ...flags],
        { encoding: "utf8" },
      ),
    );
    samples.push(child.samples[0]);
  }
}
for (let run = 0; single && run < 1; run++) {
  global.gc();
  const startHeap = process.memoryUsage().heapUsed,
    h = new authoring.History(p),
    start = performance.now();
  for (let i = 0; i < 30; i++)
    h.transact("Move", (q) => (q.nodes[0].transform[4] = i + 1));
  const historyMs = performance.now() - start;
  global.gc();
  const retainedHeapDelta = process.memoryUsage().heapUsed - startHeap;
  const orderStart = performance.now();
  let order;
  for (let i = 0; i < 100; i++)
    order = renderer.sceneOrder(p, "workload-board");
  const traversalMs = performance.now() - orderStart;
  if (
    order.length !== 1000 ||
    order[0].id !== "node-0" ||
    h.snapshot().nodes[0].transform[4] !== 30
  )
    throw Error("Workload correctness failed");
  samples.push({ historyMs, retainedHeapDelta, traversalMs });
}
const report = {
  checkedAt: new Date().toISOString(),
  phase: baseline ? "before" : "after",
  baselineCommit,
  nodeVersion: process.version,
  cpuModel: cpus()[0]?.model,
  nodeCount: 1000,
  historyEdits: 30,
  retainedAssetBytes: bytes.length,
  sceneOrderIterations: 100,
  fixtureSha256: createHash("sha256").update(JSON.stringify(p)).digest("hex"),
  samples,
  scope:
    "Cloud Node process; three fresh-process trials, forced-GC heap delta. Baseline History/traversal loaded from pinned Git source; current model validation is shared. No browser/device/GPU FPS or memory claim.",
};
if (single) console.log(JSON.stringify(report));
else {
  await mkdir("research/results/studio-workflow", { recursive: true });
  await writeFile(
    `research/results/studio-workflow/${report.phase}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
}
