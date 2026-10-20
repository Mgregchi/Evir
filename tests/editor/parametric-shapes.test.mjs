import test from 'node:test';import assert from 'node:assert/strict';
import {createProject,validateProject,toRuntimeProject,SHAPES,shapeGeometry} from '@evir/project-model';
import {addShape,setShapeParameters,detachShape,History,bindSkin,addNode,insertPoint} from '@evir/authoring';
import {compileProject} from '@evir/format';
test('All live presets persist canonical controls, resize, detach and omit editing definitions from runtime snapshots',()=>{
 for(const {id:type}of SHAPES){const p=createProject(),id=addShape(p,type,{parametric:true});assert.equal(p.schemaVersion,3);assert.equal(p.nodes[0].geometry.shape.type,type);const before=p.nodes[0].geometry.points?.map(v=>v.id);setShapeParameters(p,id,{width:180});validateProject(p);if(before)assert.deepEqual(p.nodes[0].geometry.points.map(v=>v.id),before);assert.equal(p.nodes[0].geometry.shape.options.width,180);assert.equal(toRuntimeProject(p).nodes[0].geometry.shape,undefined);const bytes=compileProject(p).bytes;detachShape(p,id);validateProject(p);assert.equal(p.nodes[0].kind,'path');assert.equal(p.nodes[0].geometry.shape,undefined);assert(compileProject(p).bytes.length>0);}
});
test('Live shape constraints reject stale geometry and invalid edits atomically while preserving paint and history',()=>{
 const p=createProject(),id=addShape(p,'rounded',{parametric:true,width:100,height:100,radius:40});p.nodes[0].geometry.fill={type:'linear',start:[0,0],end:[100,100],stops:[{position:0,color:'#89e4c4'},{position:1,color:'#edb75f'}]};validateProject(p);const h=new History(p);h.transact('Resize',q=>setShapeParameters(q,id,{width:40}));assert.equal(h.snapshot().nodes[0].geometry.shape.options.radius,20);assert.deepEqual(h.snapshot().nodes[0].geometry.fill,p.nodes[0].geometry.fill);h.undo();assert.deepEqual(h.snapshot(),p);
 const before=structuredClone(p);assert.throws(()=>setShapeParameters(p,id,{radius:200}));assert.deepEqual(p,before);assert.throws(()=>setShapeParameters(p,id,{unknown:1}));assert.deepEqual(p,before);assert.throws(()=>insertPoint(p,id,0));assert.deepEqual(p,before);p.nodes[0].geometry.points[0].anchor[0]+=1;assert.throws(()=>validateProject(p),/differ from parameters/);
});
test('Point-count changes need explicit unbinding; fixed topology can preserve skin weights and stable IDs',()=>{
 const p=createProject(),id=addShape(p,'star',{parametric:true}),bone=addNode(p,'bone');bindSkin(p,id,[bone]);const before=structuredClone(p);assert.throws(()=>setShapeParameters(p,id,{sides:8}),/Unbind/);assert.deepEqual(p,before);setShapeParameters(p,id,{inner:60});validateProject(p);assert.deepEqual(p.nodes[0].geometry.skin,before.nodes[0].geometry.skin);
});

test('Live definitions require source v3 and refuse runtime schemas',()=>{const p=createProject();addShape(p,'circle',{parametric:true});delete p.advanced;p.schemaVersion=2;assert.throws(()=>validateProject(p),/advanced source/);});
