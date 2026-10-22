import {worldTransform,mapPoint,inverse,multiply} from '@evir/project-model';
import {components} from './geometry.mjs';
// Sequential chain solve following Rive's IKConstraint::solve2/constrain
// (7aa93402a27c800db8a36acc8672612c100ea9b1, MIT). Unit positive scales only.
// Pair steps update the constrained pair and tip explicitly, as in Rive;
// intermediate FK worlds remain snapshots until their own step. Strength mixes solved local
// rotations with the original FK pose after the complete solve.
export function solveChain(p,ik){
 if(ik.strength===0)return p;
 const chain=[];let bone=p.nodes.find(n=>n.id===ik.boneId);
 for(let i=0;i<ik.count;i++){chain.unshift(bone);bone=p.nodes.find(n=>n.id===bone.parentId);}
 const base=chain.map(n=>components(n.transform).rotation),target=mapPoint(worldTransform(p,ik.targetId),[0,0]),tip=chain.at(-1);
 const worlds=new Map(chain.map(n=>[n.id,worldTransform(p,n.id)]));
 const parentWorld=n=>worlds.get(n.parentId)??(n.parentId?worldTransform(p,n.parentId):[1,0,0,1,0,0]);
 const compose=n=>{const local=[...n.transform],parent=p.nodes.find(v=>v.id===n.parentId);if(parent?.kind==='bone'){local[4]=parent.geometry.length;local[5]=0;}worlds.set(n.id,multiply(parentWorld(n),local));};
 const rotate=(n,angle)=>{n.transform.splice(0,4,Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle));compose(n);};
 const origin=n=>mapPoint(worlds.get(n.id),[0,0]);
 const end=()=>mapPoint(worlds.get(tip.id),[tip.geometry.length,0]);
 const cosine=v=>Math.acos(Number.isNaN(v)?1:Math.max(-1,Math.min(1,v)));
 for(let i=0;i<chain.length-1;i++){
  const first=chain[i],second=chain[i+1],inv=inverse(parentWorld(first));
  const a=mapPoint(inv,origin(first)),c=mapPoint(inv,origin(second)),b=mapPoint(inv,end()),t=mapPoint(inv,target);
  const av=b.map((v,j)=>v-c[j]),bv=c.map((v,j)=>v-a[j]),cv=t.map((v,j)=>v-a[j]);
  const la=Math.hypot(...av),lb=Math.hypot(...bv),lc=Math.hypot(...cv);
  const A=cosine((-la*la+lb*lb+lc*lc)/(2*lb*lc)),C=cosine((la*la+lb*lb-lc*lc)/(2*la*lb));
  let correction=0;
  if(second!==tip){const parentInv=inverse(worlds.get(second.id)),v0=mapPoint(parentInv,origin(second)),v1=mapPoint(parentInv,end());correction=-Math.atan2(v1[1]-v0[1],v1[0]-v0[0]);}
  rotate(first,Math.atan2(cv[1],cv[0])+(ik.invert?-A:A));
  rotate(second,(ik.invert?Math.PI-C:C-Math.PI)+correction);
  if(second!==tip)compose(tip);
 }
 if(ik.strength!==1)chain.forEach((n,i)=>{let delta=(components(n.transform).rotation-base[i])%(2*Math.PI);if(delta>Math.PI)delta-=2*Math.PI;if(delta< -Math.PI)delta+=2*Math.PI;rotate(n,base[i]+delta*ik.strength);});
 return p;
}
