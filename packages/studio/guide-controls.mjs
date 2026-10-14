import {
  defaultGuides,
  guidePreferences,
  validateGuides,
  parseGuidePreset,
  gridLines,
} from "./guides.mjs";
import { sheet } from "./advanced.mjs";

const el = (tag, text) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
export function mountGuides(api) {
  let storage;
  try {
    storage = localStorage;
  } catch {
    storage = {
      getItem() {},
      setItem() {
        throw Error("Unavailable");
      },
    };
  }
  const preferences = guidePreferences(storage, api.notice);
  let editing = false,
    gesture = null;
  const current = () => preferences.get(api.project().id, api.artboard().id);
  const save = (s) => preferences.set(api.project().id, api.artboard().id, s);
  const openButton = document.querySelector("#manage-guides");
  document.querySelector("#stop-guide-editing").onclick = () => {
    api.cancel();
    editing = false;
    api.draw();
  };
  openButton.onclick = () => {
    if (!api.ready()) return;
    api.cancel();
    document.querySelector("#view-menu").hidePopover();
    const scope = [api.project().id, api.artboard().id];
    let draft = current(),
      edit = editing;
    sheet(
      "Guides & grid",
      (host) => {
        host.className = "guide-manager";
        host.append(
          el(
            "p",
            "Guides belong to this artboard and are saved in this browser for up to 32 recently saved artboards. They never appear in scene exports. Download a preset to move them between browsers. Apply saves these preferences; Cancel keeps the previous settings.",
          ),
        );
        const body = el("div");
        host.append(body);
        function field(parent, label, value, set, type = "number") {
          const l = el("label"),
            input = el("input");
          l.className = "field";
          input.type = type;
          input.setAttribute("aria-label", label);
          if (type === "checkbox") input.checked = value;
          else {
            input.value = value;
            input.step = "any";
          }
          input.oninput = () =>
            set(
              type === "checkbox"
                ? input.checked
                : input.value === ""
                  ? NaN
                  : Number(input.value),
            );
          l.append(el("span", label), input);
          parent.append(l);
          return input;
        }
        function paint() {
          body.replaceChildren();
          const settings = el("fieldset");
          settings.append(el("legend", "Canvas guides"));
          body.append(settings);
          for (const [key, name] of [
            ["visible", "Show guides and grid"],
            ["rulers", "Show rulers"],
            ["snap", "Snap to guides"],
            ["locked", "Lock guide positions"],
          ])
            field(
              settings,
              name,
              draft[key],
              (v) => {
                draft[key] = v;
                if (key === "locked") {
                  paint();
                  body
                    .querySelector('[aria-label="Lock guide positions"]')
                    ?.focus();
                }
              },
              "checkbox",
            );
          field(
            settings,
            "Edit guides on canvas",
            edit,
            (v) => {
              edit = v;
            },
            "checkbox",
          ).disabled = draft.locked;
          settings.append(
            el(
              "p",
              "In Design with Select, enable editing and drag from the top ruler for a vertical guide or the left ruler for a horizontal guide. Drag a guide to move it; Escape cancels the gesture. Numeric positions below offer the same control without dragging. Locked guides can still snap layers.",
            ),
          );
          const list = el("fieldset");
          list.append(el("legend", "Guide positions (artboard units)"));
          body.append(list);
          for (const [index, g] of draft.guides.entries()) {
            const row = el("div");
            row.className = "guide-row";
            list.append(row);
            field(
              row,
              `${g.axis === "x" ? "Vertical" : "Horizontal"} guide ${index + 1}`,
              g.position,
              (v) => {
                g.position = v;
              },
            ).disabled = draft.locked;
            field(
              row,
              `Show guide ${index + 1}`,
              g.visible,
              (v) => {
                g.visible = v;
              },
              "checkbox",
            );
            const remove = el("button", "Remove");
            remove.type = "button";
            remove.disabled = draft.locked;
            remove.setAttribute("aria-label", `Remove guide ${index + 1}`);
            remove.onclick = () => {
              draft.guides.splice(index, 1);
              paint();
              listFocus();
            };
            row.append(remove);
          }
          for (const axis of ["x", "y"]) {
            const add = el(
              "button",
              `Add ${axis === "x" ? "vertical" : "horizontal"} guide`,
            );
            add.type = "button";
            add.disabled = draft.locked || draft.guides.length >= 64;
            add.onclick = () => {
              draft.guides.push({
                id: crypto.randomUUID(),
                axis,
                position: api.artboard()[axis === "x" ? "width" : "height"] / 2,
                visible: true,
              });
              paint();
              body
                .querySelectorAll(".guide-row input[type=number]")
                .item(draft.guides.length - 1)
                ?.focus();
            };
            list.append(add);
          }
          const grid = el("fieldset");
          grid.append(el("legend", "Uniform grid"));
          body.append(grid);
          for (const [key, name, type] of [
            ["visible", "Show grid", "checkbox"],
            ["snap", "Snap to grid", "checkbox"],
            ["spacing", "Grid spacing", "number"],
            ["originX", "Grid origin X", "number"],
            ["originY", "Grid origin Y", "number"],
          ])
            field(
              grid,
              name,
              draft.grid[key],
              (v) => {
                draft.grid[key] = v;
              },
              type,
            );
          grid.append(
            el(
              "p",
              "Spacing is 1–10,000 artboard units. Guides and grid snap within six screen pixels. Hold Alt to move layers freely. Hide guides and grid to bypass both; object alignment has its own Canvas view switch.",
            ),
          );
        }
        function listFocus() {
          body.querySelector("button")?.focus();
        }
        paint();
        const portable = el("fieldset");
        portable.append(el("legend", "Reusable preset"));
        host.append(portable);
        const status = el("p");
        status.setAttribute("role", "status");
        portable.append(status);
        const download = el("button", "Download guide preset");
        download.type = "button";
        download.onclick = () => {
          try {
            const value = validateGuides(draft),
              url = URL.createObjectURL(
                new Blob([JSON.stringify(value, null, 2)], {
                  type: "application/json",
                }),
              ),
              link = el("a");
            link.href = url;
            link.download = "artboard.guides.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            status.textContent =
              "Preset downloaded. Apply to save it in this browser too.";
          } catch (e) {
            status.textContent = e.message;
          }
        };
        portable.append(download);
        const label = el("label"),
          input = el("input");
        input.type = "file";
        input.accept = ".json";
        label.className = "field";
        label.append(el("span", "Import guide preset"), input);
        portable.append(label);
        input.onchange = async () => {
          const file = input.files[0];
          if (!file) return;
          try {
            if (file.size > 65536)
              throw Error("Choose a guide preset smaller than 64 KiB.");
            const value = parseGuidePreset(await file.text());
            if (!input.isConnected) return;
            draft = value;
            edit = false;
            paint();
            status.textContent =
              "Preset ready. Apply to replace this artboard’s guides.";
          } catch (e) {
            if (input.isConnected) status.textContent = e.message;
          }
          input.value = "";
        };
        const reset = el("button", "Reset guide preferences");
        reset.type = "button";
        reset.onclick = () => {
          draft = defaultGuides();
          edit = false;
          paint();
          status.textContent =
            "Reset ready. Apply to save, or Cancel to keep your guides.";
        };
        portable.append(reset);
      },
      () => {
        if (scope[0] !== api.project().id || scope[1] !== api.artboard().id)
          throw Error("The artboard changed. Reopen Guides & grid.");
        save(draft);
        editing = edit && !draft.locked;
        api.draw();
      },
      api.notice,
      document.querySelector("#view-toggle"),
    );
  };
  return {
    current,
    editing: () => editing,
    escape() {
      if (!editing) return false;
      editing = false;
      api.draw();
      return true;
    },
    begin(point, camera) {
      const s = current();
      if (!editing || s.locked) return false;
      let axis, id;
      if (s.rulers && point.y < 20 && point.x >= 20) axis = "x";
      else if (s.rulers && point.x < 20 && point.y >= 20) axis = "y";
      else if (s.visible) {
        const candidates = s.guides
          .filter((g) => g.visible)
          .map((g) => ({
            g,
            distance: Math.abs(
              point[g.axis] - (camera[g.axis] + g.position * camera.zoom),
            ),
          }))
          .filter((v) => v.distance <= 6)
          .sort((a, b) => a.distance - b.distance);
        if (candidates.length) {
          axis = candidates[0].g.axis;
          id = candidates[0].g.id;
        }
      }
      if (!axis) return false;
      if (!id) {
        if (s.guides.length >= 64) {
          api.notice("Use at most 64 guides per artboard.");
          return false;
        }
        id = crypto.randomUUID();
        s.guides.push({ id, axis, position: 0, visible: true });
        s.visible = true;
      }
      gesture = {
        value: s,
        id,
        axis,
        camera: { ...camera },
        project: api.project().id,
        artboard: api.artboard().id,
      };
      this.move(point);
      return true;
    },
    move(point) {
      if (!gesture) return;
      const { axis, camera, value, id } = gesture;
      value.guides.find((g) => g.id === id).position = Math.max(
        -1e6,
        Math.min(
          1e6,
          Math.round(((point[axis] - camera[axis]) / camera.zoom) * 100) / 100,
        ),
      );
    },
    finish() {
      if (
        gesture &&
        gesture.project === api.project().id &&
        gesture.artboard === api.artboard().id
      )
        save(gesture.value);
      gesture = null;
    },
    cancel() {
      gesture = null;
    },
    draw(ctx, camera, viewport) {
      document.querySelector("#stop-guide-editing").hidden =
        !editing || !api.editable();
      const s = gesture?.value || current(),
        board = api.artboard();
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.zoom, camera.zoom);
      const grid = gridLines(s, board, camera, viewport);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, board.width, board.height);
      ctx.clip();
      ctx.strokeStyle = "#37665840";
      ctx.lineWidth = 1 / camera.zoom;
      ctx.beginPath();
      for (const x of grid.x) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, board.height);
      }
      for (const y of grid.y) {
        ctx.moveTo(0, y);
        ctx.lineTo(board.width, y);
      }
      ctx.stroke();
      ctx.restore();
      if (s.visible) {
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 4 / camera.zoom]);
        for (const g of s.guides)
          if (g.visible) {
            ctx.strokeStyle = g.id === gesture?.id ? "#edbd80" : "#74cdb0";
            ctx.beginPath();
            if (g.axis === "x") {
              ctx.moveTo(g.position, -camera.y / camera.zoom);
              ctx.lineTo(
                g.position,
                (viewport.height - camera.y) / camera.zoom,
              );
            } else {
              ctx.moveTo(-camera.x / camera.zoom, g.position);
              ctx.lineTo((viewport.width - camera.x) / camera.zoom, g.position);
            }
            ctx.stroke();
          }
      }
      ctx.restore();
      if (!s.rulers) return;
      ctx.save();
      ctx.fillStyle = "#182322";
      ctx.fillRect(0, 0, viewport.width, 20);
      ctx.fillRect(0, 0, 20, viewport.height);
      ctx.fillStyle = "#d8e8e2";
      ctx.strokeStyle = "#89a99c";
      ctx.font = "10px system-ui";
      ctx.lineWidth = 1;
      const raw = 60 / camera.zoom,
        unit = 10 ** Math.floor(Math.log10(raw)),
        step = [1, 2, 5, 10].find((v) => v * unit >= raw) * unit;
      for (const axis of ["x", "y"]) {
        const size = viewport[axis === "x" ? "width" : "height"],
          start = Math.ceil((20 - camera[axis]) / camera.zoom / step) * step;
        for (let i = 0, v = start; i < 256; i++, v += step) {
          const screen = camera[axis] + v * camera.zoom;
          if (screen > size) break;
          ctx.beginPath();
          if (axis === "x") {
            ctx.moveTo(screen, 16);
            ctx.lineTo(screen, 20);
            ctx.fillText(String(Math.round(v * 100) / 100), screen + 3, 12);
          } else {
            ctx.moveTo(16, screen);
            ctx.lineTo(20, screen);
            ctx.save();
            ctx.translate(12, screen + 3);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(String(Math.round(v * 100) / 100), 0, 0);
            ctx.restore();
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  };
}
