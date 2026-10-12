// Legacy boolean loops remain readable. New records carry one playback policy.
export function playbackSettings(animation) {
  return animation.playback ?? {
    mode: animation.loop ? 'loop' : 'once',
    iterations: animation.loop ? 0 : 1,
    speed: 1,
  };
}

export function validatePlayback(value, path, problem) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    problem(path, 'expected playback object'); return;
  }
  const keys = ['mode', 'iterations', 'speed'];
  for (const key of keys) if (!Object.hasOwn(value, key)) problem(`${path}.${key}`, 'required');
  for (const key of Object.keys(value)) if (!keys.includes(key)) problem(`${path}.${key}`, 'unsupported field');
  if (!['once', 'loop', 'ping-pong'].includes(value.mode)) problem(path, 'unsupported playback mode');
  if (!Number.isInteger(value.iterations) || value.iterations < 0 || value.iterations > 10000)
    problem(path, 'iterations must be 0 (continuous) or 1–10000 complete cycles');
  if (value.mode === 'once' && value.iterations !== 1) problem(path, 'play once needs one iteration');
  if (!Number.isFinite(value.speed) || value.speed < 0.01 || value.speed > 16)
    problem(path, 'authored speed must be 0.01–16');
}
