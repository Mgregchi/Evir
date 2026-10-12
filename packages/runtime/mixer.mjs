import { toRuntimeProject, validateRuntimeProject, ProjectError } from '@evir/project-model';
import { AnimationClock } from './playback.mjs';
import { evaluateLayers } from './motion.mjs';

export class AnimationMixer {
  #project; #artboard; #layers = new Map();
  constructor(project, {artboardId, layers = []} = {}) {
    this.#project = project.format === 'evir-project' ? toRuntimeProject(project) : structuredClone(validateRuntimeProject(project));
    this.#artboard = this.#project.artboards.find(a => a.id === (artboardId ?? this.#project.artboards[0].id));
    if (!this.#artboard) throw new ProjectError(['mixer: missing artboard']);
    for (const {animationId, speed, enabled = true} of layers) {
      const a = this.#project.animations.find(a => a.id === animationId && a.artboardId === this.#artboard.id);
      if (!a || this.#layers.has(animationId) || typeof enabled !== 'boolean') throw new ProjectError(['mixer: missing, duplicate or invalid animation layer']);
      const clock = new AnimationClock(a);
      if (speed !== undefined) clock.setSpeed(speed);
      this.#layers.set(animationId, {clock, enabled});
    }
  }
  get artboard() { return structuredClone(this.#artboard); }
  get layers() { return [...this.#layers].map(([animationId,l]) => ({animationId,...l.clock.state,speed:l.clock.speed,enabled:l.enabled})); }
  snapshot() { return structuredClone(this.#project); }
  #layer(id) {
    const layer = this.#layers.get(id);
    if (!layer) throw new ProjectError(['mixer: missing layer']);
    return layer;
  }
  playback(id) { const l = this.#layer(id); return {...l.clock.state, speed:l.clock.speed, enabled:l.enabled}; }
  setSpeed(id, speed) { this.#layer(id).clock.setSpeed(speed); }
  setEnabled(id, value) {
    if (typeof value !== 'boolean') throw new TypeError('mixer: enabled must be boolean');
    this.#layer(id).enabled = value;
  }
  restart(id) { const l = this.#layer(id); l.clock.reset(); l.enabled = true; return this.pose(); }
  seek(id, frame, options) { this.#layer(id).clock.seek(frame, options); return this.pose(); }
  advanceClocks(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('mixer: delta must be finite and nonnegative');
    for (const l of this.#layers.values()) if (l.enabled) l.clock.advance(seconds);
  }
  advance(seconds) {
    this.advanceClocks(seconds);
    return this.pose();
  }
  pose() {
    return evaluateLayers(this.#project, [...this.#layers].filter(([,l]) => l.enabled).map(([animationId,l]) => ({animationId,frame:l.clock.state.frame})));
  }
  reset() { for (const l of this.#layers.values()) l.clock.reset(); return this.pose(); }
}
