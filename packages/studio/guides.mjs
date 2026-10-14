import { snapMove } from "./alignment.mjs";

export const GUIDE_CACHE = "evir.studio.guides.v1";
export const defaultGuides = () => ({
  format: "evir-guides",
  version: 2,
  visible: true,
  rulers: false,
  locked: false,
  snap: true,
  grid: { visible: false, snap: false, spacing: 32, originX: 0, originY: 0 },
  guides: [],
  components: [],
});
const exact = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join() === [...keys].sort().join();
const position = (v) =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e6;
export function validateGuides(value) {
  // Version 1 has exactly the former fields; upgrade without changing its guides.
  if (
    value?.version === 1 &&
    exact(
      value,
      Object.keys(defaultGuides()).filter((k) => k !== "components"),
    )
  )
    value = { ...value, version: 2, components: [] };
  if (
    !exact(value, Object.keys(defaultGuides())) ||
    value.format !== "evir-guides" ||
    value.version !== 2
  )
    throw Error("Choose an Evir guide preset (version 1 or 2).");
  for (const key of ["visible", "rulers", "locked", "snap"])
    if (typeof value[key] !== "boolean")
      throw Error("Guide switches must be true or false.");
  const grid = value.grid;
  if (
    !exact(grid, ["visible", "snap", "spacing", "originX", "originY"]) ||
    typeof grid.visible !== "boolean" ||
    typeof grid.snap !== "boolean" ||
    !position(grid.originX) ||
    !position(grid.originY) ||
    !Number.isFinite(grid.spacing) ||
    grid.spacing < 1 ||
    grid.spacing > 10000
  )
    throw Error(
      "Grid spacing must be 1–10,000; origins must be finite, within ±1,000,000.",
    );
  if (!Array.isArray(value.guides) || value.guides.length > 64)
    throw Error("Use at most 64 guides per artboard.");
  const ids = new Set();
  for (const g of value.guides) {
    if (
      !exact(g, ["id", "axis", "position", "visible"]) ||
      typeof g.id !== "string" ||
      !/^[\w-]{1,80}$/.test(g.id) ||
      ids.has(g.id) ||
      !["x", "y"].includes(g.axis) ||
      !position(g.position) ||
      typeof g.visible !== "boolean"
    )
      throw Error(
        "Each guide needs a unique ID, an axis and a finite position within ±1,000,000.",
      );
    ids.add(g.id);
  }
  if (!Array.isArray(value.components) || value.components.length > 8)
    throw Error("Use at most eight row/column guide components.");
  for (const c of value.components) {
    if (
      !exact(c, [
        "id",
        "axis",
        "count",
        "mode",
        "size",
        "gap",
        "margin",
        "align",
        "visible",
        "snap",
      ]) ||
      typeof c.id !== "string" ||
      !/^[\w-]{1,80}$/.test(c.id) ||
      ids.has(c.id) ||
      !["x", "y"].includes(c.axis) ||
      !Number.isInteger(c.count) ||
      c.count < 1 ||
      c.count > 32 ||
      !["fixed", "stretch"].includes(c.mode) ||
      !Number.isFinite(c.size) ||
      c.size < 1 ||
      c.size > 10000 ||
      !Number.isFinite(c.gap) ||
      c.gap < 0 ||
      c.gap > 10000 ||
      !position(c.margin) ||
      c.margin < 0 ||
      !["start", "center", "end"].includes(c.align) ||
      typeof c.visible !== "boolean" ||
      typeof c.snap !== "boolean"
    )
      throw Error(
        "Guide components need unique IDs, 1–32 tracks, valid sizing/alignment, width/height 1–10,000, gutters 0–10,000 and margins 0–1,000,000.",
      );
    ids.add(c.id);
  }
  return structuredClone(value);
}

export const newGuideComponent = (axis) => ({
  id: crypto.randomUUID(),
  axis,
  count: 3,
  mode: "stretch",
  size: 96,
  gap: 24,
  margin: 48,
  align: "center",
  visible: true,
  snap: true,
});

// A bounded geometric overlay, independent of scene nodes or runtime layout.
export function componentBands(c, board) {
  const extent = board[c.axis === "x" ? "width" : "height"],
    inner = extent - 2 * c.margin;
  const size =
    c.mode === "stretch" ? (inner - (c.count - 1) * c.gap) / c.count : c.size;
  const span = c.count * size + (c.count - 1) * c.gap;
  if (
    !Number.isInteger(c.count) ||
    c.count < 1 ||
    c.count > 32 ||
    !Number.isFinite(inner) ||
    !Number.isFinite(size) ||
    size <= 0 ||
    !Number.isFinite(span) ||
    span - inner > Math.max(1, extent) * 1e-12 ||
    c.gap < 0 ||
    c.margin < 0
  )
    throw Error(
      "Tracks and gutters must fit between the artboard margins. Reduce count, size, gutter or margin.",
    );
  const offset =
    c.mode === "stretch" || c.align === "start"
      ? 0
      : c.align === "end"
        ? inner - span
        : (inner - span) / 2;
  return Array.from({ length: c.count }, (_, i) => {
    const start = c.margin + offset + i * (size + c.gap);
    return {
      id: c.id,
      axis: c.axis,
      start,
      end: start + size,
      center: start + size / 2,
    };
  });
}
export function layoutBands(settings, board, strict = false) {
  const bands = [];
  for (const c of settings.components || []) {
    try {
      const generated = componentBands(c, board);
      if (c.visible) bands.push(...generated);
    } catch (error) {
      if (strict) throw error;
    } // Resized artboards can invalidate an old preference.
  }
  return bands;
}
export function parseGuidePreset(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).byteLength > 65536
  )
    throw Error("Choose a guide preset smaller than 64 KiB.");
  try {
    return validateGuides(JSON.parse(text));
  } catch (e) {
    if (e instanceof SyntaxError)
      throw Error("This guide preset is not valid JSON.");
    throw e;
  }
}

// Browser preferences, deliberately separate from authored source and exports.
// Keep only the 32 most recently saved project/artboard pairs.
export function guidePreferences(storage, warning = () => {}) {
  let entries = [];
  try {
    const data = storage.getItem(GUIDE_CACHE);
    if (data && data.length <= 2 * 1024 * 1024) {
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed) || parsed.length > 32)
        throw Error("Invalid guide cache");
      entries = parsed.map((e) => {
        if (
          !exact(e, ["project", "artboard", "value"]) ||
          typeof e.project !== "string" ||
          typeof e.artboard !== "string"
        )
          throw Error("Invalid guide scope");
        return { ...e, value: validateGuides(e.value) };
      });
    }
  } catch {
    warning(
      "Saved guide preferences could not be read. Your scene is unchanged.",
    );
  }
  return {
    get(project, artboard) {
      return structuredClone(
        entries.find((e) => e.project === project && e.artboard === artboard)
          ?.value || defaultGuides(),
      );
    },
    set(project, artboard, value) {
      value = validateGuides(value);
      entries = entries.filter(
        (e) => e.project !== project || e.artboard !== artboard,
      );
      entries.push({ project, artboard, value });
      entries = entries.slice(-32);
      try {
        storage.setItem(GUIDE_CACHE, JSON.stringify(entries));
      } catch {
        warning(
          "Guides work for this visit, but browser storage is unavailable. Download a guide preset to keep them.",
        );
      }
      return structuredClone(value);
    },
  };
}
export const canSnapGuides = (s) =>
  s.visible &&
  ((s.snap &&
    (s.guides.some((g) => g.visible) ||
      (s.components || []).some((c) => c.visible && c.snap))) ||
    s.grid.snap);

export function snapWithGuides(
  box,
  targets,
  settings,
  board,
  dx,
  dy,
  zoom,
  bypass = false,
) {
  if (!box || !settings || !canSnapGuides(settings))
    return snapMove(box, targets, dx, dy, zoom, bypass);
  if (bypass) return { dx, dy, guides: [] };
  const combined = { x: [], y: [] },
    reference = {
      id: "grid",
      name: "Grid",
      x: 0,
      y: 0,
      width: board.width,
      height: board.height,
    };
  for (const axis of ["x", "y"]) {
    if (settings.snap) {
      const enabled = new Set(
        (settings.components || [])
          .filter((c) => c.visible && c.snap)
          .map((c) => c.id),
      );
      for (const band of layoutBands(settings, board))
        if (band.axis === axis && enabled.has(band.id))
          for (const value of [band.start, band.center, band.end])
            combined[axis].push({
              value,
              box: {
                ...reference,
                id: band.id,
                name: axis === "x" ? "Column guide" : "Row guide",
              },
            });
    }
    if (settings.snap)
      for (const g of settings.guides)
        if (g.visible && g.axis === axis)
          combined[axis].push({
            value: g.position,
            box: { ...reference, id: g.id, name: "Guide" },
          });
    if (settings.grid.snap) {
      const origin = settings.grid[axis === "x" ? "originX" : "originY"],
        size = board[axis === "x" ? "width" : "height"],
        start = box[axis] + (axis === "x" ? dx : dy),
        extent = box[axis === "x" ? "width" : "height"];
      for (const v of [start, start + extent / 2, start + extent]) {
        const near =
          origin +
          Math.round((v - origin) / settings.grid.spacing) *
            settings.grid.spacing;
        if (near >= 0 && near <= size)
          combined[axis].push({ value: near, box: reference });
      }
    }
    combined[axis].sort((a, b) => a.value - b.value);
  }
  // Keep the captured scene arrays intact: binary-search object targets rather
  // than copying/sorting every object on each pointer event. Only the bounded
  // guide list and six arithmetic grid candidates need a small sorted list.
  const base = snapMove(box, targets, dx, dy, zoom),
    extra = snapMove(box, combined, dx, dy, zoom);
  for (const axis of ["x", "y"]) {
    const key = axis === "x" ? "dx" : "dy",
      raw = axis === "x" ? dx : dy,
      candidate = extra.guides.find((g) => g.axis === axis),
      previous = base.guides.find((g) => g.axis === axis);
    if (
      candidate &&
      (!previous || Math.abs(extra[key] - raw) <= Math.abs(base[key] - raw))
    ) {
      base[key] = extra[key];
      base.guides = base.guides.filter((g) => g.axis !== axis);
      base.guides.push(candidate);
    }
  }
  return base;
}

// Grid lines thin out when zoomed out. Snapping retains the configured spacing.
// Bounded by screen pixels, never by the size of an artboard.
export function gridLines(settings, board, camera, viewport) {
  if (!settings.visible || !settings.grid.visible) return { x: [], y: [] };
  const result = { x: [], y: [] },
    stride =
      settings.grid.spacing *
      Math.max(1, Math.ceil(8 / (settings.grid.spacing * camera.zoom)));
  for (const axis of ["x", "y"]) {
    const origin = settings.grid[axis === "x" ? "originX" : "originY"],
      size = board[axis === "x" ? "width" : "height"],
      screen = viewport[axis === "x" ? "width" : "height"],
      min = Math.max(0, -camera[axis] / camera.zoom),
      max = Math.min(size, (screen - camera[axis]) / camera.zoom);
    for (
      let v = origin + Math.ceil((min - origin) / stride) * stride;
      v <= max && result[axis].length < 512;
      v += stride
    )
      result[axis].push(v);
  }
  return result;
}
