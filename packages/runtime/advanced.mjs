import {solveChain} from './ik-chain.mjs';
import {
  worldTransform,
  inverse,
  mapPoint,
  strokeValue,
  paintValue,
  isColorProperty,
  propertiesFor,
} from "@evir/project-model";
import { components, getValue } from "./geometry.mjs";
export function solveIK(p) {
  for (const ik of p.advanced?.ik ?? []) {
    if(ik.count>2){solveChain(p,ik);continue;}
    const tip = p.nodes.find((n) => n.id === ik.boneId),
      root = ik.count === 2 ? p.nodes.find((n) => n.id === tip.parentId) : tip;
    const parent = root.parentId
      ? worldTransform(p, root.parentId)
      : [1, 0, 0, 1, 0, 0];
    const local = mapPoint(
      inverse(parent),
      mapPoint(worldTransform(p, ik.targetId), [0, 0]),
    );
    // A child bone's origin follows its parent's tip, including the parent length.
    const origin = mapPoint(
      inverse(parent),
      mapPoint(worldTransform(p, root.id), [0, 0]),
    );
    const dx = local[0] - origin[0],
      dy = local[1] - origin[1],
      distance = Math.hypot(dx, dy),
      direction = Math.atan2(dy, dx);
    const rotate = (n, angle) => {
      const old = components(n.transform).rotation;
      let delta = (angle - old) % (Math.PI * 2);
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      const a = old + delta * ik.strength;
      n.transform.splice(
        0,
        4,
        Math.cos(a),
        Math.sin(a),
        -Math.sin(a),
        Math.cos(a),
      );
    };
    if (ik.count === 1) {
      rotate(tip, direction);
      continue;
    }
    const a = root.geometry.length,
      b = tip.geometry.length,
      c = Math.max(1e-12, Math.min(a + b, Math.max(Math.abs(a - b), distance)));
    const elbow =
      Math.acos(
        Math.max(-1, Math.min(1, (c * c - a * a - b * b) / (2 * a * b))),
      ) * (ik.invert ? 1 : -1);
    const shoulder =
      direction - Math.atan2(b * Math.sin(elbow), a + b * Math.cos(elbow));
    rotate(root, shoulder);
    rotate(tip, elbow);
  }
  return p;
}
export function mixColor(a, b, t) {
  const channel = (s) =>
    [0, 2, 4, 6].map((i) =>
      i === 6 && s.length === 7 ? 255 : parseInt(s.slice(i + 1, i + 3), 16),
    );
  const x = channel(a),
    y = channel(b);
  return (
    "#" +
    x
      .map((v, i) =>
        Math.max(0, Math.min(255, Math.round(v + (y[i] - v) * t)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function mixPoses(a, b, t) {
  const out = structuredClone(a);
  for (const n of out.nodes) {
    const next = b.nodes.find((v) => v.id === n.id),
      x = components(n.transform),
      y = components(next.transform);
    const v = Object.fromEntries(
      Object.keys(x).map((k) => [k, x[k] + (y[k] - x[k]) * t]),
    );
    n.transform = [
      Math.cos(v.rotation) * v.scaleX,
      Math.sin(v.rotation) * v.scaleX,
      -Math.sin(v.rotation) * v.scaleY,
      Math.cos(v.rotation) * v.scaleY,
      v.x,
      v.y,
    ];
    for (const k of propertiesFor(n).filter(
      (k) =>
        k.startsWith("paint.") || k.startsWith("stroke.") ||
        ["width", "height", "length", "fontSize", "fill"].includes(k),
    )) {
      const from = getValue(n, k),
        to = getValue(next, k),
        value = isColorProperty(k)
          ? mixColor(from, to, t)
          : from + (to - from) * t;
      if (k.startsWith("stroke.")) strokeValue(n, k, value);
      else if (k.startsWith("paint.")) paintValue(n, k, value);
      else n.geometry[k] = value;
    }
  }
  return out;
}
