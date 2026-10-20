import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stableImport} from '../../tools/stabilize-import.mjs';
import {geometryCases,importedCases} from '../fixtures/import-geometry.mjs';
import {encodeRecords} from '../fixtures/riv-records.mjs';
import {importRiv,compileProject,readRiv} from '@evir/format';
import {validateProject,toRuntimeProject,validateRuntimeProject} from '@evir/project-model';
import {evaluate} from '@evir/runtime';
import {History} from '@evir/authoring';
const close=(actual,expected,tolerance=1e-5)=>{assert.equal(actual.length,expected.length);actual.forEach((v,i)=>assert(Math.abs(v-expected[i])<tolerance,`${actual} != ${expected}`));};
test('mixed native vertex representations preserve ordered anchors and actual handle directions',async()=>{
 const p=await importRiv(geometryCases()[0].bytes),points=p.nodes[0].geometry.points;
 assert.equal(points.length,4);close(points[0].anchor,[45,65]);close(points[0].in,[45,65]);close(points[0].out,[45,65]);
 close(points[1].in,[158-Math.cos(.3)*30,60-Math.sin(.3)*30]);close(points[1].out,[158+Math.cos(.3)*30,60+Math.sin(.3)*30]);
 close(points[2].in,[203-Math.cos(1.8)*48,165-Math.sin(1.8)*48]);close(points[2].out,[203+Math.cos(1.8)*22,165+Math.sin(1.8)*22]);
 close(points[3].in,[70+Math.cos(.4)*29,195+Math.sin(.4)*29]);close(points[3].out,[70+Math.cos(-2)*46,195+Math.sin(-2)*46]);
});
test('ellipse defaults and rectangle origins become editable cubic controls without moving the Shape',async()=>{
 const all=await importedCases(),ellipse=all.find(c=>c.name==='import-ellipse-centered').project,n=ellipse.nodes[0];
 close(n.transform,[1,0,0,1,128,128]);assert.equal(n.geometry.closed,true);assert.equal(n.geometry.points.length,4);
 close(n.geometry.points[0].anchor,[0,-42.5]);close(n.geometry.points[0].out,[65*.552284749831,-42.5]);
 const rect=all.find(c=>c.name==='import-rectangle-centered').project.nodes[0];assert.equal(rect.kind,'path');close(rect.geometry.points[0].anchor,[-75,-46]);
 const source=geometryCases().find(c=>c.name==='import-rectangle-centered');source.records.find(r=>r.type==='Rectangle').fields={parentId:1,width:50,height:30,originX:0,originY:0};
 const direct=(await importRiv(encodeRecords(source.records))).nodes[0];assert.equal(direct.kind,'rectangle');assert.equal(direct.geometry.width,50);
});
test('static contour TRS affects all handles while Shape transform and paint remain in their own space',async()=>{
 const c=geometryCases().find(c=>c.name==='import-mixed-transformed'),p=await importRiv(c.bytes),n=p.nodes[0],f=c.records.find(r=>r.type==='PointsPath').fields;
 const map=([x,y])=>[Math.cos(f.rotation)*f.scaleX*x-Math.sin(f.rotation)*f.scaleY*y+f.x,Math.sin(f.rotation)*f.scaleX*x+Math.cos(f.rotation)*f.scaleY*y+f.y];
 close(n.geometry.points[0].anchor,map([45,65]));close(n.geometry.points[1].out,map([158+Math.cos(.3)*30,60+Math.sin(.3)*30]),2e-5);close(n.transform,[1,0,0,1,0,0]);assert.deepEqual(n.geometry.fill.start,[45,30]);
});
test('supported geometry survives stripped-runtime validation, semantic reimport, editing and undo',async()=>{
 for(const c of await importedCases()){
  const p=c.project;validateProject(p);validateRuntimeProject(toRuntimeProject(p));
  const again=await importRiv(compileProject(p).bytes);assert.equal(again.nodes.length,p.nodes.length);
  const a=p.nodes.find(n=>n.kind==='path'),b=again.nodes.find(n=>n.kind==='path');
  for(let i=0;i<a.geometry.points.length;i++)for(const k of ['anchor','in','out'])close(a.geometry.points[i][k],b.geometry.points[i][k],5e-5);
  assert.deepEqual(again.animations.map(a=>a.tracks.map(t=>t.property)),p.animations.map(a=>a.tracks.map(t=>t.property)));
  const h=new History(p);h.transact('Edit imported control',draft=>{const n=draft.nodes.find(n=>n.id===a.id);n.geometry.points[0].anchor[0]+=3;});assert.notDeepEqual(h.committed(),p);h.undo();assert.deepEqual(h.committed(),p);
 }
});
test('straight skin weights apply to coincident handles and cubic weights preserve independent control bindings',async()=>{
 const c=(await importedCases()).find(c=>c.name==='import-mixed-skinned'),n=c.project.nodes.find(n=>n.kind==='path'),w=n.geometry.skin.weights;
 assert.equal(w.length,4);assert.deepEqual(w[0].anchor,w[0].in);assert.deepEqual(w[0].anchor,w[0].out);assert(w.every(v=>v.anchor[0][1]===1));assert.notEqual(w[1].in[0][0],w[1].anchor[0][0]);
 assert.notDeepEqual(evaluate(c.project,c.project.animations[0].id,0),evaluate(c.project,c.project.animations[0].id,60));
});
test('unsupported rounding, flags, malformed hierarchy, weights and animated contour geometry reject',async()=>{
 for(const [name,type,field,value,reason]of [
 ['import-mixed-closed','StraightVertex','radius',12,/rounded straight/],
 ['import-mixed-closed','PointsPath','pathFlags',1,/path flags/],
 ['import-mixed-closed','CubicMirroredVertex','parentId',0,/belong to a PointsPath/],
 ['import-ellipse-centered','Ellipse','parentId',0,/belong directly/],
 ['import-ellipse-centered','Ellipse','width',0,/positive width/],
 ['import-rectangle-centered','Rectangle','cornerRadiusTL',5,/rounded rectangles/],
 ['import-mixed-skinned','PointsPath','x',2,/transformed skinned/],
 ]){const records=structuredClone(geometryCases().find(c=>c.name===name).records);records.find(r=>r.type===type).fields[field]=value;await assert.rejects(()=>importRiv(encodeRecords(records)),reason);}
 const duplicate=geometryCases()[0].records;duplicate.push({type:'Ellipse',fields:{parentId:1,width:30,height:20}});const compound=await importRiv(encodeRecords(duplicate));assert.equal(compound.nodes[0].geometry.contours.length,1);assert.equal(compound.nodes[0].geometry.contours[0].points.length,4);
 const weight=geometryCases().find(c=>c.name==='import-mixed-skinned').records;const r=weight.find(r=>r.type==='Weight');r.type='CubicWeight';await assert.rejects(()=>importRiv(encodeRecords(weight)),/weight type/);
 for(const [name,type,propertyKey]of [['import-mixed-closed','CubicMirroredVertex',82],['import-ellipse-centered','Ellipse',20],['import-rectangle-centered','Rectangle',21],['import-mixed-transformed','PointsPath',13]]){
  const records=structuredClone(geometryCases().find(c=>c.name===name).records),objectId=records.findIndex(r=>r.type===type)-1;
  records.push({type:'LinearAnimation',fields:{name:'Geometry',fps:60,duration:60}},{type:'KeyedObject',fields:{objectId}},{type:'KeyedProperty',fields:{propertyKey}},{type:'KeyFrameDouble',fields:{frame:0,value:1}});
  await assert.rejects(()=>importRiv(encodeRecords(records)),/animated .* geometry cannot be preserved/);
 }
});

test('Tide source is reproducibly generated by importing its original native contour sample',async()=>{
 const native=readFileSync('apps/web/assets/examples/tide-native.riv'),types=new Set(readRiv(native).records.map(r=>r.type));
 for(const type of ['Ellipse','Rectangle','StraightVertex','CubicMirroredVertex','CubicAsymmetricVertex'])assert(types.has(type));
 const p=stableImport(await importRiv(native),'tide');p.name='Tide — a shore-side hello';
 assert.deepEqual(JSON.parse(JSON.stringify(p)),JSON.parse(readFileSync('apps/web/assets/examples/tide.evir-project')));assert.equal(p.nodes.length,34);assert.equal(p.assets.length,0);
 assert.deepEqual(Buffer.from(compileProject(p).bytes),readFileSync('apps/web/assets/examples/tide.riv'));
});
