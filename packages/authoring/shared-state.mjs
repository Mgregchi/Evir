// Internal immutable versions share unchanged records. Callback candidates and
// public snapshots stay detached; none of a callback's mutable objects escape.
export function shareState(before, after) {
  if (before === after) return before;
  if (after === null || typeof after !== "object") return after;
  const keys = Object.keys(after);
  const comparable =
    before !== null &&
    typeof before === "object" &&
    Array.isArray(before) === Array.isArray(after);
  let same = comparable && Object.keys(before).length === keys.length;
  if (Array.isArray(after) && comparable && before.length !== after.length)
    same = false;
  const result = Array.isArray(after)
    ? Array(after.length)
    : Object.create(null);
  for (const key of keys) {
    result[key] = shareState(comparable ? before[key] : undefined, after[key]);
    if (
      !comparable ||
      !Object.hasOwn(before, key) ||
      result[key] !== before[key]
    )
      same = false;
  }
  return same ? before : Object.freeze(result);
}
