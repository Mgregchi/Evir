// Panels share the same DOM and state across desktop and touch drawers.
export function mountPanels() {
  const dialog = document.querySelector("#mobile-panel");
  const media = matchMedia("(max-width: 850px)");
  const entries = [
    {
      id: "show-layers",
      selector: ".layers",
      title: "Layers",
      side: "left",
      hide: "hide-layers",
    },
    {
      id: "show-properties",
      selector: ".inspector",
      title: "Properties",
      side: "right",
      hide: "hide-properties",
    },
  ];
  entries.push({
    id: "show-workflow",
    selector: "#authoring-panel",
    title: "Animation and interaction",
    side: "right",
  });
  let current = null,
    placeholder = null,
    origin = null;
  const feedback = document.getElementById("notice");
  const feedbackPosition = document.createComment(
    "Feedback belongs in the active top layer",
  );
  feedback.before(feedbackPosition);
  const sync = () => {
    for (const entry of entries) {
      const button = document.getElementById(entry.id);
      if (entry.id === "show-workflow") {
        button.hidden =
          !media.matches || document.getElementById("authoring-panel").hidden;
        const mode = document.querySelector(
          ".mode-buttons [aria-pressed=true]",
        )?.textContent;
        button.querySelector("span:last-child").textContent =
          mode === "Interact" ? "Machine" : "Timeline";
      }
      button.setAttribute(
        "aria-expanded",
        String(
          media.matches
            ? origin === button
            : !document.body.classList.contains(`hide-${entry.side}`),
        ),
      );
      button.setAttribute(
        "aria-controls",
        media.matches
          ? "mobile-panel"
          : entry.side === "left"
            ? "layers-panel"
            : "properties-panel",
      );
      if (media.matches) button.setAttribute("aria-haspopup", "dialog");
      else button.removeAttribute("aria-haspopup");
    }
  };
  for (const entry of entries) {
    const button = document.getElementById(entry.id);
    button.onclick = () => {
      if (!media.matches) {
        document.body.classList.toggle(`hide-${entry.side}`);
        sync();
        return;
      }
      if (dialog.open) return;
      origin = button;
      current = document.querySelector(entry.selector);
      placeholder = document.createComment("Desktop panel position");
      current.replaceWith(placeholder);
      document.querySelector("#mobile-panel-title").textContent =
        entry.id === "show-workflow"
          ? document.querySelector(".mode-buttons [aria-pressed=true]")
              ?.textContent === "Interact"
            ? "State machine"
            : "Timeline"
          : entry.title;
      dialog.dataset.side = entry.side;
      dialog.append(current, feedback);
      dialog.showModal();
      document.querySelector("#close-panel").focus();
      sync();
    };
    if (entry.hide)
      document.getElementById(entry.hide).onclick = () => {
        button.click();
        button.focus();
      };
  }
  dialog.addEventListener("close", () => {
    if (placeholder && current) placeholder.replaceWith(current);
    feedbackPosition.after(feedback);
    const restoreFocus = origin;
    current = placeholder = origin = null;
    sync();
    restoreFocus?.focus();
  });
  document.querySelector("#close-panel").onclick = () => dialog.close();
  // Clicking the backdrop closes the drawer without forwarding edits to the canvas.
  dialog.addEventListener("click", (event) => {
    const r = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom)
    )
      dialog.close();
  });
  media.addEventListener("change", () => {
    if (dialog.open) dialog.close();
    sync();
  });
  new MutationObserver(() => {
    if (current?.id === "authoring-panel" && current.hidden) dialog.close();
    sync();
  }).observe(document.getElementById("authoring-panel"), {
    attributes: true,
    attributeFilter: ["hidden"],
  });
  sync();
}

export function mountDisclosures() {
  for (const id of ["project-menu", "create-menu", "view-menu"]) {
    const panel = document.getElementById(id);
    const trigger = document.querySelector(`[popovertarget="${id}"]`);
    panel.addEventListener("toggle", () => {
      const open = panel.matches(":popover-open");
      trigger.setAttribute("aria-expanded", String(open));
      if (open) panel.querySelector("button:not(:disabled),a")?.focus();
    });
    trigger.addEventListener("click", () => {
      for (const other of document.querySelectorAll("[popover]:popover-open"))
        if (other !== panel) other.hidePopover();
    });
    panel.addEventListener("click", (event) => {
      if (!event.target.closest("button")) return;
      panel.hidePopover();
      trigger.focus();
    });
  }
}
