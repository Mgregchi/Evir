import { createProject } from "@evir/project-model";
import { addNode } from "@evir/authoring";
import { convertRectangle, bindPath, setWeight, createAnimation, setKey, createMachine } from "@evir/authoring";
import { newId } from "@evir/project-model";
export function scenes() {
  const p = createProject();
  p.name = "Authoring oracle";
  p.artboards[0].width = p.artboards[0].height = 256;
  const board = p.artboards[0].id;
  const root = addNode(p, "bone"),
    child = addNode(p, "bone", root),
    path = addNode(p, "path");
  const r = p.nodes.find((n) => n.id === root);
  r.name = "Shoulder";
  r.transform = [
    Math.SQRT1_2,
    Math.SQRT1_2,
    -Math.SQRT1_2,
    Math.SQRT1_2,
    80,
    90,
  ];
  r.geometry.length = 48;
  const c = p.nodes.find((n) => n.id === child);
  c.name = "Elbow";
  const n = p.nodes.find((n) => n.id === path);
  n.name = "Skin";
  n.transform = [1, 0, 0, 1, 55, 70];
  n.geometry.fill = "#2864dc";
  bindPath(p, path, [root, child]);
  setWeight(p, path, n.geometry.points[0].id, "out", child, 1);
  setWeight(p, path, n.geometry.points[0].id, "anchor", child, 0);
  const front = addNode(p, "rectangle");
  const f = p.nodes.find((n) => n.id === front);
  f.name = "Click target";
  f.transform = [1, 0, 0, 1, 90, 110];
  f.geometry = { width: 50, height: 28, fill: "#e56a3280" };
  const a = createAnimation(p, board);
  p.animations[0].name = "Bend";
  setKey(p, a, child, "rotation", 0, 0, {
    type: "cubic",
    curve: [0.42, 0, 0.58, 1],
  });
  setKey(p, a, child, "rotation", 60, Math.PI / 2);
  setKey(p, a, root, "x", 0, 80);
  setKey(p, a, root, "x", 60, 110);
  setKey(p, a, root, "length", 0, 48);
  setKey(p, a, root, "length", 60, 65);
  setKey(p, a, front, "fill", 0, "#e56a3280");
  setKey(p, a, front, "fill", 60, "#64d832c0");
  const b = createAnimation(p, board);
  p.animations[1].name = "Active";
  setKey(p, b, child, "rotation", 0, -Math.PI / 3);
  setKey(p, b, front, "x", 0, 140);
  setKey(p, b, front, "width", 0, 70);
  setKey(p, b, front, "y", 0, 110, { type: "hold", curve: null });
  setKey(p, b, front, "y", 60, 180);
  const m = createMachine(p, board),
    machine = p.machines[0];
  machine.name = "Controller";
  const other = {
    id: newId("state"),
    name: "Active",
    animationId: b,
    position: [240, 50],
  };
  machine.states.push(other);
  const inputs = [
    { id: newId("input"), name: "enabled", type: "boolean", value: false },
    { id: newId("input"), name: "amount", type: "number", value: 0 },
    { id: newId("input"), name: "go", type: "trigger", value: false },
  ];
  machine.inputs.push(...inputs);
  machine.transitions.push(
    {
      id: newId("transition"),
      fromId: machine.entryStateId,
      toId: other.id,
      conditions: [
        { inputId: inputs[0].id, op: "eq", value: true },
        { inputId: inputs[1].id, op: "ge", value: 2 },
      ],
    },
    {
      id: newId("transition"),
      fromId: machine.entryStateId,
      toId: other.id,
      conditions: [{ inputId: inputs[2].id, op: "fire", value: null }],
    },
    {
      id: newId("transition"),
      fromId: other.id,
      toId: machine.entryStateId,
      conditions: [
        { inputId: inputs[0].id, op: "eq", value: false },
        { inputId: inputs[1].id, op: "lt", value: 0 },
      ],
    },
  );
  machine.listeners.push({
    id: newId("listener"),
    targetId: front,
    event: "click",
    inputId: inputs[2].id,
    value: null,
  });
  return { p, root, child, path, front, a, b, m };
}
