// The first contour keeps the original points/closed vocabulary. Additional
// contours share paint, transform and skin, but have independent topology.
export const pathContours = g => [g,...(g.contours ?? [])];
export const pathPoints = g => pathContours(g).flatMap(c=>c.points);
export const pointContour = (g,id) => pathContours(g).find(c=>c.points.some(p=>p.id===id));
export function reverseContour(c){
  return {...c,points:[...c.points].reverse().map(p=>({...p,in:[...p.out],out:[...p.in]}))};
}
