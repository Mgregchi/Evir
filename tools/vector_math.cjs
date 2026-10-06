/* Experimental geometry for simple, single-contour paths; no holes or self intersections. */
const cross = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - a[1] * b[0];
  }, 0) / 2;
function triangulate(points) {
  const p = points.map((p) => [...p]);
  if (area(p) < 0) p.reverse();
  const ids = p.map((_, i) => i),
    tri = [];
  const inside = (q, a, b, c) =>
    cross(a, b, q) >= -1e-9 &&
    cross(b, c, q) >= -1e-9 &&
    cross(c, a, q) >= -1e-9;
  while (ids.length > 3) {
    let found = false;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[(i + ids.length - 1) % ids.length],
        b = ids[i],
        c = ids[(i + 1) % ids.length];
      if (cross(p[a], p[b], p[c]) <= 1e-9) continue;
      if (
        ids.some(
          (j) =>
            j !== a && j !== b && j !== c && inside(p[j], p[a], p[b], p[c]),
        )
      )
        continue;
      tri.push(p[a], p[b], p[c]);
      ids.splice(i, 1);
      found = true;
      break;
    }
    if (!found)
      throw Error("Cannot triangulate: degenerate or unsupported contour");
  }
  if (ids.length !== 3 || Math.abs(area(p)) < 1e-9)
    throw Error("Degenerate polygon");
  tri.push(...ids.map((i) => p[i]));
  return tri;
}
function flattenCubic(a, b, c, d, tolerance = 0.25) {
  if (!(tolerance > 0)) throw Error("Positive tolerance required");
  const out = [a];
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  function recur(a, b, c, d, depth) {
    const length = Math.hypot(d[0] - a[0], d[1] - a[1]);
    const dist = (p) =>
      length
        ? Math.abs(cross(a, d, p)) / length
        : Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (Math.max(dist(b), dist(c)) <= tolerance) {
      out.push(d);
      return;
    }
    if (depth === 20) throw Error("Subdivision limit");
    const ab = mid(a, b),
      bc = mid(b, c),
      cd = mid(c, d),
      abc = mid(ab, bc),
      bcd = mid(bc, cd),
      m = mid(abc, bcd);
    recur(a, ab, abc, m, depth + 1);
    recur(m, bcd, cd, d, depth + 1);
  }
  recur(a, b, c, d, 0);
  return out;
}
const api = { triangulate, flattenCubic, area };
if (typeof module !== "undefined") module.exports = api;
else window.vectorMath = api;
