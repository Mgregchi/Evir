import paper from 'paper/dist/paper-core.js';
import {newId} from '@evir/project-model';
import {prepareCompound,commitCompound,COMPOUND_OPERATIONS} from './compound.mjs';
// Optional curve kernel: Studio loads this only in its cancellable worker.
export function booleanGeometry(shapes,operation){
 if(!COMPOUND_OPERATIONS.includes(operation))throw Error('Choose Union, Subtract, Intersect or Exclude.');
 if(!Array.isArray(shapes)||shapes.length<2||shapes.length>8||shapes.some(s=>!Array.isArray(s.contours)||!['nonzero','evenodd'].includes(s.fillRule)))throw Error('Use two to eight prepared shapes.');
 if(shapes.reduce((n,s)=>n+s.contours.reduce((v,c)=>v+c.points.length,0),0)>1024)throw Error('At most 1,024 input controls.');
 const scope=new paper.PaperScope();scope.setup([1,1]);
 try{
  const item=s=>new scope.CompoundPath({insert:false,fillRule:s.fillRule,children:s.contours.map(c=>new scope.Path({insert:false,closed:c.closed,segments:c.points.map(p=>new scope.Segment(p.anchor,p.in.map((v,i)=>v-p.anchor[i]),p.out.map((v,i)=>v-p.anchor[i])))}))});
  let result=item(shapes[0]);
  for(const s of shapes.slice(1)){const other=item(s),next=result[operation==='union'?'unite':operation](other,{insert:false});result.remove();other.remove();result=next;}
  result.reorient(true,true);
  const paths=result.className==='Path'?[result]:result.children;
  const contours=paths.filter(p=>p.segments.length>=3&&Math.abs(p.area)>1e-9).map(p=>({closed:true,points:p.segments.map(s=>({id:newId('point'),anchor:[s.point.x,s.point.y],in:[s.point.x+s.handleIn.x,s.point.y+s.handleIn.y],out:[s.point.x+s.handleOut.x,s.point.y+s.handleOut.y]}))}));
  if(contours.length>256||contours.reduce((n,c)=>n+c.points.length,0)>4096)throw Error('Result exceeds 256 contours or 4,096 controls. Simplify the inputs.');
  if(!contours.length)return null;
  const first=contours.shift();return {...first,...(contours.length?{contours}:{}),fillRule:'nonzero'};
 }finally{scope.project.remove();}
}
export function booleanPaths(p,ids,{operation='union'}={}){const plan=prepareCompound(p,ids);return commitCompound(p,ids,booleanGeometry(plan.shapes,operation));}
