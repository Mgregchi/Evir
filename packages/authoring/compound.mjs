import {pathContours,pathPoints,newId,worldTransform,multiply,inverse,mapPoint,validateProject,upgradeAdvanced} from '@evir/project-model';
export const COMPOUND_OPERATIONS=['union','subtract','intersect','exclude'];
const clone=v=>structuredClone(v);
const rectangle=g=>({closed:true,points:[[0,0],[g.width,0],[g.width,g.height],[0,g.height]].map(v=>({id:newId('point'),anchor:v,in:[...v],out:[...v]}))});
export function prepareCompound(p,ids){
 validateProject(p);
 if(!Array.isArray(ids)||ids.length<2||ids.length>8||new Set(ids).size!==ids.length)throw Error('Choose two to eight different filled shapes.');
 const nodes=ids.map(id=>p.nodes.find(n=>n.id===id)),keep=nodes[0];
 for(const n of nodes){
  if(!n||!['rectangle','path'].includes(n.kind)||n.geometry.fill===null)throw Error('Choose filled rectangles or vector paths.');
  if(n.parentId!==keep.parentId||n.artboardId!==keep.artboardId)throw Error('Choose shapes under the same parent and artboard.');
  for(let a=n;a;a=p.nodes.find(v=>v.id===a.parentId))if(p.editor.locked.includes(a.id)||p.editor.hidden.includes(a.id))throw Error('Show and unlock the shapes and their parents.');
  if(n.geometry.skin)throw Error('Unbind skin before changing path topology.');
  if(n.kind==='path'&&pathContours(n.geometry).some(c=>!c.closed))throw Error('Close every contour before combining filled shapes.');
 }
 const selected=new Set(ids);
 if(p.animations.some(a=>a.tracks.some(t=>selected.has(t.targetId)))||p.machines.some(m=>m.listeners.some(l=>selected.has(l.targetId))))throw Error('Remove direct animation/listeners before changing topology. Group animation can stay.');
 if(p.advanced&&[...p.advanced.clips,...p.advanced.feathers,...p.advanced.ik].some(v=>[v.targetId,v.maskId,v.boneId].some(id=>selected.has(id))))throw Error('Remove direct clipping, feather or IK references before combining.');
 const basis=inverse(worldTransform(p,keep.id));
 const shapes=nodes.map(n=>{
  const matrix=multiply(basis,worldTransform(p,n.id));inverse(worldTransform(p,n.id));
  const contours=(n.kind==='rectangle'?[rectangle(n.geometry)]:pathContours(n.geometry)).map(c=>({closed:c.closed,points:c.points.map(v=>({id:v.id,...Object.fromEntries(['anchor','in','out'].map(k=>[k,mapPoint(matrix,v[k])]))}))}));
  if(contours.some(c=>c.points.some(v=>['anchor','in','out'].some(k=>v[k].some(x=>!Number.isFinite(x)||Math.abs(x)>1e6)))))throw Error('Controls must remain within ±1,000,000 kept-layer units.');
  return {contours,fillRule:n.geometry.fillRule??'nonzero'};
 });
 if(shapes.reduce((sum,s)=>sum+s.contours.reduce((n,c)=>n+c.points.length,0),0)>1024||shapes.reduce((n,s)=>n+s.contours.length,0)>64)throw Error('Use at most 1,024 input controls and 64 contours per operation.');
 return {ids:[...ids],keepId:keep.id,name:keep.name,shapes};
}
export function commitCompound(p,ids,result){
 const plan=prepareCompound(p,ids),keep=p.nodes.find(n=>n.id===plan.keepId),removed=new Set(ids.slice(result?1:0));
 let candidate={...p,nodes:p.nodes.filter(n=>!removed.has(n.id)).map(n=>n.id===keep.id&&result?{...n,kind:'path',geometry:{...result,fill:clone(keep.geometry.fill),skin:null,...(keep.geometry.stroke?{stroke:clone(keep.geometry.stroke)}:{})}}:n)};
 upgradeAdvanced(candidate);validateProject(candidate);
 p.nodes=candidate.nodes;p.schemaVersion=candidate.schemaVersion;p.advanced=candidate.advanced;
 return result?keep.id:null;
}
export function combinePaths(p,ids,{fillRule='nonzero'}={}){
 if(!['nonzero','evenodd'].includes(fillRule))throw Error('Choose nonzero or evenodd fill.');
 const plan=prepareCompound(p,ids),contours=plan.shapes.flatMap(s=>s.contours).map(c=>({...c,points:c.points.map(v=>({...v,id:newId('point')}))}));
 const first=contours.shift();return commitCompound(p,ids,{...first,contours,fillRule});
}
export function releaseCompound(p,id){
 const source=p.nodes.find(n=>n.id===id);if(source?.kind!=='path'||!source.geometry.contours?.length)throw Error('Choose a compound path.');
 for(let n=source;n;n=p.nodes.find(v=>v.id===n.parentId))if(p.editor.locked.includes(n.id)||p.editor.hidden.includes(n.id))throw Error('Show and unlock the compound path.');
 if(p.machines.some(m=>m.listeners.some(l=>l.targetId===id))||p.advanced&&[...p.advanced.clips,...p.advanced.feathers,...p.advanced.ik].some(v=>[v.targetId,v.maskId,v.boneId].includes(id)))throw Error('Remove direct listeners and effects before releasing contours.');
 if(source.geometry.skin||p.animations.some(a=>a.tracks.some(t=>t.targetId===id)))throw Error('Remove skin and direct animation before releasing contours.');
 const candidate=clone(p),n=candidate.nodes.find(n=>n.id===id),parts=pathContours(n.geometry),base=clone(n.geometry);delete base.contours;delete base.fillRule;
 const oldOrder=n.order,created=[id];
 for(const other of candidate.nodes)if(other.parentId===n.parentId&&other.artboardId===n.artboardId&&other.order>oldOrder)other.order+=parts.length-1;
 parts.forEach((c,i)=>{const next={...clone(n),id:i?newId('node'):id,name:i?`${n.name} · contour ${i+1}`:n.name,order:oldOrder+i,geometry:{...clone(base),closed:c.closed,points:clone(c.points)}};if(i){candidate.nodes.push(next);created.push(next.id);}else Object.assign(n,next);});
 validateProject(candidate);p.nodes=candidate.nodes;return created;
}
