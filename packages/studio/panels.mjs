export function mountPanels() {
  const dialog = document.querySelector("#mobile-panel");
  const media = matchMedia("(max-width: 850px)");
  let current = null, placeholder = null;
  const close = () => { if (dialog.open) dialog.close(); };
  for (const [id, selector, title] of [["show-layers", ".layers", "Layers"], ["show-properties", ".inspector", "Properties"]]) {
    document.getElementById(id).onclick = () => {
      if (!media.matches || dialog.open) return;
      current = document.querySelector(selector);
      placeholder = document.createComment("Panel belongs in the workspace on desktop");
      current.replaceWith(placeholder);
      document.querySelector("#mobile-panel-title").textContent = title;
      dialog.append(current);
      dialog.showModal();
    };
  }
  dialog.addEventListener("close", () => {
    if (placeholder && current) placeholder.replaceWith(current);
    current = placeholder = null;
  });
  document.querySelector("#close-panel").onclick = close;
  media.addEventListener("change", (e) => { if (!e.matches) close(); });
}
