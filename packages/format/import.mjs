import {
  createProject,
  upgradeAdvanced,
  validateProject,
  ProjectError,
  newId,
  encodeBase64,
  defaultStroke, STROKE_CAPS, STROKE_JOINS,pathContours,
} from "@evir/project-model";
import schema from "./schema/runtime.json" with { type: "json" };
import {contourTypes, vertexTypes, editableContour, isIdentityContour} from './contours.mjs';
const types = new Map(
  Object.entries(schema.types).map(([id, t]) => [Number(id), t]),
);
const typesByName = new Map([...types.values()].map((t) => [t.name, t]));
const fieldsByType = new Map(
  [...types].map(([id, t]) => {
    const names = new Map();
    let current = t;
    while (current) {
      for (const [name, key] of Object.entries(current.properties))
        names.set(key, name);
      current = typesByName.get(current.parent);
    }
    return [id, names];
  }),
);
// Decode the real binary stream, with bounded reads and explicit unsupported
// type/property errors. No editor history or proprietary .rev data is inferred.
export function readRiv(input, { allowedTypes } = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length > 32 * 1024 * 1024)
    throw new ProjectError(["Rive file exceeds 32 MiB"]);
  let at = 0;
  const take = (n) => {
    if (at + n > bytes.length)
      throw new ProjectError(["Truncated Rive file at byte " + at]);
    const v = bytes.subarray(at, at + n);
    at += n;
    return v;
  };
  const uint = () => {
    let v = 0,
      f = 1;
    for (let i = 0; i < 8; i++) {
      const b = take(1)[0];
      v += (b & 127) * f;
      if (!Number.isSafeInteger(v))
        throw new ProjectError(["Integer exceeds supported range"]);
      if (!(b & 128)) return v;
      f *= 128;
    }
    throw new ProjectError(["Invalid varuint"]);
  };
  if (new TextDecoder().decode(take(4)) !== "RIVE")
    throw new ProjectError(["Expected RIVE signature"]);
  const major = uint(),
    minor = uint(),
    fileId = uint();
  if (major !== 7) throw new ProjectError(["Unsupported Rive major " + major]);
  const keys = [];
  const seenKeys = new Set();
  for (let k; (k = uint()) !== 0; ) {
    if (keys.length >= 16384)
      throw new ProjectError(["Rive header budget exceeded"]);
    if (seenKeys.has(k)) throw new ProjectError(["Duplicate Rive header key"]);
    seenKeys.add(k);
    keys.push(k);
  }
  // Rive advances four entries per uint32 (despite room for 16 two-bit values).
  // Follow the upstream reader and the existing Python codec exactly.
  const table = new Map();
  for (let i = 0; i < keys.length; i += 4) {
    const data = new DataView(
      take(4).buffer,
      bytes.byteOffset + at - 4,
      4,
    ).getUint32(0, true);
    for (let j = 0; j < 4 && i + j < keys.length; j++)
      table.set(keys[i + j], (data >>> (j * 2)) & 3);
  }
  const records = [];
  while (at < bytes.length) {
    const offset = at,
      type = uint(),
      t = types.get(type);
    if (!t)
      throw new ProjectError([
        "Unsupported Rive type " + type + " at byte " + offset,
      ]);
    if (allowedTypes && !allowedTypes.has(t.name))
      throw new ProjectError([
        `${t.name} at byte ${offset}: outside editable import subset; original file remains unchanged`,
      ]);
    const names = fieldsByType.get(type);
    const fields = {};
    for (let key; (key = uint()) !== 0; ) {
      const wire = schema.properties[key]?.wire,
        name = names.get(key);
      if (!wire || !name)
        throw new ProjectError([
          `${t.name}: unsupported property ${key}; import would discard data`,
        ]);
      if (Object.hasOwn(fields, name))
        throw new ProjectError(["Duplicate Rive property"]);
      let value;
      if (wire === "uint") value = uint();
      else if (wire === "bool") {
        value = take(1)[0];
        if (value > 1) throw new ProjectError(["Invalid boolean"]);
        value = !!value;
      } else if (wire === "string" || wire === "bytes") {
        const raw = take(uint());
        value =
          wire === "string"
            ? new TextDecoder("utf-8", { fatal: true }).decode(raw)
            : Uint8Array.from(raw);
      } else {
        const raw = take(4),
          view = new DataView(raw.buffer, raw.byteOffset, 4);
        value =
          wire === "color" ? view.getUint32(0, true) : view.getFloat32(0, true);
        if (!Number.isFinite(value))
          throw new ProjectError(["Nonfinite Rive property"]);
      }
      fields[name] = value;
    }
    records.push({ type: t.name, fields, offset });
    if (records.length > 200000)
      throw new ProjectError(["Rive record budget exceeded"]);
  }
  return { major, minor, fileId, records };
}
const transform = (f) => {
  const r = f.rotation ?? 0,
    x = f.scaleX ?? 1,
    y = f.scaleY ?? 1;
  return [
    Math.cos(r) * x,
    Math.sin(r) * x,
    -Math.sin(r) * y,
    Math.cos(r) * y,
    f.x ?? 0,
    f.y ?? 0,
  ];
};
const matrix = (f) => [
  f.xx ?? 1,
  f.xy ?? 0,
  f.yx ?? 0,
  f.yy ?? 1,
  f.tx ?? 0,
  f.ty ?? 0,
];
const color = (v) =>
  "#" +
  (v & 0xffffff).toString(16).padStart(6, "0") +
  (v >>> 24).toString(16).padStart(2, "0");
const editableTypes = new Set([
  "Backboard",
  "ImageAsset",
  "FontAsset",
  "FileAssetContents",
  "Artboard",
  "Node",
  "RootBone",
  "Bone",
  "Shape",
  "Rectangle",
  "Ellipse",
  "PointsPath",
  "CubicDetachedVertex",
  "CubicMirroredVertex",
  "CubicAsymmetricVertex",
  "StraightVertex",
  "CubicWeight",
  "Weight",
  "Skin",
  "Tendon",
  "Fill",
  "Stroke", "TrimPath", "DashPath", "Dash",
  "SolidColor",
  "LinearGradient",
  "RadialGradient",
  "GradientStop",
  "ClippingShape",
  "Feather",
  "IKConstraint",
  "Image",
  "Mesh",
  "MeshVertex",
  "ContourMeshVertex",
  "Text",
  "TextStyle",
  "TextStylePaint",
  "TextValueRun",
  "CubicEaseInterpolator",
  "LinearAnimation",
  "KeyedObject",
  "KeyedProperty",
  "KeyFrameDouble",
  "KeyFrameColor",
  "StateMachine",
  "StateMachineBool",
  "StateMachineNumber",
  "StateMachineTrigger",
  "StateMachineLayer",
  "EntryState",
  "AnyState",
  "ExitState",
  "AnimationState",
  "BlendState1DInput",
  "BlendAnimation1D",
  "BlendStateDirect", "BlendAnimationDirect",
  "StateTransition",
  "TransitionBoolCondition",
  "TransitionNumberCondition",
  "TransitionTriggerCondition",
  "StateMachineListenerSingle",
  "ListenerBoolChange",
  "ListenerNumberChange",
  "ListenerTriggerChange",
]);
async function decodeProject(input) {
  const { records } = readRiv(input, { allowedTypes: editableTypes }),
    p = upgradeAdvanced(createProject());
  p.nodes = [];
  p.artboards = [];
  p.editor.cameras = {};
  p.name = "Imported Rive scene";
  const fail = (r, message) => {
    throw new ProjectError([`${r.type} at byte ${r.offset}: ${message}`]);
  };
  for (const r of records)
    if (!editableTypes.has(r.type))
      fail(
        r,
        "outside editable import subset; original file remains unchanged",
      );
  // Enforce accepted semantics, including explicit defaults. Unknown fields
  // are never silently dropped merely because their binary wire is understood.
  const common = ["name", "parentId"],
    trs = [...common, "x", "y", "rotation", "scaleX", "scaleY"];
  const accepted = {
    Backboard: [],
    ImageAsset: ["name", "assetId", "width", "height"],
    FontAsset: ["name", "assetId"],
    FileAssetContents: ["bytes"],
    Artboard: ["name", "width", "height", "defaultStateMachineId"],
    Node: trs,
    Shape: [...trs, "opacity"],
    RootBone: [...trs, "length"],
    Bone: [...common, "rotation", "scaleX", "scaleY", "length"],
    Rectangle: [...trs, "pathFlags", "width", "height", "originX", "originY", "linkCornerRadius", "cornerRadiusTL", "cornerRadiusTR", "cornerRadiusBL", "cornerRadiusBR"],
    Ellipse: [...trs, "pathFlags", "width", "height", "originX", "originY"],
    PointsPath: [...trs, "pathFlags", "isClosed"],
    StraightVertex: [...common, "x", "y", "radius"],
    CubicMirroredVertex: [...common, "x", "y", "rotation", "distance"],
    CubicAsymmetricVertex: [...common, "x", "y", "rotation", "inDistance", "outDistance"],
    CubicDetachedVertex: [
      ...common,
      "x",
      "y",
      "inRotation",
      "inDistance",
      "outRotation",
      "outDistance",
    ],
    CubicWeight: [
      ...common,
      "indices",
      "values",
      "inIndices",
      "inValues",
      "outIndices",
      "outValues",
    ],
    Weight: [...common, "indices", "values"],
    Skin: [...common, "xx", "xy", "yx", "yy", "tx", "ty"],
    Tendon: [...common, "boneId", "xx", "xy", "yx", "yy", "tx", "ty"],
    Fill: [...common, "fillRule"],
    Stroke: [...common,"thickness","cap","join","transformAffectsStroke","position"],
    TrimPath: [...common,"start","end","offset","modeValue"],
    DashPath: [...common,"offset","offsetIsPercentage"],
    Dash: [...common,"length","lengthIsPercentage"],
    SolidColor: [...common, "colorValue"],
    LinearGradient: [...common, "startX", "startY", "endX", "endY"],
    RadialGradient: [...common, "startX", "startY", "endX", "endY"],
    GradientStop: [...common, "position", "colorValue"],
    ClippingShape: [...common, "sourceId", "fillRule", "isVisible"],
    Feather: [...common, "strength"],
    IKConstraint: [
      ...common,
      "targetId",
      "parentBoneCount",
      "invertDirection",
      "strength",
    ],
    Image: [...trs, "assetId", "originX", "originY"],
    Mesh: [...common, "triangleIndexBytes"],
    MeshVertex: [...common, "x", "y", "u", "v"],
    ContourMeshVertex: [...common, "x", "y", "u", "v"],
    Text: [...trs, "originValue"],
    TextStyle: [...common, "fontSize", "fontAssetId"],
    TextStylePaint: [...common, "fontSize", "fontAssetId"],
    TextValueRun: [...common, "styleId", "text"],
    CubicEaseInterpolator: ["x1", "y1", "x2", "y2"],
    LinearAnimation: ["name", "fps", "duration", "loopValue", "speed"],
    KeyedObject: ["objectId"],
    KeyedProperty: ["propertyKey"],
    KeyFrameDouble: ["frame", "value", "interpolationType", "interpolatorId"],
    KeyFrameColor: ["frame", "value", "interpolationType", "interpolatorId"],
    StateMachine: ["name"],
    StateMachineLayer: ["name"],
    EntryState: [],
    AnyState: [],
    ExitState: [],
    AnimationState: ["animationId"],
    BlendStateDirect: ["flags"],
    BlendAnimationDirect: ["animationId","inputId","mixValue","blendSource"],
    BlendState1DInput: ["inputId", "flags"],
    BlendAnimation1D: ["animationId", "value"],
    StateTransition: ["stateToId", "duration", "flags", "exitTime"],
    TransitionBoolCondition: ["inputId", "opValue"],
    TransitionNumberCondition: ["inputId", "opValue", "value"],
    TransitionTriggerCondition: ["inputId"],
    StateMachineBool: ["name", "value"],
    StateMachineNumber: ["name", "value"],
    StateMachineTrigger: ["name"],
    StateMachineListenerSingle: ["targetId", "listenerTypeValue"],
    ListenerBoolChange: ["inputId", "value"],
    ListenerNumberChange: ["inputId", "value"],
    ListenerTriggerChange: ["inputId"],
  };
  for (const r of records)
    for (const k of Object.keys(r.fields))
      if (!accepted[r.type]?.includes(k))
        fail(r, "unsupported editable property " + k);
  const assets = [];
  let currentAsset;
  for (const r of records) {
    if (["ImageAsset", "FontAsset"].includes(r.type)) {
      currentAsset = {
        id: newId("asset"),
        name: r.fields.name || "Imported asset",
        mimeType: r.type === "ImageAsset" ? "image/png" : "font/ttf",
        sha256: "",
        data: "",
        width: r.fields.width,
        height: r.fields.height,
      };
      assets.push(currentAsset);
    } else if (r.type === "FileAssetContents") {
      if (!currentAsset) fail(r, "missing asset owner");
      const data = r.fields.bytes;
      currentAsset.data = encodeBase64(data);
      currentAsset.sha256 = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      currentAsset = null;
    }
  }
  if (assets.some((a) => !a.data))
    throw new ProjectError(["External assets must be embedded before import"]);
  p.assets = assets.map(({ width, height, ...a }) => a);
  const boards = [];
  let board;
  for (const r of records) {
    if (r.type === "Artboard") {
      board = { record: r, components: [], tail: [] };
      boards.push(board);
    } else if (board) {
      if (["ImageAsset", "FontAsset", "FileAssetContents"].includes(r.type))
        continue;
      if (
        board.tail.length ||
        r.type === "LinearAnimation" ||
        r.type === "StateMachine"
      )
        board.tail.push(r);
      else board.components.push(r);
    }
  }
  for (const board of boards) {
    const art = {
      id: newId("artboard"),
      name: board.record.fields.name || "Artboard",
      width: board.record.fields.width ?? 0,
      height: board.record.fields.height ?? 0,
    };
    p.artboards.push(art);
    p.editor.cameras[art.id] = { x: 0, y: 0, zoom: 1 };
    const components = [board.record, ...board.components],
      nodeIds = new Map(),
      targets = new Map();
    const childrenByParent = new Map();
    for (const [i, r] of components.entries()) {
      if (!i) continue;
      const parent = r.fields.parentId ?? 0;
      if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
      childrenByParent.get(parent).push({ r, i });
    }
    const children = (id) => childrenByParent.get(id) ?? [];
    for (const r of components) {
      const parent=components[r.fields.parentId ?? 0];
      const required={Stroke:"Shape",TrimPath:"Stroke",DashPath:"Stroke",Dash:"DashPath"}[r.type];
      if(required && parent?.type!==required)fail(r,"unsupported stroke-effect parent; import would discard data");
      if(contourTypes.has(r.type) && parent?.type!=="Shape")fail(r,"editable contours must belong directly to one Shape");
      if(vertexTypes.has(r.type) && parent?.type!=="PointsPath")fail(r,"editable vertices must belong to a PointsPath");
      if(r.type==="Skin" && !["PointsPath","Mesh"].includes(parent?.type))fail(r,"skin must belong to editable path or mesh geometry");
      if(r.type==="Tendon" && parent?.type!=="Skin")fail(r,"tendon must belong to a skin");
      if(["Weight","CubicWeight"].includes(r.type)) {
        const cubic=vertexTypes.has(parent?.type)&&parent.type!=="StraightVertex";
        if(cubic ? r.type!=="CubicWeight" : r.type!=="Weight" || !["StraightVertex","MeshVertex","ContourMeshVertex"].includes(parent?.type))
          fail(r,"vertex weight type must match its straight/cubic geometry");
        if(!children(parent.fields.parentId).some(v=>v.r.type==="Skin"))fail(r,"vertex weights require an owning skin");
      }
    }
    const single = (list, r, label) => {
      if (list.length !== 1) fail(r, "expected exactly one " + label);
      return list[0];
    };
    const fill = (owner, node) => {
      const { r, i } = single(
        children(owner).filter((v) => v.r.type === "Fill"),
        components[owner],
        "fill",
      );
      if (![0, 1, 2].includes(r.fields.fillRule ?? 0))
        fail(r, "unsupported fill rule");
      const paint = single(
        children(i).filter((v) =>
          ["SolidColor", "LinearGradient", "RadialGradient"].includes(v.r.type),
        ),
        r,
        "paint",
      );
      if (paint.r.type === "SolidColor") {
        targets.set(paint.i + "/37", { node, property: "fill" });
        return color(paint.r.fields.colorValue ?? 0xff000000);
      }
      const f = paint.r.fields,
        stops = children(paint.i).filter((v) => v.r.type === "GradientStop");
      const type = paint.r.type === "LinearGradient" ? "linear" : "radial";
      // Use actual type inheritance to locate gradient property IDs.
      const gradientType = Object.values(schema.types).find(
        (v) => v.name === "LinearGradient",
      );
      for (const k of ["startX", "startY", "endX", "endY"])
        targets.set(paint.i + "/" + gradientType.properties[k], {
          node,
          property: "paint." + k,
        });
      for (const [j, s] of stops.entries()) {
        targets.set(s.i + "/38", { node, property: `paint.stop.${j}.color` });
        targets.set(s.i + "/39", {
          node,
          property: `paint.stop.${j}.position`,
        });
      }
      return {
        type,
        start: [f.startX ?? 0, f.startY ?? 0],
        end: [f.endX ?? 100, f.endY ?? 0],
        stops: stops.map((v) => ({
          position: v.r.fields.position ?? 0,
          color: color(v.r.fields.colorValue ?? 0xff000000),
        })),
      };
    };
    const stroke = (owner, node) => {
      const list=children(owner).filter(v=>v.r.type==="Stroke");
      if(!list.length)return null;
      const {r,i}=single(list,components[owner],"stroke"),f=r.fields;
      if(!(f.transformAffectsStroke ?? true) || (f.position ?? 0)!==0)fail(r,"only centered, transform-scaled strokes are editable");
      const s=defaultStroke();s.width=f.thickness ?? 1;s.cap=STROKE_CAPS[f.cap ?? 0];s.join=STROKE_JOINS[f.join ?? 0];
      const paint=single(children(i).filter(v=>["SolidColor","LinearGradient","RadialGradient"].includes(v.r.type)),r,"stroke paint");
      if(paint.r.type!=="SolidColor")fail(paint.r,"gradient strokes are outside the editable subset");
      s.color=color(paint.r.fields.colorValue ?? 0xff000000);
      targets.set(i+"/47",{node,property:"stroke.width"});targets.set(paint.i+"/37",{node,property:"stroke.color"});
      const trims=children(i).filter(v=>v.r.type==="TrimPath"),dashes=children(i).filter(v=>v.r.type==="DashPath");
      if(trims.length) {
        const t=single(trims,r,"trim effect");
        if((t.r.fields.modeValue ?? 0)!==1)fail(t.r,"only sequential single-contour trim is editable");
        s.trim={start:t.r.fields.start ?? 0,end:t.r.fields.end ?? 0,offset:t.r.fields.offset ?? 0};
        for(const [key,property] of [[114,"stroke.trimStart"],[115,"stroke.trimEnd"],[116,"stroke.trimOffset"]]) targets.set(t.i+"/"+key,{node,property});
      }
      if(dashes.length) {
        const d=single(dashes,r,"dash effect");
        if(d.r.fields.offsetIsPercentage ?? false)fail(d.r,"percentage dash offsets are outside the editable subset");
        if(trims.length && trims[0].i>d.i)fail(d.r,"only trim-before-dash effect order is editable");
        s.dashOffset=d.r.fields.offset ?? 0;
        s.dash=children(d.i).filter(v=>v.r.type==="Dash").map(v=>{
          if(v.r.fields.lengthIsPercentage ?? false)fail(v.r,"percentage dash lengths are outside the editable subset");
          return v.r.fields.length ?? 0;
        });
        if(!s.dash.length)fail(d.r,"empty dash effect would hide the stroke");
        targets.set(d.i+"/690",{node,property:"stroke.dashOffset"});
      }
      return s;
    };
    for (let i = 1; i < components.length; i++) {
      const r = components[i];
      if (
        ["Node", "Shape", "RootBone", "Bone", "Image", "Text"].includes(r.type)
      )
        nodeIds.set(i, newId("node"));
    }
    for (const [i, id] of nodeIds) {
      const r = components[i],
        f = r.fields,
        parent = f.parentId ?? 0;
      if (parent && !nodeIds.has(parent)) fail(r, "unsupported parent");
      const n = {
        id,
        name: f.name || r.type,
        kind: "group",
        artboardId: art.id,
        parentId: parent ? nodeIds.get(parent) : null,
        order: 0,
        transform: transform(f),
        geometry: null,
      };
      p.nodes.push(n);
      for (const k of ["x", "y", "rotation", "scaleX", "scaleY"]) {
        let type = Object.values(schema.types).find((t) => t.name === r.type);
        while (type && !Object.hasOwn(type.properties, k))
          type = Object.values(schema.types).find(
            (t) => t.name === type.parent,
          );
        if (type)
          targets.set(i + "/" + type.properties[k], { node: id, property: k });
      }
      if (["RootBone", "Bone"].includes(r.type)) {
        n.kind = "bone";
        n.geometry = { length: f.length ?? 0 };
        targets.set(i + "/89", { node: id, property: "length" });
      } else if (r.type === "Shape") {
        const shapes=children(i).filter(v=>contourTypes.has(v.r.type));
        if(!shapes.length||shapes.length>256)fail(r,'expected one to 256 shape contours');
        const fills=children(i).filter(v=>v.r.type==="Fill"),s=stroke(i,id);
        if(fills.length>1 || (!fills.length && !s))fail(r,"expected one fill and/or one supported stroke");
        if(s && fills.length && children(i).find(v=>v.r.type==="Stroke").i<fills[0].i)fail(r,"only fill-before-stroke paint order is editable");
        n.geometry = {fill: fills.length ? fill(i,id) : null, ...(s ? {stroke:s} : {})};
        const decoded=shapes.map(shape=>{
          const vertices=children(shape.i).filter(v=>vertexTypes.has(v.r.type));
          const skin=children(shape.i).filter(v=>v.r.type==='Skin');
          if(skin.length&&!isIdentityContour(shape.r.fields))fail(shape.r,'transformed skinned contours are outside the editable subset');
          return editableContour(shape.r,vertices,{fail,pointId:()=>newId('point'),forcePath:shapes.length>1||(fills[0]?.r.fields.fillRule===1)});
        });
        n.kind=decoded[0].kind;Object.assign(n.geometry,decoded[0].geometry);
        if(shapes.length>1)n.geometry.contours=decoded.slice(1).map(v=>({closed:v.geometry.closed,points:v.geometry.points}));
        if(fills[0]?.r.fields.fillRule===1)n.geometry.fillRule='evenodd';
        const shape=shapes[0];
        if (n.kind === "rectangle") {
          targets.set(shape.i + "/20", { node: id, property: "width" });
          targets.set(shape.i + "/21", { node: id, property: "height" });
        }
      } else if (r.type === "Text") {
        if (f.originValue !== 1) fail(r, "text must use baseline origin");
        const style = single(
            children(i).filter((v) =>
              ["TextStyle", "TextStylePaint"].includes(v.r.type),
            ),
            r,
            "text style",
          ),
          run = single(
            children(i).filter((v) => v.r.type === "TextValueRun"),
            r,
            "text run",
          );
        if (run.r.fields.styleId !== style.i)
          fail(run.r, "mismatched text style");
        n.kind = "text";
        n.geometry = {
          text: run.r.fields.text ?? "",
          fontAssetId: assets[style.r.fields.fontAssetId ?? 0]?.id,
          fontSize: style.r.fields.fontSize ?? 12,
          fill: fill(style.i, id),
        };
        targets.set(style.i + "/274", { node: id, property: "fontSize" });
      } else if (r.type === "Image") {
        const asset = assets[f.assetId ?? 0];
        if (asset?.mimeType !== "image/png") fail(r, "missing image asset");
        if ((f.originX ?? 0.5) !== 0 || (f.originY ?? 0.5) !== 0)
          fail(r, "image origin must be top left");
        const mesh = children(i).filter((v) => v.r.type === "Mesh");
        if (!mesh.length) {
          n.kind = "image";
          n.geometry = {
            assetId: asset.id,
            width: asset.width,
            height: asset.height,
          };
        } else {
          const m = single(mesh, r, "mesh");
          const vertices = children(m.i).filter((v) =>
            ["MeshVertex", "ContourMeshVertex"].includes(v.r.type),
          );
          const data = m.r.fields.triangleIndexBytes ?? new Uint8Array(),
            triangles = [];
          let v = 0,
            factor = 1;
          for (const byte of data) {
            v += (byte & 127) * factor;
            if (byte & 128) factor *= 128;
            else {
              triangles.push(v);
              v = 0;
              factor = 1;
            }
          }
          if (factor !== 1) fail(m.r, "truncated triangle index");
          n.kind = "mesh";
          n.geometry = {
            assetId: asset.id,
            vertices: vertices.map((v) => ({
              id: newId("vertex"),
              position: [v.r.fields.x ?? 0, v.r.fields.y ?? 0],
              uv: [v.r.fields.u ?? 0, v.r.fields.v ?? 0],
            })),
            triangles,
            skin: null,
          };
        }
      }
      // Skin is shared by path controls and textured mesh vertices.
      const sourceContours=children(i).filter(v=>contourTypes.has(v.r.type)||v.r.type==="Mesh");
      const partSkins=sourceContours.map(c=>children(c.i).filter(v=>v.r.type==="Skin"));
      if(partSkins.some(s=>s.length)&&partSkins.some(s=>!s.length))fail(r,"mixed bound and unbound compound contours need separate shapes");
      for (const [contourIndex,contour] of sourceContours.entries()) {
        const skins=children(contour.i).filter(v=>v.r.type==="Skin");
        if(skins.length>1)fail(contour.r,"expected at most one skin");
        const skin=skins[0];
        if (skin) {
          const tendons = children(skin.i).filter((v) => v.r.type === "Tendon"),
            bones = tendons.map((v) => ({
              boneId: nodeIds.get(v.r.fields.boneId),
              bind: matrix(v.r.fields),
            }));
          const unpack = (indices, values) => {
            const out = [];
            for (let k = 0; k < 4; k++) {
              const index = (indices >>> (8 * k)) & 255,
                weight = (values >>> (8 * k)) & 255;
              if (weight) {
                if (!index || index > bones.length)
                  fail(skin.r, "invalid tendon weight");
                out.push([bones[index - 1].boneId, weight / 255]);
              }
            }
            return out;
          };
          const vertices = children(contour.i).filter((v) =>
            vertexTypes.has(v.r.type) || ["MeshVertex", "ContourMeshVertex"].includes(v.r.type),
          );
          const decodedSkin = {
            bindWorld: matrix(skin.r.fields),
            bones,
            weights: vertices.map((v, j) => {
              const weight = single(
                  children(v.i).filter((v) =>
                    ["Weight", "CubicWeight"].includes(v.r.type),
                  ),
                  v.r,
                  "vertex weight",
                ),
                f = weight.r.fields,
                anchor = unpack(f.indices ?? 0, f.values ?? 0);
              const straight=v.r.type==="StraightVertex";
              if(n.kind==="path" && weight.r.type!==(straight?"Weight":"CubicWeight"))
                fail(weight.r,"vertex weight type must match its straight/cubic geometry");
              return {
                pointId: (n.kind === "path"
                  ? pathContours(n.geometry)[contourIndex].points
                  : n.geometry.vertices)[j].id,
                anchor,
                in:
                  n.kind === "path" && !straight
                    ? unpack(f.inIndices ?? 0, f.inValues ?? 0)
                    : anchor,
                out:
                  n.kind === "path" && !straight
                    ? unpack(f.outIndices ?? 0, f.outValues ?? 0)
                    : anchor,
              };
            }),
          };
          if(!n.geometry.skin)n.geometry.skin=decodedSkin;
          else {
            const shared=n.geometry.skin;
            if(shared.bindWorld.some((v,j)=>Math.abs(v-decodedSkin.bindWorld[j])>1e-6))fail(skin.r,'compound contours need matching skin coordinate spaces');
            for(const bone of decodedSkin.bones){const old=shared.bones.find(b=>b.boneId===bone.boneId);if(old&&old.bind.some((v,j)=>Math.abs(v-bone.bind[j])>1e-6))fail(skin.r,'compound tendon bind transforms differ');if(!old)shared.bones.push(bone);}
            shared.weights.push(...decodedSkin.weights);
          }
        }
      }
    }
    for (const n of p.nodes.filter((n) => n.artboardId === art.id)) {
      const siblings = p.nodes.filter(
        (v) => v.artboardId === art.id && v.parentId === n.parentId,
      );
      n.order = siblings.length - 1 - siblings.indexOf(n);
    }
    for (const r of components) {
      const f = r.fields;
      if (r.type === "ClippingShape") {
        if (f.isVisible === false || ![0,1].includes(f.fillRule ?? 0))
          fail(r, "disabled/alternate-rule clips are unsupported");
        const mask = components[f.sourceId];
        p.advanced.clips.push({
          targetId: nodeIds.get(f.parentId),
          maskId: nodeIds.get(f.sourceId),
          visible: mask?.fields.opacity !== 0,
          ...(f.fillRule===1?{fillRule:"evenodd"}:p.nodes.find(n=>n.id===nodeIds.get(f.sourceId))?.geometry?.fillRule==="evenodd"?{fillRule:"nonzero"}:{}),
        });
      } else if (r.type === "Feather") {
        const owner = components[f.parentId];
        p.advanced.feathers.push({
          targetId: nodeIds.get(owner.fields.parentId),
          strength: f.strength ?? 0,
        });
      } else if (r.type === "IKConstraint")
        p.advanced.ik.push({
          boneId: nodeIds.get(f.parentId),
          targetId: nodeIds.get(f.targetId),
          count: (f.parentBoneCount ?? 0) + 1,
          invert: f.invertDirection ?? false,
          strength: f.strength ?? 1,
        });
    }
    for (const [i, id] of nodeIds) {
      const r = components[i];
      if (
        r.fields.opacity !== undefined &&
        !(
          r.fields.opacity === 0 &&
          p.advanced.clips.some((c) => c.maskId === id && !c.visible)
        )
      )
        fail(r, "unsupported opacity");
    }
    const animIds = [];
    let animation,
      object,
      track,
      machine,
      state,
      transition,
      listener,
      blend,
      states = [];
    for (const r of board.tail) {
      const f = r.fields;
      if (r.type === "LinearAnimation") {
        if (![0, 1, 2].includes(f.loopValue ?? 0))
          fail(r, "unsupported loop mode");
        animation = {
          id: newId("animation"),
          name: f.name || "Animation",
          artboardId: art.id,
          fps: f.fps ?? 60,
          duration: f.duration ?? 1,
          ...(f.loopValue === 2 || (f.speed ?? 1) !== 1 ? {playback:{mode:f.loopValue === 2 ? 'ping-pong' : f.loopValue === 1 ? 'loop' : 'once', iterations:f.loopValue ? 0 : 1, speed:f.speed ?? 1}} : {loop:f.loopValue === 1}),
          tracks: [],
        };
        p.animations.push(animation);
        animIds.push(animation.id);
      } else if (r.type === "KeyedObject") object = f.objectId;
      else if (r.type === "KeyedProperty") {
        const target = targets.get(object + "/" + f.propertyKey);
        if (!target) {
          const owner=components[object];
          if(owner && (contourTypes.has(owner.type)||vertexTypes.has(owner.type)))
            fail(r,`animated ${owner.type} geometry cannot be preserved as editable controls`);
          fail(r, "unsupported editable key target");
        }
        track = { targetId: target.node, property: target.property, keys: [] };
        animation.tracks.push(track);
      } else if (r.type.startsWith("KeyFrame")) {
        const interp = components[f.interpolatorId];
        if (interp && interp.type !== "CubicEaseInterpolator")
          fail(r, "invalid easing");
        if (![0, 1].includes(f.interpolationType ?? 0))
          fail(r, "unsupported easing");
        track.keys.push({
          frame: f.frame ?? 0,
          value: r.type === "KeyFrameColor" ? color(f.value) : f.value,
          easing: interp
            ? {
                type: "cubic",
                curve: ["x1", "y1", "x2", "y2"].map(
                  (k) => interp.fields[k] ?? 0,
                ),
              }
            : {
                type: f.interpolationType === 1 ? "linear" : "hold",
                curve: null,
              },
        });
      } else if (r.type === "StateMachine") {
        machine = {
          id: newId("machine"),
          name: f.name || "Machine",
          artboardId: art.id,
          inputs: [],
          states: [],
          entryStateId: null,
          transitions: [],
          listeners: [],
        };
        p.machines.push(machine);
        states = [];
        state = null;
      } else if (
        [
          "StateMachineBool",
          "StateMachineNumber",
          "StateMachineTrigger",
        ].includes(r.type)
      ) {
        const type = {
          StateMachineBool: "boolean",
          StateMachineNumber: "number",
          StateMachineTrigger: "trigger",
        }[r.type];
        machine.inputs.push({
          id: newId("input"),
          name: f.name || "Input",
          type,
          value: f.value ?? (type === "number" ? 0 : false),
        });
      } else if (r.type === "StateMachineLayer") {
        if (states.length) fail(r, "multiple machine layers are unsupported");
      } else if (
        [
          "EntryState",
          "AnyState",
          "ExitState",
          "AnimationState",
          "BlendState1DInput",
          "BlendStateDirect",
        ].includes(r.type)
      ) {
        state = {
          id: newId("state"),
          name: r.type + " " + states.length,
          animationId: animIds[f.animationId ?? 0],
          position: [states.length * 160, 0],
        };
        states.push(state);
        blend = null;
        if (["AnimationState","BlendState1DInput","BlendStateDirect"].includes(r.type)) {
          machine.states.push(state);
          if(r.type==='BlendStateDirect'){
            if(![0,2].includes(f.flags??0))fail(r,'unsupported direct blend flags');
            state.blend={type:'direct',children:[]};blend=state.blend;
          }
          if (r.type === "BlendState1DInput") {
            if ((f.flags ?? 0) !== 2) fail(r, "unsupported blend flags");
            state.blend = {
              type: "1d",
              inputId: machine.inputs[f.inputId ?? 0]?.id,
              children: [],
            };
            blend = state.blend;
          }
        }
      } else if(r.type==='BlendAnimationDirect'){
        if(blend?.type!=='direct')fail(r,'missing direct blend owner');
        if(![0,1].includes(f.blendSource??0))fail(r,'direct data bindings are outside editable import');
        const animationId=animIds[f.animationId??0];
        blend.children.push({animationId,...(f.blendSource===1?{weight:f.mixValue??100}:{inputId:machine.inputs[f.inputId]?.id})});
        if(blend.children.length===1)state.animationId=animationId;
      } else if (r.type === "BlendAnimation1D") {
        if (blend?.type!=="1d") fail(r, "missing blend owner");
        blend.children.push({
          animationId: animIds[f.animationId ?? 0],
          position: f.value ?? 0,
        });
      } else if (r.type === "StateTransition") {
        transition = {
          id: newId("transition"),
          fromId: state.id,
          toIndex: f.stateToId ?? 0,
          conditions: [],
        };
        if (states.length === 1) machine.entryIndex = transition.toIndex;
        else {
          if ((f.flags ?? 0) & ~4) fail(r, "unsupported transition flags");
          if (f.duration) transition.durationMs = f.duration;
          if ((f.flags ?? 0) & 4) transition.exitTimeMs = f.exitTime ?? 0;
          machine.transitions.push(transition);
        }
      } else if (r.type.startsWith("Transition")) {
        const input = machine.inputs[f.inputId ?? 0];
        transition.conditions.push({
          inputId: input?.id,
          op:
            r.type === "TransitionTriggerCondition"
              ? "fire"
              : r.type === "TransitionBoolCondition"
                ? "eq"
                : ["eq", "ne", "le", "ge", "lt", "gt"][f.opValue ?? 0],
          value:
            r.type === "TransitionTriggerCondition"
              ? null
              : r.type === "TransitionBoolCondition"
                ? !(f.opValue ?? 0)
                : (f.value ?? 0),
        });
      } else if (r.type === "StateMachineListenerSingle") {
        if (f.listenerTypeValue !== 6)
          fail(r, "only click listeners supported");
        listener = { targetId: nodeIds.get(f.targetId) };
      } else if (r.type.startsWith("Listener"))
        machine.listeners.push({
          id: newId("listener"),
          ...listener,
          event: "click",
          inputId: machine.inputs[f.inputId ?? 0]?.id,
          value: r.type === "ListenerTriggerChange" ? null : (f.value ?? false),
        });
    }
    // All referenced state indices are scoped to their own machine layer.
    for (const m of p.machines.filter((m) => m.artboardId === art.id)) {
      const indices = [null, null, null, ...m.states];
      m.entryStateId = indices[m.entryIndex]?.id;
      delete m.entryIndex;
      for (const t of m.transitions) {
        t.toId = indices[t.toIndex]?.id;
        delete t.toIndex;
      }
    }
  }
  validateProject(p);
  return p;
}

export async function importRiv(input) {
  try {
    return await decodeProject(input);
  } catch (error) {
    if (error instanceof ProjectError) throw error;
    throw new ProjectError([
      "Malformed or unsupported editable Rive structure: " + error.message,
    ]);
  }
}
