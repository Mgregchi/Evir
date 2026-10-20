// Canonical editable controls for the pinned Rive contour definitions.
// Constraints (mirrored/asymmetric/parametric) are materialized as detached
// controls; animated contour/vertex properties are deliberately not mapped.
export const vertexTypes = new Set([
  'StraightVertex', 'CubicDetachedVertex',
  'CubicMirroredVertex', 'CubicAsymmetricVertex',
]);
export const contourTypes = new Set(['PointsPath', 'Rectangle', 'Ellipse']);
export const contourTransform = (f) => {
  const r=f.rotation ?? 0, x=f.scaleX ?? 1, y=f.scaleY ?? 1;
  return [Math.cos(r)*x,Math.sin(r)*x,-Math.sin(r)*y,Math.cos(r)*y,f.x ?? 0,f.y ?? 0];
};
export const isIdentityContour = f => (f.x ?? 0)===0 && (f.y ?? 0)===0 &&
  (f.rotation ?? 0)===0 && (f.scaleX ?? 1)===1 && (f.scaleY ?? 1)===1;

export function editableContour(record, vertices, {fail, pointId,forcePath=false}) {
  const f=record.fields;
  if((f.pathFlags ?? 0)!==0)fail(record,'nondefault path flags are outside the editable contour subset');
  const point=(anchor,incoming=anchor,outgoing=anchor)=>({id:pointId(),anchor:[...anchor],in:[...incoming],out:[...outgoing]});
  let points, closed=true;
  if(record.type==='PointsPath') {
    closed=f.isClosed ?? false;
    points=vertices.map(({r})=>{
      const v=r.fields,anchor=[v.x ?? 0,v.y ?? 0];
      if(r.type==='StraightVertex') {
        if((v.radius ?? 0)!==0)fail(r,'rounded straight vertices are outside the editable contour subset');
        return point(anchor);
      }
      const detached=r.type==='CubicDetachedVertex',mirrored=r.type==='CubicMirroredVertex';
      const incoming=detached ? v.inRotation ?? 0 : v.rotation ?? 0;
      const outgoing=detached ? v.outRotation ?? 0 : v.rotation ?? 0;
      const inDistance=mirrored ? v.distance ?? 0 : v.inDistance ?? 0;
      const outDistance=mirrored ? v.distance ?? 0 : v.outDistance ?? 0;
      const sign=detached ? 1 : -1;
      return point(anchor,
        [anchor[0]+sign*Math.cos(incoming)*inDistance,anchor[1]+sign*Math.sin(incoming)*inDistance],
        [anchor[0]+Math.cos(outgoing)*outDistance,anchor[1]+Math.sin(outgoing)*outDistance]);
    });
  } else {
    const w=f.width ?? 0,h=f.height ?? 0;
    if(w<=0 || h<=0)fail(record,'editable parametric contours require positive width and height');
    const x=-(f.originX ?? .5)*w,y=-(f.originY ?? .5)*h;
    if(record.type==='Rectangle') {
      for(const k of ['cornerRadiusTL','cornerRadiusTR','cornerRadiusBL','cornerRadiusBR'])
        if((f[k] ?? 0)!==0)fail(record,'rounded rectangles are outside the editable contour subset');
      if(!forcePath&&x===0 && y===0 && isIdentityContour(f))return {kind:'rectangle',geometry:{width:w,height:h}};
      points=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(v=>point(v));
    } else {
      // Ellipse::update uses four clockwise cubic vertices and this constant.
      const k=.552284749831,rx=w/2,ry=h/2,cx=x+rx,cy=y+ry;
      points=[point([cx,y],[cx-k*rx,y],[cx+k*rx,y]),
        point([x+w,cy],[x+w,cy-k*ry],[x+w,cy+k*ry]),
        point([cx,y+h],[cx+k*rx,y+h],[cx-k*rx,y+h]),
        point([x,cy],[x,cy+k*ry],[x,cy-k*ry])];
    }
  }
  if(!isIdentityContour(f)) {
    const [a,b,c,d,x,y]=contourTransform(f);
    for(const p of points)for(const key of ['anchor','in','out']){
      const [px,py]=p[key];p[key]=[a*px+c*py+x,b*px+d*py+y];
    }
  }
  return {kind:'path',geometry:{closed,skin:null,points}};
}
