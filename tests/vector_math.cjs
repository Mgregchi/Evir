const assert = require("node:assert/strict");
const { triangulate, flattenCubic, area } = require("../tools/vector_math.cjs");
for (const p of [
  [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ],
  [
    [0, 0],
    [10, 0],
    [10, 4],
    [4, 4],
    [4, 10],
    [0, 10],
  ],
]) {
  for (const order of [p, [...p].reverse()]) {
    const t = triangulate(order);
    assert.equal(t.length / 3, p.length - 2);
    let a = 0;
    for (let i = 0; i < t.length; i += 3) {
      const v = area(t.slice(i, i + 3));
      assert(v > 0);
      a += v;
    }
    assert.equal(a, Math.abs(area(p)));
  }
}
assert.throws(() =>
  triangulate([
    [0, 0],
    [1, 0],
    [2, 0],
  ]),
);
const a = [0, 0],
  b = [0, 100],
  c = [100, 100],
  d = [100, 0];
const coarse = flattenCubic(a, b, c, d, 1),
  fine = flattenCubic(a, b, c, d, 0.1);
assert(fine.length > coarse.length);
assert.deepEqual(fine[0], a);
assert.deepEqual(fine.at(-1), d);
assert.throws(() => flattenCubic(a, b, c, d, 0));
console.log(
  "Geometry checks PASS: area, winding, concavity, degeneracy, subdivision and endpoints",
);
