export function createMotionLoop(draw, { request = globalThis.requestAnimationFrame,
  cancel = globalThis.cancelAnimationFrame, onError = () => {} } = {}) {
  let active = false, frame = null, last = 0;
  const tick = (now) => {
    frame = null;
    if (!active) return;
    try { draw(last ? Math.min((now - last) / 1000, 0.05) : 0); }
    catch (error) { active = false; last = 0; onError(error); return; }
    last = now;
    if (active) frame = request(tick);
  };
  return {
    setActive(next) {
      if (active === next) return;
      active = next;
      last = 0;
      if (active) frame = request(tick);
      else { if (frame !== null) cancel(frame); frame = null; }
    },
    stop() { active = false; last = 0; if (frame !== null) cancel(frame); frame = null; },
  };
}
