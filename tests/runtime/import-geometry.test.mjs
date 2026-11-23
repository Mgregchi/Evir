import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stableImport} from '../../tools/stabilize-import.mjs';
import {geometryCases,importedCases} from '../fixtures/import-geometry.mjs';
import {encodeRecords} from '../fixtures/riv-records.mjs';
import {importRiv,compileProject,readRiv} from '@evir/format';
import {validateProject,toRuntimeProject,validateRuntimeProject} from '@evir/project-model';
import {evaluate} from '@evir/runtime';
import {worldPoints} from '@evir/runtime/geometry';
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
test('rounded rectangles clamp each linked corner and preserve independent concave and square corners',async()=>{
 const all=await importedCases();
 const linked=all.find(c=>c.name==='import-rectangle-rounded-linked').project.nodes[0].geometry.points;
 assert.equal(linked.length,8);
 close(linked[0].anchor,[-72.5,0]);close(linked[1].anchor,[-27.5,-45]);
 close(linked[2].anchor,[27.5,-45]);close(linked[3].anchor,[72.5,0]);
 const source=geometryCases().find(c=>c.name==='import-rectangle-rounded-independent');
 const fields=source.records.find(r=>r.type==='Rectangle').fields;
 Object.assign(fields,{rotation:0,scaleX:1,scaleY:1});
 const shape=(await importRiv(encodeRecords(source.records))).nodes[0];
 const points=shape.geometry.points,handle=26*4/3*Math.tan(Math.PI/8);
 assert.equal(points.length,7);assert.equal(shape.geometry.closed,true);
 close(points[0].anchor,[-55,-14]);close(points[0].out,[-55+handle,-14]);
 close(points[1].anchor,[-29,-40]);close(points[1].in,[-29,-40+handle]);
 close(points[4].anchor,[55,40]);close(points[4].out,points[4].anchor);
 close(points[5].anchor,[-21,40]);close(points[6].anchor,[-55,6]);
});
test('freeform rounding follows adjacent cubic handles and preserves open endpoint rounding',async()=>{
 const all=await importedCases();
 const mixed=all.find(c=>c.name==='import-rounded-mixed-closed').project.nodes[0].geometry;
 assert.equal(mixed.closed,true);assert.equal(mixed.points.length,6);
 const nextIn=[158-Math.cos(.3)*30,60-Math.sin(.3)*30];
 close(mixed.points[1].anchor,[(50+nextIn[0])/2,(65+nextIn[1])/2]);
 close(mixed.points[2].in,nextIn);
 const open=all.find(c=>c.name==='import-rounded-open-stroke').project.nodes[0].geometry;
 assert.equal(open.closed,false);assert.equal(open.points.length,6);
 const length=Math.hypot(11,119);
 close(open.points[0].anchor,[58+24*11/length,7+(80+24*119/length)*.9]);
});
test('native procedural contours become closed paths with the authored origin and point count',async()=>{
 const all=await importedCases();
 const triangle=all.find(c=>c.name==='import-triangle').project.nodes[0].geometry;
 assert.equal(triangle.closed,true);assert.equal(triangle.points.length,3);
 close(triangle.points[0].anchor,[28.75,-63]);close(triangle.points[2].anchor,[-28.75,27]);
 const polygon=all.find(c=>c.name==='import-polygon-rounded').project.nodes[0].geometry;
 assert.equal(polygon.closed,true);assert.equal(polygon.points.length,10);
 const star=all.find(c=>c.name==='import-star-transformed').project.nodes[0].geometry;
 assert.equal(star.closed,true);assert.equal(star.points.length,24);
 for(const points of [2,257]){
  const source=geometryCases().find(c=>c.name==='import-polygon-rounded');
  source.records.find(r=>r.type==='Polygon').fields.points=points;
  await assert.rejects(()=>importRiv(encodeRecords(source.records)),/3 to 256 points/);
 }
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
test('skinned controls retain their local values and use the explicit bind matrix instead of contour TRS',async()=>{
 const cases=await importedCases();
 const baseline=cases.find(c=>c.name==='import-mixed-skinned').project.nodes.find(n=>n.kind==='path');
 const fixture=cases.find(c=>c.name==='import-skinned-contour-bind'),n=fixture.project.nodes.find(n=>n.kind==='path');
 assert.deepEqual(n.geometry.points.map(({anchor,in:incoming,out})=>[anchor,incoming,out]),
   baseline.geometry.points.map(({anchor,in:incoming,out})=>[anchor,incoming,out]));
 close(n.geometry.skin.bindWorld,[.8,.13,-.1,.85,27,19]);
 const withoutTRS=structuredClone(fixture.records);
 const nativePath=withoutTRS.find(r=>r.type==='PointsPath');
 nativePath.fields={parentId:nativePath.fields.parentId,isClosed:true};
 const reference=await importRiv(encodeRecords(withoutTRS));
 const rig=reference.nodes.find(n=>n.kind==='path');
 close(rig.geometry.skin.bindWorld,n.geometry.skin.bindWorld);
 for(const frame of [0,30,60,120]){
  const pose=evaluate(fixture.project,fixture.project.animations[0].id,frame);
  const control=evaluate(reference,reference.animations[0].id,frame);
  const coordinates=(project,node)=>worldPoints(project,node).map(({anchor,in:incoming,out})=>[anchor,incoming,out]);
  assert.deepEqual(coordinates(pose,n),coordinates(control,rig));
 }
});
test('counterclockwise hints preserve raw order for ordinary paints and reject clockwise-fill normalization',async()=>{
 const cases=await importedCases();
 for(const rule of ['nonzero','evenodd']){
  const fixture=cases.find(c=>c.name===`import-counterclockwise-${rule}-hole`);
  const geometry=fixture.project.nodes[0].geometry;
  assert.equal(geometry.fillRule ?? 'nonzero',rule);
  assert.deepEqual(geometry.contours[0].points.map(p=>p.anchor),[[-36,-32],[-36,34],[33,34],[33,-32]]);
 }
 const source=geometryCases().find(c=>c.name==='import-counterclockwise-nonzero-hole');
 source.records.find(r=>r.type==='Fill').fields.fillRule=2;
 await assert.rejects(()=>importRiv(encodeRecords(source.records)),/counterclockwise path flags with a clockwise fill/);
});
test('unsupported rounding, flags, malformed hierarchy, weights and animated contour geometry reject',async()=>{
 for(const [name,type,field,value,reason]of [
 ['import-mixed-skinned','StraightVertex','radius',12,/rounded straight vertices with skin/],
 ['import-mixed-closed','PointsPath','pathFlags',1,/path flags/],
 ['import-mixed-closed','PointsPath','pathFlags',3,/path flags/],
 ['import-mixed-closed','PointsPath','pathFlags',4,/path flags/],
 ['import-mixed-closed','CubicMirroredVertex','parentId',0,/belong to a PointsPath/],
 ['import-ellipse-centered','Ellipse','parentId',0,/belong directly/],
 ['import-ellipse-centered','Ellipse','width',0,/positive width/],
 ]){const records=structuredClone(geometryCases().find(c=>c.name===name).records);records.find(r=>r.type===type).fields[field]=value;await assert.rejects(()=>importRiv(encodeRecords(records)),reason);}
 const duplicate=geometryCases()[0].records;duplicate.push({type:'Ellipse',fields:{parentId:1,width:30,height:20}});const compound=await importRiv(encodeRecords(duplicate));assert.equal(compound.nodes[0].geometry.contours.length,1);assert.equal(compound.nodes[0].geometry.contours[0].points.length,4);
 const weight=geometryCases().find(c=>c.name==='import-mixed-skinned').records;const r=weight.find(r=>r.type==='Weight');r.type='CubicWeight';await assert.rejects(()=>importRiv(encodeRecords(weight)),/weight type/);
 for(const [name,type,propertyKey]of [['import-mixed-closed','CubicMirroredVertex',82],['import-star-transformed','Star',127],['import-rounded-mixed-closed','StraightVertex',26],['import-ellipse-centered','Ellipse',20],['import-rectangle-centered','Rectangle',21],['import-rectangle-rounded-linked','Rectangle',31],['import-mixed-transformed','PointsPath',13],['import-skinned-contour-bind','PointsPath',13]]){
  const records=structuredClone(geometryCases().find(c=>c.name===name).records),objectId=records.findIndex(r=>r.type===type)-1;
  records.push({type:'LinearAnimation',fields:{name:'Geometry',fps:60,duration:60}},{type:'KeyedObject',fields:{objectId}},{type:'KeyedProperty',fields:{propertyKey}},{type:'KeyFrameDouble',fields:{frame:0,value:1}});
  await assert.rejects(()=>importRiv(encodeRecords(records)),/animated .* geometry cannot be preserved/);
 }
});

test('Tide source is reproducibly generated by importing its original native contour sample',async()=>{
 const native=readFileSync('apps/web/assets/examples/tide-native.riv'),types=new Set(readRiv(native).records.map(r=>r.type));
 for(const type of ['Ellipse','Rectangle','StraightVertex','CubicMirroredVertex','CubicAsymmetricVertex'])assert(types.has(type));
 const p=stableImport(await importRiv(native),'tide');p.name='Tide — a shore-side hello';
 assert.deepEqual(JSON.parse(JSON.stringify(p)),JSON.parse(readFileSync('apps/web/assets/examples/tide.evir-project')));assert.equal(p.nodes.length,35);assert.equal(p.assets.length,0);
 assert.deepEqual(Buffer.from(compileProject(p).bytes),readFileSync('apps/web/assets/examples/tide.riv'));
});
