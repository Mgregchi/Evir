import { playbackSettings, validatePlayback, ProjectError } from '@evir/project-model';

const delta = value => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('playback: delta must be finite and nonnegative');
};
export function playbackSample(animation, seconds) {
  delta(seconds);
  const policy = playbackSettings(animation);
  const frames = seconds * animation.fps * policy.speed;
  if (!Number.isFinite(frames)) throw new RangeError('playback: elapsed time overflow');
  return sample(animation, frames);
}
function sample(animation, frames) {
  const {mode, iterations} = playbackSettings(animation), duration = animation.duration;
  const cycle = duration * (mode === 'ping-pong' ? 2 : 1);
  const limit = mode === 'once' ? duration : iterations ? iterations * cycle : Infinity;
  const completed = frames >= limit;
  const local = completed ? (mode === 'ping-pong' ? 0 : duration) : frames % cycle;
  return {
    frame: mode === 'ping-pong' && local > duration ? cycle - local : local,
    completed,
    direction: mode === 'ping-pong' && local >= duration ? -1 : 1,
  };
}

// A speed change affects future deltas, preserving phase. Zero freezes a layer.
export class AnimationClock {
  #animation; #speed; #frames = 0; #scrubFrame = null;
  constructor(animation) {
    const issues = [];
    validatePlayback(playbackSettings(animation),'animation.playback',(path,message)=>issues.push(path+': '+message));
    if (!Number.isInteger(animation.fps) || animation.fps < 1 || animation.fps > 240 || !Number.isInteger(animation.duration) || animation.duration < 1)
      issues.push('animation: positive frame duration and FPS 1–240 required');
    if (issues.length) throw new ProjectError(issues);
    this.#animation = {fps:animation.fps,duration:animation.duration,playback:{...playbackSettings(animation)}};
    this.#speed = playbackSettings(animation).speed;
  }
  get speed() { return this.#speed; }
  fork() {
    const next = new AnimationClock(this.#animation);
    next.#speed = this.#speed; next.#frames = this.#frames; next.#scrubFrame = this.#scrubFrame;
    return next;
  }
  get state() { const result = sample(this.#animation, this.#frames); return this.#scrubFrame === null ? result : {...result,frame:this.#scrubFrame}; }
  advance(seconds) {
    delta(seconds);
    const step = seconds * this.#animation.fps * this.#speed;
    if (!Number.isFinite(step) || !Number.isFinite(this.#frames + step)) throw new RangeError('playback: elapsed time overflow');
    if (!this.state.completed) {
      if (step > 0) this.#scrubFrame = null;
      const policy = playbackSettings(this.#animation);
      const cycle = this.#animation.duration * (policy.mode === 'ping-pong' ? 2 : 1);
      const limit = policy.mode === 'once' ? cycle : policy.iterations ? policy.iterations * cycle : Infinity;
      this.#frames = Math.min(this.#frames + step, limit);
      // Keep continuous phases bounded without accumulating precision loss.
      if (limit === Infinity) this.#frames %= cycle;
    }
    return this.state;
  }
  setSpeed(value) {
    if (!Number.isFinite(value) || value < 0 || value > 64) throw new RangeError('playback: speed must be 0–64');
    this.#speed = value;
  }
  seek(frame, {direction = 1} = {}) {
    if (!Number.isFinite(frame) || frame < 0 || frame > this.#animation.duration || ![1,-1].includes(direction))
      throw new RangeError('playback: seek must be within the timeline');
    const policy = playbackSettings(this.#animation);
    this.#frames = policy.mode === 'ping-pong' && direction === -1 ? this.#animation.duration * 2 - frame : frame;
    this.#scrubFrame = frame;
    return this.state;
  }
  reset() { this.#frames = 0; this.#scrubFrame = null; return this.state; }
}
