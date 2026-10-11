import { createProject } from "@evir/project-model";
import {
  addNode,
  convertRectangle,
  createAnimation,
  setKey,
} from "@evir/authoring";
export function paintScene() {
  const p = createProject();
  p.id = "paint-project";
  p.name = "Gradient acceptance";
  p.artboards[0].width = p.artboards[0].height = 512;
  const group = addNode(p, "group");
  p.nodes[0].name = "Paint group";
  p.nodes[0].transform = [0, 1.1, -0.75, 0, 460, 250];
  const make = (name, type, parent = null, x = 40, y = 40) => {
    const id = addNode(p, "rectangle", parent),
      n = p.nodes.find((n) => n.id === id);
    n.name = name;
    n.transform = [1, 0, 0, 1, x, y];
    n.geometry = {
      width: 180,
      height: 160,
      fill: {
        type,
        start: [20, 30],
        end: [150, 130],
        stops: [
          { position: 0.1, color: "#f5e4ca" },
          { position: 0.4, color: "#eaab9180" },
          { position: 0.85, color: "#254131" },
        ],
      },
    };
    return id;
  };
  const linear = make("Linear rectangle", "linear");
  const radial = make("Radial rectangle", "radial", null, 270, 40);
  const path = make("Radial path", "radial", group, 15, 15);
  convertRectangle(p, path);
  const reflected = make("Linear path", "linear", null, 220, 440);
  convertRectangle(p, reflected);
  p.nodes.find((n) => n.id === reflected).transform = [-1, 0, 0, -1, 220, 440];
  const animation = createAnimation(p, p.artboards[0].id);
  const a = p.animations.find((a) => a.id === animation);
  a.name = "Turn";
  a.duration = 60;
  setKey(p, animation, group, "rotation", 0, Math.PI / 2);
  setKey(p, animation, group, "rotation", 30, 1.85);
  setKey(p, animation, group, "rotation", 60, Math.PI / 2);
  return { p, linear, radial, path, animation };
}
