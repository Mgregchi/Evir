import {removeSubtree,reparent,setKey,addShape,setShapeParameters,detachShape,combinePaths,releaseCompound,joinPaths} from '@evir/authoring';
import {upgradeAdvanced} from '@evir/project-model';
import {object,fail,text} from './validation.mjs';
export const commandNames=['create_node','update_node','remove_node','reparent_node','create_animation','set_key','set_playback','create_machine','create_shape','set_shape_parameters','detach_shape','combine_paths','release_compound','join_paths'];
function node(p,id,board){const n=p.nodes.find(n=>n.id===id&&n.artboardId===board);if(!n)fail('MISSING_TARGET','Node is outside this artboard or absent');return n;}
function writable(p,n){for(let v=n;v;v=p.nodes.find(n=>n.id===v.parentId))if(p.editor.locked.includes(v.id))fail('LOCKED','A target or ancestor is locked');}
export function applyCommands(p,commands,board){
  if(!Array.isArray(commands)||commands.length<1||commands.length>64)fail('INVALID_ARGUMENT','Patch needs 1–64 commands');
  const changed=new Set();
  for(const c of commands){
    object(c,['op'],['node','nodeId','changes','parentId','animation','animationId','property','frame','value','easing','playback','machine','preset','options','nodeIds','fillRule','otherId']);
    const requireShape=(keys)=>object(c,['op',...keys]);
    const animation=id=>{const a=p.animations.find(a=>a.id===id&&a.artboardId===board);if(!a)fail('MISSING_TARGET','Animation is outside this artboard or absent');return a;};
    if(c.op==='create_node'){
      requireShape(['node']);if(c.node?.artboardId!==board)fail('SCOPE','Node must belong to the paired artboard');
      if(c.node.parentId!==null)writable(p,node(p,c.node.parentId,board));
      text(c.node.name,'Node name',160);if(c.node.geometry?.stroke||c.node.geometry?.shape||c.node.geometry?.contours||c.node.geometry?.fillRule)upgradeAdvanced(p);p.nodes.push(structuredClone(c.node));changed.add(c.node.id);
    }else if(c.op==='update_node'){
      requireShape(['nodeId','changes']);const n=node(p,c.nodeId,board);writable(p,n);object(c.changes,[],['name','transform','geometry']);
      if(!Object.keys(c.changes).length)fail('INVALID_ARGUMENT','Node changes are empty');
      if('name'in c.changes)text(c.changes.name,'Node name',160);
      Object.assign(n,structuredClone(c.changes));if(n.geometry?.stroke||n.geometry?.shape||n.geometry?.contours||n.geometry?.fillRule)upgradeAdvanced(p);changed.add(n.id);
    }else if(c.op==='remove_node'){
      requireShape(['nodeId']);const n=node(p,c.nodeId,board);writable(p,n);
      const descendants=new Set([n.id]);for(let size=-1;size!==descendants.size;){size=descendants.size;for(const v of p.nodes)if(descendants.has(v.parentId)){writable(p,v);descendants.add(v.id);}}
      removeSubtree(p,n.id);for(const id of descendants)changed.add(id);
    }else if(c.op==='reparent_node'){
      requireShape(['nodeId','parentId']);const n=node(p,c.nodeId,board);writable(p,n);if(c.parentId!==null)writable(p,node(p,c.parentId,board));reparent(p,n.id,c.parentId);changed.add(n.id);
    }else if(c.op==='create_animation'){
      requireShape(['animation']);if(c.animation?.artboardId!==board)fail('SCOPE','Animation must belong to the paired artboard');
      for(const t of c.animation.tracks||[])writable(p,node(p,t.targetId,board));p.animations.push(structuredClone(c.animation));changed.add(c.animation.id);
    }else if(c.op==='set_key'){
      requireShape(['animationId','nodeId','property','frame','value','easing']);animation(c.animationId);writable(p,node(p,c.nodeId,board));setKey(p,c.animationId,c.nodeId,c.property,c.frame,c.value,c.easing);changed.add(c.animationId);changed.add(c.nodeId);
    }else if(c.op==='set_playback'){
      requireShape(['animationId','playback']);const a=animation(c.animationId);delete a.loop;a.playback=structuredClone(c.playback);changed.add(a.id);
    }else if(c.op==='create_machine'){
      requireShape(['machine']);if(c.machine?.artboardId!==board)fail('SCOPE','Machine must belong to the paired artboard');
      if(c.machine.states?.some(s=>s.blend)||c.machine.transitions?.some(t=>'durationMs'in t||'exitTimeMs'in t))upgradeAdvanced(p);
      p.machines.push(structuredClone(c.machine));changed.add(c.machine.id);
    }else if(c.op==='create_shape'){
      requireShape(['nodeId','preset','options']);text(c.nodeId,'Shape ID');object(c.options,[],['parentId','name','x','y','width','height','radius','sides','inner','fill','strokeWidth','parametric']);
      if(c.options.name!==undefined)text(c.options.name,'Shape name',160);
      if(c.options.parentId!==undefined&&c.options.parentId!==null)writable(p,node(p,c.options.parentId,board));
      const generated=addShape(p,c.preset,{...c.options,artboardId:board}),n=node(p,generated,board);n.id=c.nodeId;changed.add(n.id);
    }else if(c.op==='set_shape_parameters'){
      requireShape(['nodeId','changes']);writable(p,node(p,c.nodeId,board));setShapeParameters(p,c.nodeId,c.changes);changed.add(c.nodeId);
    }else if(c.op==='detach_shape'){
      requireShape(['nodeId']);writable(p,node(p,c.nodeId,board));detachShape(p,c.nodeId);changed.add(c.nodeId);
    }else if(c.op==='combine_paths'){
      requireShape(['nodeIds','fillRule']);if(!Array.isArray(c.nodeIds)||c.nodeIds.length<2||c.nodeIds.length>8)fail('INVALID_ARGUMENT','Choose 2–8 path IDs');
      for(const id of c.nodeIds)writable(p,node(p,id,board));combinePaths(p,c.nodeIds,{fillRule:c.fillRule});for(const id of c.nodeIds)changed.add(id);
    }else if(c.op==='release_compound'){
      requireShape(['nodeId']);writable(p,node(p,c.nodeId,board));for(const id of releaseCompound(p,c.nodeId))changed.add(id);
    }else if(c.op==='join_paths'){
      requireShape(['nodeId','otherId','options']);writable(p,node(p,c.nodeId,board));writable(p,node(p,c.otherId,board));object(c.options,[],['keepEnd','otherEnd','mode']);joinPaths(p,c.nodeId,c.otherId,c.options);changed.add(c.nodeId);changed.add(c.otherId);
    }else fail('UNSUPPORTED_COMMAND',`Unsupported command ${c.op}`);
  }
  return [...changed];
}
