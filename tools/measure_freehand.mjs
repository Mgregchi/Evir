import { fitFreehand, segmentDistance } from "../packages/studio/freehand.mjs";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
const cases = {
  wave: Array.from({ length: 401 }, (_, i) => [i, 90 + 40 * Math.sin(i / 55)]),
  ring: Array.from({ length: 401 }, (_, i) => [
    200 + 100 * Math.cos((i / 400) * 2 * Math.PI),
    200 + 75 * Math.sin((i / 400) * 2 * Math.PI),
  ]),
  corner: [
    [0, 0],
    ...Array.from({ length: 100 }, (_, i) => [i, 0]),
    ...Array.from({ length: 100 }, (_, i) => [100, i]),
  ],
  noisy: Array.from({ length: 401 }, (_, i) => [
    i,
    Math.sin(i * 2) * 0.2 + 40 * Math.sin(i / 55),
  ]),
};
const cubic = (a, b, c, d, t) =>
  a.map(
    (v, i) =>
      (1 - t) ** 3 * v +
      3 * (1 - t) ** 2 * t * b[i] +
      3 * (1 - t) * t * t * c[i] +
      t ** 3 * d[i],
  );
const results = [];
for (const [name, samples] of Object.entries(cases))
  for (const tolerance of [0.5, 2, 8]) {
    const options = { tolerance, closed: name === "ring" };
    const times = [];
    let geometry;
    for (let i = 0; i < 31; i++) {
      const start = performance.now();
      geometry = fitFreehand(samples, options);
      const ms = performance.now() - start;
      if (i) times.push(ms);
    }
    const edges = geometry.points.flatMap((p, i) => {
      if (!geometry.closed && i === geometry.points.length - 1) return [];
      const q = geometry.points[(i + 1) % geometry.points.length];
      const points = Array.from({ length: 129 }, (_, j) =>
        cubic(p.anchor, p.out, q.in, q.anchor, j / 128),
      );
      return points.slice(1).map((v, j) => [points[j], v]);
    });
    let maximumSampleDeviation = 0;
    for (const p of samples) {
      let closest = Infinity;
      for (const [a, b] of edges)
        closest = Math.min(closest, segmentDistance(p, a, b));
      maximumSampleDeviation = Math.max(maximumSampleDeviation, closest);
    }
    times.sort((a, b) => a - b);
    results.push({
      name,
      tolerance,
      closed: geometry.closed,
      samples: samples.length,
      anchors: geometry.points.length,
      maximumSampleDeviation,
      medianFitMilliseconds: times[Math.floor(times.length / 2)],
    });
  }
const file = "packages/studio/freehand.mjs";
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    "Deterministic Node CPU fitting experiment. 30 fits after one warm-up; 128 linear subdivisions per cubic for sample deviation. No physical-device, renderer or human-drawing measurement.",
  environment: {
    node: process.version,
    platform: os.platform(),
    architecture: os.arch(),
    reportedCPU: os.cpus()[0]?.model,
  },
  sourceSha256: createHash("sha256")
    .update(await readFile(file))
    .digest("hex"),
  sampleSetSha256: createHash("sha256")
    .update(JSON.stringify(cases))
    .digest("hex"),
  results,
};
await mkdir("research/results/studio-freehand", { recursive: true });
await writeFile(
  "research/results/studio-freehand/fitting.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  results
    .map(
      (r) =>
        `${r.name}, tolerance ${r.tolerance}: ${r.samples} samples → ${r.anchors} anchors; deviation ${r.maximumSampleDeviation.toFixed(3)}; median fit ${r.medianFitMilliseconds.toFixed(3)} ms`,
    )
    .join("\n"),
);
