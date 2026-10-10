// Touch cameras stay in stage coordinates, independent of the project format.
export function touchFrame(points) {
  const [a, b] = [...points.values()];
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
  };
}
export function gestureCamera(camera, start, next) {
  const zoom = Math.max(
    0.1,
    Math.min(4, (camera.zoom * next.distance) / start.distance),
  );
  return {
    zoom,
    x: next.x - ((start.x - camera.x) * zoom) / camera.zoom,
    y: next.y - ((start.y - camera.y) * zoom) / camera.zoom,
  };
}
