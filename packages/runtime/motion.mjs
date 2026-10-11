import { paintValue, isColorProperty } from "@evir/project-model";
import { solveIK, mixPoses } from "./advanced.mjs";
import { components } from "./geometry.mjs";
const clone = (x) => structuredClone(x);
export function easingValue(e, t) {
  if (e.type === "hold") return 0;
  if (e.type === "linear") return t;
  const [x1, y1, x2, y2] = e.curve;
  const cubic = (a, b, s) =>
    3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
  let low = 0,
    high = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (cubic(x1, x2, mid) < t) low = mid;
    else high = mid;
  }
  return cubic(y1, y2, (low + high) / 2);
}
function rgba(color) {
  const hex = color.slice(1);
  return [0, 2, 4, 6].map((i) =>
    i === 6 && hex.length === 6 ? 255 : parseInt(hex.slice(i, i + 2), 16),
  );
}
export function keyValue(track, frame) {
  const keys = track.keys;
  if (frame <= keys[0].frame) return keys[0].value;
  if (frame >= keys.at(-1).frame) return keys.at(-1).value;
  const next = keys.findIndex((k) => k.frame > frame),
    a = keys[next - 1],
    b = keys[next],
    t = easingValue(a.easing, (frame - a.frame) / (b.frame - a.frame));
  if (isColorProperty(track.property)) {
    const from = rgba(a.value),
      to = rgba(b.value);
    return (
      "#" +
      from
        .map((v, i) =>
          Math.max(0, Math.min(255, Math.round(v + (to[i] - v) * t)))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  }
  return a.value + (b.value - a.value) * t;
}
export function evaluate(
  p,
  animationId,
  frame,
  { applyConstraints = true } = {},
) {
  const pose = clone(p),
    a = p.animations.find((a) => a.id === animationId);
  if (!a) return applyConstraints ? solveIK(pose) : pose;
  const changes = new Map();
  for (const track of a.tracks) {
    if (!changes.has(track.targetId)) changes.set(track.targetId, {});
    changes.get(track.targetId)[track.property] = keyValue(
      track,
      Math.max(0, Math.min(a.duration, frame)),
    );
  }
  for (const [id, values] of changes) {
    const n = pose.nodes.find((n) => n.id === id),
      base = components(n.transform),
      m = n.transform;
    const sx = values.scaleX === undefined ? 1 : values.scaleX / base.scaleX,
      sy = values.scaleY === undefined ? 1 : values.scaleY / base.scaleY;
    const delta = (values.rotation ?? base.rotation) - base.rotation,
      c = Math.cos(delta),
      s = Math.sin(delta),
      [aa, bb, cc, dd] = m;
    m[0] = (c * aa - s * bb) * sx;
    m[1] = (s * aa + c * bb) * sx;
    m[2] = (c * cc - s * dd) * sy;
    m[3] = (s * cc + c * dd) * sy;
    if (values.x !== undefined) m[4] = values.x;
    if (values.y !== undefined) m[5] = values.y;
    for (const key of ["width", "height", "length", "fontSize", "fill"])
      if (values[key] !== undefined) n.geometry[key] = values[key];
  }
  for (const [id, values] of changes)
    for (const [property, value] of Object.entries(values))
      if (property.startsWith("paint."))
        paintValue(
          pose.nodes.find((n) => n.id === id),
          property,
          value,
        );
  return applyConstraints ? solveIK(pose) : pose;
}
export class MachinePlayer {
  constructor(p, machineId) {
    this.project = clone(p);
    this.machine = this.project.machines.find((m) => m.id === machineId);
    this.reset();
  }
  reset() {
    this.stateId = this.machine.entryStateId;
    this.time = 0;
    this.mixing = null;
    this.inputs = Object.fromEntries(
      this.machine.inputs.map((i) => [i.id, i.value]),
    );
    return this.advance(0);
  }
  set(inputId, value) {
    const input = this.machine.inputs.find((i) => i.id === inputId);
    if (
      !input ||
      (input.type === "number"
        ? !Number.isFinite(value)
        : typeof value !== "boolean")
    )
      throw Error("Invalid test input");
    this.inputs[inputId] = value;
  }
  advance(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw Error("Invalid delta time");
    let remaining = dt,
      transitions = 0;
    const enabled = (t) =>
      t.fromId === this.stateId &&
      t.toId !== this.stateId &&
      t.conditions.every((c) => {
        const v = this.inputs[c.inputId];
        return {
          eq: () => v === c.value,
          ne: () => v !== c.value,
          gt: () => v > c.value,
          ge: () => v >= c.value,
          lt: () => v < c.value,
          le: () => v <= c.value,
          fire: () => v === true,
        }[c.op]();
      });
    for (;;) {
      if (this.mixing) {
        if (remaining <= 0) break;
        const step = Math.min(
          remaining,
          Math.max(0, this.mixing.duration - this.mixing.elapsed),
        );
        this.time += step;
        this.mixing.elapsed += step;
        this.mixing.fromTime += step;
        remaining = Math.max(0, remaining - step);
        if (this.mixing.elapsed + 1e-10 >= this.mixing.duration)
          this.mixing = null;
        else break;
        continue;
      }
      const candidates = this.machine.transitions.filter(enabled);
      const t = candidates.find(
        (t) => !("exitTimeMs" in t) || this.time * 1000 + 1e-7 >= t.exitTimeMs,
      );
      if (t) {
        if (++transitions > 100)
          throw Error(
            "State machine has a continuously enabled transition cycle",
          );
        if (t.durationMs > 0)
          this.mixing = {
            fromId: this.stateId,
            fromTime: this.time,
            elapsed: 0,
            duration: t.durationMs / 1000,
          };
        this.stateId = t.toId;
        this.time = 0;
        for (const c of t.conditions)
          if (c.op === "fire") this.inputs[c.inputId] = false;
        continue;
      }
      if (remaining <= 0) break;
      const wait = Math.min(
        ...candidates
          .filter((t) => "exitTimeMs" in t)
          .map((t) => Math.max(0, t.exitTimeMs / 1000 - this.time)),
      );
      const step = Math.min(remaining, wait);
      this.time += step;
      remaining = Math.max(0, remaining - step);
      if (step === 0) break;
    }
    for (const i of this.machine.inputs)
      if (i.type === "trigger") this.inputs[i.id] = false;
    return this.pose();
  }
  click(targetId) {
    for (const l of this.machine.listeners.filter(
      (l) => l.targetId === targetId,
    ))
      this.set(
        l.inputId,
        this.machine.inputs.find((i) => i.id === l.inputId).type === "trigger"
          ? true
          : l.value,
      );
    return this.advance(0);
  }
  statePose(stateId, time) {
    const state = this.machine.states.find((s) => s.id === stateId);
    const animationPose = (id) => {
      const a = this.project.animations.find((a) => a.id === id);
      return evaluate(
        this.project,
        id,
        a.loop
          ? (time * a.fps) % a.duration
          : Math.min(a.duration, time * a.fps),
        { applyConstraints: false },
      );
    };
    if (!state.blend) return animationPose(state.animationId);
    const children = state.blend.children,
      value = this.inputs[state.blend.inputId];
    if (value <= children[0].position)
      return animationPose(children[0].animationId);
    if (value >= children.at(-1).position)
      return animationPose(children.at(-1).animationId);
    const i = children.findIndex((c) => c.position > value),
      lo = children[i - 1],
      hi = children[i];
    return mixPoses(
      animationPose(lo.animationId),
      animationPose(hi.animationId),
      (value - lo.position) / (hi.position - lo.position),
    );
  }
  pose() {
    const current = this.statePose(this.stateId, this.time);
    return solveIK(
      this.mixing
        ? mixPoses(
            this.statePose(this.mixing.fromId, this.mixing.fromTime),
            current,
            this.mixing.elapsed / this.mixing.duration,
          )
        : current,
    );
  }
}
