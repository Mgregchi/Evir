// Frontend-only primitives. No engine, storage, account or hosting dependency.
export const livingLoader = (label = "A little hello is waking up…") =>
  `<div class="living-loader" role="status"><span class="living-seed" aria-hidden="true"><i></i><b></b></span><span>${String(label).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}</span></div>`;

export function createFeedback(host) {
  const message = host.querySelector("span"), dismiss = host.querySelector("button");
  let timer, origin;
  const clear = () => { clearTimeout(timer); timer = null; host.hidden = true; };
  const schedule = () => {
    clearTimeout(timer);
    if (!host.hidden && host.dataset.kind === "success" && !document.hidden &&
      !host.matches(":hover") && !host.contains(document.activeElement)) timer = setTimeout(clear, 8000);
  };
  const pause = () => clearTimeout(timer);
  dismiss.addEventListener("click", () => {
    clear();
    if (origin?.isConnected) origin.focus();
  });
  host.addEventListener("pointerenter", pause);
  host.addEventListener("pointerleave", schedule);
  host.addEventListener("focusin", pause);
  host.addEventListener("focusout", schedule);
  document.addEventListener("visibilitychange", schedule);
  return {
    clear,
    show(error, kind = "error") {
      clearTimeout(timer);
      origin = document.activeElement;
      host.dataset.kind = kind;
      host.setAttribute("role", kind === "success" ? "status" : "alert");
      host.setAttribute("aria-atomic", "true");
      message.textContent = error?.message || String(error);
      host.hidden = false;
      schedule();
    },
  };
}
