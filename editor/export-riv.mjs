import { validateProject, ProjectError } from "./model.mjs";
import { components, quantize, getValue } from "./motion.mjs";
const OP = { eq: 0, ne: 1, le: 2, ge: 3, lt: 4, gt: 5 }; // pinned TransitionConditionOp
export function compileProject(project, schema) {
  validateProject(project);
  const diagnostics = [];
  if (project.schemaVersion !== 2)
    diagnostics.push(
      "Open the project to migrate it to version 2 before exporting",
    );
  if (project.assets.length)
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
            targets.set(n.id + "/" + property, { index, type, property });
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
          const fill = componentRecord("Fill", { parentId: index }).index,
            paint = componentRecord("SolidColor", {
              parentId: fill,
              colorValue: color(n.geometry.fill),
            }).index;
          targets.set(n.id + "/fill", {
            index: paint,
            type: "SolidColor",
            property: "colorValue",
          });
        }
        traverse(n.id);
      }
    };
    traverse(null);
    for (const item of pending)
      item.record.fields.find((f) => f.key === key("Tendon", "boneId")).value =
        ids.get(item.boneId);
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
              track.property === "fill" ? "KeyFrameColor" : "KeyFrameDouble",
              {
                frame: k.frame,
                value: track.property === "fill" ? color(k.value) : k.value,
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
        emit("AnimationState", {
          animationId: animations.findIndex((a) => a.id === state.animationId),
        });
        for (const t of m.transitions.filter((t) => t.fromId === state.id)) {
          emit("StateTransition", {
            stateToId: stateIds.get(t.toId),
            duration: 0,
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
      else if (wire === "string") {
        const bytes = encodedText.encode(value);
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
      "Solid rectangles/cubic paths, TRS groups and bone chains, four-influence control skinning, typed linear/hold/cubic keys, one-layer conditional machines and click listeners. No universal Rive compatibility.",
  };
}
