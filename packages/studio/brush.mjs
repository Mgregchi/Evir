import { getStroke } from "perfect-freehand";

// Pointer Events specifies zero on release and 0.5 for devices without pressure.
// Only a pen with an active button contributes pressure; release retains the tip.
export function pointerPressure(event, previous = 0.5) {
  if (event.pointerType !== "pen") return 0.5;
  return event.buttons &&
    Number.isFinite(event.pressure) &&
    event.pressure >= 0 &&
    event.pressure <= 1
    ? event.pressure
    : previous;
}

export function brushOutline(samples, { width = 16, pressure = true } = {}) {
  if (!Number.isFinite(width) || width < 1 || width > 256)
    throw Error("Choose brush width between 1 and 256 artboard units.");
  if (typeof pressure !== "boolean") throw Error("Invalid pressure option.");
  if (samples.length > 4096)
    throw Error("This drawing is too long. Draw a shorter stroke.");
  for (const p of samples)
    if (
      !Array.isArray(p) ||
      p.length !== 3 ||
      !p.every(Number.isFinite) ||
      p[2] < 0 ||
      p[2] > 1
    )
      throw Error(
        "Brush samples need finite coordinates and pressure between 0 and 1.",
      );
  return getStroke(samples, {
    size: width,
    thinning: pressure ? 0.65 : 0,
    simulatePressure: false,
    streamline: 0,
    smoothing: 0.35,
    last: true,
    start: { cap: true },
    end: { cap: true },
  });
}
