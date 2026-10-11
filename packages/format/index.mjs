import {
  validateProject,
  ProjectError,
  isColorProperty,
  pngSize,
} from "@evir/project-model";
import { components, quantize, getValue } from "@evir/runtime/geometry";
const OP = { eq: 0, ne: 1, le: 2, ge: 3, lt: 4, gt: 5 }; // pinned TransitionConditionOp
import runtimeSchema from "./schema/runtime.json" with { type: "json" };
export { runtimeSchema };
export function compileProject(project, schema = runtimeSchema) {
  validateProject(project);
  const diagnostics = [];
  if (![2, 3].includes(project.schemaVersion))
    diagnostics.push(
      "Open the project to migrate it to version 2 before exporting",
    );
  if (project.assets.length && !project.advanced)
    diagnostics.push(
      "Attached assets are outside the tested vector export subset",
    );
  for (const n of project.nodes) {
    const m = n.transform;
    const sx = Math.hypot(m[0], m[1]);
    if (sx < 1e-10 || Math.abs(m[0] * m[3] - m[1] * m[2]) < 1e-10)
      diagnostics.push(`${n.name}: singular transform`);
    else if (
      Math.abs(m[0] * m[2] + m[1] * m[3]) >
      1e-6 * Math.max(1, sx * Math.hypot(m[2], m[3]))
    )
      diagnostics.push(
        `${n.name}: shear cannot be represented by Rive node transforms`,
      );
  }
  if (diagnostics.length) throw new ProjectError(diagnostics);
  const types = new Map(
    Object.entries(schema.types).map(([key, value]) => [
      value.name,
      { key: Number(key), ...value },
    ]),
  );
  function key(type, name) {
    let t = types.get(type);
    while (t) {
      if (Object.hasOwn(t.properties, name)) return t.properties[name];
      t = types.get(t.parent);
    }
    throw new Error(`Schema does not define ${type}.${name}`);
  }
  const records = [],
    mapping = {
      artboards: Object.create(null),
      nodes: Object.create(null),
      points: Object.create(null),
      animations: Object.create(null),
      machines: Object.create(null),
    };
  const emit = (type, fields = {}) => {
    const record = {
      type: types.get(type).key,
      fields: Object.entries(fields).map(([name, value]) => ({
        key: key(type, name),
        value,
      })),
    };
    records.push(record);
    return record;
  };
  emit("Backboard");
  const color = (hex) => {
    const raw = hex.slice(1),
      alpha = raw.length === 8 ? parseInt(raw.slice(6), 16) : 255;
    return (alpha * 2 ** 24 + parseInt(raw.slice(0, 6), 16)) >>> 0;
  };
  const matrix = (m) => ({
    xx: m[0],
    xy: m[1],
    yx: m[2],
    yy: m[3],
    tx: m[4],
    ty: m[5],
  });
  const assets = new Map();
  for (const [assetIndex, asset] of project.assets.entries()) {
    const bytes = Uint8Array.from(atob(asset.data), (c) => c.charCodeAt(0));
    if (asset.mimeType === "image/png") {
      if (
        bytes.length < 24 ||
        ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
      )
        throw new ProjectError(["Invalid PNG " + asset.name]);
      const { width, height } = pngSize(bytes);
      assets.set(asset.id, { index: assetIndex, width, height });
      emit("ImageAsset", {
        name: asset.name,
        assetId: assetIndex + 1,
        width,
        height,
      });
    } else if (["font/ttf", "font/otf"].includes(asset.mimeType)) {
      assets.set(asset.id, { index: assetIndex });
      emit("FontAsset", { name: asset.name, assetId: assetIndex + 1 });
    } else
      throw new ProjectError(["Unsupported embedded asset: " + asset.mimeType]);
    emit("FileAssetContents", { bytes });
  }
  for (const [artboardIndex, a] of project.artboards.entries()) {
    const animations = project.animations.filter((v) => v.artboardId === a.id),
      machines = project.machines.filter((v) => v.artboardId === a.id);
    emit("Artboard", {
      name: a.name,
      width: a.width,
      height: a.height,
      ...(machines.length ? { defaultStateMachineId: 0 } : {}),
    });
    mapping.artboards[a.id] = artboardIndex;
    let component = 1;
    const ids = new Map(),
      targets = new Map(),
      fills = new Map(),
      pending = [];
    const componentRecord = (type, fields) => {
      const index = component++;
      const record = emit(type, fields);
      return { index, record };
    };
    const traverse = (parent) => {
      for (const n of project.nodes
        .filter((n) => n.artboardId === a.id && n.parentId === parent)
        .sort((x, y) => y.order - x.order)) {
        const boneParent =
          project.nodes.find((v) => v.id === n.parentId)?.kind === "bone";
        const type =
          n.kind === "group"
            ? "Node"
            : n.kind === "bone"
              ? boneParent
                ? "Bone"
                : "RootBone"
              : n.kind === "text"
                ? "Text"
                : ["image", "mesh"].includes(n.kind)
                  ? "Image"
                  : "Shape";
        const c = components(n.transform),
          fields = {
            name: n.name,
            parentId: parent === null ? 0 : ids.get(parent),
            rotation: c.rotation,
            scaleX: c.scaleX,
            scaleY: c.scaleY,
          };
        if (type !== "Bone") {
          fields.x = c.x;
          fields.y = c.y;
        }
        if (
          project.advanced?.clips.some((c) => !c.visible && c.maskId === n.id)
        )
          fields.opacity = 0;
        if (n.kind === "text") Object.assign(fields, { originValue: 1 });
        if (["image", "mesh"].includes(n.kind)) {
          const asset = assets.get(n.geometry.assetId);
          Object.assign(fields, {
            assetId: asset.index,
            originX: 0,
            originY: 0,
          });
          if (n.kind === "image") {
            fields.scaleX *= n.geometry.width / asset.width;
            fields.scaleY *= n.geometry.height / asset.height;
          }
        }
        if (n.kind === "bone") fields.length = n.geometry.length;
        const { index } = componentRecord(type, fields);
        ids.set(n.id, index);
        mapping.nodes[n.id] = {
          artboard: artboardIndex,
          component: index,
          type,
        };
        for (const property of [
          "x",
          "y",
          "rotation",
          "scaleX",
          "scaleY",
          ...(n.kind === "bone" ? ["length"] : []),
        ])
          if (type !== "Bone" || !["x", "y"].includes(property))
            targets.set(n.id + "/" + property, {
              index,
              type,
              property,
              ...(n.kind === "image" && ["scaleX", "scaleY"].includes(property)
                ? {
                    factor:
                      property === "scaleX"
                        ? n.geometry.width /
                          assets.get(n.geometry.assetId).width
                        : n.geometry.height /
                          assets.get(n.geometry.assetId).height,
                  }
                : {}),
            });
        if (n.kind === "text") {
          const style = componentRecord("TextStylePaint", {
            parentId: index,
            fontSize: n.geometry.fontSize,
            fontAssetId: assets.get(n.geometry.fontAssetId).index,
          }).index;
          const fill = componentRecord("Fill", { parentId: style }).index;
          const solid = componentRecord("SolidColor", {
            parentId: fill,
            colorValue: color(n.geometry.fill),
          }).index;
          componentRecord("TextValueRun", {
            parentId: index,
            styleId: style,
            text: n.geometry.text,
          });
          targets.set(n.id + "/fontSize", {
            index: style,
            type: "TextStylePaint",
            property: "fontSize",
          });
          targets.set(n.id + "/fill", {
            index: solid,
            type: "SolidColor",
            property: "colorValue",
          });
        }
        if (n.kind === "mesh") {
          const g = n.geometry,
            packedIndices = [];
          for (let value of g.triangles) {
            do {
              const byte = value % 128;
              value = Math.floor(value / 128);
              packedIndices.push(byte + (value ? 128 : 0));
            } while (value);
          }
          const mesh = componentRecord("Mesh", {
            parentId: index,
            triangleIndexBytes: Uint8Array.from(packedIndices),
          }).index;
          for (const v of g.vertices) {
            const vertex = componentRecord("MeshVertex", {
              parentId: mesh,
              x: v.position[0],
              y: v.position[1],
              u: v.uv[0],
              v: v.uv[1],
            }).index;
            if (g.skin) {
              const w = quantize(
                g.skin.weights.find((w) => w.pointId === v.id).anchor,
              );
              componentRecord("Weight", {
                parentId: vertex,
                indices:
                  w.reduce(
                    (s, [b], i) =>
                      s +
                      (g.skin.bones.findIndex((t) => t.boneId === b) + 1) *
                        2 ** (8 * i),
                    0,
                  ) >>> 0,
                values:
                  w.reduce(
                    (s, [, v], i) => s + Math.round(v * 255) * 2 ** (8 * i),
                    0,
                  ) >>> 0,
              });
            }
          }
          if (g.skin) {
            const skin = componentRecord("Skin", {
              parentId: mesh,
              ...matrix(g.skin.bindWorld),
            }).index;
            for (const b of g.skin.bones) {
              const tendon = componentRecord("Tendon", {
                parentId: skin,
                boneId: 0,
                ...matrix(b.bind),
              });
              pending.push({ record: tendon.record, boneId: b.boneId });
            }
          }
        }
        if (n.kind === "rectangle") {
          const path = componentRecord("Rectangle", {
            parentId: index,
            width: n.geometry.width,
            height: n.geometry.height,
            originX: 0,
            originY: 0,
          }).index;
          for (const property of ["width", "height"])
            targets.set(n.id + "/" + property, {
              index: path,
              type: "Rectangle",
              property,
            });
        }
        if (n.kind === "path") {
          const path = componentRecord("PointsPath", {
              parentId: index,
              isClosed: n.geometry.closed,
            }).index,
            skin = n.geometry.skin;
          const packed = (influences) => {
            const weights = quantize(influences);
            return {
              indices:
                weights.reduce(
                  (v, [b, w], i) =>
                    v +
                    (skin.bones.findIndex((t) => t.boneId === b) + 1) *
                      2 ** (8 * i),
                  0,
                ) >>> 0,
              values:
                weights.reduce(
                  (v, [b, w], i) => v + Math.round(w * 255) * 2 ** (8 * i),
                  0,
                ) >>> 0,
            };
          };
          for (const v of n.geometry.points) {
            const delta = (handle) => {
                const x = v[handle][0] - v.anchor[0],
                  y = v[handle][1] - v.anchor[1];
                return { angle: Math.atan2(y, x), distance: Math.hypot(x, y) };
              },
              inside = delta("in"),
              outside = delta("out");
            const vertex = componentRecord("CubicDetachedVertex", {
              parentId: path,
              x: v.anchor[0],
              y: v.anchor[1],
              inRotation: inside.angle,
              inDistance: inside.distance,
              outRotation: outside.angle,
              outDistance: outside.distance,
            }).index;
            mapping.points[v.id] = {
              artboard: artboardIndex,
              component: vertex,
            };
            if (skin) {
              const w = skin.weights.find((w) => w.pointId === v.id),
                anchor = packed(w.anchor),
                inside = packed(w.in),
                outside = packed(w.out);
              componentRecord("CubicWeight", {
                parentId: vertex,
                ...anchor,
                inIndices: inside.indices,
                inValues: inside.values,
                outIndices: outside.indices,
                outValues: outside.values,
              });
            }
          }
          if (skin) {
            const skinId = componentRecord("Skin", {
              parentId: path,
              ...matrix(skin.bindWorld),
            }).index;
            for (const b of skin.bones) {
              const tendon = componentRecord("Tendon", {
                parentId: skinId,
                boneId: 0,
                ...matrix(b.bind),
              });
              pending.push({ record: tendon.record, boneId: b.boneId });
            }
          }
        }
        if (["rectangle", "path"].includes(n.kind)) {
          const feather = project.advanced?.feathers.find(
            (f) => f.targetId === n.id,
          );
          const fill = componentRecord("Fill", {
            parentId: index,
            ...(feather ? { fillRule: 2 } : {}),
          }).index;
          fills.set(n.id, fill);
          const paint = n.geometry.fill;
          if (typeof paint === "string") {
            const solid = componentRecord("SolidColor", {
              parentId: fill,
              colorValue: color(paint),
            }).index;
            targets.set(n.id + "/fill", {
              index: solid,
              type: "SolidColor",
              property: "colorValue",
            });
          } else {
            const gradient = componentRecord(
              paint.type === "linear" ? "LinearGradient" : "RadialGradient",
              {
                parentId: fill,
                startX: paint.start[0],
                startY: paint.start[1],
                endX: paint.end[0],
                endY: paint.end[1],
              },
            ).index;
            const type =
              paint.type === "linear" ? "LinearGradient" : "RadialGradient";
            for (const property of ["startX", "startY", "endX", "endY"])
              targets.set(n.id + "/paint." + property, {
                index: gradient,
                type,
                property,
              });
            for (const [stopIndex, stop] of paint.stops.entries()) {
              const stopId = componentRecord("GradientStop", {
                parentId: gradient,
                position: stop.position,
                colorValue: color(stop.color),
              }).index;
              targets.set(n.id + `/paint.stop.${stopIndex}.position`, {
                index: stopId,
                type: "GradientStop",
                property: "position",
              });
              targets.set(n.id + `/paint.stop.${stopIndex}.color`, {
                index: stopId,
                type: "GradientStop",
                property: "colorValue",
              });
            }
          }
        }
        traverse(n.id);
      }
    };
    traverse(null);
    for (const item of pending)
      item.record.fields.find((f) => f.key === key("Tendon", "boneId")).value =
        ids.get(item.boneId);
    for (const c of project.advanced?.clips ?? [])
      if (ids.has(c.targetId))
        componentRecord("ClippingShape", {
          parentId: ids.get(c.targetId),
          sourceId: ids.get(c.maskId),
          fillRule: 0,
          isVisible: true,
        });
    for (const f of project.advanced?.feathers ?? [])
      if (ids.has(f.targetId))
        componentRecord("Feather", {
          parentId: fills.get(f.targetId),
          strength: f.strength,
        });
    for (const c of project.advanced?.ik ?? [])
      if (ids.has(c.boneId))
        componentRecord("IKConstraint", {
          parentId: ids.get(c.boneId),
          targetId: ids.get(c.targetId),
          parentBoneCount: c.count - 1,
          invertDirection: c.invert,
          strength: c.strength,
        });
    const interpolators = new Map();
    for (const animation of animations)
      for (const track of animation.tracks)
        for (const k of track.keys)
          if (k.easing.type === "cubic") {
            const id = JSON.stringify(k.easing.curve);
            if (!interpolators.has(id)) {
              const [x1, y1, x2, y2] = k.easing.curve;
              interpolators.set(
                id,
                componentRecord("CubicEaseInterpolator", { x1, y1, x2, y2 })
                  .index,
              );
            }
          }
    for (const [animationIndex, animation] of animations.entries()) {
      mapping.animations[animation.id] = {
        artboard: artboardIndex,
        index: animationIndex,
        name: animation.name,
      };
      emit("LinearAnimation", {
        name: animation.name,
        fps: animation.fps,
        duration: animation.duration,
        loopValue: animation.loop ? 1 : 0,
      });
      const grouped = new Map();
      // Runtime animation application only writes keyed properties. Explicit
      // default keys prevent stale values when switching between Studio poses.
      const tracks = [...animation.tracks];
      for (const other of animations)
        for (const track of other.tracks) {
          if (
            !tracks.some(
              (t) =>
                t.targetId === track.targetId && t.property === track.property,
            )
          ) {
            tracks.push({
              targetId: track.targetId,
              property: track.property,
              keys: [
                {
                  frame: 0,
                  value: getValue(
                    project.nodes.find((n) => n.id === track.targetId),
                    track.property,
                  ),
                  easing: { type: "hold", curve: null },
                },
              ],
            });
          }
        }
      for (const track of tracks) {
        const target = targets.get(track.targetId + "/" + track.property);
        if (!target)
          throw new ProjectError([
            `${animation.name}: unsupported track ${track.property}`,
          ]);
        if (!grouped.has(target.index)) grouped.set(target.index, []);
        grouped.get(target.index).push({ track, target });
      }
      for (const [index, tracks] of grouped) {
        emit("KeyedObject", { objectId: index });
        for (const { track, target } of tracks) {
          emit("KeyedProperty", {
            propertyKey: key(target.type, target.property),
          });
          for (const k of track.keys)
            emit(
              isColorProperty(track.property)
                ? "KeyFrameColor"
                : "KeyFrameDouble",
              {
                frame: k.frame,
                value: isColorProperty(track.property)
                  ? color(k.value)
                  : k.value * (target.factor ?? 1),
                interpolationType: k.easing.type === "hold" ? 0 : 1,
                ...(k.easing.type === "cubic"
                  ? {
                      interpolatorId: interpolators.get(
                        JSON.stringify(k.easing.curve),
                      ),
                    }
                  : {}),
              },
            );
        }
      }
    }
    for (const [machineIndex, m] of machines.entries()) {
      mapping.machines[m.id] = {
        artboard: artboardIndex,
        index: machineIndex,
        name: m.name,
      };
      emit("StateMachine", { name: m.name });
      for (const input of m.inputs)
        emit(
          {
            boolean: "StateMachineBool",
            number: "StateMachineNumber",
            trigger: "StateMachineTrigger",
          }[input.type],
          {
            name: input.name,
            ...(input.type === "trigger" ? {} : { value: input.value }),
          },
        );
      const stateIds = new Map(m.states.map((s, i) => [s.id, i + 3])),
        inputIds = new Map(m.inputs.map((s, i) => [s.id, i]));
      emit("StateMachineLayer", { name: "Main" });
      emit("EntryState");
      emit("StateTransition", { stateToId: stateIds.get(m.entryStateId) });
      emit("AnyState");
      emit("ExitState");
      for (const state of m.states) {
        if (state.blend) {
          emit("BlendState1DInput", {
            inputId: inputIds.get(state.blend.inputId),
            flags: 2,
          });
          for (const child of state.blend.children)
            emit("BlendAnimation1D", {
              animationId: animations.findIndex(
                (a) => a.id === child.animationId,
              ),
              value: child.position,
            });
        } else
          emit("AnimationState", {
            animationId: animations.findIndex(
              (a) => a.id === state.animationId,
            ),
          });
        for (const t of m.transitions.filter((t) => t.fromId === state.id)) {
          emit("StateTransition", {
            stateToId: stateIds.get(t.toId),
            duration: t.durationMs ?? 0,
            ...("exitTimeMs" in t ? { flags: 4, exitTime: t.exitTimeMs } : {}),
          });
          for (const c of t.conditions) {
            const input = m.inputs.find((i) => i.id === c.inputId),
              inputId = inputIds.get(c.inputId);
            if (input.type === "trigger")
              emit("TransitionTriggerCondition", { inputId });
            else if (input.type === "boolean")
              emit("TransitionBoolCondition", {
                inputId,
                opValue: (c.op === "eq" ? c.value : !c.value) ? 0 : 1,
              });
            else
              emit("TransitionNumberCondition", {
                inputId,
                opValue: OP[c.op],
                value: c.value,
              });
          }
        }
      }
      for (const l of m.listeners) {
        emit("StateMachineListenerSingle", {
          targetId: ids.get(l.targetId),
          listenerTypeValue: 6,
        });
        const input = m.inputs.find((i) => i.id === l.inputId);
        emit(
          {
            trigger: "ListenerTriggerChange",
            boolean: "ListenerBoolChange",
            number: "ListenerNumberChange",
          }[input.type],
          {
            inputId: inputIds.get(l.inputId),
            ...(input.type === "trigger" ? {} : { value: l.value }),
          },
        );
      }
    }
  }
  const out = [82, 73, 86, 69, 7, 0, 0, 0];
  const uint = (value) => {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error("Invalid unsigned integer");
    do {
      const b = value % 128;
      value = Math.floor(value / 128);
      out.push(b + (value ? 128 : 0));
    } while (value);
  };
  const encodedText = new TextEncoder();
  for (const record of records) {
    uint(record.type);
    for (const field of record.fields) {
      uint(field.key);
      const wire = schema.properties[field.key].wire,
        value = field.value;
      if (wire === "uint") uint(value);
      else if (wire === "bool") out.push(value ? 1 : 0);
      else if (wire === "string" || wire === "bytes") {
        const bytes = wire === "bytes" ? value : encodedText.encode(value);
        uint(bytes.length);
        for (const b of bytes) out.push(b);
      } else {
        const bytes = new Uint8Array(4),
          view = new DataView(bytes.buffer);
        if (wire === "float") {
          if (!Number.isFinite(Math.fround(value)))
            throw new ProjectError([
              `Property ${field.key}: value exceeds runtime float32 range`,
            ]);
          view.setFloat32(0, value, true);
        } else if (wire === "color") view.setUint32(0, value, true);
        else throw new Error(`Unsupported wire ${wire}`);
        out.push(...bytes);
      }
    }
    out.push(0);
  }
  return {
    bytes: Uint8Array.from(out),
    mapping,
    scope:
      "2D fills, animated gradients, clipping, outer feather, embedded PNG/TTF assets, single-line text, textured meshes, one/two-bone unit-scale IK, four-influence skinning, typed keys, one-layer timed transitions, 1D blends and click listeners. No universal Rive compatibility.",
  };
}

export { importRiv, readRiv } from "./import.mjs";
