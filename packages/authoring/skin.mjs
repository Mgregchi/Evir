import {worldTransform,inverse,upgradeAdvanced} from '@evir/project-model';
import {quantize} from '@evir/runtime/geometry';
const controls=['anchor','in','out'];
function skinNode(p,id){
 const nodes=new Map(p.nodes.map(n=>[n.id,n])),n=nodes.get(id);
 if(!n||!['path','mesh'].includes(n.kind))throw Error('Choose a vector path or textured mesh');
 for(let current=n;current;current=nodes.get(current.parentId))
  if(p.editor?.locked.includes(current.id)||p.editor?.hidden.includes(current.id))throw Error('Unlock and show this layer and its parents before editing weights');
 return n;
}
export function bindSkin(p,nodeId,boneIds){
 const n=skinNode(p,nodeId);
 if(!Array.isArray(boneIds)||!boneIds.length||boneIds.length>4||new Set(boneIds).size!==boneIds.length)throw Error('Choose one to four different bones');
 if(n.geometry.stroke)throw Error('Skinned strokes are outside the current rendering contract');
 const bindWorld=worldTransform(p,nodeId);inverse(bindWorld);
 const bones=boneIds.map(boneId=>{const bone=p.nodes.find(v=>v.id===boneId);if(bone?.kind!=='bone'||bone.artboardId!==n.artboardId)throw Error('Choose bones in the same artboard');const bind=worldTransform(p,boneId);inverse(bind);return{boneId,bind};});
 const weights=quantize(boneIds.map(b=>[b,1/boneIds.length]));
 const skin={bindWorld,bones,weights:(n.kind==='path'?n.geometry.points:n.geometry.vertices).map(v=>({pointId:v.id,...Object.fromEntries(controls.map(c=>[c,structuredClone(weights)]))}))};
 if(n.kind==='mesh'||typeof n.geometry.fill!=='string')upgradeAdvanced(p);
 n.geometry.skin=skin;
}
export function setSkinWeights(p,nodeId,changes){
 const n=skinNode(p,nodeId),skin=n.geometry.skin;
 if(!skin)throw Error('Bind bones before editing weights');
 if(!Array.isArray(changes)||changes.length>12288)throw Error('Use at most 12,288 control assignments per edit');
 const bones=skin.bones.map(b=>b.boneId),entries=new Map(skin.weights.map(w=>[w.pointId,w])),plans=new Map();
 for(const {pointId,control='anchor',boneId,value} of changes){
  const entry=entries.get(pointId);
  if(!entry||!bones.includes(boneId)||!controls.includes(control)||(n.kind==='mesh'&&control!=='anchor'))throw Error('Choose an existing vertex, supported control and bound bone');
  if(!Number.isFinite(value)||value<0||value>1)throw Error('Weight must be between 0 and 1');
  if(bones.length===1&&value!==1)throw Error('A single bound bone must keep 100%; bind another bone to blend');
  const key=pointId+'/'+control;if(plans.has(key))throw Error('Assign each vertex control once per edit');
  const old=new Map(entry[control]),sum=bones.reduce((s,b)=>s+(b===boneId?0:old.get(b)??0),0);
  const weights=quantize(bones.map(b=>[b,b===boneId?value:(1-value)*(sum>0?(old.get(b)??0)/sum:1/(bones.length-1))]));
  plans.set(key,{entry,control,weights});
 }
 for(const {entry,control,weights}of plans.values()){
  entry[control]=weights;
  if(n.kind==='mesh'){entry.in=structuredClone(weights);entry.out=structuredClone(weights);}
 }
}
