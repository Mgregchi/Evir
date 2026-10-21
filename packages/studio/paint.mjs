import { validateProject, MAX_GRADIENT_STOPS, upgradeAdvanced } from "@evir/project-model";
const el = (tag, text) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};
const readPaint=(geometry,target)=>target==='stroke'?geometry.stroke.color:geometry.fill;
const writePaint=(geometry,target,value)=>{if(target==='stroke')geometry.stroke.color=value;else geometry.fill=value;};
// Inspector and path controls share the same transaction; draft paint never
// mutates the project until Apply. Native dialog supplies focus containment,
// while the existing interaction-sheet CSS supplies the bottom-sheet UI.
export function paintControls({
  project,
  node,
  commit,
  notice,
  disabled = false,
  paintDisabled = disabled,
  label = "Fill color",
  target = "fill",
}) {
  const host = el("div"),
    fill = readPaint(node.geometry,target);
  if (typeof fill === "string") {
    const field = el("label");
    field.className = "field";
    field.append(el("span", label));
    const input = el("input");
    input.type = "color";
    input.value = fill.slice(0, 7);
    input.setAttribute("aria-label", label);
    input.disabled = disabled;
    input.onchange = () =>
      commit("Change fill", (p) => {
        const geometry = p.nodes.find((n) => n.id === node.id).geometry;
        const original=readPaint(geometry,target);
        writePaint(geometry,target,input.value+(original.length===9?original.slice(7):""));
      });
    field.append(input);
    host.append(field);
  } else if (fill !== null)
    host.append(
      el(
        "p",
        `${fill.type === "linear" ? "Linear" : "Radial"} gradient · ${fill.stops.length} stops`,
      ),
    );
  const open = el("button", target==='stroke'?"Edit stroke paint":"Edit fill");
  open.disabled = paintDisabled;
  open.dataset.paintNode = node.id;
  open.dataset.paintTarget=target;
  open.onclick = () => {
    try {
      openPaintSheet({ project, node, commit, open, target });
    } catch (error) {
      notice(error);
    }
  };
  host.append(open);
  return host;
}
function openPaintSheet({ project, node, commit, open, target }) {
  document.querySelector("#paint-sheet")?.remove();
  const sheet = el("dialog");
  sheet.id = "paint-sheet";
  sheet.className = "interaction-sheet";
  sheet.setAttribute("aria-labelledby", "paint-title");
  const title = el("h2", `${target==='stroke'?'Stroke paint':'Fill'} · ${node.name}`);
  title.id = "paint-title";
  const description = el(
    "p",
    "Colors and endpoints belong to this shape. Apply makes one undo step. Use Animate to key gradient endpoints, stop positions and colors.",
  );
  const error = el("p");
  error.id = "paint-error";
  error.setAttribute("role", "alert");
  const form = el("form"),
    body = el("div");
  form.noValidate = true;
  const original = structuredClone(readPaint(node.geometry,target));
  const initial = original ?? "#8fd9af";
  let kind = typeof initial === "string" ? "solid" : initial.type;
  let solid = typeof initial === "string" ? initial : initial.stops[0].color;
  const points =
    node.kind === "rectangle"
      ? [
          [0, 0],
          [node.geometry.width, node.geometry.height],
        ]
      : node.geometry.points.flatMap((p) => [p.anchor, p.in, p.out]);
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  let gradient =
    typeof initial === "string"
      ? {
          start: [Math.min(...xs), Math.min(...ys)],
          end: [Math.max(...xs), Math.max(...ys)],
          stops: [
            { position: 0, color: solid },
            { position: 1, color: "#f5f3e7" },
          ],
        }
      : structuredClone(initial);
  const field = (label, value, type, change) => {
    const wrap = el("label");
    wrap.className = "field";
    wrap.append(el("span", label));
    const input = el("input");
    input.type = type;
    input.value = value;
    input.setAttribute("aria-label", label);
    if (type === "number") input.step = "any";
    input.oninput = () =>
      change(type === "number" ? input.valueAsNumber : input.value);
    wrap.append(input);
    return wrap;
  };
  const paintColor = (label, value, change) => {
    const pair = el("div");
    pair.className = "field-pair";
    let rgb = value.slice(0, 7),
      alpha = value.length === 9 ? parseInt(value.slice(7), 16) : 255;
    const update = () =>
      change(
        rgb +
          (alpha === 255
            ? ""
            : Number.isFinite(alpha)
              ? Math.round(alpha).toString(16).padStart(2, "0")
              : "invalid"),
      );
    pair.append(
      field(label, rgb, "color", (v) => {
        rgb = v;
        update();
      }),
      field(
        `${label} opacity (%)`,
        Math.round((alpha / 255) * 1000) / 10,
        "number",
        (v) => {
          alpha = v >= 0 && v <= 100 ? Math.round((v / 100) * 255) : NaN;
          update();
        },
      ),
    );
    return pair;
  };
  const typeLabel = el("label");
  typeLabel.className = "field";
  typeLabel.append(el("span", target==='stroke'?"Stroke paint type":"Fill type"));
  const type = el("select");
  type.setAttribute("aria-label", target==='stroke'?"Stroke paint type":"Fill type");
  for (const [value, label] of [
    ["solid", "Solid"],
    ["linear", "Linear gradient"],
    ["radial", "Radial gradient"],
  ]) {
    const option = el("option", label);
    option.value = value;
    type.append(option);
  }
  type.value = kind;
  type.onchange = () => {
    kind = type.value;
    error.textContent = "";
    render();
  };
  typeLabel.append(type);
  function render() {
    body.replaceChildren();
    if (kind === "solid") {
      body.append(
        paintColor("Solid color", solid, (v) => {
          solid = v;
        }),
      );
      return;
    }
    body.append(
      el(
        "p",
        kind === "radial"
          ? "Start is the center; the distance to End sets the radius."
          : "Start and End define the direction. Coordinates are in shape units.",
      ),
    );
    for (const key of ["start", "end"]) {
      const pair = el("div");
      pair.className = "field-pair";
      for (const [index, axis] of ["X", "Y"].entries())
        pair.append(
          field(
            `${key === "start" ? "Start" : "End"} ${axis}`,
            gradient[key][index],
            "number",
            (value) => {
              gradient[key][index] = value;
            },
          ),
        );
      body.append(pair);
    }
    for (const [i, stop] of gradient.stops.entries()) {
      const row = el("fieldset");
      row.className = "gradient-stop";
      row.append(el("legend", `Stop ${i + 1}`));
      row.append(
        field(
          `Stop ${i + 1} position (%)`,
          stop.position * 100,
          "number",
          (value) => {
            stop.position = value / 100;
          },
        ),
        paintColor(`Stop ${i + 1} color`, stop.color, (v) => {
          stop.color = v;
        }),
      );
      const remove = el("button", `Remove stop ${i + 1}`);
      remove.type = "button";
      remove.disabled = gradient.stops.length <= 2;
      remove.onclick = () => {
        gradient.stops.splice(i, 1);
        render();
        type.focus();
      };
      row.append(remove);
      body.append(row);
    }
    const add = el("button", "Add stop");
    add.type = "button";
    add.disabled = gradient.stops.length >= MAX_GRADIENT_STOPS;
    add.onclick = () => {
      // Bisect the widest existing gap. No duplicate positions or hidden stop
      // sorting; users can move positions and Apply sorts a valid draft.
      const sorted = [...gradient.stops].sort(
        (a, b) => a.position - b.position,
      );
      let pair = [sorted[0], sorted[1]];
      for (let i = 1; i < sorted.length - 1; i++)
        if (
          sorted[i + 1].position - sorted[i].position >
          pair[1].position - pair[0].position
        )
          pair = [sorted[i], sorted[i + 1]];
      gradient.stops.push({
        position: (pair[0].position + pair[1].position) / 2,
        color: pair[0].color,
      });
      gradient.stops.sort((a, b) => a.position - b.position);
      render();
      body
        .querySelectorAll("input")
        .item(body.querySelectorAll("input").length - 3)
        ?.focus();
    };
    body.append(add);
  }
  const actions = el("div");
  actions.className = "dialog-actions";
  const cancel = el("button", target==='stroke'?"Cancel stroke paint":"Cancel fill");
  cancel.type = "button";
  cancel.onclick = () => sheet.close();
  const apply = el("button", target==='stroke'?"Apply stroke paint":"Apply fill");
  apply.type = "submit";
  apply.className = "primary";
  actions.append(cancel, apply);
  form.append(typeLabel, body, error, actions);
  sheet.append(title, description, form);
  document.body.append(sheet);
  render();
  form.onsubmit = (event) => {
    event.preventDefault();
    if(!sheet.open||!sheet.isConnected)return;
    try {
      const fill =
        kind === "solid"
          ? solid
          : {
              type: kind,
              start: gradient.start,
              end: gradient.end,
              stops: [...gradient.stops].sort(
                (a, b) => a.position - b.position,
              ),
            };
      if (
        kind !== "solid" &&
        project.animations.some((a) =>
          a.tracks.some((t) => t.targetId === node.id && t.property === (target==='stroke'?'stroke.color':'fill')),
        )
      )
        throw Error(
          "This paint has color keys. Remove those keys before converting to a gradient.",
        );
      const candidate = structuredClone(project);
      writePaint(candidate.nodes.find((n)=>n.id===node.id).geometry,target,structuredClone(fill));
      if(node.geometry.skin && typeof fill!=="string")upgradeAdvanced(candidate);
      validateProject(candidate);
      if (
        !commit("Change shape paint", (p) => {
          const layer=p.nodes.find(n=>n.id===node.id);
          if(!layer||JSON.stringify(readPaint(layer.geometry,target))!==JSON.stringify(original))throw Error('The shape changed. Reopen its paint before applying.');
          if(layer.geometry.skin&&typeof fill!=="string")upgradeAdvanced(p);
          writePaint(layer.geometry,target,structuredClone(fill));
        })
      )
        throw Error(
          "Fill was not applied. Finish any pending drawing and try again.",
        );
      sheet.close();
    } catch (issue) {
      error.textContent = issue.message;
    }
  };
  sheet.addEventListener(
    "close",
    () => {
      (
        document.querySelector(`[data-paint-node="${node.id}"][data-paint-target="${target}"]`) || open
      ).focus();
      sheet.remove();
    },
    { once: true },
  );
  sheet.showModal();
  type.focus();
}
