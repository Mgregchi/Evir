import { worldTransform, multiply, inverse, mapPoint } from "@evir/project-model";
export { mapPoint } from "@evir/project-model";
export function quantize(influences) {
  const total = influences.reduce((v, [b, w]) => v + w, 0);
  if (!Number.isFinite(total) || total <= 0)
    throw Error("Weights need a positive total");
  const scaled = influences.map(([b, w]) => (w / total) * 255),
    bytes = scaled.map(Math.floor);
  const ranks = bytes
    .map((v, i) => i)
    .sort((a, b) => scaled[b] - bytes[b] - (scaled[a] - bytes[a]) || a - b);
  const remaining = 255 - bytes.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) bytes[ranks[i]]++;
  return influences.map(([b, w], i) => [b, bytes[i] / 255]);
}
export function controlMatrix(p, n, pointId, control) {
  if (!n.geometry.skin) return worldTransform(p, n.id);
  const skin = n.geometry.skin,
    w = skin.weights.find((v) => v.pointId === pointId)[control],
    matrix = [0, 0, 0, 0, 0, 0];
  for (const [boneId, weight] of quantize(w)) {
    const bind = skin.bones.find((b) => b.boneId === boneId).bind,
      m = multiply(worldTransform(p, boneId), inverse(bind));
    m.forEach((v, i) => (matrix[i] += v * weight));
  }
  return multiply(matrix, skin.bindWorld);
}
export function worldPoints(p, n) {
  return n.geometry.points.map((v) => ({
    id: v.id,
    ...Object.fromEntries(
      ["anchor", "in", "out"].map((k) => [
        k,
        mapPoint(controlMatrix(p, n, v.id, k), v[k]),
      ]),
    ),
  }));
}
export function components(m) {
  const sx = Math.hypot(m[0], m[1]);
  if (sx < 1e-12) throw Error("Singular transform");
  const rotation = Math.atan2(m[1], m[0]),
    sy = (m[0] * m[3] - m[1] * m[2]) / sx;
  return { x: m[4], y: m[5], rotation, scaleX: sx, scaleY: sy };
}
export function getValue(n, property) {
  if (["width", "height", "length", "fill"].includes(property))
    return n.geometry[property];
  return components(n.transform)[property];
}
