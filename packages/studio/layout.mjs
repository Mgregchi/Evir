const KEY = "evir.studio.layout.v1";
export function panelWidths(preferred, viewport, active = "left") {
  const budget = Math.max(360, viewport - 60 - 240);
  const sizes = {
    left: Math.max(180, Math.min(420, preferred.left)),
    right: Math.max(180, Math.min(420, preferred.right)),
  };
  const other = active === "left" ? "right" : "left";
  sizes[active] = Math.min(sizes[active], budget - sizes[other]);
  if (sizes[active] < 180) {
    sizes[active] = 180;
    sizes[other] = budget - 180;
  }
  return sizes;
}
export function mountLayout({ notice }) {
  const media = matchMedia("(max-width: 850px)");
  let preferred = { left: 236, right: 260 },
    active = "left";
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.right))
      preferred = saved;
  } catch {
    /* A blocked or malformed preference never prevents editing. */
  }
  const apply = () => {
    const sizes = panelWidths(preferred, innerWidth, active);
    for (const side of ["left", "right"]) {
      document.documentElement.style.setProperty(
        `--${side}-panel-width`,
        `${sizes[side]}px`,
      );
      const input = document.getElementById(`${side}-panel-width`),
        splitter = document.getElementById(`${side}-splitter`);
      input.value = sizes[side];
      input.disabled = media.matches;
      splitter.setAttribute("aria-valuenow", sizes[side]);
      splitter.setAttribute(
        "aria-valuemax",
        Math.min(
          420,
          innerWidth - 60 - 240 - sizes[side === "left" ? "right" : "left"],
        ),
      );
    }
  };
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(preferred));
    } catch {}
  };
  const resize = (side, value) => {
    active = side;
    preferred[side] = Math.max(180, Math.min(420, value));
    apply();
  };
  for (const side of ["left", "right"]) {
    const input = document.getElementById(`${side}-panel-width`),
      splitter = document.getElementById(`${side}-splitter`);
    input.addEventListener("change", () => {
      const value = Number(input.value);
      if (
        !input.value ||
        !Number.isFinite(value) ||
        value < 180 ||
        value > 420
      ) {
        apply();
        notice("Panel widths must be between 180 and 420 pixels.");
        return;
      }
      resize(side, value);
      save();
    });
    let drag = null;
    splitter.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      drag = {
        id: e.pointerId,
        x: e.clientX,
        width: Number(splitter.getAttribute("aria-valuenow")),
        before: { ...preferred },
      };
      splitter.setPointerCapture(e.pointerId);
      splitter.focus();
      e.preventDefault();
    });
    splitter.addEventListener("pointermove", (e) => {
      if (drag?.id === e.pointerId)
        resize(
          side,
          drag.width + (e.clientX - drag.x) * (side === "left" ? 1 : -1),
        );
    });
    splitter.addEventListener("pointerup", (e) => {
      if (drag?.id === e.pointerId) {
        drag = null;
        save();
      }
    });
    const cancel = () => {
      if (drag) {
        preferred = drag.before;
        drag = null;
        apply();
      }
    };
    splitter.addEventListener("pointercancel", cancel);
    splitter.addEventListener("lostpointercapture", cancel);
    window.addEventListener("blur", cancel);
    splitter.addEventListener("keydown", (e) => {
      if (
        !["ArrowLeft", "ArrowRight", "Home", "End", "Enter", "Escape"].includes(
          e.key,
        )
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        cancel();
        return;
      }
      if (e.key === "Enter") {
        cancel();
        document
          .getElementById(side === "left" ? "show-layers" : "show-properties")
          .click();
        document
          .getElementById(side === "left" ? "show-layers" : "show-properties")
          .focus();
        return;
      }
      resize(
        side,
        e.key === "Home"
          ? 180
          : e.key === "End"
            ? 420
            : Number(splitter.getAttribute("aria-valuenow")) +
              (e.key === "ArrowRight" ? 1 : -1) *
                (side === "left" ? 1 : -1) *
                (e.shiftKey ? 30 : 10),
      );
      save();
    });
  }
  document.getElementById("reset-layout").onclick = () => {
    preferred = { left: 236, right: 260 };
    document.body.classList.remove("hide-left", "hide-right");
    apply();
    save();
    document
      .getElementById("show-layers")
      .setAttribute("aria-expanded", String(!media.matches));
    document
      .getElementById("show-properties")
      .setAttribute("aria-expanded", String(!media.matches));
  };
  window.addEventListener("resize", apply);
  apply();
}
