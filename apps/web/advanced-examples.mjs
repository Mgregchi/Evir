import {
  createProject,
  upgradeAdvanced,
  validateProject,
} from "@evir/project-model";
import { addNode, setKey, bindPath, convertRectangle } from "@evir/authoring";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
export async function suite() {
  const projects = [];
  const make = (name) => {
    const p = upgradeAdvanced(createProject());
    p.id = name + "-project";
    p.name = name;
    p.artboards = [{ id: name + "-board", name, width: 256, height: 256 }];
    p.editor.cameras = { [name + "-board"]: { x: 0, y: 0, zoom: 1 } };
    projects.push(p);
    return p;
  };
  const node = (p, id, kind, x, y, g, parent = null) => {
    const n = {
      id: p.name + "-" + id,
      name: id,
      kind,
      parentId: parent,
      artboardId: p.artboards[0].id,
      order: p.nodes.filter((n) => n.parentId === parent).length,
      transform: [1, 0, 0, 1, x, y],
      geometry: g,
    };
    p.nodes.push(n);
    return n;
  };
  const rect = (p, id, x, y, w, h, fill, parent = null) =>
    node(p, id, "rectangle", x, y, { width: w, height: h, fill }, parent);
  const animation = (p, id) => {
    p.animations.push({
      id: p.name + "-" + id,
      name: id,
      artboardId: p.artboards[0].id,
      fps: 60,
      duration: 60,
      loop: false,
      tracks: [],
    });
    return p.animations.at(-1).id;
  };
  const asset = (p, id, mime, data) => {
    p.assets.push({
      id,
      name: id,
      mimeType: mime,
      sha256: createHash("sha256").update(data).digest("hex"),
      data: data.toString("base64"),
    });
    return id;
  };
  const p = make("canopy");
  const group = node(p, "window", "group", 20, 20, null);
  rect(p, "background", 0, 0, 216, 216, "#d9eee3", group.id);
  const gradient = rect(
    p,
    "light",
    -30,
    65,
    270,
    150,
    {
      type: "linear",
      start: [0, 0],
      end: [270, 0],
      stops: [
        { position: 0, color: "#89dcc0" },
        { position: 1, color: "#efb489" },
      ],
    },
    group.id,
  );
  const wind = node(p, "paint-wind", "bone", 0, 0, { length: 32 });
  convertRectangle(p, gradient.id);
  gradient.geometry.points.forEach((point, i) => {
    point.id = `canopy-light-point-${i}`;
  });
  bindPath(p, gradient.id, [wind.id]);
  const mask = rect(p, "mask", 44, 44, 168, 168, "#ffffff");
  p.advanced.clips.push({
    targetId: group.id,
    maskId: mask.id,
    visible: false,
  });
  const a = animation(p, "Glow");
  setKey(p, a, wind.id, "y", 0, 0);
  setKey(p, a, wind.id, "y", 60, 20);
  setKey(p, a, gradient.id, "paint.stop.0.color", 0, "#89dcc0");
  setKey(p, a, gradient.id, "paint.stop.0.color", 60, "#28493d");
  setKey(p, a, gradient.id, "paint.endX", 0, 270);
  setKey(p, a, gradient.id, "paint.endX", 60, 130);
  const feather = make("halo");
  const glow = rect(feather, "glow", 72, 72, 112, 112, "#8bdcba");
  feather.advanced.feathers.push({ targetId: glow.id, strength: 12 });
  const rig = make("reach");
  const root = node(rig, "shoulder", "bone", 64, 160, { length: 64 });
  const tip = node(rig, "elbow", "bone", 0, 0, { length: 56 }, root.id);
  rect(rig, "upper", 0, -8, 64, 16, "#34594b", root.id);
  rect(rig, "lower", 0, -7, 56, 14, "#8dd9b7", tip.id);
  const target = node(rig, "target", "group", 170, 80, null);
  rect(rig, "target-marker", -5, -5, 10, 10, "#efb489", target.id);
  rig.advanced.ik.push({
    boneId: tip.id,
    targetId: target.id,
    count: 2,
    invert: false,
    strength: 1,
  });
  const move = animation(rig, "Reach");
  setKey(rig, move, target.id, "x", 0, 170);
  setKey(rig, move, target.id, "x", 60, 110);
  const pixels = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4,
        c = x < 32 === y < 32 ? [137, 220, 192] : [239, 180, 137];
      pixels.data.set([...c, 255], i);
    }
  const png = PNG.sync.write(pixels);
  const mesh = make("kite");
  const pngId = asset(mesh, "kite-texture", "image/png", png);
  const bone = node(mesh, "wind", "bone", 0, 0, { length: 40 });
  const verts = [
    [48, 48],
    [208, 48],
    [208, 208],
    [48, 208],
  ].map((position, i) => ({
    id: "kite-v" + i,
    position,
    uv: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ][i],
  }));
  const kite = node(mesh, "cloth", "mesh", 0, 0, {
    assetId: pngId,
    vertices: verts,
    triangles: [0, 1, 2, 0, 2, 3],
    skin: {
      bindWorld: [1, 0, 0, 1, 0, 0],
      bones: [{ boneId: bone.id, bind: [1, 0, 0, 1, 0, 0] }],
      weights: verts.map((v) => ({
        pointId: v.id,
        anchor: [[bone.id, 1]],
        in: [[bone.id, 1]],
        out: [[bone.id, 1]],
      })),
    },
  });
  const flutter = animation(mesh, "Flutter");
  setKey(mesh, flutter, bone.id, "rotation", 0, 0);
  setKey(mesh, flutter, bone.id, "rotation", 60, 0.16);
  const text = make("caption");
  const font = asset(
    text,
    "noto-latin",
    "font/ttf",
    await readFile("assets/fonts/NotoSans-latin.ttf"),
  );
  node(text, "caption", "text", 32, 135, {
    text: "Hello, Evir!",
    fontAssetId: font,
    fontSize: 32,
    fill: "#34594b",
  });
  const pulse = animation(text, "Type");
  setKey(text, pulse, text.nodes[0].id, "fontSize", 0, 24);
  setKey(text, pulse, text.nodes[0].id, "fontSize", 60, 32);
  const mix = make("blend");
  const bar = rect(mix, "marker", 35, 108, 35, 40, "#89dcc0");
  const left = animation(mix, "Left"),
    right = animation(mix, "Right");
  setKey(mix, left, bar.id, "x", 0, 35);
  setKey(mix, right, bar.id, "x", 0, 186);
  mix.machines = [
    {
      id: "blend-machine",
      name: "Motion",
      artboardId: mix.artboards[0].id,
      inputs: [
        { id: "blend-level", name: "position", type: "number", value: 0 },
        { id: "blend-on", name: "active", type: "boolean", value: false },
      ],
      states: [
        { id: "blend-idle", name: "Idle", animationId: left, position: [0, 0] },
        {
          id: "blend-active",
          name: "Blend",
          animationId: left,
          position: [200, 0],
          blend: {
            type: "1d",
            inputId: "blend-level",
            children: [
              { animationId: left, position: 0 },
              { animationId: right, position: 1 },
            ],
          },
        },
      ],
      entryStateId: "blend-idle",
      transitions: [
        {
          id: "blend-start",
          fromId: "blend-idle",
          toId: "blend-active",
          conditions: [{ inputId: "blend-on", op: "eq", value: true }],
          durationMs: 400,
          exitTimeMs: 200,
        },
      ],
      listeners: [],
    },
  ];
  for (const p of projects) validateProject(p);
  return projects;
}
