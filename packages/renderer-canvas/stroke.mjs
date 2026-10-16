// Bounded software path effects. Source keeps cubic controls; effect output is
// a polyline approximation (0.01-unit control-polygon excess, 8-unit chords).
// Dash phase follows Rive's path-length wrap, not Canvas setLineDash phase.
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const midpoint = (a,b) => [(a[0]+b[0])/2,(a[1]+b[1])/2];
export function centerline(g) {
  if (g.points) return {points:g.points,closed:g.closed};
  return {closed:true,points:[[0,0],[g.width,0],[g.width,g.height],[0,g.height]].map(anchor=>({anchor,in:anchor,out:anchor}))};
}
function flatten(g) {
  const {points,closed}=centerline(g), output=[points[0].anchor];
  const append=(a,b,c,d,depth=0)=>{
    const chord=distance(a,d), polygon=distance(a,b)+distance(b,c)+distance(c,d);
    if(depth===12 || (polygon-chord<=.01 && polygon<=8)) {
      if(distance(output.at(-1),d)>1e-9) output.push(d);
      if(output.length>65536) throw new RangeError('Stroke subdivision budget exceeded');
      return;
    }
    const ab=midpoint(a,b),bc=midpoint(b,c),cd=midpoint(c,d),abc=midpoint(ab,bc),bcd=midpoint(bc,cd),m=midpoint(abc,bcd);
    append(a,ab,abc,m,depth+1); append(m,bcd,cd,d,depth+1);
  };
  for(let i=0;i<points.length-(closed?0:1);i++) {
    const a=points[i],b=points[(i+1)%points.length];append(a.anchor,a.out,b.in,b.anchor);
  }
  return {points:output,closed};
}
function measured(contours) {
  const edges=[];let length=0;
  for(const [contour,host] of contours.entries()) for(let i=1;i<host.points.length;i++) {
    const a=host.points[i-1],b=host.points[i],size=distance(a,b);
    if(size>1e-9){edges.push({a,b,start:length,end:length+size,contour});length+=size;}
  }
  return {edges,length};
}
function segment(measure,start,end) {
  const out=[];let current=null,previous=-1;
  // Dash intervals visit only their intersecting edges, even for tiny dashes.
  let low=0,high=measure.edges.length;
  while(low<high){const mid=(low+high)>>>1;if(measure.edges[mid].end<=start)low=mid+1;else high=mid;}
  for(let i=low;i<measure.edges.length && measure.edges[i].start<end;i++) {
    const e=measure.edges[i];
    const point=t=>[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t];
    const a=point(Math.max(0,(start-e.start)/(e.end-e.start))),b=point(Math.min(1,(end-e.start)/(e.end-e.start)));
    if(e.contour!==previous){current={points:[a],closed:false};out.push(current);previous=e.contour;}
    current.points.push(b);
  }
  return out;
}
const wrap=(v,total)=>((v%total)+total)%total;
function range(measure,start,end,closed) {
  const length=measure.length;if(!length || end-start<1e-9)return [];
  const result=segment(measure,start,Math.min(length,end));
  if(end>length) {
    const tail=segment(measure,0,end-length);
    if(closed && result.length && tail.length) {
      result.at(-1).points.push(...tail[0].points.slice(1));tail.shift();
    }
    result.push(...tail);
  }
  return result;
}
export function strokeContours(g) {
  const stroke=g.stroke, original=flatten(g),{start,end,offset}=stroke.trim;
  let contours=[original],measure=measured(contours);
  if(!measure.length)return [];
  if(start!==0 || end!==1 || offset!==0) {
    let from=Math.min(start,end)+wrap(offset,1),to=Math.max(start,end)+wrap(offset,1);
    if(from>=1){from-=1;to-=1;}
    contours=range(measure,from*measure.length,to*measure.length,original.closed);
    if(start===0 && end===1 && original.closed && contours.length===1)contours[0].closed=true;
  }
  const checked=paths=>{if(paths.reduce((sum,c)=>sum+c.points.length,0)>65536)throw new RangeError("Stroke effect output budget exceeded");return paths;};
  if(!stroke.dash.length)return checked(contours);
  measure=measured(contours);if(!measure.length)return [];
  const dashed=[];let count=0,walked=0,position=wrap(stroke.dashOffset,measure.length),index=0;
  while(walked<measure.length) {
    const amount=Math.min(stroke.dash[index%stroke.dash.length],measure.length);
    const end=position+amount;
    if(index%2===0) {
      const pieces=range(measure,position,end,contours.length===1&&contours[0].closed);
      count+=pieces.reduce((sum,c)=>sum+c.points.length,0);
      if(count>65536)throw new RangeError("Stroke effect output budget exceeded");
      dashed.push(...pieces);
    }
    position=end>measure.length?end-measure.length:end;walked+=amount;index++;
  }
  return dashed;
}
export function strokeStyle(ctx,g) {
  const s=g.stroke;ctx.lineWidth=s.width;ctx.lineCap=s.cap;ctx.lineJoin=s.join;ctx.miterLimit=4;ctx.strokeStyle=s.color;
}
export function strokePathOnContext(ctx,g) {
  ctx.beginPath();
  const s=g.stroke;
  if(!s.dash.length && s.trim.start===0 && s.trim.end===1 && s.trim.offset===0) {
    const {points,closed}=centerline(g);ctx.moveTo(...points[0].anchor);
    for(let i=1;i<points.length;i++)ctx.bezierCurveTo(...points[i-1].out,...points[i].in,...points[i].anchor);
    if(closed){ctx.bezierCurveTo(...points.at(-1).out,...points[0].in,...points[0].anchor);ctx.closePath();}
  } else for(const c of strokeContours(g)) {
    if(c.points.length<2)continue;
    ctx.moveTo(...c.points[0]);for(const p of c.points.slice(1))ctx.lineTo(...p);if(c.closed)ctx.closePath();
  }
}
