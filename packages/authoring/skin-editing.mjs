import{validateProject,upgradeAdvanced,pathPoints,pathContours,mapPoint}from'@evir/project-model';
import{quantize}from'@evir/runtime/geometry';import{skinNode}from'./skin.mjs';import{weightLockIndex,normalizedWeights,fixedWeights}from'./weight-normalization.mjs';
const clone=v=>structuredClone(v),keys=n=>n.kind==='mesh'?['anchor']:['anchor','in','out'];
function context(p,id){const n=skinNode(p,id),skin=n.geometry.skin;if(!skin)throw Error('Bind bones before using weight tools');if(skin.bones.length>4)throw Error('Weight tools need at most four bound bones; rebind an explicit subset first');return{n,skin,points:n.kind==='mesh'?n.geometry.vertices:pathPoints(n.geometry),bones:skin.bones.map(b=>b.boneId),locks:weightLockIndex(p,id)};}
function commit(p,n,skin,editor=p.editor,advanced=false){const candidate={...p,editor,nodes:p.nodes.map(v=>v.id===n.id?{...n,geometry:{...n.geometry,skin}}:v)};if(advanced)upgradeAdvanced(candidate);validateProject(candidate);p.nodes=candidate.nodes;p.editor=candidate.editor;p.schemaVersion=candidate.schemaVersion;if(candidate.advanced)p.advanced=candidate.advanced;return n.id;}
export function setSkinLocks(p,nodeId,changes){
 const{n,skin,bones}=context(p,nodeId);if(!Array.isArray(changes)||changes.length>12288)throw Error('Use at most 12,288 lock assignments per edit');
 const selectedPoints=new Set(changes.map(c=>c?.pointId)),next={...skin,weights:skin.weights.map(w=>selectedPoints.has(w.pointId)?clone(w):w)},entries=new Map(next.weights.map(w=>[w.pointId,w])),locks=new Map((p.editor.weightLocks??[]).map(l=>[JSON.stringify([l.nodeId,l.pointId,l.control,l.boneId]),l]));
 for(const change of changes){if(!change||typeof change!=='object'||Object.keys(change).sort().join()!=='boneId,control,locked,pointId')throw Error('Choose pointId, control, boneId and locked');const{pointId,control,boneId,locked}=change,entry=entries.get(pointId);if(!entry||!keys(n).includes(control)||!bones.includes(boneId)||typeof locked!=='boolean')throw Error('Choose an existing control, bound bone and lock state');const id=JSON.stringify([nodeId,pointId,control,boneId]);if(locked){entry[control]=quantize(entry[control]);if(n.kind==='mesh'){entry.in=clone(entry.anchor);entry.out=clone(entry.anchor);}locks.set(id,{nodeId,pointId,control,boneId});}else locks.delete(id);}
 const editor={...p.editor};if(locks.size)editor.weightLocks=[...locks.values()];else delete editor.weightLocks;return commit(p,n,next,editor,true);
}
function selection(points,ids){if(ids===undefined||Array.isArray(ids)&&!ids.length)return new Set(points.map(v=>v.id));if(!Array.isArray(ids)||ids.length>4096||new Set(ids).size!==ids.length)throw Error('Choose at most 4,096 distinct point IDs');const available=new Set(points.map(v=>v.id));if(ids.some(id=>!available.has(id)))throw Error('A selected control is absent from the skin');return new Set(ids);}
function options(n,points,{pointIds,control='all'}={}){const selected=selection(points,pointIds);if(selected.size>4096)throw Error('Choose a subset of at most 4,096 vertices for this weight operation');if(!['all',...keys(n)].includes(control))throw Error('Choose supported weight controls');return{selected,controls:control==='all'?keys(n):[control]};}
const segmentDistance=(p,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],length=x*x+y*y,t=length?Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/length)):0;return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);};
export function autoSkinWeights(p,nodeId,settings={}){
 const{n,skin,points,bones,locks}=context(p,nodeId),{selected,controls}=options(n,points,settings),{blend=.35,influences=Math.min(2,bones.length)}=settings;
 if(!Number.isFinite(blend)||blend<0||blend>1||!Number.isInteger(influences)||influences<1||influences>bones.length)throw Error('Blend must be 0–1 and influences 1 to the number of bound bones');
 const segments=skin.bones.map(b=>{const bone=p.nodes.find(v=>v.id===b.boneId);return{id:b.boneId,a:mapPoint(b.bind,[0,0]),b:mapPoint(b.bind,[bone.geometry.length,0])};});const radius=Math.max(1,segments.reduce((sum,s)=>sum+Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),0)/segments.length)*blend;
 if(segments.some(s=>[...s.a,...s.b].some(v=>!Number.isFinite(v)))||!Number.isFinite(radius*radius))throw Error('Weight bind segments must remain finite');
 const positions=new Map(points.map(v=>[v.id,v])),next={...skin,weights:skin.weights.map(w=>selected.has(w.pointId)?clone(w):w)};
 for(const entry of next.weights)if(selected.has(entry.pointId))for(const control of controls){
  const point=positions.get(entry.pointId),position=mapPoint(skin.bindWorld,n.kind==='mesh'?point.position:point[control]),fixed=fixedWeights(entry,control,locks.get(entry.pointId+'/'+control)),active=[...fixed.values()].filter(v=>v>0).length;
  if(position.some(v=>!Number.isFinite(v)))throw Error('Weight bind controls must remain finite');
  if(active>influences)throw Error('Unlock influences before reducing their maximum count');
  const ranked=segments.filter(s=>!fixed.has(s.id)).map((s,i)=>({...s,distance:segmentDistance(position,s.a,s.b),order:i})).sort((a,b)=>a.distance-b.distance||a.order-b.order),available=(blend===0?Math.min(1,influences-active):influences-active),raw=new Map();
  if(ranked.some(s=>!Number.isFinite(s.distance)))throw Error('Weight distances must remain finite');
  if(255-[...fixed.values()].reduce((a,b)=>a+b,0)>0&&(!available||!ranked.length))throw Error('Unlock an influence or increase the influence count to distribute the remainder');
  // Relative inverse-square scores avoid underflow to zero for distant controls.
  const chosen=ranked.slice(0,available),base=chosen.length?Math.max(1e-6,Math.hypot(chosen[0].distance,radius)):1;
  for(const s of chosen)raw.set(s.id,blend===0?1:(base/Math.max(1e-6,Math.hypot(s.distance,radius)))**2);
  entry[control]=normalizedWeights(bones,raw,fixed);if(n.kind==='mesh'){entry.in=clone(entry.anchor);entry.out=clone(entry.anchor);}
 }
 return commit(p,n,next);
}
export function smoothSkinWeights(p,nodeId,settings={}){
 const{n,skin,points,bones,locks}=context(p,nodeId),{selected,controls}=options(n,points,settings),{strength=.5,iterations=1}=settings;
 if(!Number.isFinite(strength)||strength<0||strength>1||!Number.isInteger(iterations)||iterations<1||iterations>10)throw Error('Smoothing strength must be 0–1 and iterations 1–10');
 const adjacent=new Map(points.map(v=>[v.id,new Set()])),connect=(a,b)=>{if(a!==b){adjacent.get(a).add(b);adjacent.get(b).add(a);}};
 if(n.kind==='mesh'){for(let i=0;i<n.geometry.triangles.length;i+=3){const ids=n.geometry.triangles.slice(i,i+3).map(v=>points[v].id);connect(ids[0],ids[1]);connect(ids[1],ids[2]);connect(ids[2],ids[0]);}}
 else for(const contour of pathContours(n.geometry)){for(let i=1;i<contour.points.length;i++)connect(contour.points[i-1].id,contour.points[i].id);if(contour.closed)connect(contour.points.at(-1).id,contour.points[0].id);}
 if(strength===0)return n.id;
 let next={...skin,weights:skin.weights};
 for(let i=0;i<iterations;i++){const before=new Map(next.weights.map(w=>[w.pointId,w])),cache=new Map(),values=(pointId,control)=>{const key=pointId+'/'+control;if(!cache.has(key))cache.set(key,new Map(before.get(pointId)[control]));return cache.get(key);};next={...next,weights:next.weights.map(entry=>{if(!selected.has(entry.pointId))return entry;const result=clone(entry),neighbors=[entry.pointId,...adjacent.get(entry.pointId)];for(const control of controls){const old=new Map(entry[control]),raw=new Map(bones.map(id=>[id,(1-strength)*(old.get(id)??0)+strength*neighbors.reduce((sum,pointId)=>sum+(values(pointId,control).get(id)??0),0)/neighbors.length]));result[control]=normalizedWeights(bones,raw,fixedWeights(entry,control,locks.get(entry.pointId+'/'+control)));}if(n.kind==='mesh'){result.in=clone(result.anchor);result.out=clone(result.anchor);}return result;})};}
 return commit(p,n,next);
}
