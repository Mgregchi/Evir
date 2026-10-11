// Static shape-local paint. This extends the early v2 scene vocabulary; old
// readers reject the object rather than silently replacing it with a color.
export const MAX_GRADIENT_STOPS = 16;
export function validatePaint(fill, path, problem) {
  const color = (value, key) => {
    if (
      typeof value !== "string" ||
      !/^#[\da-fA-F]{6}([\da-fA-F]{2})?$/.test(value)
    )
      problem(key, "expected #RRGGBB or #RRGGBBAA");
  };
  if (typeof fill === "string") return color(fill, path);
  const record = (value, key, keys) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      problem(key, "expected solid color or gradient object");
      return false;
    }
    for (const name of keys)
      if (!Object.hasOwn(value, name)) problem(`${key}.${name}`, "required");
    for (const name of Object.keys(value))
      if (!keys.includes(name))
        problem(`${key}.${name}`, "unsupported paint field");
    return true;
  };
  if (!record(fill, path, ["type", "start", "end", "stops"])) return;
  if (!["linear", "radial"].includes(fill.type))
    problem(`${path}.type`, "expected linear or radial");
  for (const key of ["start", "end"])
    if (
      !Array.isArray(fill[key]) ||
      fill[key].length !== 2 ||
      !fill[key].every(Number.isFinite)
    )
      problem(`${path}.${key}`, "expected two finite shape-local coordinates");
  if (
    [fill.start, fill.end].every(
      (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite),
    )
  ) {
    const distance = Math.hypot(
      fill.end[0] - fill.start[0],
      fill.end[1] - fill.start[1],
    );
    if (!Number.isFinite(distance))
      problem(path, "gradient endpoint distance must be finite");
    else if (distance < 1e-6)
      problem(path, "gradient endpoints must be distinct");
  }
  if (!Array.isArray(fill.stops))
    return problem(`${path}.stops`, "expected stop array");
  if (fill.stops.length < 2 || fill.stops.length > MAX_GRADIENT_STOPS)
    return problem(
      `${path}.stops`,
      `expected 2 to ${MAX_GRADIENT_STOPS} stops`,
    );
  let previous = -1;
  for (const [i, stop] of fill.stops.entries()) {
    const key = `${path}.stops[${i}]`;
    if (!record(stop, key, ["position", "color"])) continue;
    if (
      !Number.isFinite(stop.position) ||
      stop.position < 0 ||
      stop.position > 1 ||
      stop.position <= previous
    )
      problem(
        `${key}.position`,
        "expected strictly increasing positions from 0 to 1",
      );
    previous = stop.position;
    color(stop.color, `${key}.color`);
  }
}
