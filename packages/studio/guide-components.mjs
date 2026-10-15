import { newGuideComponent, componentBands } from "./guides.mjs";
const el = (tag, text) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};

export function componentControls(
  host,
  draft,
  board,
  field,
  repaint,
  expanded,
) {
  const section = el("fieldset");
  section.append(el("legend", "Rows & columns"));
  section.append(
    el(
      "p",
      "Repeat guide bands with a count, gutter and margin. Stretch fills the available space; Fixed uses your width or height. Guides do not move layers automatically. Bands that no longer fit a resized artboard stay inactive until adjusted.",
    ),
  );
  host.append(section);
  const counts = { x: 0, y: 0 };
  for (const [index, c] of draft.components.entries()) {
    const name = `${c.axis === "x" ? "Columns" : "Rows"} ${++counts[c.axis]}`,
      details = el("details");
    details.dataset.componentId = c.id;
    details.open = expanded.has(c.id);
    details.ontoggle = () => {
      if (details.isConnected) {
        if (details.open) expanded.add(c.id);
        else expanded.delete(c.id);
      }
    };
    details.append(el("summary", name));
    section.append(details);
    const result = el("p");
    result.className = "component-size";
    const update = () => {
      try {
        const bands = componentBands(c, board);
        result.textContent = `${c.count} tracks · ${(bands[0].end - bands[0].start).toFixed(2)} units each · starts at ${bands[0].start.toFixed(2)}`;
      } catch (error) {
        result.textContent = error.message;
      }
    };
    for (const [key, title, type] of [
      ["visible", "Show", "checkbox"],
      ["snap", "Snap to", "checkbox"],
      ["count", "Track count", "number"],
      ["gap", "Gutter", "number"],
      ["margin", "Margin", "number"],
    ]) {
      const input = field(
        details,
        `${name} ${title.toLowerCase()}`,
        c[key],
        (v) => {
          c[key] = v;
          update();
        },
        type,
      );
      input.parentElement.querySelector("span").textContent = title;
      if (type === "number") {
        input.disabled = draft.locked;
        input.min = key === "count" ? "1" : "0";
        input.max =
          key === "count" ? "32" : key === "gap" ? "10000" : "1000000";
        if (key === "count") input.step = "1";
      }
    }
    function select(title, values, key) {
      const label = el("label"),
        input = el("select");
      label.className = "field";
      input.setAttribute("aria-label", `${name} ${title}`);
      for (const [id, text] of values) {
        const option = el("option", text);
        option.value = id;
        input.append(option);
      }
      input.value = c[key];
      label.append(el("span", title[0].toUpperCase() + title.slice(1)), input);
      details.append(label);
      input.disabled = draft.locked;
      return input;
    }
    const mode = select(
      "sizing",
      [
        ["stretch", "Stretch"],
        ["fixed", "Fixed"],
      ],
      "mode",
    );
    const size = field(
      details,
      `${name} ${c.axis === "x" ? "width" : "height"}`,
      c.size,
      (v) => {
        c.size = v;
        update();
      },
    );
    size.min = "1";
    size.max = "10000";
    size.parentElement.querySelector("span").textContent =
      c.axis === "x" ? "Width" : "Height";
    const align = select(
      "alignment",
      [
        ["start", "Start"],
        ["center", "Center"],
        ["end", "End"],
      ],
      "align",
    );
    const sync = () => {
      size.disabled = align.disabled = draft.locked || c.mode === "stretch";
      update();
    };
    mode.onchange = () => {
      c.mode = mode.value;
      sync();
    };
    align.onchange = () => {
      c.align = align.value;
      update();
    };
    sync();
    details.append(result);
    const duplicate = el("button", "Duplicate"),
      remove = el("button", "Remove");
    for (const [b, action] of [
      [duplicate, "Duplicate"],
      [remove, "Remove"],
    ]) {
      b.type = "button";
      b.setAttribute("aria-label", `${action} ${name.toLowerCase()}`);
      b.disabled = draft.locked;
    }
    duplicate.disabled ||= draft.components.length >= 8;
    duplicate.onclick = () => {
      const copy = { ...c, id: crypto.randomUUID() };
      draft.components.splice(index + 1, 0, copy);
      expanded.add(copy.id);
      repaint();
      host.querySelector(`[data-component-id="${copy.id}"] input`)?.focus();
    };
    remove.onclick = () => {
      draft.components.splice(index, 1);
      expanded.delete(c.id);
      repaint();
      host.querySelector("[data-add-component]")?.focus();
    };
    details.append(duplicate, remove);
  }
  for (const axis of ["x", "y"]) {
    const add = el("button", `Add ${axis === "x" ? "columns" : "rows"}`);
    add.type = "button";
    add.dataset.addComponent = axis;
    add.disabled = draft.locked || draft.components.length >= 8;
    add.onclick = () => {
      const c = newGuideComponent(axis);
      draft.components.push(c);
      expanded.add(c.id);
      repaint();
      host.querySelector(`[data-component-id="${c.id}"] input`)?.focus();
    };
    section.append(add);
  }
}
