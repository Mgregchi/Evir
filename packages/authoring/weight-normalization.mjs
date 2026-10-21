export function weightLockIndex(p,nodeId){
 const map=new Map();for(const lock of p.editor?.weightLocks??[])if(lock.nodeId===nodeId){const key=lock.pointId+'/'+lock.control;if(!map.has(key))map.set(key,new Set());map.get(key).add(lock.boneId);}return map;
}
// Allocate the residual byte budget without moving locked influences.
export function normalizedWeights(bones,raw,fixed=new Map()){
 const remaining=255-[...fixed.values()].reduce((a,b)=>a+b,0);if(remaining<0||remaining>255)throw Error('The requested weight exceeds the remainder after locked influences');
 const free=bones.filter(id=>!fixed.has(id)),sum=free.reduce((s,id)=>s+Math.max(0,raw.get(id)??0),0);
 if(!free.length&&remaining)throw Error('Unlock an influence before redistributing weights');
 const scaled=free.map(id=>(sum>0?Math.max(0,raw.get(id)??0)/sum:1/free.length)*remaining),bytes=scaled.map(Math.floor),ranks=free.map((_,i)=>i).sort((a,b)=>scaled[b]-bytes[b]-(scaled[a]-bytes[a])||a-b);
 for(let i=0,n=remaining-bytes.reduce((a,b)=>a+b,0);i<n;i++)bytes[ranks[i]]++;
 const result=new Map(fixed);free.forEach((id,i)=>result.set(id,bytes[i]));return bones.map(id=>[id,(result.get(id)??0)/255]);
}
export function fixedWeights(entry,control,locked){const old=new Map(entry[control]);return new Map([...(locked??[])].map(id=>[id,Math.round((old.get(id)??0)*255)]));}
