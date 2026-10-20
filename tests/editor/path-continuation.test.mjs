import test from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  worldTransform,
  validateProject,
  serializeProject,
  openProject,
} from "@evir/project-model";
import { addNode, History } from "@evir/authoring";
import { compileProject } from "@evir/format";
import { mapPoint } from "@evir/runtime/geometry";
import {
  ContinuationDraft,
  CONTINUATION_LIMITS,
} from "../../packages/studio/path-continuation.mjs";

function fixture() {
  const p = createProject(),
    parent = addNode(p, "group"),
    id = addNode(p, "path", parent);
  p.nodes.find((n) => n.id === parent).transform = [0, 2, -0.5, 0, 300, 70];
  const node = p.nodes.find((n) => n.id === id);
  node.geometry.closed = false;
  node.geometry.points = node.geometry.points.slice(0, 3);
  node.transform = [0.5, 0, 0, 1.25, 12, 18];
  node.geometry.fill = "#a8d7be";
  node.geometry.points[0].out = [40, -20];
  node.geometry.points[1].in = [75, 25];
  return { p, parent, id, node };
}
test("Either endpoint preserves the source's existing point IDs, anchors, handles, paint and direction", async () => {
  for (const endpoint of ["first", "last"]) {
    const { p, id, node } = fixture();
    if (endpoint === "first")
      node.geometry.fill = {
        type: "linear",
        start: [0, 0],
        end: [120, 100],
        stops: [
          { position: 0, color: "#a8d7be" },
          { position: 1, color: "#304f41" },
        ],
      };
    const original = structuredClone(p),
      d = new ContinuationDraft(p, id, { endpoint, closed: true });
    const last = d.points.at(-1).anchor;
    d.appendLocal([last[0] + 70, last[1] - 60], [last[0] + 82, last[1] - 44]);
    assert.deepEqual(p, original);
    const g = d.geometry();
    assert.equal(g.closed, true);
    assert.deepEqual(g.fill, node.geometry.fill);
    const retained = g.points.filter((q) =>
      node.geometry.points.some((v) => v.id === q.id),
    );
    assert.deepEqual(retained, node.geometry.points);
    const h = new History(p);
    h.transact("Continue", (q) => d.apply(q, g));
    assert.equal(h.committed().nodes.length, p.nodes.length);
    assert.equal(
      h.committed().nodes.find((n) => n.id === id).parentId,
      node.parentId,
    );
    validateProject(h.committed());
    compileProject(h.committed());
    assert.deepEqual(
      (await openProject(await serializeProject(h.committed()))).nodes,
      h.committed().nodes,
    );
    const after = structuredClone(h.committed());
    h.undo();
    assert.deepEqual(h.committed(), original);
    h.redo();
    assert.deepEqual(h.committed(), after);
  }
});
test("Pen continuation retains world coordinates under a transformed node and affine parent", () => {
  const { p, id } = fixture(),
    d = new ContinuationDraft(p, id),
    matrix = worldTransform(p, id);
  const before = structuredClone(d.points),
    anchor = mapPoint(matrix, [180, 170]),
    handle = mapPoint(matrix, [200, 190]);
  d.down({ x: anchor[0], y: anchor[1] }, 1.5);
  d.move({ x: handle[0], y: handle[1] });
  d.up();
  const point = d.geometry().points.at(-1);
  for (const [key, expected] of [
    ["anchor", anchor],
    ["out", handle],
  ])
    mapPoint(matrix, point[key]).forEach((v, i) =>
      assert(Math.abs(v - expected[i]) < 1e-9),
    );
  assert.deepEqual(d.points.slice(0, -1), before);
});
test("Backspace and pointer cancellation never remove original points; drafts require a completed new point", () => {
  const { p, id } = fixture(),
    original = structuredClone(p),
    d = new ContinuationDraft(p, id),
    before = structuredClone(d.points);
  d.removeLast();
  assert.deepEqual(d.points, before);
  assert.throws(() => d.geometry(), /at least one/);
  d.appendLocal([200, 180]);
  const pending = structuredClone(d.points);
  d.down({ x: 180, y: 140 }, 1);
  assert.throws(() => d.geometry(), /Release/);
  d.cancelGesture();
  assert.deepEqual(d.points, pending);
  d.removeLast();
  d.removeLast();
  assert.deepEqual(d.points, before);
  assert.deepEqual(p, original);
});
test("Closed, skinned, hidden, locked and singular paths reject before a source edit", () => {
  for (const change of [
    ({ node }) => (node.geometry.closed = true),
    ({ node }) => (node.geometry.skin = { bones: [] }),
    ({ p, parent }) => p.editor.hidden.push(parent),
    ({ p, parent }) => p.editor.locked.push(parent),
    ({ p, parent }) =>
      (p.nodes.find((n) => n.id === parent).transform = [0, 0, 0, 1, 0, 0]),
  ]) {
    const f = fixture();
    change(f);
    const original = structuredClone(f.p);
    assert.throws(() => new ContinuationDraft(f.p, f.id));
    assert.deepEqual(f.p, original);
  }
  const { p, id } = fixture();
  assert.throws(
    () => new ContinuationDraft(p, id, { endpoint: "middle" }),
    /First or Last/,
  );
});
test("A concurrently changed path or ancestor rejects atomically without destroying the draft", () => {
  for (const change of [
    ({ node }) => (node.geometry.points[0].anchor[0] += 1),
    ({ p, parent }) => (p.nodes.find((n) => n.id === parent).transform[4] += 1),
  ]) {
    const f = fixture(),
      d = new ContinuationDraft(f.p, f.id);
    d.appendLocal([200, 150]);
    change(f);
    const before = structuredClone(f.p),
      h = new History(f.p);
    assert.throws(
      () => h.transact("Continue", (p) => d.apply(p, d.geometry())),
      /changed/,
    );
    assert.deepEqual(h.committed(), before);
    assert.equal(d.addedCount, 1);
  }
});
test("Numeric coordinates and drawing budgets are bounded; closing remains possible at the budget", () => {
  const { p, id } = fixture(),
    d = new ContinuationDraft(p, id);
  for (const a of [
    [NaN, 0],
    [Infinity, 0],
    [1000001, 0],
  ])
    assert.throws(() => d.appendLocal(a), /finite/);
  assert.equal(d.addedCount, 0);
  for (let i = 0; i < CONTINUATION_LIMITS.added; i++)
    d.appendLocal([200 + i, 150]);
  assert.throws(() => d.appendLocal([600, 150]), /256 new/);
  const first = d.worldPoints()[0].anchor;
  assert.equal(d.down({ x: first[0], y: first[1] }, 1), "close");
  assert.equal(d.geometry(true).closed, true);
  const many = fixture();
  many.node.geometry.points = Array.from({ length: 4096 }, (_, i) => ({
    id: `p${i}`,
    anchor: [i, 0],
    in: [i, 0],
    out: [i, 0],
  }));
  assert.throws(() => new ContinuationDraft(many.p, many.id), /4,096/);
});

test('Smooth continuation previews the committed tangent for either endpoint and preserves previous curve segments',()=>{
 for(const endpoint of ['first','last']){const{p,id,node}=fixture();for(const point of node.geometry.points){point.in=point.anchor.map((v,i)=>v-(i?8:16));point.out=point.anchor.map((v,i)=>v+(i?12:20));}const original=structuredClone(p),d=new ContinuationDraft(p,id,{endpoint,smooth:true});const anchor=d.points.at(-1).anchor;d.appendLocal([anchor[0]+60,anchor[1]+40],[anchor[0]+80,anchor[1]+50]);const g=d.geometry(),preview=d.worldPoints(),matrix=worldTransform(p,id);for(const point of g.points){const actual=preview.find(v=>v.id===point.id);for(const key of ['anchor','in','out'])assert.deepEqual(actual[endpoint==='first'&&key!=='anchor'?(key==='in'?'out':'in'):key],mapPoint(matrix,point[key]));}const end=node.geometry.points[endpoint==='first'?0:2],kept=g.points.find(v=>v.id===end.id);assert.deepEqual(kept.anchor,end.anchor);assert.deepEqual(kept[endpoint==='first'?'out':'in'],end[endpoint==='first'?'out':'in']);assert.deepEqual(kept.in.map((v,i)=>v+kept.out[i]),kept.anchor.map(v=>v*2));assert.deepEqual(p,original);d.apply(p,g);validateProject(p);compileProject(p);}
});
