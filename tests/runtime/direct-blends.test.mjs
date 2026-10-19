import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeRecords} from '../../tools/encode-riv-records.mjs';
import {readFileSync} from 'node:fs';
import {directFixture,nativeDirectFixture} from '../fixtures/direct-blends.mjs';
import {MachinePlayer,createRuntime} from '@evir/runtime';
import {validateProject,toRuntimeProject,validateRuntimeProject} from '@evir/project-model';
import {compileProject,importRiv,readRiv} from '@evir/format';
const x=pose=>pose.nodes[0].transform[4];
test('direct weights apply in order, retain results between explicit ticks and keep pose reads idempotent',()=>{
 const p=directFixture(),before=structuredClone(p),m=new MachinePlayer(p,'direct-machine');m.set('left-weight',75);m.set('right-weight',25);
 for(const want of[96,102,103.125,103.3359375]){assert.equal(x(m.advance(0)),want);assert.equal(x(m.pose()),want);assert.equal(x(m.pose()),want);}
 m.set('left-weight',0);m.set('right-weight',0);const held=m.pose();assert.deepEqual(m.advance(.5),held);assert.equal(x(m.reset()),64);assert.deepEqual(p,before);
});
test('weights clamp, later full rows win, fixed baseline restores zeroed inputs, and unrelated properties stay unchanged',()=>{
 const p=directFixture(),m=new MachinePlayer(p,'direct-machine');m.set('left-weight',1000);m.set('right-weight',200);assert.equal(x(m.advance(0)),192);m.set('right-weight',-12);assert.equal(x(m.advance(0)),64);
 p.machines[0].states[0].blend.children[0]={animationId:'left',weight:100};const n=new MachinePlayer(p,'direct-machine');n.set('right-weight',50);assert.equal(x(n.advance(0)),128);assert.equal(x(n.advance(0)),128);n.set('right-weight',0);assert.equal(x(n.advance(0)),64);assert.equal(n.pose().nodes[0].transform[5],128);
 p.machines[0].states[0].blend.children.reverse();p.machines[0].states[0].animationId='right';const reversed=new MachinePlayer(p,'direct-machine');reversed.set('right-weight',100);assert.equal(x(reversed.advance(0)),64);
});
test('all child clocks advance at zero weight; loop, once, speed and ping-pong use each clip clock',()=>{
 const p=directFixture({fixed:true}),a=p.animations[1];a.tracks[0].keys[1].value=252;
 for(const[mode,speed,seconds,want]of[['loop',1,.5,222],['once',2,2,252],['ping-pong',1,1.5,222]]){
  a.playback={mode,iterations:mode==='once'?1:0,speed};delete a.loop;const m=new MachinePlayer(p,'direct-machine');m.advance(seconds);m.set('right-weight',100);assert.equal(x(m.advance(0)),want);
 }
});
test('runtime fork preserves persistent direct values independently, with isolated reset and detached pose reads',()=>{
 const p=directFixture(),r=createRuntime(p,{machineId:'direct-machine'});r.setInput('left',75);r.setInput('right',25);r.advance(0);const held=r.pose(),fork=r.fork();assert.deepEqual(fork.pose(),held);fork.advance(0);assert.notDeepEqual(fork.pose(),r.pose());assert.deepEqual(r.pose(),held);fork.reset();assert.equal(x(fork.pose()),64);assert.deepEqual(r.pose(),held);
 const stripped=toRuntimeProject(p);validateRuntimeProject(stripped);assert(!('position'in stripped.machines[0].states[0]));
});
test('invalid references, mixed bindings, graph contracts and budgets reject source and runtime atomically',()=>{
 for(const mutate of[
  p=>p.machines[0].states[0].blend.children[0].inputId='missing',
  p=>p.machines[0].states[0].blend.children[0].weight=20,
  p=>p.machines[0].states[0].blend.children[0]={animationId:'left',weight:101},
  p=>p.machines[0].states[0].blend.children[0].animationId='missing',
  p=>p.machines[0].inputs[0]={id:'left-weight',name:'left',type:'boolean',value:false},
  p=>p.machines[0].states[0].blend.children.pop(),
  p=>p.machines[0].states[0].blend.children=Array(9).fill({animationId:'left',weight:10}),
  p=>p.machines[0].states.push({...structuredClone(p.machines[0].states[0]),id:'other'}),
  p=>p.machines[0].transitions.push({id:'t',fromId:'direct-state',toId:'direct-state',conditions:[]}),
  p=>p.machines[0].states[0].animationId='right',
 ]){const p=directFixture();mutate(p);assert.throws(()=>validateProject(p));assert.throws(()=>compileProject(p));}
});
test('independent native direct records, default fixed 100 percent and native source round trips preserve semantics',async()=>{
 for(const options of[{}, {fixed:true},{fixed:true,omitFixedValue:true}]){
  const imported=await importRiv(nativeDirectFixture(options).bytes);validateProject(imported);const m=imported.machines[0],runtime=new MachinePlayer(imported,m.id);runtime.set(m.inputs[1].id,25);assert.equal(x(runtime.advance(0)),96);
  if(options.fixed)assert.equal(m.states[0].blend.children[0].weight,100);
  const bytes=compileProject(imported).bytes,records=readRiv(bytes).records;assert(records.some(r=>r.type==='BlendStateDirect'));assert.equal(records.filter(r=>r.type==='BlendAnimationDirect').length,2);assert(!records.some(r=>r.type==='BlendState1DInput'));
  const again=await importRiv(bytes),next=new MachinePlayer(again,again.machines[0].id);next.set(again.machines[0].inputs[1].id,25);assert.equal(x(next.advance(0)),96);
 }
 for(const[fields,pattern]of[[{blendSource:2},/data bindings/],[{inputId:200},/number input/]]){
  const c=nativeDirectFixture();Object.assign(c.records.find(r=>r.type==='BlendAnimationDirect').fields,fields);await assert.rejects(()=>importRiv(encodeRecords(c.records)),pattern);
 }
});
test('Lumen is vector art with a three-row baseline, independent inputs and deterministic native export',()=>{
 const p=JSON.parse(readFileSync('apps/web/assets/examples/lumen.evir-project'));validateProject(p);assert(p.nodes.filter(n=>n.kind==='path').length>=30);assert.equal(p.assets.length,0);assert.equal(p.machines[0].states[0].blend.children.length,3);const r=createRuntime(p,{machineId:p.machines[0].id});const start=r.pose();r.setInput('joy',100);r.setInput('courage',100);assert.notDeepEqual(r.pose(),start);r.reset();assert.deepEqual(r.pose(),start);assert.deepEqual(Buffer.from(compileProject(p).bytes),readFileSync('apps/web/assets/examples/lumen.riv'));
});

test('direct export retains sparse keyed scopes and rejects sharing clips with ordinary states',()=>{
 const p=directFixture();p.animations[1].tracks[0].property='y';p.animations[1].tracks[0].keys.forEach(k=>k.value=80);
 const records=readRiv(compileProject(p).bytes).records;let animation;const scopes={};
 for(const r of records){if(r.type==='LinearAnimation'){animation=r.fields.name;scopes[animation]=[];}if(r.type==='KeyedProperty')scopes[animation].push(r.fields.propertyKey);}
 assert.deepEqual(scopes,{Left:[13],Right:[14]});
 p.machines.push({...structuredClone(p.machines[0]),id:'other-machine',name:'Other',inputs:[],states:[{id:'other-state',name:'Other',animationId:'left',position:[0,0]}],entryStateId:'other-state'});
 assert.throws(()=>validateProject(p),/cannot also drive ordinary/);
});

test('local command input forks keep direct accumulation while rejected commands preserve presentation',async()=>{
 const{CommandSession}=await import('@evir/commands');const p=directFixture(),session=new CommandSession(p,{sessionId:'direct-test'});let id=0;
 const input=(inputId,value)=>session.execute({schemaVersion:1,context:session.context,requestId:'tick-'+(++id),expectedRevision:session.inspect().revision,operation:'input',payload:{machineId:'direct-machine',inputId,value}});
 assert(input('left-weight',75).ok);assert(input('right-weight',25).ok);assert.equal(x(session.advance(0)),96);assert.equal(x(session.advance(0)),96);
 assert(input('right-weight',25).ok);assert.equal(x(session.advance(0)),102);const held=session.advance(0),revision=session.inspect().revision;assert.equal(input('right-weight','invalid').ok,false);assert.equal(session.inspect().revision,revision);assert.deepEqual(session.advance(0),held);assert.deepEqual(session.snapshot(),p);session.close();
});

test('malformed direct arrays and null children report project validation errors',()=>{
 for(const children of[null,{},[null,{animationId:'right',weight:100}]]){
  const p=directFixture();p.machines[0].states[0].blend.children=children;
  assert.throws(()=>validateProject(p),e=>e.name==='ProjectError'&&Array.isArray(e.issues));
 }
});

test('direct rotation accumulation retains authored turns instead of decomposing rendered matrices',()=>{
 const p=directFixture();for(const[i,a]of p.animations.entries()){a.tracks[0].property='rotation';for(const k of a.tracks[0].keys)k.value=i?0:Math.PI*4;}
 const m=new MachinePlayer(p,'direct-machine');m.set('left-weight',0);m.set('right-weight',50);const pose=m.advance(0);assert(Math.abs(pose.nodes[0].transform[0]-1)<1e-12);const next=m.advance(0);assert(Math.abs(next.nodes[0].transform[0]+1)<1e-12);
});
