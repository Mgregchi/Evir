import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MotorcycleController} from '../../apps/web/motorcycle.mjs';
const project=JSON.parse(readFileSync(new URL('../../apps/web/assets/examples/motorcycle.evir-project',import.meta.url)));
const wheel='motorcycle-wheels', bump='motorcycle-bump';
test('motorcycle accelerates, brakes to rest, preserves wheel phase and resets every control',()=>{
  const p=structuredClone(project),ride=new MotorcycleController(p),before=structuredClone(p);
  ride.advance(2);assert.equal(ride.telemetry.speed,0);assert.equal(ride.telemetry.distance,0);assert.equal(ride.mixer.playback(wheel).frame,0);
  ride.setThrottle(.8);ride.advance(3);assert(ride.telemetry.speed>9);assert(ride.telemetry.distance>10);
  const phase=ride.mixer.playback(wheel).frame;ride.setBrake(true);assert.equal(ride.mixer.playback(wheel).frame,phase,'engaging brake preserves phase');
  ride.advance(3);assert.equal(ride.telemetry.speed,0);const stopped=ride.mixer.playback(wheel).frame;ride.advance(2);assert.equal(ride.mixer.playback(wheel).frame,stopped);
  ride.setHeadlight(true);assert.equal(ride.pose().nodes.find(n=>n.id==='motorcycle-headlight').geometry.fill,'#fff0c4');
  assert.equal(ride.pose().nodes.find(n=>n.id==='motorcycle-tail-light').geometry.fill,'#ff8c70');
  ride.reset();assert.deepEqual(ride.telemetry,{speed:0,speedKmh:0,distance:0,throttle:0,braking:false,headlight:false,roughRoad:true,bumpCount:0});assert.equal(ride.mixer.playback(wheel).frame,0);assert.equal(ride.mixer.playback(bump).completed,true);assert.deepEqual(p,before);
});
test('bumps are one-shot, independently composited and spatially spaced; road and wheels share travel distance',()=>{
  const ride=new MotorcycleController(project);ride.setRoughRoad(false);ride.setThrottle(.5);ride.advance(1);
  const rotation=ride.mixer.playback(wheel).frame;
  assert.equal(ride.bump(),true);assert.equal(ride.bump(),false,'no rapid retrigger while suspension moves');assert.equal(ride.mixer.playback(wheel).frame,rotation);
  ride.advance(.1);assert(ride.pose().nodes.find(n=>n.id==='motorcycle-chassis-and-rider').transform[5]<302);
  ride.advance(1);assert.equal(ride.mixer.playback(bump).completed,true);assert.equal(ride.pose().nodes.find(n=>n.id==='motorcycle-chassis-and-rider').transform[5],302);
  const wheelCycles=(ride.telemetry.distance/(2*Math.PI*.34))%1;
  assert(Math.abs(ride.mixer.playback(wheel).frame/60-wheelCycles)<1e-8);
  const roadCycles=(ride.telemetry.distance/(128/(43/.34)))%1;
  assert(Math.abs(ride.mixer.playback('motorcycle-asphalt').frame/60-roadCycles)<1e-8);
  ride.reset();ride.setThrottle(1);ride.advance(10);assert(ride.telemetry.bumpCount>=2);assert(ride.telemetry.distance>40);
});
test('substeps agree across caller frame rates and reject invalid controls without mutating state',()=>{
  const a=new MotorcycleController(project),b=new MotorcycleController(project);a.setThrottle(.7);b.setThrottle(.7);a.setRoughRoad(false);b.setRoughRoad(false);
  a.advance(2);for(let i=0;i<120;i++)b.advance(1/60);
  assert(Math.abs(a.telemetry.speed-b.telemetry.speed)<1e-9);assert(Math.abs(a.telemetry.distance-b.telemetry.distance)<1e-9);
  const before=a.telemetry;
  for(const bad of [-1,2,NaN,Infinity])assert.throws(()=>a.setThrottle(bad));
  for(const method of ['setBrake','setHeadlight','setRoughRoad'])assert.throws(()=>a[method](1));
  for(const bad of [-1,NaN,Infinity,61])assert.throws(()=>a.advance(bad));
  assert.deepEqual(a.telemetry,before);
});
test('turn signal repeats exactly three cycles, then stays off independently of wheel motion',()=>{
  const ride=new MotorcycleController(project);ride.setThrottle(.7);assert.equal(ride.signal(),true);assert.equal(ride.signal(),false);
  const light=()=>ride.pose().nodes.find(n=>n.id==='motorcycle-turn-indicator').geometry.fill;
  for(let i=0;i<3;i++){assert.equal(light(),'#e9b658ff');ride.advance(.5);assert.equal(light(),'#e9b65800');ride.advance(.5);}
  assert.equal(ride.mixer.playback('motorcycle-indicator').completed,true);assert.equal(light(),'#e9b65800');
  const phase=ride.mixer.playback(wheel).frame;ride.advance(1);assert.notEqual(ride.mixer.playback(wheel).frame,phase);assert.equal(light(),'#e9b65800');
  assert.equal(ride.signal(),true);assert.equal(light(),'#e9b658ff');ride.reset();assert.equal(light(),'#e9b65800');
});
