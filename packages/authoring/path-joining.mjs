import { inverse, multiply, validateProject, worldTransform } from '@evir/project-model';
import { mapPoint } from '@evir/runtime/geometry';

export const PATH_JOIN_LIMIT = 4096;
const color = v => typeof v === 'string' ? (v.length === 7 ? v + 'ff' : v).toLowerCase() : v;
const reverse = points => [...points].reverse().map(p => ({...p, in:[...p.out], out:[...p.in]}));
const close = (a,b) => Math.abs(a-b) <= 1e-8 * Math.max(1,Math.abs(a),Math.abs(b));
function editable(p,n) {
  if(n?.kind !== 'path') throw Error('Choose two existing vector paths.');
  for(let v=n;v;v=p.nodes.find(q=>q.id===v.parentId)) {
    if(p.editor.locked.includes(v.id)) throw Error('Unlock both paths and their parents before joining.');
    if(p.editor.hidden.includes(v.id)) throw Error('Show both paths and their parents before joining.');
  }
  if(n.geometry.closed) throw Error('Open both paths before joining their endpoints.');
  if(n.geometry.contours?.length)throw Error('Release compound contours before joining separate paths.');
  if(n.geometry.skin) throw Error('Unbind both paths before joining. New topology needs new skin weights.');
}
function paints(a,b,m) {
  if((a.fill !== null && typeof a.fill !== 'string') || (b.fill !== null && typeof b.fill !== 'string'))
    throw Error('Joining currently supports solid fills. Gradients need paint-space remapping.');
  if(color(a.fill) !== color(b.fill) || Boolean(a.stroke) !== Boolean(b.stroke))
    throw Error('Use the same solid fill and stroke on both paths before joining.');
  if(!a.stroke) return;
  const x=Math.hypot(m[0],m[1]),y=Math.hypot(m[2],m[3]);
  if(!close(x,y) || !close(m[0]*m[2]+m[1]*m[3],0))
    throw Error('Stroked paths need matching proportional scale without relative shear.');
  const sa=a.stroke,sb=b.stroke;
  for(const s of [sa,sb])
    if(s.dash.length || s.trim.start!==0 || s.trim.end!==1 || s.trim.offset!==0)
      throw Error('Reset dashes and trim on both strokes before joining. Their phase would change.');
  if(color(sa.color)!==color(sb.color) || !close(sa.width,sb.width*x) || sa.cap!==sb.cap || sa.join!==sb.join)
    throw Error('Match stroke color, visible width, cap and join before joining.');
}

// Pure plan: validation finishes before the caller's project is changed.
export function planPathJoin(p,keepId,otherId,{keepEnd='last',otherEnd='first',mode='bridge'}={}) {
  if(keepId===otherId) throw Error('Choose a different path to join.');
  if(!['first','last'].includes(keepEnd)||!['first','last'].includes(otherEnd)||!['bridge','merge'].includes(mode))
    throw Error('Choose First or Last endpoints and a connection method.');
  const keep=p.nodes.find(n=>n.id===keepId),other=p.nodes.find(n=>n.id===otherId);
  editable(p,keep);editable(p,other);
  if(keep.artboardId!==other.artboardId || keep.parentId!==other.parentId)
    throw Error('Move both paths into the same parent before joining.');
  const siblings=p.nodes.filter(n=>n.artboardId===keep.artboardId&&n.parentId===keep.parentId).sort((a,b)=>a.order-b.order);
  if(Math.abs(siblings.indexOf(keep)-siblings.indexOf(other))!==1)
    throw Error('Place the paths next to each other in Layers before joining.');
  const ids=new Set([keepId,otherId]);
  if(p.animations.some(a=>a.tracks.some(t=>ids.has(t.targetId))))
    throw Error('Remove animation tracks on these paths before joining. Parent animation can stay.');
  if(p.machines.some(m=>m.listeners.some(l=>ids.has(l.targetId))))
    throw Error('Remove listeners on these paths before joining. Their hit regions would change.');
  if(p.advanced && [...p.advanced.clips,...p.advanced.feathers,...p.advanced.ik].some(v=>ids.has(v.targetId)||ids.has(v.maskId)||ids.has(v.boneId)))
    throw Error('Remove direct clipping, feather or IK references to these paths before joining.');
  const count=keep.geometry.points.length+other.geometry.points.length-(mode==='merge'?1:0);
  if(count>PATH_JOIN_LIMIT) throw Error('A joined path can contain at most 4,096 points.');
  const matrix=worldTransform(p,keepId),basis=multiply(inverse(matrix),worldTransform(p,otherId));
  inverse(worldTransform(p,otherId));
  paints(keep.geometry,other.geometry,basis);
  let a=structuredClone(keep.geometry.points),b=structuredClone(other.geometry.points);
  if(keepEnd==='first')a=reverse(a);
  if(otherEnd==='last')b=reverse(b);
  const pointIds=new Set(a.map(v=>v.id));
  if(b.some(v=>pointIds.has(v.id))) throw Error('The paths contain overlapping point IDs.');
  for(const v of b)for(const key of ['anchor','in','out'])v[key]=mapPoint(basis,v[key]);
  const end=a.at(-1),start=b[0],from=mapPoint(matrix,end.anchor),to=mapPoint(matrix,start.anchor);
  const gap=Math.hypot(from[0]-to[0],from[1]-to[1]);
  if(!Number.isFinite(gap)||matrix.some(x=>!Number.isFinite(x)))throw Error('Joined world coordinates must remain finite.');
  if(mode==='bridge') {end.out=[...end.anchor];start.in=[...start.anchor];}
  else {end.out=start.out.map((v,i)=>v+end.anchor[i]-start.anchor[i]);b.shift();}
  let points=[...a,...b];if(keepEnd==='first')points=reverse(points);
  if(points.some(v=>['anchor','in','out'].some(k=>v[k].some(x=>!Number.isFinite(x)||Math.abs(x)>1e6))))
    throw Error('Joined controls must remain finite and within ±1,000,000 kept-path units.');
  const geometry={...keep.geometry,points},node={...keep,geometry};
  const next={...p,nodes:p.nodes.filter(n=>n.id!==otherId).map(n=>n.id===keepId?node:n)};
  validateProject(next);
  return {project:next,node,keepId,otherId,keepEnd,otherEnd,mode,gap,from,to,matrix,pointCount:points.length,
    removedPointId:mode==='merge'?other.geometry.points[otherEnd==='first'?0:other.geometry.points.length-1].id:null};
}
export function joinPaths(p,keepId,otherId,options) {
  const plan=planPathJoin(p,keepId,otherId,options);
  p.nodes=plan.project.nodes;
  return keepId;
}
