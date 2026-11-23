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

const offset = ([x,y],[dx,dy],distance) => [x+dx*distance,y+dy*distance];
const difference = ([x,y],[ox,oy]) => [x-ox,y-oy];
const angleBetween = ([x,y],[u,v]) => Math.atan2(x*v-y*u,x*u+y*v);

function rotateHandle(handle, anchor, angle) {
  const [x,y]=difference(handle,anchor);
  const sin=Math.sin(angle),cos=Math.cos(angle);
  return [anchor[0]+x*cos-y*sin,anchor[1]+x*sin+y*cos];
}

// Rive uses neighboring cubic handles as the corner directions. Open paths
// also wrap the neighbor lookup at the endpoints when constructing rounding.
function roundedCorner(anchor, previous, next, radius, point) {
  const toPrev=difference(previous,anchor),toNext=difference(next,anchor);
  const prevLength=Math.hypot(...toPrev),nextLength=Math.hypot(...toNext);
  const inset=Math.min(Math.abs(radius),prevLength/2,nextLength/2);
  if(inset===0)return [point(anchor)];

  const prev=toPrev.map(value=>value/prevLength),following=toNext.map(value=>value/nextLength);
  const angle=Math.abs(angleBetween(prev,following));
  const factor=angle<Math.PI/2 ? 1+Math.cos(angle) : 2-Math.sin(angle);
  const handle=Math.min(inset,4/3*Math.tan(angle/4)*inset*factor);
  const start=offset(anchor,prev,inset),end=offset(anchor,following,inset);
  let outgoing=offset(anchor,prev,inset-handle),incoming=offset(anchor,following,inset-handle);
  if(radius<0){
    const rotation=2*angleBetween(difference(start,end),difference(anchor,end));
    outgoing=rotateHandle(outgoing,start,rotation);
    incoming=rotateHandle(incoming,end,-rotation);
  }
  return [point(start,start,outgoing),point(end,incoming)];
}

export function editableContour(record, vertices, {fail, pointId,forcePath=false,skinned=false}) {
  const f=record.fields;
  if((f.pathFlags ?? 0)!==0)fail(record,'nondefault path flags are outside the editable contour subset');
  const point=(anchor,incoming=anchor,outgoing=anchor)=>({id:pointId(),anchor:[...anchor],in:[...incoming],out:[...outgoing]});
  let points, closed=true;
  if(record.type==='PointsPath') {
    closed=f.isClosed ?? false;
    points=vertices.map(({r})=>{
      const v=r.fields,anchor=[v.x ?? 0,v.y ?? 0];
      if(r.type==='StraightVertex') {
        if(skinned&&(v.radius ?? 0)!==0)fail(r,'rounded straight vertices with skin are outside the editable contour subset');
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
    const controls=points;
    points=controls.flatMap((p,i)=>{
      const r=vertices[i].r,radius=r.type==='StraightVertex' ? r.fields.radius ?? 0 : 0;
      if(radius===0 || controls.length<2)return [p];
      const previous=controls[(i+controls.length-1)%controls.length];
      const next=controls[(i+1)%controls.length];
      return roundedCorner(p.anchor,previous.out,next.in,radius,point);
    });
  } else {
    const w=f.width ?? 0,h=f.height ?? 0;
    if(w<=0 || h<=0)fail(record,'editable parametric contours require positive width and height');
    const x=-(f.originX ?? .5)*w,y=-(f.originY ?? .5)*h;
    if(record.type==='Rectangle') {
      const topLeft = f.cornerRadiusTL ?? 0;
      const radii = f.linkCornerRadius === false
        ? [topLeft, f.cornerRadiusTR ?? 0, f.cornerRadiusBR ?? 0, f.cornerRadiusBL ?? 0]
        : [topLeft, topLeft, topLeft, topLeft];
      const rounded = radii.some(radius => radius !== 0);
      if(!rounded&&!forcePath&&x===0 && y===0 && isIdentityContour(f))return {kind:'rectangle',geometry:{width:w,height:h}};
      const corners = [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
      points = corners.flatMap((corner,i)=>radii[i]===0 ? [point(corner)] :
        roundedCorner(corner,corners[(i+3)%4],corners[(i+1)%4],radii[i],point));
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
