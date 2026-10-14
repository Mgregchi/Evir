import test from "node:test";
import assert from "node:assert/strict";
import { createProject } from "@evir/project-model";
import { addNode, History } from "@evir/authoring";
import { nodeBounds } from "@evir/renderer-canvas";
import {
  defaultGuides,
  validateGuides,
  parseGuidePreset,
  guidePreferences,
  GUIDE_CACHE,
  gridLines,
  snapWithGuides,
} from "../../packages/studio/guides.mjs";
import {
  alignmentMoves,
  applyAlignment,
} from "../../packages/studio/alignment.mjs";

test("Guide presets strictly validate bounded positions, counts, flags and IDs", () => {
  const s = defaultGuides();
  s.guides.push({ id: "a", axis: "x", position: -12.5, visible: true });
  assert.deepEqual(parseGuidePreset(JSON.stringify(s)), s);
  for (const change of [
    (v) => (v.extra = true),
    (v) => (v.version = 3),
    (v) => (v.visible = "true"),
    (v) => (v.grid.spacing = 0),
    (v) => (v.grid.originX = Infinity),
    (v) => (v.grid.spacing = "32"),
    (v) => (v.guides[0].position = NaN),
    (v) => v.guides.push({ ...v.guides[0] }),
    (v) => (v.guides[0].axis = "z"),
    (v) =>
      (v.guides = Array.from({ length: 65 }, (_, i) => ({
        ...v.guides[0],
        id: String(i),
      }))),
  ]) {
    const v = structuredClone(s);
    change(v);
    assert.throws(() => validateGuides(v));
  }
  assert.throws(() => parseGuidePreset("{"), /valid JSON/);
  assert.throws(() => parseGuidePreset(" ".repeat(65537)), /64 KiB/);
  const copy = validateGuides(s);
  copy.guides[0].position = 1;
  assert.equal(s.guides[0].position, -12.5);
});

test("Browser guide preferences recover, isolate artboards/projects and evict older scopes", () => {
  const storage = {
      data: null,
      getItem(key) {
        assert.equal(key, GUIDE_CACHE);
        return this.data;
      },
      setItem(key, value) {
        this.data = value;
      },
    },
    warnings = [];
  let p = guidePreferences(storage, (s) => warnings.push(s));
  const s = defaultGuides();
  s.rulers = true;
  p.set("p", "a", s);
  assert.equal(p.get("p", "a").rulers, true);
  assert.equal(p.get("p", "b").rulers, false);
  assert.equal(p.get("q", "a").rulers, false);
  p = guidePreferences(storage);
  assert.equal(p.get("p", "a").rulers, true);
  const copy = p.get("p", "a");
  copy.rulers = false;
  assert.equal(p.get("p", "a").rulers, true);
  for (let i = 0; i < 33; i++) p.set(`p${i}`, "a", s);
  assert.equal(JSON.parse(storage.data).length, 32);
  assert.equal(p.get("p0", "a").rulers, false);
  storage.data = "bad";
  p = guidePreferences(storage, (v) => warnings.push(v));
  assert.deepEqual(p.get("p", "a"), defaultGuides());
  assert.equal(warnings.length, 1);
  storage.setItem = () => {
    throw Error("quota");
  };
  p.set("p", "a", s);
  assert.equal(p.get("p", "a").rulers, true);
  assert.equal(warnings.length, 2);
});

test("Manual guide and arithmetic grid snaps retain screen tolerance, hidden/Alt bypass and immutable settings", () => {
  const s = defaultGuides(),
    board = { width: 1e6, height: 1e6 },
    box = { x: 10, y: 10, width: 20, height: 20 };
  s.guides = [{ id: "g", axis: "x", position: 100, visible: true }];
  s.grid.snap = true;
  s.grid.spacing = 32;
  const before = structuredClone(s),
    result = snapWithGuides(box, null, s, board, 87, 52, 1);
  assert.equal(result.dx, 86);
  assert.equal(result.dy, 54);
  assert.equal(result.guides[0].target.name, "Grid");
  assert.deepEqual(s, before);
  assert.equal(snapWithGuides(box, null, s, board, 87, 52, 4).dx, 86); // grid at 96 is nearer at this zoom
  assert.deepEqual(snapWithGuides(box, null, s, board, 87, 52, 1, true), {
    dx: 87,
    dy: 52,
    guides: [],
  });
  s.visible = false;
  assert.equal(snapWithGuides(box, null, s, board, 87, 52, 1).dx, 87);
  s.visible = true;
  s.grid.snap = false;
  assert.equal(snapWithGuides(box, null, s, board, 87, 52, 1).dx, 90);
  assert.equal(snapWithGuides(box, null, s, board, 87, 52, 4).dx, 87);
  s.guides[0].visible = false;
  assert.equal(snapWithGuides(box, null, s, board, 87, 52, 1).dx, 87);
  s.grid.snap = true;
  s.grid.originX = 10;
  s.grid.spacing = 10000;
  assert.equal(
    snapWithGuides(
      { ...box, x: -10000 },
      null,
      s,
      { width: 100, height: 100 },
      -2,
      0,
      1,
    ).dx,
    -2,
  );
});

test("Zoomed-out dense grids draw bounded visible lines without changing configured snap spacing", () => {
  const s = defaultGuides();
  s.grid.visible = true;
  s.grid.spacing = 1;
  const lines = gridLines(
    s,
    { width: 1e6, height: 1e6 },
    { x: -5000, y: -3000, zoom: 0.1 },
    { width: 1440, height: 844 },
  );
  assert(lines.x.length <= 181);
  assert(lines.y.length <= 107);
  assert(lines.x[0] >= 50000);
  assert.equal(s.grid.spacing, 1);
  assert.deepEqual(
    gridLines(
      s,
      { width: 100, height: 100 },
      { x: 2000, y: 0, zoom: 1 },
      { width: 400, height: 400 },
    ).x,
    [],
  );
});
test("Guide snapping preserves binary search over large captured object targets", () => {
  let reads = 0;
  const entries = Array.from({ length: 100000 }, (_, i) => ({
    value: i * 10,
    box: { id: String(i), name: "Object" },
  }));
  const guarded = new Proxy(entries, {
    get(target, key) {
      if (/^\d+$/.test(String(key))) reads++;
      return Reflect.get(target, key);
    },
  });
  const s = defaultGuides();
  s.grid.snap = true;
  const result = snapWithGuides(
    { x: 0, y: 0, width: 10, height: 10 },
    { x: guarded, y: [] },
    s,
    { width: 1e6, height: 1e6 },
    99998,
    0,
    1,
  );
  assert(result.guides.length);
  assert(reads < 150, `Scene entries read: ${reads}`);
});

test("Key-object alignment keeps a locked reference fixed, moves affine members once and undoes atomically", () => {
  const p = createProject(),
    key = addNode(p, "rectangle"),
    parent = addNode(p, "group"),
    moving = addNode(p, "rectangle", parent);
  p.nodes.find((n) => n.id === key).transform[4] = 300;
  p.nodes.find((n) => n.id === parent).transform = [0, 2, -0.5, 0, 250, 80];
  p.editor.locked.push(key);
  const h = new History(p),
    original = structuredClone(p);
  const moves = alignmentMoves(p, [key, moving], "left", key);
  assert.equal(moves.length, 1);
  h.transact("Align to key", (v) => applyAlignment(v, moves));
  assert.deepEqual(
    h.committed().nodes.find((n) => n.id === key),
    p.nodes.find((n) => n.id === key),
  );
  const boxes = [key, moving].map((id) =>
    nodeBounds(
      h.committed(),
      h.committed().nodes.find((n) => n.id === id),
    ),
  );
  assert.equal(boxes[0].x, boxes[1].x);
  h.undo();
  assert.deepEqual(h.committed(), original);
  p.editor.locked.push(moving);
  assert.throws(() => alignmentMoves(p, [key, moving], "left", key), /Unlock/);
  assert.throws(
    () => alignmentMoves(p, [parent, moving], "left", moving),
    /independent/,
  );
  assert.throws(() => alignmentMoves(p, [key], "left", key), /independent/);
});
