import { ProjectError, validateRuntimeProject, toRuntimeProject, openRuntimeProject } from '@evir/project-model';
import { evaluate, MachinePlayer } from './motion.mjs';
import { AnimationClock } from './playback.mjs';
export { evaluate, evaluateLayers, MachinePlayer, easingValue, keyValue } from './motion.mjs';
export { AnimationClock, playbackSample } from './playback.mjs';
export { AnimationMixer } from './mixer.mjs';

export class RuntimePlayer {
  #project;
  #animation;
  #machine;
  #clock;
  #artboard;
  constructor(project, { artboardId, animationId, machineId } = {}) {
    this.#project = project.format === 'evir-project' ? toRuntimeProject(project) : structuredClone(validateRuntimeProject(project));
    this.#artboard = this.#project.artboards.find(a => a.id === (artboardId ?? this.#project.artboards[0].id));
    if (!this.#artboard) throw new ProjectError(['runtime: missing artboard']);
    if (animationId && machineId) throw new ProjectError(['runtime: choose an animation or a state machine']);
    if (animationId) {
      this.#animation = this.#project.animations.find(a => a.id === animationId && a.artboardId === this.#artboard.id);
      if (!this.#animation) throw new ProjectError(['runtime: missing animation in selected artboard']);
      this.#clock = new AnimationClock(this.#animation);
    }
    if (machineId) {
      const m = this.#project.machines.find(m => m.id === machineId && m.artboardId === this.#artboard.id);
      if (!m) throw new ProjectError(['runtime: missing state machine in selected artboard']);
      this.#machine = new MachinePlayer(this.#project, m.id);
    }
  }
  get artboard() { return structuredClone(this.#artboard); }
  get state() {
    if (!this.#machine) return null;
    const state = this.#machine.machine.states.find(s => s.id === this.#machine.stateId);
    return { id: state.id, name: state.name };
  }
  snapshot() { return structuredClone(this.#project); }
  // Independent presentation state for speculative commands; source stays immutable.
  fork() {
    const next = new RuntimePlayer(this.#project, {artboardId:this.#artboard.id,
      ...(this.#animation ? {animationId:this.#animation.id} : {}),
      ...(this.#machine ? {machineId:this.#machine.machine.id} : {})});
    if (this.#clock) next.#clock = this.#clock.fork();
    if (this.#machine) for (const key of ['stateId','time','mixing','inputs'])
      next.#machine[key] = structuredClone(this.#machine[key]);
    return next;
  }
  get playback() { return this.#clock ? {...this.#clock.state, speed:this.#clock.speed} : null; }
  setSpeed(value) {
    if (!this.#clock) throw new ProjectError(['runtime: no active animation']);
    this.#clock.setSpeed(value);
    return this.pose();
  }
  pose() {
    if (this.#machine) return this.#machine.pose();
    if (!this.#animation) return evaluate(this.#project,null,0);
    return evaluate(this.#project, this.#animation.id, this.#clock.state.frame);
  }
  advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('runtime: delta must be finite and nonnegative');
    if (this.#machine) return this.#machine.advance(seconds);
    this.#clock?.advance(seconds);
    return this.pose();
  }
  setInput(nameOrId, value) {
    if (!this.#machine) throw new ProjectError(['runtime: no active state machine']);
    const input = this.#machine.machine.inputs.find(i => i.id === nameOrId || i.name === nameOrId);
    if (!input) throw new ProjectError(['runtime: missing input']);
    this.#machine.set(input.id, value);
    return this.#machine.advance(0);
  }
  click(targetId) {
    if (!this.#machine) throw new ProjectError(['runtime: no active state machine']);
    if (!this.#project.nodes.some(n => n.id === targetId && n.artboardId === this.#artboard.id)) throw new ProjectError(['runtime: missing click target']);
    return this.#machine.click(targetId);
  }
  reset() {
    this.#clock?.reset();
    return this.#machine ? this.#machine.reset() : this.pose();
  }
}

export const createRuntime = (project, options) => new RuntimePlayer(project, options);
export async function loadRuntime(text, options) {
  return createRuntime(await openRuntimeProject(text), options);
}
