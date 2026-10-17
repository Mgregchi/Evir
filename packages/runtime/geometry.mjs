import { strokeValue, paintValue } from "@evir/project-model";
import {
  worldTransform,
  multiply,
  inverse,
  mapPoint,
} from "@evir/project-model";
export { mapPoint } from "@evir/project-model";
const skinContexts = new WeakMap();
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
export function controlMatrix(p, n, pointId, control, resolve) {
  const read = resolve || ((id) => worldTransform(p, id));
  if (!n.geometry.skin) return read(n.id);
  const skin = n.geometry.skin,
    matrix = [0, 0, 0, 0, 0, 0];
  let context;
  if (resolve) {
    let skins = skinContexts.get(resolve);
    if (!skins) {
      skins = new WeakMap();
      skinContexts.set(resolve, skins);
    }
    context = skins.get(skin);
    if (!context) {
      context = {
        weights: new Map(skin.weights.map((w) => [w.pointId, w])),
        bones: new Map(
          skin.bones.map((b) => [
            b.boneId,
            multiply(read(b.boneId), inverse(b.bind)),
          ]),
        ),
      };
      skins.set(skin, context);
    }
  }
  const w = (
    context
      ? context.weights.get(pointId)
      : skin.weights.find((v) => v.pointId === pointId)
  )[control];
  for (const [boneId, weight] of quantize(w)) {
    const m = context
      ? context.bones.get(boneId)
      : multiply(
          read(boneId),
          inverse(skin.bones.find((b) => b.boneId === boneId).bind),
        );
    m.forEach((v, i) => (matrix[i] += v * weight));
  }
  return multiply(matrix, skin.bindWorld);
}
export function worldPoints(p, n, resolve) {
  return n.geometry.points.map((v) => ({
    id: v.id,
    ...Object.fromEntries(
      ["anchor", "in", "out"].map((k) => [
        k,
        mapPoint(controlMatrix(p, n, v.id, k, resolve), v[k]),
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
  if (property.startsWith("stroke.")) return strokeValue(n, property);
  if (property.startsWith("paint.")) return paintValue(n, property);
  if (["width", "height", "length", "fontSize", "fill"].includes(property))
    return n.geometry[property];
  return components(n.transform)[property];
}
