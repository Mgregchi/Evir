import {pathPoints} from '@evir/project-model';
import {worldPoints,controlMatrix,mapPoint} from '@evir/runtime/geometry';
import {transformResolver} from '@evir/project-model';
import {setSkinWeights} from '@evir/authoring';
export const WEIGHT_BRUSH_LIMIT=4096;
export function weightControls(p,n,mode='all'){
 const resolve=transformResolver(p);
 if(n.kind==='mesh')return n.geometry.vertices.map(v=>({pointId:v.id,control:'anchor',position:mapPoint(controlMatrix(p,n,v.id,'anchor',resolve),v.position)}));
 return worldPoints(p,n,resolve).flatMap(v=>(mode==='all'?['in','out','anchor']:[mode]).map(control=>({pointId:v.id,control,position:v[control]})));
}
export function segmentDistance(point,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((point[0]-a.x)*dx+(point[1]-a.y)*dy)/len)):0;
 return Math.hypot(point[0]-a.x-t*dx,point[1]-a.y-t*dy);
}
export class WeightBrush {
 constructor({source,pose=source,nodeId,boneId,control='all',target=1,strength=1,radius=36,zoom=1}){
  const n=source.nodes.find(n=>n.id===nodeId),visible=pose.nodes.find(n=>n.id===nodeId);
  if(!n?.geometry?.skin||!visible)throw Error('Choose a bound path or mesh');
  if(!['all','anchor','in','out'].includes(control)||![target,strength].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||!Number.isFinite(radius)||radius<8||radius>160||!Number.isFinite(zoom)||zoom<.1||zoom>4)throw Error('Review the weight brush settings');
  const count=n.kind==='mesh'?n.geometry.vertices.length:pathPoints(n.geometry).length*(control==='all'?3:1);
  if(count>WEIGHT_BRUSH_LIMIT)throw Error('Brush painting supports at most 4,096 displayed controls; use the numeric vertex editor for this layer');
  this.locks=new Map();for(const lock of source.editor?.weightLocks??[])if(lock.nodeId===nodeId){const key=lock.pointId+'/'+lock.control;if(!this.locks.has(key))this.locks.set(key,new Set());this.locks.get(key).add(lock.boneId);}
  this.controls=weightControls(pose,visible,n.kind==='mesh'?'anchor':control).filter(v=>!this.locks.get(v.pointId+'/'+v.control)?.has(boneId));
  if(this.controls.length>WEIGHT_BRUSH_LIMIT)throw Error('Brush painting supports at most 4,096 displayed controls; use the numeric vertex editor for this layer');
  this.nodeId=nodeId;this.boneId=boneId;this.target=target;this.strength=strength;this.radius=radius/zoom;
  this.base=structuredClone(n.geometry.skin.weights);this.entries=new Map(this.base.map(w=>[w.pointId,w]));this.influence=new Float64Array(this.controls.length);this.samples=0;this.previous=null;
  // Validate ownership, bone and single-bone normalization before a gesture.
  setSkinWeights(source,nodeId,[]);
  if(!n.geometry.skin.bones.some(b=>b.boneId===boneId))throw Error('Choose a bound bone');
  if(n.geometry.skin.bones.length===1&&target!==1)throw Error('A single bound bone must keep 100%; bind another bone to blend');
 }
 move(point){
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y))throw Error('Paint with finite stage coordinates');
  if(this.previous&&point.x===this.previous.x&&point.y===this.previous.y)return;
  if(++this.samples>2048)throw Error('That stroke was too long and was canceled. Use shorter strokes.');
  const previous=this.previous??point;
  this.controls.forEach((v,i)=>{
   const d=segmentDistance(v.position,previous,point)/this.radius;
   // Maximum footprint makes a swept segment independent of event frequency
   // and avoids repeated pressure/dwell accumulation at stationary samples.
   this.influence[i]=Math.max(this.influence[i],d<1?(1-d)*(1-d)*this.strength:0);
  });
  this.previous={...point};
 }
 apply(p){
  const n=p.nodes.find(n=>n.id===this.nodeId);n.geometry.skin.weights=structuredClone(this.base);
  const changes=[];
  this.controls.forEach((v,i)=>{if(!this.influence[i])return;const entry=this.entries.get(v.pointId)[v.control],old=entry.find(([b])=>b===this.boneId)?.[1]??0,locked=this.locks.get(v.pointId+'/'+v.control),remaining=1-entry.reduce((sum,[id,w])=>sum+(locked?.has(id)?w:0),0),target=Math.min(this.target,remaining);changes.push({...v,boneId:this.boneId,value:old+(target-old)*this.influence[i]});});
  setSkinWeights(p,this.nodeId,changes);return changes.length;
 }
}
