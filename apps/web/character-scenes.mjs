import { bindPath, setWeight } from "@evir/authoring";

// Original gallery artwork. This small absolute M/L/C/Q/Z notation is only an
// internal authoring helper, not an SVG importer or a retained raster layer.
function tools(make, id, label) {
  const t = make(id, label),
    { p, node, path, oval, box, anim, key } = t;
  const group = (name, parent = null, x = 0, y = 0) =>
    node(name, "group", null, parent, x, y);
  const draw = (name, d, fill, parent = null, x = 0, y = 0) => {
    const tokens = d.match(/[MLCQZ]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) || [];
    let i = 0,
      points = [],
      closed = false;
    const pair = () => [Number(tokens[i++]), Number(tokens[i++])];
    const point = (a) => [a, [...a], [...a]];
    while (i < tokens.length) {
      const command = tokens[i++];
      if (command === "M") {
        if (points.length) throw Error("One contour per gallery path");
        points.push(point(pair()));
      } else if (command === "L") points.push(point(pair()));
      else if (command === "C") {
        const out = pair(),
          incoming = pair(),
          anchor = pair();
        points.at(-1)[2] = out;
        points.push([anchor, incoming, [...anchor]]);
      } else if (command === "Q") {
        const control = pair(),
          anchor = pair(),
          before = points.at(-1)[0];
        points.at(-1)[2] = before.map((v, j) => v + (2 * (control[j] - v)) / 3);
        points.push([
          anchor,
          anchor.map((v, j) => v + (2 * (control[j] - v)) / 3),
          [...anchor],
        ]);
      } else if (command === "Z") closed = true;
      else throw Error("Unsupported gallery contour command " + command);
    }
    if (
      !closed ||
      points.length < 3 ||
      points.some((pt) => pt.some((v) => !v.every(Number.isFinite)))
    )
      throw Error("Invalid gallery contour " + name);
    if (
      points.length > 3 &&
      points.at(-1)[0].every((v, j) => v === points[0][0][j])
    ) {
      points[0][1] = points.pop()[1];
    }
    return path(name, points, fill, parent, x, y);
  };
  const spark = (name, x, y, size, color, parent = null) =>
    draw(
      name,
      `M 0 ${-size} Q 2 -2 ${size} 0 Q 2 2 0 ${size} Q -2 2 ${-size} 0 Q -2 -2 0 ${-size} Z`,
      color,
      parent,
      x,
      y,
    );
  function backdrop(paper, disc) {
    box("paper", 0, 0, 512, 512, 0, paper);
    oval("color-field", 256, 254, 181, 181, disc);
    oval("ground-shadow", 256, 453, 106, 11, "#26374718");
  }
  function eye(
    name,
    x,
    y,
    parent,
    { rx = 15, ry = 19, white = "#fff9ec", iris = "#25333b", pupilX = 1 } = {},
  ) {
    const e = group(name, parent, x, y);
    oval(name + "-white", 0, 0, rx, ry, white, e);
    oval(name + "-iris", pupilX, 1, rx * 0.57, ry * 0.72, iris, e);
    oval(name + "-shine", pupilX - 2, -5, rx * 0.2, ry * 0.18, "#ffffff", e);
    return e;
  }
  function expressionMotion({
    root,
    baseY,
    head,
    wave,
    eyes,
    mouth,
    rest = 0,
    hello = -1,
    headRest = 0,
    cloth = null,
    leftArm = null,
  }) {
    const animations = [];
    for (const [index, label] of ["Calm", "Hello", "Delight"].entries()) {
      const a = anim(label.toLowerCase(), label);
      animations.push(a);
      const high = index === 2 ? 18 : 5,
        base = baseY - (index === 2 ? 6 : 0);
      key(a, root, "y", [
        [0, base],
        [30, base - high * 0.4],
        [60, base - high],
        [90, base - high * 0.4],
        [120, base],
      ]);
      key(a, root, "scaleY", [
        [0, index === 2 ? 1.025 : 1],
        [60, index === 2 ? 0.97 : 1.015],
        [120, index === 2 ? 1.025 : 1],
      ]);
      key(a, root, "rotation", [
        [0, index === 2 ? -0.035 : 0],
        [60, index === 2 ? 0.045 : 0],
        [120, index === 2 ? -0.035 : 0],
      ]);
      key(a, head, "rotation", [
        [0, headRest + (index === 1 ? -0.06 : 0)],
        [60, headRest + (index === 2 ? -0.1 : 0.035)],
        [120, headRest + (index === 1 ? -0.06 : 0)],
      ]);
      const arm = index ? hello : rest,
        spread = index === 1 ? 0.18 : index === 2 ? 0.12 : 0.025;
      key(a, wave, "rotation", [
        [0, arm],
        [30, arm + spread],
        [60, arm - spread],
        [90, arm + spread],
        [120, arm],
      ]);
      if (leftArm)
        key(a, leftArm, "rotation", [
          [0, index === 2 ? 0.25 : 0],
          [60, index === 2 ? -0.12 : 0.035],
          [120, index === 2 ? 0.25 : 0],
        ]);
      for (const e of eyes)
        key(a, e, "scaleY", [
          [0, 1],
          [40, 1],
          [46, 0.08],
          [52, 1],
          [120, 1],
        ]);
      key(a, mouth, "scaleY", [
        [0, index === 2 ? 1.65 : index === 1 ? 1.15 : 1],
        [60, index === 2 ? 1.85 : index === 1 ? 1.2 : 1.05],
        [120, index === 2 ? 1.65 : index === 1 ? 1.15 : 1],
      ]);
      if (cloth)
        key(a, cloth, "rotation", [
          [0, -0.025],
          [60, index === 2 ? 0.14 : index === 1 ? 0.09 : 0.04],
          [120, -0.025],
        ]);
    }
    const states = animations.map((animationId, i) => ({
      id: `${id}-state-${i}`,
      name: ["Calm", "Hello", "Delight"][i],
      animationId,
      position: [40 + i * 220, 60],
    }));
    p.machines = [
      {
        id: `${id}-expressions`,
        name: "Expressions",
        artboardId: p.artboards[0].id,
        inputs: [
          {
            id: `${id}-expression-input`,
            name: "expression",
            type: "number",
            value: 0,
          },
        ],
        states,
        entryStateId: states[0].id,
        transitions: states.flatMap((from, i) =>
          states.flatMap((to, j) =>
            i === j
              ? []
              : [
                  {
                    id: `${id}-from-${i}-to-${j}`,
                    fromId: from.id,
                    toId: to.id,
                    conditions: [
                      { inputId: `${id}-expression-input`, op: "eq", value: j },
                    ],
                  },
                ],
          ),
        ),
        listeners: [],
      },
    ];
  }
  return { ...t, group, draw, spark, backdrop, eye, expressionMotion };
}

export function characterScenes(make) {
  return {
    momo: () => momo(make),
    nura: () => nura(make),
    otto: () => otto(make),
  };
}

function momo(make) {
  const { p, node, draw, oval, group, spark, backdrop, expressionMotion } =
    tools(make, "momo", "Momo — a pocketful of joy");
  backdrop("#fff7e8", "#f4e1d7");
  spark("left-spark", 103, 175, 14, "#e59c73");
  spark("right-spark", 402, 269, 10, "#a997d4");
  oval("small-orbit", 395, 151, 7, 7, "#a997d4");
  oval("small-seed", 112, 329, 5, 5, "#669f8d");
  const root = group("character", null, 256, 319);
  draw(
    "back-foot",
    "M -59 94 C -91 91 -108 106 -101 117 C -95 127 -58 126 -34 115 L -32 103 Z",
    "#d97865",
    root,
  );
  draw(
    "front-foot",
    "M 30 102 C 58 95 85 102 91 115 C 92 127 61 131 30 120 Z",
    "#d97865",
    root,
  );
  const left = group("left-flipper", root, -90, -7);
  draw(
    "left-flipper-shape",
    "M 6 -21 C -18 -32 -48 -23 -58 0 C -68 21 -57 32 -43 23 C -24 11 -16 7 8 9 Z",
    "#419d8e",
    left,
  );
  const wave = group("waving-flipper", root, 88, -21);
  draw(
    "waving-flipper-shape",
    "M -4 -18 C 16 -18 28 -39 43 -56 C 55 -71 72 -64 65 -45 C 84 -64 96 -55 84 -34 C 107 -41 111 -25 88 -11 C 64 3 36 22 0 18 Z",
    "#65bea5",
    wave,
  );
  draw(
    "body-shadow",
    "M -102 73 C -130 7 -116 -95 -59 -137 C -44 -162 -50 -181 -30 -191 C -8 -202 18 -183 23 -156 C 75 -144 112 -91 116 -31 C 126 34 109 106 70 119 C 42 128 28 111 1 119 C -32 135 -88 119 -102 73 Z",
    "#348f80",
    root,
  );
  draw(
    "body",
    "M -93 67 C -116 5 -100 -93 -49 -132 C -31 -155 -35 -177 -22 -181 C -8 -182 5 -162 7 -143 C 67 -135 103 -86 105 -25 C 111 33 99 96 65 107 C 40 117 27 100 1 109 C -31 124 -80 107 -93 67 Z",
    "#81ceb3",
    root,
  );
  draw(
    "body-light",
    "M -78 -50 C -65 -99 -37 -124 -3 -127 C 28 -129 51 -107 59 -80 C 29 -106 -8 -102 -29 -73 C -49 -45 -47 -5 -70 12 C -89 19 -88 -23 -78 -50 Z",
    "#b5e5cd",
    root,
  );
  draw(
    "belly",
    "M -64 36 C -69 5 -43 -6 2 -5 C 45 -6 72 15 67 49 C 64 84 31 98 -2 95 C -36 92 -61 70 -64 36 Z",
    "#c1ead0",
    root,
  );
  const head = group("face", root, 4, -51);
  const eyes = [];
  for (const [name, x] of [
    ["left-eye", -34],
    ["right-eye", 34],
  ]) {
    const e = group(name, head, x, -23);
    oval(name + "-sclera", 0, 0, 19, 24, "#fff9eb", e);
    oval(name + "-pupil", 3, 2, 10, 15, "#233e3d", e);
    oval(name + "-shine", 5, -5, 4, 5, "#ffffff", e);
    eyes.push(e);
  }
  oval("left-blush", -55, 12, 15, 8, "#e49f8b", head);
  oval("right-blush", 56, 12, 15, 8, "#e49f8b", head);
  draw(
    "left-brow",
    "M -54 -54 Q -40 -69 -22 -56 Q -39 -61 -51 -50 Z",
    "#397f70",
    head,
  );
  draw(
    "right-brow",
    "M 20 -56 Q 38 -69 52 -55 L 50 -50 Q 35 -60 20 -51 Z",
    "#397f70",
    head,
  );
  const mouth = group("smile", head, 0, 17);
  draw(
    "mouth",
    "M -28 -4 C -16 2 15 2 28 -4 C 31 17 15 29 1 29 C -16 28 -29 14 -28 -4 Z",
    "#26413d",
    mouth,
  );
  draw("tooth", "M -15 0 Q 0 4 15 0 L 14 7 Q 0 12 -14 7 Z", "#fff9e8", mouth);
  draw(
    "tongue",
    "M -13 25 C -9 13 10 11 16 24 Q 1 34 -13 25 Z",
    "#e6a092",
    mouth,
  );
  draw("nose", "M -5 3 Q 0 -1 5 3 Q 0 10 -5 3 Z", "#397f70", head);
  expressionMotion({
    root,
    baseY: 319,
    head,
    wave,
    eyes,
    mouth,
    rest: 0.75,
    hello: -0.55,
    leftArm: left,
  });
  return p;
}

function nura(make) {
  const {
    p,
    node,
    draw,
    oval,
    box,
    group,
    spark,
    backdrop,
    eye,
    expressionMotion,
  } = tools(make, "nura", "Nura — a warm little welcome");
  backdrop("#f6f4ed", "#e4e7f4");
  spark("peach-spark", 107, 229, 12, "#dda37d");
  spark("mint-spark", 399, 313, 10, "#77ad94");
  oval("floating-dot", 381, 98, 6, 6, "#b2bce6");
  const root = group("character", null, 256, 285);
  draw(
    "left-shoe",
    "M -48 137 C -71 135 -79 148 -77 157 Q -48 164 -19 156 L -18 142 Z",
    "#354449",
    root,
  );
  draw(
    "right-shoe",
    "M 17 139 L 48 137 C 68 140 81 151 73 158 Q 47 166 16 157 Z",
    "#354449",
    root,
  );
  draw(
    "skirt",
    "M -49 42 C -62 73 -75 111 -75 142 Q -6 167 74 141 C 68 100 57 65 43 41 Z",
    "#a5addb",
    root,
  );
  draw(
    "skirt-side",
    "M 18 45 L 43 41 C 58 65 68 102 74 141 Q 48 150 31 150 C 36 110 31 74 18 45 Z",
    "#8692c5",
    root,
  );
  draw(
    "skirt-fold-one",
    "M -36 66 C -46 104 -48 124 -49 146 L -45 147 C -43 113 -37 83 -33 68 Z",
    "#7e8cbf",
    root,
  );
  draw(
    "skirt-fold-two",
    "M 2 59 C -4 101 -2 133 2 153 L 6 153 C 3 112 3 84 6 60 Z",
    "#7e8cbf",
    root,
  );
  draw(
    "blouse",
    "M -45 -49 C -61 -34 -66 2 -54 52 Q 0 69 54 51 C 60 7 60 -27 41 -47 Z",
    "#4e7f72",
    root,
  );
  draw(
    "blouse-light",
    "M -43 -44 Q -55 6 -44 49 Q -27 56 -14 56 L -13 -46 Z",
    "#659a86",
    root,
  );
  const left = group("left-sleeve", root, -49, -32);
  draw(
    "sleeve",
    "M 6 -7 C -22 -8 -27 21 -29 52 Q -24 68 -7 64 C 2 41 9 18 12 0 Z",
    "#578a7a",
    left,
  );
  draw(
    "left-cuff",
    "M -29 49 Q -20 59 -6 54 L -7 65 Q -20 70 -30 60 Z",
    "#356456",
    left,
  );
  draw(
    "left-hand",
    "M -28 62 Q -18 69 -8 64 L -6 81 C -2 93 -9 94 -15 84 L -15 101 Q -20 106 -22 94 L -25 101 Q -31 104 -31 92 L -35 95 Q -41 94 -36 79 Z",
    "#d9946c",
    left,
  );
  const wave = group("waving-sleeve", root, 50, -34);
  draw(
    "raised-sleeve",
    "M -7 -3 C 11 2 21 -9 21 -29 L 20 -56 Q 29 -67 43 -58 C 52 -27 44 -3 28 12 Q 7 29 -11 14 Z",
    "#578a7a",
    wave,
  );
  draw(
    "raised-cuff",
    "M 19 -54 Q 29 -47 44 -53 L 44 -66 Q 31 -74 19 -67 Z",
    "#356456",
    wave,
  );
  draw(
    "waving-hand",
    "M 22 -65 C 15 -76 11 -86 15 -89 Q 21 -93 26 -80 L 24 -104 Q 25 -113 31 -107 L 35 -84 L 36 -112 Q 41 -119 45 -110 L 46 -85 L 51 -103 Q 57 -107 58 -98 L 54 -78 C 64 -94 71 -86 62 -71 Q 54 -55 41 -56 Z",
    "#e7ab80",
    wave,
  );
  draw(
    "palm-crease",
    "M 27 -72 Q 34 -84 46 -74 L 45 -71 Q 35 -79 29 -68 Z",
    "#bb7657",
    wave,
  );
  const clothRoot = node("scarf-root", "bone", { length: 45 }, root, -20, -7),
    clothTip = node("scarf-tip", "bone", { length: 45 }, clothRoot);
  const tail = draw(
    "floating-scarf",
    "M -24 -20 C 5 -12 47 -4 93 39 C 56 40 51 70 2 82 C 8 51 -12 21 -24 -20 Z",
    "#8297cb",
    root,
  );
  const seam = draw(
    "scarf-fold",
    "M -8 0 C 11 14 47 29 69 36 C 34 26 11 34 3 60 L 2 48 C 13 27 3 19 -8 0 Z",
    "#6179b0",
    root,
  );
  for (const id of [tail, seam]) {
    bindPath(p, id, [clothRoot, clothTip]);
    const n = p.nodes.find((n) => n.id === id);
    for (const point of n.geometry.points)
      for (const c of ["anchor", "in", "out"])
        setWeight(
          p,
          id,
          point.id,
          c,
          clothTip,
          Math.max(0, Math.min(0.9, (point[c][0] + 10) / 110)),
        );
  }
  const head = group("head", root, 0, -113);
  draw(
    "hijab-outline",
    "M -74 58 C -94 20 -92 -58 -58 -85 C -28 -114 37 -104 66 -68 C 86 -42 89 12 75 56 L 83 73 C 57 86 31 82 4 74 C -28 84 -60 79 -80 70 Z",
    "#4b577d",
    head,
  );
  draw(
    "hijab",
    "M -67 53 C -84 12 -80 -54 -52 -78 C -22 -103 34 -95 59 -63 C 78 -37 80 12 67 53 L 73 67 C 49 77 25 72 3 67 C -25 76 -52 70 -71 64 Z",
    "#91a2d4",
    head,
  );
  draw(
    "face",
    "M -50 -48 C -29 -71 9 -74 40 -43 C 58 -23 62 7 52 35 C 39 65 -3 77 -34 53 C -55 36 -62 -14 -50 -48 Z",
    "#e7ab80",
    head,
  );
  draw(
    "face-shade",
    "M 44 -28 C 66 1 53 43 25 55 Q -1 73 -28 56 C 3 80 44 66 54 37 C 64 9 57 -12 44 -28 Z",
    "#d3936d",
    head,
  );
  draw(
    "scarf-sweep",
    "M -63 -43 C -58 -82 -17 -98 21 -79 C 43 -68 60 -48 67 -20 C 48 -48 23 -48 -5 -66 C -19 -44 -45 -33 -63 -13 Z",
    "#aebde9",
    head,
  );
  for (const [name, x] of [
    ["left", -28],
    ["right", 30],
  ]) {
    oval(name + "-glasses-frame", x, 3, 28, 30, "#3b414f", head);
    oval(name + "-lens", x, 3, 24.5, 26.5, "#edb68c", head);
  }
  const eyes = [
    eye("left-eye", -28, 1, head, { rx: 14, ry: 18, iris: "#48392f" }),
    eye("right-eye", 30, 1, head, { rx: 14, ry: 18, iris: "#48392f" }),
  ];
  draw(
    "glasses-bridge",
    "M -3 -4 Q 1 -9 6 -4 L 6 0 Q 1 -5 -3 0 Z",
    "#3b414f",
    head,
  );
  draw(
    "left-lens-shine",
    "M -49 -4 Q -46 -17 -37 -18 L -39 -15 Q -44 -12 -46 -3 Z",
    "#fff6df",
    head,
  );
  draw(
    "right-lens-shine",
    "M 9 -4 Q 12 -17 21 -18 L 19 -15 Q 14 -12 12 -3 Z",
    "#fff6df",
    head,
  );
  draw(
    "left-brow",
    "M -44 -28 Q -30 -41 -15 -29 L -16 -25 Q -31 -34 -43 -24 Z",
    "#6e493c",
    head,
  );
  draw(
    "right-brow",
    "M 15 -29 Q 31 -40 46 -27 L 45 -23 Q 30 -34 16 -25 Z",
    "#6e493c",
    head,
  );
  oval("left-blush", -46, 33, 10, 5, "#d98578", head);
  oval("right-blush", 45, 34, 10, 5, "#d98578", head);
  draw("nose", "M 1 15 Q -3 25 4 25 L 3 28 Q -7 27 -2 15 Z", "#bc7556", head);
  const mouth = group("smile", head, 1, 38);
  draw(
    "mouth",
    "M -11 -2 Q 0 4 12 -2 C 13 12 -10 16 -11 -2 Z",
    "#713f3b",
    mouth,
  );
  draw("smile-light", "M -5 8 Q 2 3 8 8 Q 1 14 -5 8 Z", "#ed9f91", mouth);
  oval("scarf-pin", 58, 60, 5.5, 5.5, "#ebc58e", head);
  expressionMotion({
    root,
    baseY: 285,
    head,
    wave,
    eyes,
    mouth,
    rest: 1.85,
    hello: 0,
    cloth: clothTip,
    leftArm: left,
  });
  return p;
}

function otto(make) {
  const { p, draw, oval, box, group, spark, backdrop, eye, expressionMotion } =
    tools(make, "otto", "Otto — a rhythm of his own");
  backdrop("#f3efe6", "#dfebe3");
  spark("orange-beat", 100, 157, 11, "#d17c50");
  spark("mint-beat", 409, 214, 9, "#6ba58e");
  const root = group("character", null, 252, 288);
  draw(
    "back-trouser",
    "M -38 35 L 17 38 C 9 80 -13 105 -34 147 L -65 142 C -59 103 -44 66 -38 35 Z",
    "#354a55",
    root,
  );
  draw(
    "front-trouser",
    "M 6 38 L 54 33 C 64 72 50 119 62 151 L 27 156 C 13 120 14 89 -1 72 Z",
    "#233a43",
    root,
  );
  draw(
    "back-sock",
    "M -64 135 L -35 142 L -41 157 L -68 150 Z",
    "#fff5e1",
    root,
  );
  draw("front-sock", "M 28 147 L 60 144 L 65 162 L 34 166 Z", "#fff5e1", root);
  draw(
    "left-sneaker",
    "M -66 146 L -39 155 C -33 167 -18 164 -18 173 Q -50 184 -83 170 L -80 162 Z",
    "#7eac91",
    root,
  );
  draw(
    "left-sole",
    "M -83 166 Q -52 181 -18 170 L -17 176 Q -54 185 -85 172 Z",
    "#e8dfc9",
    root,
  );
  draw(
    "right-sneaker",
    "M 32 158 L 61 155 C 72 166 91 162 96 173 C 82 184 45 182 30 177 Z",
    "#7eac91",
    root,
  );
  draw(
    "right-sole",
    "M 30 173 Q 64 184 96 171 L 98 177 Q 63 190 29 178 Z",
    "#e8dfc9",
    root,
  );
  draw("shirt", "M -35 -79 L 30 -85 L 55 47 Q 1 68 -43 43 Z", "#fff3db", root);
  const left = group("left-arm", root, -37, -67);
  draw(
    "left-sleeve",
    "M 5 -10 C -25 -11 -32 22 -29 51 L -12 57 C 2 32 7 12 10 2 Z",
    "#ce7951",
    left,
  );
  draw("left-wrist", "M -28 46 L -13 52 L -18 68 L -33 63 Z", "#a25d43", left);
  draw(
    "left-hand",
    "M -33 61 Q -18 62 -16 75 L -15 88 Q -19 93 -23 82 L -26 92 Q -32 95 -34 86 L -37 91 Q -43 91 -41 81 L -42 73 Z",
    "#9c553f",
    left,
  );
  const wave = group("right-arm", root, 38, -68);
  draw(
    "right-sleeve",
    "M -8 -7 C 8 -13 22 -1 25 13 L 34 37 L 60 51 L 52 69 C 28 67 4 52 -2 35 Z",
    "#e18c5b",
    wave,
  );
  draw("right-cuff", "M 54 45 L 67 51 L 59 70 L 48 66 Z", "#b86446", wave);
  draw(
    "right-hand",
    "M 64 51 C 73 50 80 53 85 48 L 95 35 Q 102 33 101 40 L 92 55 L 108 47 Q 116 48 110 55 L 97 64 L 108 62 Q 117 66 107 70 L 94 72 Q 105 74 103 80 C 91 87 77 72 61 69 Z",
    "#a96448",
    wave,
  );
  draw(
    "jacket-left",
    "M -38 -86 L -10 -83 C -14 -45 -11 -5 -19 47 L -50 43 C -48 14 -56 -48 -38 -86 Z",
    "#e09261",
    root,
  );
  draw(
    "jacket-right",
    "M 14 -86 L 38 -86 C 48 -45 57 -8 58 45 L 19 51 C 22 4 9 -43 14 -86 Z",
    "#eaa26c",
    root,
  );
  draw(
    "lapel-left",
    "M -38 -84 L -11 -85 L -18 -49 L -30 -57 L -28 -66 L -41 -67 Z",
    "#f6b980",
    root,
  );
  draw(
    "lapel-right",
    "M 15 -85 L 34 -86 L 46 -69 L 30 -67 L 34 -56 L 21 -45 Z",
    "#f6b980",
    root,
  );
  draw("pocket-seam", "M 29 -24 L 48 -26 L 49 -22 L 30 -20 Z", "#b86f4b", root);
  oval("jacket-button", 9, 13, 2.5, 2.5, "#a96149", root);
  draw(
    "tee-line",
    "M -3 -62 Q 4 -58 13 -62 L 13 -58 Q 4 -54 -3 -59 Z",
    "#d2c4ac",
    root,
  );
  const head = group("head", root, -5, -140);
  draw("neck", "M -12 28 L 20 24 L 24 62 Q 5 74 -14 59 Z", "#9b5842", head);
  draw(
    "neck-shade",
    "M -11 29 L 20 29 L 20 49 Q 4 54 -11 42 Z",
    "#7c4436",
    head,
  );
  draw(
    "headphone-band",
    "M -51 -2 C -66 -69 14 -89 43 -37 L 37 -30 C 9 -75 -51 -55 -43 -2 Z",
    "#577b77",
    head,
  );
  oval("back-ear", 36, 1, 12, 18, "#a35e45", head);
  draw(
    "face",
    "M -36 -34 C -22 -54 21 -51 32 -28 L 37 -2 L 48 12 Q 47 18 35 18 L 33 32 C 12 49 -14 45 -29 25 C -44 8 -47 -16 -36 -34 Z",
    "#b57250",
    head,
  );
  draw(
    "face-shade",
    "M -38 -22 C -41 0 -26 23 -8 28 C 5 35 21 32 34 22 L 33 33 C 11 49 -14 45 -29 25 C -41 12 -45 -8 -38 -22 Z",
    "#9d5b43",
    head,
  );
  draw(
    "hair",
    "M -43 3 C -62 -12 -62 -43 -49 -49 C -57 -65 -37 -74 -23 -68 C -20 -85 5 -84 13 -71 C 27 -84 45 -68 40 -55 C 58 -48 53 -30 37 -24 C 26 -18 13 -25 7 -37 C 2 -21 -16 -19 -28 -26 L -30 -2 Z",
    "#293b3e",
    head,
  );
  draw(
    "curl-light",
    "M -43 -46 C -30 -61 -11 -49 -8 -38 C -21 -49 -31 -46 -38 -33 Z",
    "#3e5253",
    head,
  );
  oval("headphone-pad", -37, 6, 16, 21, "#334c4d", head);
  oval("headphone-shell", -41, 4, 11, 16, "#8bbca2", head);
  oval("headphone-inset", -42, 4, 6, 10, "#bdd7be", head);
  const eyes = [
    eye("left-eye", -7, -7, head, {
      rx: 8,
      ry: 10,
      pupilX: 2,
      iris: "#283a3d",
    }),
    eye("right-eye", 23, -10, head, {
      rx: 7,
      ry: 9,
      pupilX: 1,
      iris: "#283a3d",
    }),
  ];
  draw(
    "left-brow",
    "M -18 -23 Q -6 -30 4 -23 L 3 -19 Q -7 -25 -16 -19 Z",
    "#293b3e",
    head,
  );
  draw(
    "right-brow",
    "M 13 -27 Q 25 -32 31 -23 L 28 -20 Q 23 -27 14 -23 Z",
    "#293b3e",
    head,
  );
  draw("nose-light", "M 27 1 L 36 10 L 27 11 Z", "#cc8b62", head);
  const mouth = group("smile", head, 13, 25);
  draw(
    "mouth",
    "M -10 -4 Q 1 0 14 -7 C 13 10 -7 15 -10 -4 Z",
    "#633b32",
    mouth,
  );
  draw("teeth", "M -5 -1 Q 4 0 11 -3 L 9 1 Q 1 6 -4 3 Z", "#fff3db", mouth);
  expressionMotion({
    root,
    baseY: 288,
    head,
    wave,
    eyes,
    mouth,
    rest: 0.1,
    hello: -1.6,
    headRest: -0.1,
    leftArm: left,
  });
  return p;
}
