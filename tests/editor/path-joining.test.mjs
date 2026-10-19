import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, worldTransform, validateProject, defaultStroke, upgradeAdvanced, serializeProject, openProject } from '@evir/project-model';
import { addNode, joinPaths, planPathJoin, History, setKey, createAnimation, createMachine, bindPath } from '@evir/authoring';
import { compileProject, importRiv } from '@evir/format';
import { mapPoint } from '@evir/runtime/geometry';

function fixture(stroke=false) {
  const p=createProject(),parent=addNode(p,'group'),keep=addNode(p,'path',parent),other=addNode(p,'path',parent);
  p.nodes.find(n=>n.id===parent).transform=[0,2,-.5,0,300,70];
  for(const [id,offset]of[[keep,0],[other,90]]) {
    const n=p.nodes.find(n=>n.id===id);n.transform=[1,0,0,1,offset,0];n.geometry.closed=false;n.geometry.points=n.geometry.points.slice(0,3);
    if(stroke){upgradeAdvanced(p);n.geometry.fill=null;n.geometry.stroke={...defaultStroke(),width:5};}
  }
  validateProject(p);return {p,parent,keep,other};
}
const sample=(a,b,t)=>a.anchor.map((_,i)=>(1-t)**3*a.anchor[i]+3*(1-t)**2*t*a.out[i]+3*(1-t)*t*t*b.in[i]+t**3*b.anchor[i]);
function preservedSegments(before,after,id,skip=[]) {
  const n=before.nodes.find(n=>n.id===id),target=after.nodes.find(n=>n.id===after.nodes.find(n=>n.kind==='path').id);
  const m=worldTransform(before,id),world=worldTransform(after,target.id),points=target.geometry.points;
  for(let j=1;j<n.geometry.points.length;j++) {
    if(skip.includes(j))continue;const a=n.geometry.points[j-1],b=n.geometry.points[j];
    const ai=points.findIndex(p=>p.id===a.id),bi=points.findIndex(p=>p.id===b.id);assert.equal(Math.abs(ai-bi),1);
    for(const t of [0,.17,.5,.83,1]) {
      const expected=mapPoint(m,sample(a,b,t)),actual=mapPoint(world,ai<bi?sample(points[ai],points[bi],t):sample(points[bi],points[ai],1-t));
      actual.forEach((v,i)=>assert(Math.abs(v-expected[i])<1e-7));
    }
  }
}
test('All four endpoint pairings retain existing world-space cubic segments under affine parents',()=>{
  for(const keepEnd of ['first','last'])for(const otherEnd of ['first','last']) {
    const {p,keep,other}=fixture(),before=structuredClone(p),kept=p.nodes.find(n=>n.id===keep);
    const plan=planPathJoin(p,keep,other,{keepEnd,otherEnd});assert.deepEqual(p,before);assert.equal(plan.pointCount,6);
    assert.equal(joinPaths(p,keep,other,{keepEnd,otherEnd}),keep);
    assert.equal(p.nodes.length,before.nodes.length-1);assert.equal(p.nodes.find(n=>n.id===keep).name,kept.name);
    assert.deepEqual(p.nodes.find(n=>n.id===keep).transform,kept.transform);
    preservedSegments(before,p,keep);preservedSegments(before,p,other);validateProject(p);compileProject(p);
  }
});
test('Merge retains the chosen endpoint ID and only changes the attached donor segment',()=>{
  const {p,keep,other}=fixture(),before=structuredClone(p),a=p.nodes.find(n=>n.id===keep).geometry.points.at(-1),b=p.nodes.find(n=>n.id===other).geometry.points[0];
  const plan=planPathJoin(p,keep,other,{mode:'merge'});assert.equal(plan.removedPointId,b.id);assert.equal(plan.pointCount,5);
  joinPaths(p,keep,other,{mode:'merge'});const points=p.nodes.find(n=>n.id===keep).geometry.points;
  assert(!points.some(v=>v.id===b.id));assert.deepEqual(points.find(v=>v.id===a.id).anchor,a.anchor);
  assert.deepEqual(points.find(v=>v.id===a.id).out,b.out.map((v,i)=>v+a.anchor[i]-b.anchor[i]));
  preservedSegments(before,p,keep);preservedSegments(before,p,other,[1]);
});
test('Merging from either end retains the kept curves and every unattached donor segment',()=>{
  for(const keepEnd of ['first','last'])for(const otherEnd of ['first','last']) {
    const {p,keep,other}=fixture(),before=structuredClone(p),kept=p.nodes.find(n=>n.id===keep).geometry.points[keepEnd==='first'?0:2];
    const removed=p.nodes.find(n=>n.id===other).geometry.points[otherEnd==='first'?0:2].id;
    joinPaths(p,keep,other,{keepEnd,otherEnd,mode:'merge'});const points=p.nodes.find(n=>n.id===keep).geometry.points;
    assert.equal(points.length,5);assert(!points.some(v=>v.id===removed));assert.deepEqual(points.find(v=>v.id===kept.id).anchor,kept.anchor);
    preservedSegments(before,p,keep);preservedSegments(before,p,other,[otherEnd==='first'?1:2]);compileProject(p);
  }
});
test('Filled donor curves can bake a relative shear without moving their world-space segments',()=>{
  const f=fixture();f.p.nodes.find(n=>n.id===f.other).transform=[1,.4,.2,1,50,20];const before=structuredClone(f.p);
  joinPaths(f.p,f.keep,f.other);preservedSegments(before,f.p,f.other);compileProject(f.p);
});
test('Both methods produce one reversible history edit, source recovery and supported native exports',async()=>{
  for(const mode of ['bridge','merge']) {
    const {p,keep,other}=fixture(true),before=structuredClone(p),h=new History(p);
    h.transact('Join paths',q=>joinPaths(q,keep,other,{mode}));const after=h.committed();validateProject(after);
    const bytes=compileProject(after).bytes;assert(bytes.length>0);const imported=await importRiv(bytes);validateProject(imported);
    assert.deepEqual((await openProject(await serializeProject(after))).nodes,after.nodes);
    h.undo();assert.deepEqual(h.committed(),before);h.redo();assert.deepEqual(h.committed(),after);
  }
});
test('Unsafe topology, paint, ownership and references reject without any partial source mutation',()=>{
  const cases=[
    f=>f.p.nodes.find(n=>n.id===f.keep).geometry.closed=true,
    f=>f.p.nodes.find(n=>n.id===f.other).geometry.skin={bones:[],weights:[]},
    f=>f.p.editor.locked.push(f.parent),f=>f.p.editor.hidden.push(f.other),
    f=>f.p.nodes.find(n=>n.id===f.other).parentId=null,
    f=>{const id=addNode(f.p,'rectangle',f.parent);f.p.nodes.find(n=>n.id===id).order=1;f.p.nodes.find(n=>n.id===f.other).order=2;},
    f=>f.p.nodes.find(n=>n.id===f.other).geometry.fill='#ff0000',
    f=>f.p.nodes.find(n=>n.id===f.keep).geometry.fill={type:'linear'},
    f=>f.p.nodes.find(n=>n.id===f.other).transform=[0,0,0,1,0,0],
    f=>{const a=createAnimation(f.p,f.p.artboards[0].id);setKey(f.p,a,f.other,'x',0,20);},
    f=>{upgradeAdvanced(f.p);const mask=addNode(f.p,'rectangle');f.p.advanced.clips.push({targetId:f.other,maskId:mask,visible:true});},
    f=>{f.p.nodes.find(n=>n.id===f.other).geometry.points[0].id=f.p.nodes.find(n=>n.id===f.keep).geometry.points[0].id;},
  ];
  for(const change of cases){const f=fixture();change(f);const before=structuredClone(f.p);assert.throws(()=>joinPaths(f.p,f.keep,f.other));assert.deepEqual(f.p,before);}
  const f=fixture();assert.throws(()=>joinPaths(f.p,f.keep,f.keep),/different/);assert.throws(()=>joinPaths(f.p,f.keep,f.other,{keepEnd:'middle'}),/First or Last/);
});
test('Solid stroke width can be rebased across proportional scale; relative shear, dashes and trims reject',()=>{
  const f=fixture(true),other=f.p.nodes.find(n=>n.id===f.other);other.transform=[2,0,0,2,80,0];other.geometry.stroke.width=2.5;
  const before=structuredClone(f.p);joinPaths(f.p,f.keep,f.other);preservedSegments(before,f.p,f.other);compileProject(f.p);
  for(const change of [n=>n.transform=[1,.5,0,1,80,0],n=>n.geometry.stroke.dash=[8,8],n=>n.geometry.stroke.trim.end=.5,n=>n.geometry.stroke.width=20]) {
    const f=fixture(true),n=f.p.nodes.find(n=>n.id===f.other);change(n);const before=structuredClone(f.p);assert.throws(()=>joinPaths(f.p,f.keep,f.other));assert.deepEqual(f.p,before);
  }
});
test('Valid skin, listener, feather and IK contracts are preserved by rejecting an unsafe join',()=>{
  for(const configure of [
    f=>{const bone=addNode(f.p,'bone');bindPath(f.p,f.other,[bone]);},
    f=>{upgradeAdvanced(f.p);f.p.advanced.feathers.push({targetId:f.other,strength:4});},
    f=>{upgradeAdvanced(f.p);const bone=addNode(f.p,'bone');f.p.advanced.ik.push({boneId:bone,targetId:f.other,count:1,invert:false,strength:1});},
    f=>{createAnimation(f.p,f.p.artboards[0].id);const id=createMachine(f.p,f.p.artboards[0].id),m=f.p.machines.find(m=>m.id===id);m.inputs.push({id:'join-go',name:'Go',type:'trigger',value:false});m.listeners.push({id:'join-click',targetId:f.other,event:'click',inputId:'join-go',value:null});},
  ]) {
    const f=fixture();configure(f);validateProject(f.p);const before=structuredClone(f.p);
    assert.throws(()=>joinPaths(f.p,f.keep,f.other));assert.deepEqual(f.p,before);
  }
});
test('Shared parent animation stays intact; control-coordinate and topology budgets reject atomically',()=>{
  const f=fixture(),a=createAnimation(f.p,f.p.artboards[0].id);setKey(f.p,a,f.parent,'rotation',0,.2);
  const tracks=structuredClone(f.p.animations);joinPaths(f.p,f.keep,f.other);assert.deepEqual(f.p.animations,tracks);compileProject(f.p);
  const overflow=fixture();overflow.p.nodes.find(n=>n.id===overflow.other).transform[4]=2e6;const before=structuredClone(overflow.p);
  assert.throws(()=>joinPaths(overflow.p,overflow.keep,overflow.other),/1,000,000/);assert.deepEqual(overflow.p,before);
  const large=fixture();for(const id of [large.keep,large.other])large.p.nodes.find(n=>n.id===id).geometry.points=Array.from({length:2048},(_,i)=>({id:`${id}-p${i}`,anchor:[i,0],in:[i,0],out:[i,0]}));
  assert.equal(planPathJoin(large.p,large.keep,large.other).pointCount,4096);
  large.p.nodes.find(n=>n.id===large.other).geometry.points.push({id:'one-too-many',anchor:[2049,0],in:[2049,0],out:[2049,0]});
  assert.throws(()=>joinPaths(large.p,large.keep,large.other),/4,096/);
});
