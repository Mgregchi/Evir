export function validateWeightLocks(p,problem){
 const locks=p.editor?.weightLocks;if(locks===undefined)return;
 if(!p.advanced)problem('editor.weightLocks','weight locks require advanced editable source');
 if(!Array.isArray(locks)||locks.length>65536){problem('editor.weightLocks','expected at most 65,536 influence locks');return;}
 const nodes=new Map(p.nodes.map(n=>[n.id,n])),seen=new Set(),weightMaps=new Map();
 for(const lock of locks){
  if(!lock||typeof lock!=='object'||Array.isArray(lock)||Object.keys(lock).sort().join()!=='boneId,control,nodeId,pointId'){problem('editor.weightLocks','expected nodeId, pointId, control and boneId');continue;}
  const n=nodes.get(lock.nodeId),skin=n?.geometry?.skin;if(!weightMaps.has(lock.nodeId))weightMaps.set(lock.nodeId,new Map((Array.isArray(skin?.weights)?skin.weights:[]).map(w=>[w.pointId,w])));const entry=weightMaps.get(lock.nodeId).get(lock.pointId);
  if(!entry||!Array.isArray(skin.bones)||!skin.bones.some(b=>b.boneId===lock.boneId)||!['anchor',...(n?.kind==='path'?['in','out']:[])].includes(lock.control)){problem('editor.weightLocks','lock needs an existing skinned control and bound bone');continue;}
  const key=JSON.stringify([lock.nodeId,lock.pointId,lock.control,lock.boneId]);if(seen.has(key))problem('editor.weightLocks','duplicate influence lock');seen.add(key);
  const values=entry[lock.control];if(!Array.isArray(values)||values.some(pair=>!Array.isArray(pair)||!Number.isFinite(pair[1])||Math.abs(pair[1]*255-Math.round(pair[1]*255))>1e-8))problem('editor.weightLocks','locked controls require byte-quantized influences');
 }
}
