export function graphViewBox(states) {
  const x = Math.min(0, ...states.map((s) => s.position[0] - 20));
  const y = Math.min(0, ...states.map((s) => s.position[1] - 20));
  return [
    x,
    y,
    Math.max(360, ...states.map((s) => s.position[0] + 150 - x)),
    Math.max(180, ...states.map((s) => s.position[1] + 70 - y)),
  ];
}
export function stateViewBox(state) {
  return [state.position[0] - 20, state.position[1] - 20, 160, 80];
}
