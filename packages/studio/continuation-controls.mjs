import { sheet } from "./advanced.mjs";

const el = (tag, text) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
function field(host, label, value, set, type = "number") {
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
  host.append(l);
  return input;
}
export function continuationControls(node, api) {
  const section = el("section");
  section.className = "property-section";
  section.append(el("h3", "Continue drawing"));
  const start = el("button", "Continue path…");
  start.type = "button";
  start.disabled =
    !api.visible || node.geometry.closed || Boolean(node.geometry.skin);
  section.append(
    start,
    el(
      "p",
      !api.visible
        ? "Show this path and its parents in Layers before continuing."
        : node.geometry.skin
          ? "Unbind this path before adding vertices. New points do not have bone weights yet."
          : node.geometry.closed
            ? "Choose Open path above, then continue from either endpoint. Opening and continuing are separate undoable actions."
            : "Add corners or curves to this path, then Finish or Cancel. Its paint and existing point IDs stay intact. Numeric point entry also works without dragging.",
    ),
  );
  start.onclick = () => {
    let endpoint = "last",
      closed = false,
      smooth = false,
      started = false;
    const dialog = sheet(
      "Continue this path",
      (host) => {
        host.className = "continuation-sheet";
        host.append(
          el(
            "p",
            "Choose the end to extend. The draft stays outside your saved project until Finish; Cancel keeps the original. Existing curves and paint are retained. Smooth connection mirrors endpoint tangents into the new connector; collapsed handles use one third of its chord. Open filled paths still fill across their endpoints; this adds no brush stroke.",
          ),
        );
        const l = el("label"),
          select = el("select");
        l.className = "field";
        l.append(el("span", "Continue from"));
        select.setAttribute("aria-label", "Continue from");
        for (const [id, name] of [
          ["last", "Last endpoint"],
          ["first", "First endpoint"],
        ]) {
          const o = el("option", name);
          o.value = id;
          select.append(o);
        }
        select.onchange = () => {
          endpoint = select.value;
        };
        l.append(select);
        host.append(l);
        field(
          host,
          "Close when finished",
          closed,
          (v) => {
            closed = v;
          },
          "checkbox",
        );
        field(host,"Smooth connection",smooth,v=>{smooth=v;},"checkbox");
        host.append(
          el(
            "p",
            "After Apply, click to add corners or drag to add mirrored curves. Add point… provides local X/Y and curve-handle fields. Backspace removes only new points; Escape cancels the entire draft. At most 256 new points, 4,096 total.",
          ),
        );
      },
      () => {
        started = api.start(node.id, { endpoint, closed, smooth });
        return started;
      },
      api.notice,
      start,
    );
    dialog.addEventListener(
      "close",
      () => {
        if (!started) return;
        const panel = document.querySelector("#mobile-panel");
        const focusStage = () =>
          requestAnimationFrame(() => document.querySelector("#stage").focus());
        if (panel.open) {
          panel.addEventListener("close", focusStage, { once: true });
          panel.close();
        } else focusStage();
      },
      { once: true },
    );
  };
  return section;
}
export function numericContinuation(draft, changed, notice, opener) {
  const last = draft.points.at(-1).anchor;
  let anchor = [last[0] + 32, last[1]],
    out = null,
    curved = false;
  sheet(
    "Add a path point",
    (host) => {
      host.className = "continuation-sheet";
      host.addEventListener("input", () => {
        const error = host.closest("dialog")?.querySelector('[role="alert"]');
        if (error) error.textContent = "";
      });
      host.append(
        el(
          "p",
          "Coordinates are local to the path, including under rotated or scaled parents. Add a corner, or set one handle for a mirrored curve. This changes only your draft; Finish commits the extension.",
        ),
      );
      field(host, "New point X", anchor[0], (v) => {
        anchor[0] = v;
      });
      field(host, "New point Y", anchor[1], (v) => {
        anchor[1] = v;
      });
      const handles = el("div");
      handles.hidden = true;
      field(
        host,
        "Curved point",
        curved,
        (v) => {
          curved = v;
          handles.hidden = !v;
          if (v && !out) {
            out = [anchor[0] + 24, anchor[1]];
            field(handles, "Curve handle X", out[0], (v) => {
              out[0] = v;
            });
            field(handles, "Curve handle Y", out[1], (v) => {
              out[1] = v;
            });
          }
        },
        "checkbox",
      );
      host.append(
        handles,
        el(
          "p",
          "Curve handles mirror about the new anchor. After Finish, Edit points can adjust either handle independently. Values must be finite and within ±1,000,000.",
        ),
      );
    },
    () => {
      draft.appendLocal(anchor, curved ? out : anchor);
      changed();
    },
    notice,
    opener,
  );
}
