export function paintOnContext(ctx, fill) {
  if (typeof fill === "string") return fill;
  const [x, y] = fill.start,
    [ex, ey] = fill.end;
  const gradient =
    fill.type === "linear"
      ? ctx.createLinearGradient(x, y, ex, ey)
      : ctx.createRadialGradient(x, y, 0, x, y, Math.hypot(ex - x, ey - y));
  for (const stop of [...fill.stops].sort((a, b) => a.position - b.position))
    gradient.addColorStop(stop.position, stop.color);
  return gradient;
}
