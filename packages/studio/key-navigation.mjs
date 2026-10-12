export function neighborKey(animation, targetId, frame, direction) {
  if (![-1, 1].includes(direction)) throw Error("Choose a key direction.");
  const keys = animation.tracks
    .filter((t) => !targetId || t.targetId === targetId)
    .flatMap((t) =>
      t.keys.map((k) => ({
        targetId: t.targetId,
        property: t.property,
        frame: k.frame,
      })),
    );
  const eligible = keys.filter((k) =>
    direction < 0 ? k.frame < frame : k.frame > frame,
  );
  eligible.sort((a, b) => direction * (a.frame - b.frame));
  return eligible[0] || null;
}
