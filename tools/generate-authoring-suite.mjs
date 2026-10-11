import { suite } from "../apps/web/advanced-examples.mjs";
export { suite } from "../apps/web/advanced-examples.mjs";
import { compileProject } from "@evir/format";
import { mkdir, writeFile } from "node:fs/promises";
export async function generate() {
  const projects = await suite();
  const reach = projects.find((p) => p.name === "reach");
  for (const [name, change] of [
    ["reach-one-bone", { count: 1 }],
    ["reach-inverted", { invert: true }],
    ["reach-half-strength", { strength: 0.5 }],
  ]) {
    const variant = structuredClone(reach);
    variant.name = name;
    Object.assign(variant.advanced.ik[0], change);
    projects.push(variant);
  }
  await mkdir("research/fixtures/advanced-authoring", { recursive: true });
  for (const p of projects) {
    await writeFile(
      `research/fixtures/advanced-authoring/${p.name}.evir-project`,
      JSON.stringify(p, null, 2) + "\n",
    );
    await writeFile(
      `research/fixtures/advanced-authoring/${p.name}.riv`,
      compileProject(p).bytes,
    );
  }
  return projects;
}
if (process.argv[1]?.endsWith("generate-authoring-suite.mjs")) await generate();
