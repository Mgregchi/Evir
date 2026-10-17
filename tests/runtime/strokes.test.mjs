import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {strokeCases} from '../fixtures/strokes.mjs';
import {validateProject,toRuntimeProject,validateRuntimeProject,propertiesFor} from '@evir/project-model';
import {evaluate,createRuntime} from '@evir/runtime';
import {getValue} from '@evir/runtime/geometry';
import {compileProject,importRiv,readRiv} from '@evir/format';
import {strokeContours,nodeBounds} from '@evir/renderer-canvas';
import {History,setValue} from '@evir/authoring';
const fixture=()=>strokeCases().find(p=>p.name==='stroke-animated');
test('stroke source and stripped runtime preserve their strict contracts and native records',async()=>{
  for(const p of strokeCases()) {
    validateProject(p);validateRuntimeProject(toRuntimeProject(p));const {bytes}=compileProject(p),records=readRiv(bytes).records;
    assert(records.some(r=>r.type==='Stroke'));if(p.nodes[0].geometry.fill===null)assert(!records.some(r=>r.type==='Fill'));
    if(p.nodes[0].geometry.fill!==null)assert(records.some(r=>r.type==='Fill'));
    const imported=await importRiv(bytes);const rounded=v=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='number'?Number(x.toFixed(6)):x));assert.deepEqual(rounded(imported.nodes[0].geometry.stroke),rounded(p.nodes[0].geometry.stroke));
    imported.nodes[0].transform.forEach((v,i)=>assert(Math.abs(v-p.nodes[0].transform[i])<1e-5));
    assert.deepEqual(imported.animations.map(a=>a.tracks.map(t=>t.property)),p.animations.map(a=>a.tracks.map(t=>t.property)));
    assert(compileProject(imported).bytes.length>100);
  }
});
test('stroke widths, colors and effect animation follow independent playback and reset',()=>{
  const p=fixture(),a=p.animations[0],before=structuredClone(p),pose=evaluate(p,a.id,30),n=pose.nodes[0];
  assert.equal(getValue(n,'stroke.width'),14);assert.equal(getValue(n,'stroke.trimEnd'),.5);assert.equal(getValue(n,'stroke.dashOffset'),7);
  assert.equal(getValue(n,'stroke.color'),'#806d52ff');assert(propertiesFor(n).includes('stroke.trimOffset'));
  const player=createRuntime(p,{animationId:a.id});assert.deepEqual(player.advance(.5),evaluate(toRuntimeProject(p),a.id,30));
  assert.deepEqual(player.reset(),evaluate(toRuntimeProject(p),a.id,0));assert.deepEqual(p,before);
  setValue(n,'stroke.width',17);assert.equal(getValue(n,'stroke.width'),17);
});
test('invalid strokes, incompatible version/skin/feather and excessive effect work reject atomically',()=>{
  for(const mutate of [s=>s.width=-1,s=>s.width=257,s=>s.cap='triangle',s=>s.join='sharp',s=>s.color='red',s=>s.dash=[1],s=>s.dash=[0,1],s=>s.dash=[1e-9,2],s=>s.dash=[NaN,2],s=>s.trim.end=1.1,s=>s.trim.offset=2,s=>s.extra=true]) {
    const p=fixture(),h=new History(p);assert.throws(()=>h.transact('bad',p=>mutate(p.nodes[0].geometry.stroke)));assert.deepEqual(h.committed(),p);
  }
  const p=fixture();p.schemaVersion=2;delete p.advanced;assert.throws(()=>validateProject(p),/native strokes require/);
  const q=fixture();q.advanced.feathers=[{targetId:'line',strength:5}];assert.throws(()=>validateProject(q),/stroke feathering/);
  const r=fixture();r.nodes[0].geometry.points[0].out=[1e8,1e8];assert.throws(()=>validateProject(r),/effect budget/);
  const e=fixture();e.animations[0].tracks[0].keys[0].easing={type:'cubic',curve:[.2,-1,.8,2]};assert.throws(()=>validateProject(e),/value handles/);
});
test('stroke bounds include transformed width and effects keep a bounded contour output',()=>{
  for(const p of strokeCases()){
    const n=p.nodes[0],b=nodeBounds(p,n);assert(b.width>0&&b.height>0);
    assert(strokeContours(n.geometry).reduce((v,c)=>v+c.points.length,0)<65536);
  }
  const p=strokeCases().find(p=>p.name==='stroke-cap-round'),n=p.nodes[0],b=nodeBounds(p,n);assert(b.x<30&&b.y<34);
  const g=structuredClone(n.geometry);g.stroke.trim={start:.5,end:.5,offset:0};assert.deepEqual(strokeContours(g),[]);
});
test('the Trace study stays source-editable and native export contains stroke effects',()=>{
  const p=JSON.parse(readFileSync(new URL('../../apps/web/assets/examples/trace.evir-project',import.meta.url)));
  validateProject(p);assert(p.nodes.filter(n=>n.geometry?.stroke).length>=10);assert.equal(p.assets.length,0);
  const bytes=compileProject(p).bytes;assert.deepEqual(Buffer.from(bytes),readFileSync(new URL('../../apps/web/assets/examples/trace.riv',import.meta.url)));
  for(const type of ['Stroke','DashPath','Dash','TrimPath'])assert(readRiv(bytes).records.some(r=>r.type===type));
});

test('semantic import rejects unsupported native stroke semantics and malformed parents without discarding paint',async()=>{
  const {encodeRecords}=await import('../fixtures/riv-records.mjs');
  const cases=strokeCases(),source=cases.find(p=>p.name==='stroke-dash-trim'),records=readRiv(compileProject(source).bytes).records;
  // Prove that the independent fixture writer produces an accepted baseline.
  await importRiv(encodeRecords(records));
  for(const [type,field,value,reason] of [['Stroke','cap',3,/cap/],['Stroke','join',7,/join/],['Stroke','thickness',-1,/width/],['Stroke','transformAffectsStroke',false,/transform-scaled/],['Stroke','position',1,/centered/],['TrimPath','modeValue',2,/sequential/],['DashPath','offsetIsPercentage',true,/percentage/],['Dash','lengthIsPercentage',true,/percentage/],['Dash','parentId',0,/parent/],['TrimPath','parentId',0,/parent/]]){
    const changed=structuredClone(records);changed.find(r=>r.type===type).fields[field]=value;await assert.rejects(()=>importRiv(encodeRecords(changed)),reason);
  }
  const rectangle=readRiv(compileProject(cases.find(p=>p.name==='stroke-rectangle')).bytes).records;
  const board=rectangle[1],components=rectangle.slice(1),fill=components.findIndex(r=>r.type==='Fill'),stroke=components.findIndex(r=>r.type==='Stroke');
  [components[fill],components[stroke]]=[components[stroke],components[fill]];
  for(const r of components)if('parentId'in r.fields){if(r.fields.parentId===fill)r.fields.parentId=stroke;else if(r.fields.parentId===stroke)r.fields.parentId=fill;}
  await assert.rejects(()=>importRiv(encodeRecords([rectangle[0],...components])),/fill-before-stroke/);
  const broken=fixture();broken.nodes[0].geometry.stroke.dash=null;assert.throws(()=>validateProject(broken),/paired dash/);
});

test('tiny dash construction stays bounded and keyed rectangle sizes cannot bypass the effect budget',()=>{
  const p=strokeCases().find(p=>p.name==='stroke-dash'),g=p.nodes[0].geometry;
  g.points=[{id:'start',anchor:[0,0],in:[0,0],out:[0,0]},{id:'end',anchor:[16000,0],in:[16000,0],out:[16000,0]}];g.stroke.dash=[1,1];
  validateProject(p);const contours=strokeContours(g);assert.equal(contours.length,8000);assert(contours.reduce((v,c)=>v+c.points.length,0)<65536);
  const rectangle=strokeCases().find(p=>p.name==='stroke-rectangle');
  rectangle.animations=[{id:'wide',name:'Wide',artboardId:'board',fps:60,duration:120,loop:false,tracks:[{targetId:'line',property:'width',keys:[{frame:0,value:16000,easing:{type:'linear',curve:null}}]}]}];
  assert.throws(()=>validateProject(rectangle),/effect budget/);
  rectangle.animations[0].tracks[0].keys[0]={frame:0,value:100,easing:{type:'cubic',curve:[.2,-1,.8,2]}};assert.throws(()=>validateProject(rectangle),/value handles/);
});

test('thin rotated rectangle stroke bounds include all four painted corners',()=>{
  const p=strokeCases().find(p=>p.name==='stroke-rectangle'),n=p.nodes[0],c=Math.SQRT1_2;
  n.transform=[c,c,-c,c,100,100];n.geometry.stroke.width=2;
  const b=nodeBounds(p,n);
  assert(b.x<=100-c*98,'lower-left painted corner extends beyond the original geometry');
  assert(b.x+b.width>=100+c*130,'upper-right painted corner extends beyond the original geometry');
});
