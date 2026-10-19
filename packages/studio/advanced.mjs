import {
  upgradeAdvanced,
  newId,
  worldTransform,
  validateProject,
  encodeBase64,
  pngSize,
} from "@evir/project-model";
import {blendControls} from "./blend-controls.mjs";
import { paintControls } from "./paint.mjs";
const el = (tag, text) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const button = (label, fn) => {
  const b = el("button", label);
  b.type = "button";
  b.onclick = fn;
  return b;
};
function field(host, label, value, set, type = "number") {
  const l = el("label"),
    input = el("input");
  l.className = "field";
  l.append(el("span", label));
  input.type = type;
  input.value = value;
  input.setAttribute("aria-label", label);
  input.oninput = () =>
    set(type === "number" ? Number(input.value) : input.value);
  l.append(input);
  host.append(l);
  return input;
}
function select(host, label, values, value, set) {
  const l = el("label"),
    s = el("select");
  l.className = "field";
  l.append(el("span", label));
  s.setAttribute("aria-label", label);
  for (const [id, name] of values) {
    const o = el("option", name);
    o.value = id;
    s.append(o);
  }
  s.value = value;
  s.onchange = () => set(s.value);
  l.append(s);
  host.append(l);
  return s;
}
export function sheet(title, build, apply, notice, opener) {
  document.querySelector("#advanced-sheet")?.remove();
  const dialog = el("dialog");
  const controller = new AbortController();
  dialog.id = "advanced-sheet";
  dialog.className = "interaction-sheet";
  const heading = el("h2", title);
  heading.id = "advanced-title";
  dialog.setAttribute("aria-labelledby", heading.id);
  dialog.append(heading);
  const body = el("div"),
    error = el("p");
  error.setAttribute("role", "alert");
  dialog.append(body, error);
  build(body);
  const actions = el("div");
  actions.className = "dialog-actions";
  const applyButton = button("Apply", async () => {
    applyButton.disabled = true;
    try {
      if ((await apply(controller.signal)) !== false) dialog.close();
      else
        error.textContent =
          document.querySelector("#notice span")?.textContent ||
          "Changes were rejected. Review the fields and try again.";
    } catch (e) {
      if (!controller.signal.aborted) error.textContent = e.message;
    } finally {
      applyButton.disabled = false;
    }
  });
  actions.append(
    button("Cancel", () => dialog.close()),
    applyButton,
  );
  dialog.append(actions);
  document.body.append(dialog);
  dialog.addEventListener(
    "close",
    () => {
      controller.abort();
      dialog.remove();
      if (opener?.isConnected) opener.focus();
    },
    { once: true },
  );
  dialog.showModal();
  return dialog;
}
export function mountAdvanced(api) {
  const creation = document.querySelector("#creation-tools");
  const menu = button("Assets…", () => openAssets(menu));
  menu.id = "add-assets";
  creation.append(menu);
  function safe() {
    if (api.mode() !== "Design") {
      api.notice("Switch to Design to edit assets and effects.");
      return false;
    }
    return true;
  }
  async function asset(data, name, mime) {
    if (data.byteLength > 16 * 1024 * 1024)
      throw Error("Choose an asset smaller than 16 MiB");
    const bytes = new Uint8Array(data);
    return {
      id: newId("asset"),
      name,
      mimeType: mime,
      sha256: Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join(""),
      data: encodeBase64(bytes),
    };
  }
  function openAssets(opener) {
    if (!safe()) return;
    let kind = "text",
      file,
      text = "Hello, Evir!",
      fontSize = 32;
    sheet(
      "Add an asset",
      (host) => {
        host.append(
          el(
            "p",
            "Text stays editable and uses an embedded font. PNG images can stay flat or become editable triangle meshes. Your files remain in this browser project.",
          ),
        );
        select(
          host,
          "Asset type",
          [
            ["text", "Text with TTF / OTF font"],
            ["image", "PNG image"],
            ["mesh", "Textured PNG mesh"],
          ],
          kind,
          (v) => {
            kind = v;
            fileInput.accept = v === "text" ? ".ttf,.otf" : ".png";
          },
        );
        const l = el("label");
        l.className = "field";
        l.append(el("span", "Asset file"));
        const fileInput = el("input");
        fileInput.type = "file";
        fileInput.accept = ".ttf,.otf";
        fileInput.setAttribute("aria-label", "Asset file");
        fileInput.onchange = () => (file = fileInput.files[0]);
        l.append(fileInput);
        host.append(l);
        host.append(
          el(
            "p",
            "For text, leave the file empty to use the supplied OFL-licensed Noto Sans Latin font.",
          ),
        );
        field(host, "Text", text, (v) => (text = v), "text");
        field(host, "Font size", fontSize, (v) => (fontSize = v));
      },
      async (signal) => {
        let a, g;
        if (file?.size > 16 * 1024 * 1024)
          throw Error("Choose an asset smaller than 16 MiB");
        if (kind === "text") {
          const response = file
            ? null
            : await fetch(new URL("assets/NotoSans-latin.ttf", location.href), {
                signal,
              });
          if (response && !response.ok)
            throw Error(
              "The bundled font could not be loaded. Retry or choose your own font.",
            );
          const data = file
            ? await file.arrayBuffer()
            : await response.arrayBuffer();
          a = await asset(
            data,
            file?.name ?? "Noto Sans Latin",
            file?.name.toLowerCase().endsWith(".otf") ? "font/otf" : "font/ttf",
          );
          g = { text, fontAssetId: a.id, fontSize, fill: "#89dcc0" };
        } else {
          if (!file) throw Error("Choose a PNG first");
          if (!file.name.toLowerCase().endsWith(".png"))
            throw Error("Choose a PNG file");
          const data = await file.arrayBuffer();
          pngSize(new Uint8Array(data));
          a = await asset(data, file.name, "image/png");
          const bitmap = await createImageBitmap(file);
          const scale = Math.min(
              1,
              240 / Math.max(bitmap.width, bitmap.height),
            ),
            width = bitmap.width * scale,
            height = bitmap.height * scale;
          bitmap.close();
          g =
            kind === "image"
              ? { assetId: a.id, width, height }
              : {
                  assetId: a.id,
                  vertices: [
                    [0, 0],
                    [width, 0],
                    [width, height],
                    [0, height],
                  ].map((position, i) => ({
                    id: newId("vertex"),
                    position,
                    uv: [
                      [0, 0],
                      [1, 0],
                      [1, 1],
                      [0, 1],
                    ][i],
                  })),
                  triangles: [0, 1, 2, 0, 2, 3],
                  skin: null,
                };
        }
        const p = api.project();
        upgradeAdvanced(p);
        p.assets.push(a);
        const id = newId("node"),
          board = api.artboardId();
        p.nodes.push({
          id,
          name: kind === "text" ? "Text" : a.name,
          kind,
          artboardId: board,
          parentId: null,
          order:
            Math.max(
              -1,
              ...p.nodes
                .filter((n) => n.parentId === null && n.artboardId === board)
                .map((n) => n.order),
            ) + 1,
          transform: [1, 0, 0, 1, 40, 120],
          geometry: g,
        });
        validateProject(p);
        if (signal.aborted) return false;
        await api.prepare(p);
        if (signal.aborted) {
          await api.prepare(api.project());
          return false;
        }
        const applied = api.commit("Add " + kind, (project) => {
          upgradeAdvanced(project);
          project.assets.push(a);
          project.nodes.push(p.nodes.at(-1));
        });
        if (applied) api.select?.(id);
        return applied;
      },
      api.notice,
      opener,
    );
  }
  function properties(p, n, host) {
    if (!safeMode()) return;
    const block = el("section");
    block.className = "inspector-section";
    block.append(el("h2", "Effects & assets"));
    if (n.kind === "text") {
      block.append(
        button("Edit text…", function () {
          const b = this;
          let text = n.geometry.text,
            fontSize = n.geometry.fontSize;
          sheet(
            "Edit text",
            (h) => {
              field(h, "Text content", text, (v) => (text = v), "text");
              field(h, "Font size", fontSize, (v) => (fontSize = v));
            },
            () =>
              api.commit("Edit text", (p) => {
                const g = p.nodes.find((v) => v.id === n.id).geometry;
                g.text = text;
                g.fontSize = fontSize;
              }),
            api.notice,
            b,
          );
        }),
      );
      block.append(
        paintControls({
          project: p,
          node: n,
          commit: api.commit,
          notice: api.notice,
        }),
      );
    }
    if (n.kind === "mesh")
      block.append(
        button("Edit mesh…", function () {
          const draft = structuredClone(n.geometry);
          let bone = "";
          sheet(
            "Textured mesh",
            (h) => {
              h.append(
                el(
                  "p",
                  "Edit vertex coordinates and UVs. Each triangle uses three vertex indices. Binding here assigns all vertices to one bone; weights can be edited independently in source.",
                ),
              );
              const vertexHost = el("div");
              let index = 0;
              const indexInput = field(h, "Vertex index", index, (value) => {
                index = value;
                showVertex();
              });
              indexInput.min = 0;
              indexInput.max = draft.vertices.length - 1;
              indexInput.step = 1;
              const previous = button("Previous vertex", () =>
                choose(index - 1),
              );
              const next = button("Next vertex", () => choose(index + 1));
              h.append(previous, next, vertexHost);
              function choose(value) {
                index = Math.max(0, Math.min(draft.vertices.length - 1, value));
                indexInput.value = index;
                showVertex();
              }
              function showVertex() {
                vertexHost.replaceChildren();
                previous.disabled = index <= 0;
                next.disabled = index >= draft.vertices.length - 1;
                if (!Number.isInteger(index) || !draft.vertices[index]) {
                  vertexHost.append(
                    el(
                      "p",
                      `Choose a vertex from 0 to ${draft.vertices.length - 1}.`,
                    ),
                  );
                  return;
                }
                const v = draft.vertices[index],
                  i = index;
                vertexHost.append(el("h3", "Vertex " + i));
                for (const [key, axis] of [
                  ["position", 0],
                  ["position", 1],
                  ["uv", 0],
                  ["uv", 1],
                ])
                  field(
                    vertexHost,
                    `Vertex ${i} ${key} ${axis ? "Y" : "X"}`,
                    v[key][axis],
                    (value) => (v[key][axis] = value),
                  );
              }
              showVertex();
              field(
                h,
                "Triangle indices",
                draft.triangles.join(", "),
                (v) =>
                  (draft.triangles = v.split(",").map((x) => Number(x.trim()))),
                "text",
              );
              select(
                h,
                "Bind mesh to bone",
                [
                  ["", "Keep current skin"],
                  ["none", "Remove skin"],
                  ...p.nodes
                    .filter(
                      (v) => v.kind === "bone" && v.artboardId === n.artboardId,
                    )
                    .map((v) => [v.id, v.name]),
                ],
                "",
                (v) => (bone = v),
              );
            },
            () =>
              api.commit("Edit mesh", (p) => {
                if (bone === "none") draft.skin = null;
                else if (bone) {
                  draft.skin = {
                    bindWorld: worldTransform(p, n.id),
                    bones: [{ boneId: bone, bind: worldTransform(p, bone) }],
                    weights: draft.vertices.map((v) => ({
                      pointId: v.id,
                      anchor: [[bone, 1]],
                      in: [[bone, 1]],
                      out: [[bone, 1]],
                    })),
                  };
                }
                p.nodes.find((v) => v.id === n.id).geometry = draft;
              }),
            api.notice,
            this,
          );
        }),
      );
    if (n.kind === "image")
      block.append(
        el(
          "p",
          "Embedded PNG. Use transform controls to resize or create a mesh from Assets.",
        ),
      );
    if (["rectangle", "path", "group"].includes(n.kind))
      block.append(
        button("Clipping & feather…", function () {
          let mask =
              p.advanced?.clips.find((c) => c.targetId === n.id)?.maskId ?? "",
            visible =
              p.advanced?.clips.find((c) => c.targetId === n.id)?.visible ??
              false,
            strength =
              p.advanced?.feathers.find((f) => f.targetId === n.id)?.strength ??
              0;
          sheet(
            "Clipping & feather",
            (h) => {
              select(
                h,
                "Clipping mask",
                [
                  ["", "No mask"],
                  ...p.nodes
                    .filter(
                      (v) =>
                        v.id !== n.id &&
                        v.artboardId === n.artboardId &&
                        ["rectangle", "path"].includes(v.kind),
                    )
                    .map((v) => [v.id, v.name]),
                ],
                mask,
                (v) => (mask = v),
              );
              select(
                h,
                "Show mask artwork",
                [
                  ["false", "Hide mask artwork"],
                  ["true", "Show mask artwork"],
                ],
                String(visible),
                (v) => (visible = v === "true"),
              );
              if (n.kind !== "group")
                field(
                  h,
                  "Outer feather strength",
                  strength,
                  (v) => (strength = v),
                );
              h.append(
                el(
                  "p",
                  "A mask clips this layer and its descendants. Outer feather uses a Canvas blur approximation; official WebGL feather rendering is validated separately.",
                ),
              );
            },
            () =>
              api.commit("Edit effects", (p) => {
                upgradeAdvanced(p);
                p.advanced.clips = p.advanced.clips.filter(
                  (c) => c.targetId !== n.id,
                );
                if (mask)
                  p.advanced.clips.push({
                    targetId: n.id,
                    maskId: mask,
                    visible,
                  });
                p.advanced.feathers = p.advanced.feathers.filter(
                  (f) => f.targetId !== n.id,
                );
                if (strength)
                  p.advanced.feathers.push({ targetId: n.id, strength });
              }),
            api.notice,
            this,
          );
        }),
      );
    if (n.kind === "bone")
      block.append(
        button("Inverse kinematics…", function () {
          let draft = structuredClone(
            p.advanced?.ik.find((c) => c.boneId === n.id) ?? {
              boneId: n.id,
              targetId: "",
              count: 1,
              invert: false,
              strength: 1,
            },
          );
          sheet(
            "Inverse kinematics",
            (h) => {
              select(
                h,
                "IK target",
                [
                  ["", "Remove constraint"],
                  ...p.nodes
                    .filter(
                      (v) => v.id !== n.id && v.artboardId === n.artboardId,
                    )
                    .map((v) => [v.id, v.name]),
                ],
                draft.targetId,
                (v) => (draft.targetId = v),
              );
              select(
                h,
                "Chain length",
                [
                  ["1", "One bone"],
                  ["2", "Two bones"],
                ],
                String(draft.count),
                (v) => (draft.count = Number(v)),
              );
              select(
                h,
                "Bend direction",
                [
                  ["false", "Clockwise"],
                  ["true", "Counterclockwise"],
                ],
                String(draft.invert),
                (v) => (draft.invert = v === "true"),
              );
              field(
                h,
                "IK strength",
                draft.strength,
                (v) => (draft.strength = v),
              );
              h.append(
                el(
                  "p",
                  "IK supports one or two bones with unit scales and an independent target. Move the target to pose the chain.",
                ),
              );
            },
            () =>
              api.commit("Edit IK", (p) => {
                upgradeAdvanced(p);
                p.advanced.ik = p.advanced.ik.filter((c) => c.boneId !== n.id);
                if (draft.targetId) p.advanced.ik.push(draft);
              }),
            api.notice,
            this,
          );
        }),
      );
    if (block.children.length > 1) host.append(block);
  }
  function safeMode() {
    return api.mode() === "Design";
  }
  return {
    properties,
    refresh() {
      menu.disabled = !safeMode();
    },
  };
}
export function machineControls(host, p, m, commit, notice) {
  const open = button("Blending & timing…", () => {
    const draft = structuredClone(m);
    const dialog=sheet(
      "Blending & timing",
      (h) => {
        h.append(
          el(
            "p",
            "Timed transitions use milliseconds. A 1D blend uses one number input. Direct mode mixes ordered timelines with fixed percentages or separate number inputs.",
          ),
        );
        for (const state of draft.states) {
          h.append(el("h3", state.name));
          blendControls(h,p,draft,state);
        }
        for (const t of draft.transitions) {
          h.append(
            el(
              "h3",
              draft.states.find((s) => s.id === t.fromId)?.name +
                " → " +
                draft.states.find((s) => s.id === t.toId)?.name,
            ),
          );
          field(
            h,
            "Mix duration " + t.id,
            t.durationMs ?? 0,
            (v) => (t.durationMs = v),
          );
          let exit = t.exitTimeMs ?? -1;
          field(h, "Exit time " + t.id, exit, (v) => {
            exit = v;
            if (v < 0) delete t.exitTimeMs;
            else t.exitTimeMs = v;
          });
        }
        h.append(
          el(
            "p",
            "Use −1 for no exit-time requirement. Conditions must also match before the transition starts.",
          ),
        );
      },
      (signal) => {
        if(signal.aborted)throw Error("This blending sheet has closed");
        // Report draft errors inside this sheet before a transaction can emit
        // a persistent workspace toast or rebuild its opener.
        const candidate={...p,machines:p.machines.map(v=>v.id===m.id?draft:v)};
        upgradeAdvanced(candidate);validateProject(candidate);
        return commit("Edit blending & timing", (p) => {
          const index=p.machines.findIndex(v=>v.id===m.id);
          if(index<0||JSON.stringify(p.machines[index])!==JSON.stringify(m))throw Error("This machine changed. Reopen Blending & timing.");
          upgradeAdvanced(p);
          p.machines[index] = structuredClone(draft);
        });
      },
      notice,
      open,
    );
    const heading=dialog.querySelector('h2');heading.tabIndex=-1;heading.focus();
    dialog.addEventListener('close',()=>{if(!open.isConnected)([...document.querySelectorAll('[data-blend-machine]')].find(b=>b.dataset.blendMachine===m.id)??document.querySelector('#stage'))?.focus();},{once:true});
  });
  open.dataset.blendMachine=m.id;
  host.append(open);
}
