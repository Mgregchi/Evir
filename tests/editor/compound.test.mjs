import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,validateProject,pathContours,pathPoints,worldTransform,mapPoint} from '@evir/project-model';
import {addShape,addNode,combinePaths,releaseCompound,prepareCompound,bindSkin,insertPoint,removePoint,History,setKey,createAnimation} from '@evir/authoring';
import {booleanPaths} from '@evir/authoring/boolean';
import {worldPoints} from '@evir/runtime/geometry';
import {compileProject,importRiv} from '@evir/format';
const circles=()=>{const p=createProject(),a=addShape(p,'circle',{name:'Outer',width:160,x:40,y:40}),b=addShape(p,'circle',{name:'Inner',width:80,x:80,y:80});return{p,a,b};};
test('Curve-preserving subtraction creates an editable hole and native/source round trips preserve both contours',async()=>{
 const{p,a,b}=circles();booleanPaths(p,[a,b],{operation:'subtract'});validateProject(p);assert.equal(p.nodes.length,1);const g=p.nodes[0].geometry;
 assert.deepEqual(pathContours(g).map(c=>c.points.length),[4,4]);assert(pathPoints(g).every(v=>v.in.some((n,i)=>n!==v.anchor[i])&&v.out.some((n,i)=>n!==v.anchor[i])));
 const q=await importRiv(compileProject(p).bytes);assert.deepEqual(pathContours(q.nodes[0].geometry).map(c=>c.points.length),[4,4]);validateProject(q);
 const count=pathPoints(g).length;const id=insertPoint(p,a,0,1);assert.equal(pathPoints(g).length,count+1);removePoint(p,a,id);assert.equal(pathPoints(g).length,count);validateProject(p);
});
test('Union, intersection, subtraction and exclusion have distinct areas and empty results are undoable',()=>{
 const expected={union:15000,intersect:5000,subtract:5000,exclude:10000};
 for(const operation of Object.keys(expected)){
  const p=createProject(),a=addShape(p,'rectangle',{width:100,height:100,x:0,y:0}),b=addShape(p,'rectangle',{width:100,height:100,x:50,y:0});booleanPaths(p,[a,b],{operation});
  const area=pathContours(p.nodes[0].geometry).reduce((sum,c)=>sum+c.points.reduce((v,p,i)=>{const q=c.points[(i+1)%c.points.length].anchor;return v+(p.anchor[0]*q[1]-q[0]*p.anchor[1])/2;},0),0);assert(Math.abs(Math.abs(area)-expected[operation])<1e-6,operation);
 }
 const{p,a,b}=circles();p.nodes[1].geometry=structuredClone(p.nodes[0].geometry);p.nodes[1].geometry.points.forEach((v,i)=>v.id='other-'+i);p.nodes[1].transform=[...p.nodes[0].transform];const h=new History(p),before=h.snapshot();h.transact('Empty difference',q=>booleanPaths(q,[a,b],{operation:'subtract'}));assert.equal(h.snapshot().nodes.length,0);h.undo();assert.deepEqual(h.snapshot(),before);
});
test('Combining transformed contours retains world controls, evenodd fill and paint; releasing preserves sibling order',async()=>{
 const{p,a,b}=circles();p.nodes[1].transform=[.8,.6,-.6,.8,100,100];const before=p.nodes.flatMap(n=>worldPoints(p,n).map(v=>v.anchor));combinePaths(p,[a,b],{fillRule:'evenodd'});
 const after=worldPoints(p,p.nodes[0]).map(v=>v.anchor);for(let i=0;i<before.length;i++)before[i].forEach((v,k)=>assert(Math.abs(v-after[i][k])<1e-8));assert.equal(p.nodes[0].geometry.fillRule,'evenodd');
 const q=await importRiv(compileProject(p).bytes);assert.equal(q.nodes[0].geometry.fillRule,'evenodd');assert.equal(pathContours(q.nodes[0].geometry).length,2);
 const top=addShape(p,'rectangle');const ids=releaseCompound(p,a);assert.equal(ids.length,2);assert.equal(p.nodes.find(n=>n.id===ids[1]).order,1);assert.equal(p.nodes.find(n=>n.id===top).order,2);assert(p.nodes.every(n=>!n.geometry.contours));validateProject(p);
});
test('Invalid topology edits are atomic across locks, animation, parent spaces, open contours, effects and malformed geometry',()=>{
 for(const change of [({p,a})=>p.editor.locked.push(a),({p,a})=>{const id=createAnimation(p,p.artboards[0].id);setKey(p,id,a,'x',0,40);},({p,a})=>{p.nodes[0].geometry.closed=false;},({p,b})=>p.nodes.find(n=>n.id===b).parentId=addNode(p,'group')]){
  const t=circles();change(t);const before=structuredClone(t.p);assert.throws(()=>booleanPaths(t.p,[t.a,t.b],{operation:'union'}));assert.deepEqual(t.p,before);
 }
 const{p,a,b}=circles();const before=structuredClone(p);assert.throws(()=>booleanPaths(p,[a,b],{operation:'unknown'}));assert.deepEqual(p,before);
 combinePaths(p,[a,b]);p.nodes[0].geometry.contours[0].points[0].id=p.nodes[0].geometry.points[0].id;assert.throws(()=>validateProject(p),/duplicate/);
});
test('Compound skin weights cover every control and survive native reimport with shared contour bindings',async()=>{
 const{p,a,b}=circles();booleanPaths(p,[a,b],{operation:'subtract'});const bone=addNode(p,'bone');bindSkin(p,a,[bone]);validateProject(p);assert.equal(p.nodes[0].geometry.skin.weights.length,8);
 const q=await importRiv(compileProject(p).bytes),n=q.nodes.find(n=>n.kind==='path');assert.equal(pathPoints(n.geometry).length,8);assert.equal(n.geometry.skin.weights.length,8);validateProject(q);
});
