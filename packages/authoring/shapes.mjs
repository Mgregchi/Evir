import {newId,ProjectError,validateProject,upgradeAdvanced,shapeGeometry,SHAPES,canonicalShape,pathPoints} from '@evir/project-model';
export {SHAPES,shapeGeometry} from '@evir/project-model';
const fail=message=>{throw new ProjectError(['shape: '+message]);};

export function addShape(project,preset,options={}){
  const {kind,width,height,geometry}=shapeGeometry(preset,options),parentId=options.parentId??null;
  const parent=project.nodes.find(n=>n.id===parentId);
  if(parentId&&(!parent||!['group','bone'].includes(parent.kind)))fail('Choose a group or bone parent');
  const artboardId=parent?.artboardId??options.artboardId??project.artboards[0].id,
    artboard=project.artboards.find(a=>a.id===artboardId);
  if(!artboard)fail('Missing artboard');
  if(parent&&options.artboardId&&options.artboardId!==parent.artboardId)fail('Parent belongs to another artboard');
  for(let n=parent;n;n=project.nodes.find(p=>p.id===n.parentId))
    if(project.editor.locked.includes(n.id))fail('The parent or its ancestor is locked');
  const x=options.x??(parent?25:(artboard.width-width)/2),y=options.y??(parent?25:(artboard.height-height)/2);
  if(!Number.isFinite(x)||!Number.isFinite(y))fail('Position must be finite');
  if(options.parametric!==undefined&&typeof options.parametric!=='boolean')fail('Parametric must be true or false');
  if(options.parametric)geometry.shape=canonicalShape(preset,options).definition;
  const node={id:newId('node'),name:options.name??SHAPES.find(s=>s.id===preset).name,kind,artboardId,parentId,
    order:Math.max(-1,...project.nodes.filter(n=>n.artboardId===artboardId&&n.parentId===parentId).map(n=>n.order))+1,
    transform:[1,0,0,1,x,y],geometry};
  const candidate={...project,nodes:[...project.nodes,node]};
  if(geometry.stroke||geometry.shape)upgradeAdvanced(candidate);
  validateProject(candidate);
  project.nodes.push(node);
  if(geometry.stroke||geometry.shape)upgradeAdvanced(project);
  return node.id;
}

export function setShapeParameters(p,id,changes){
 const n=p.nodes.find(n=>n.id===id);if(!n?.geometry?.shape)fail('Select a live shape');
 for(let a=n;a;a=p.nodes.find(v=>v.id===a.parentId))if(p.editor.locked.includes(a.id))fail('Unlock the shape and its parents');
 const {type,options}=n.geometry.shape;
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).some(k=>!Object.hasOwn(options,k)))fail('Choose supported shape parameters');
 const next={...options,...changes};
 if('radius'in next&&!('radius'in changes))next.radius=Math.min(next.radius,Math.min(next.width,(type==='bubble'?.76:1)*next.height)/2);
 const generated=canonicalShape(type,next),geometry={...generated.geometry,fill:structuredClone(n.geometry.fill),...(generated.kind==='path'?{skin:n.geometry.skin??null}:{}),shape:generated.definition};
 if(n.geometry.stroke)geometry.stroke=structuredClone(n.geometry.stroke);
 if(n.geometry.fillRule)geometry.fillRule=n.geometry.fillRule;
 if(n.kind==='path'){
  if(n.geometry.skin&&geometry.points.length!==n.geometry.points.length)fail('Unbind skin before changing the number of points');
  if(geometry.points.length===n.geometry.points.length)geometry.points.forEach((v,i)=>v.id=n.geometry.points[i].id);
 }
 const candidate={...p,nodes:p.nodes.map(v=>v.id===id?{...n,geometry}:v)};validateProject(candidate);p.nodes=candidate.nodes;return id;
}
export function detachShape(p,id){
 const n=p.nodes.find(n=>n.id===id);if(!n?.geometry?.shape)fail('Select a live shape');
 for(let a=n;a;a=p.nodes.find(v=>v.id===a.parentId))if(p.editor.locked.includes(a.id))fail('Unlock the shape and its parents');
 const geometry=structuredClone(n.geometry);delete geometry.shape;
 if(n.kind==='rectangle'){
  if(p.animations.some(a=>a.tracks.some(t=>t.targetId===id&&['width','height'].includes(t.property))))fail('Remove rectangle size keys before converting to a free path');
  const {width:w,height:h}=geometry;delete geometry.width;delete geometry.height;
  Object.assign(geometry,{closed:true,skin:null,points:[[0,0],[w,0],[w,h],[0,h]].map(anchor=>({id:newId('point'),anchor,in:[...anchor],out:[...anchor]}))});
 }
 const candidate={...p,nodes:p.nodes.map(v=>v.id===id?{...n,kind:'path',geometry}:v)};validateProject(candidate);p.nodes=candidate.nodes;return id;
}
