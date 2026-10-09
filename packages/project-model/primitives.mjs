export class ProjectError extends Error {
  constructor(issues) {
    super(issues.join("\n"));
    this.name = "ProjectError";
    this.issues = issues;
  }
}
export function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export function inverse(m) {
  const d = m[0] * m[3] - m[1] * m[2];
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12)
    throw new ProjectError([
      "transform: parent matrix is singular; cannot preserve world transform",
    ]);
  return [
    m[3] / d,
    -m[1] / d,
    -m[2] / d,
    m[0] / d,
    (m[2] * m[5] - m[3] * m[4]) / d,
    (m[1] * m[4] - m[0] * m[5]) / d,
  ];
}
export const newId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
export const mapPoint = (m, p) => [
  m[0] * p[0] + m[2] * p[1] + m[4],
  m[1] * p[0] + m[3] * p[1] + m[5],
];
export function worldTransform(p, nodeId) {
  const n = p.nodes.find((n) => n.id === nodeId);
  if (!n) throw new ProjectError([`node ${nodeId}: not found`]);
  const local = [...n.transform];
  const parent = p.nodes.find((v) => v.id === n.parentId);
  if (n.kind === "bone" && parent?.kind === "bone") {
    local[4] = parent.geometry.length;
    local[5] = 0;
  }
  return n.parentId === null
    ? local
    : multiply(worldTransform(p, n.parentId), local);
}
