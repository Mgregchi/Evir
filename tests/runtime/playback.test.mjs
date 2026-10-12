import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject, validateProject, playbackSettings, serializeProject, openProject} from '@evir/project-model';
import {addNode, createAnimation, setKey, createMachine, History} from '@evir/authoring';
import {AnimationClock, AnimationMixer, createRuntime, MachinePlayer, playbackSample} from '@evir/runtime';
import {compileProject, readRiv, importRiv} from '@evir/format';

function scene(policy) {
  const p=createProject(), id=addNode(p), a=createAnimation(p,p.artboards[0].id), animation=p.animations[0];
  animation.duration=60;
  setKey(p,a,id,'x',0,0);setKey(p,a,id,'x',60,100);
  if(policy){delete animation.loop;animation.playback=policy;}
  return {p,id,a,animation};
}
test('once, continuous and counted cycles stop at defined boundary poses, including large deltas',()=>{
  for(const [mode,iterations,seconds,want,complete] of [
    ['once',1,.5,30,false],['once',1,1,60,true],['once',1,999,60,true],
    ['loop',0,1,0,false],['loop',0,100.5,30,false],['loop',3,2.5,30,false],['loop',3,3,60,true],
    ['ping-pong',0,1,60,false],['ping-pong',0,1.5,30,false],['ping-pong',0,2,0,false],
    ['ping-pong',2,3.5,30,false],['ping-pong',2,4,0,true],['ping-pong',2,999,0,true],
  ]) {
    const {p,a,animation}=scene({mode,iterations,speed:1}), player=createRuntime(p,{animationId:a});
    player.advance(seconds);assert.equal(player.playback.frame,want,`${mode}/${iterations}/${seconds}`);assert.equal(player.playback.completed,complete);
    assert.equal(playbackSample(animation,seconds).frame,want);
    assert.equal(player.pose().nodes[0].transform[4],want/60*100);
    assert.equal(player.reset().nodes[0].transform[4],0);assert.equal(player.playback.completed,false);
  }
});
test('speed changes and zero speed preserve phase; ping-pong scrubbing can resume backwards',()=>{
  const {p,a,animation}=scene({mode:'ping-pong',iterations:0,speed:2});
  const player=createRuntime(p,{animationId:a});player.advance(.25);assert.equal(player.playback.frame,30);
  player.setSpeed(0);player.advance(10);assert.equal(player.playback.frame,30);
  player.setSpeed(.5);player.advance(1);assert.equal(player.playback.frame,60);
  player.advance(1);assert.equal(player.playback.frame,30);assert.equal(player.playback.direction,-1);
  const clock=new AnimationClock(animation);clock.seek(45,{direction:-1});clock.setSpeed(1);assert.equal(clock.advance(.25).frame,30);
  const loop=new AnimationClock({...animation,playback:{mode:'loop',iterations:0,speed:1}});
  loop.seek(60);assert.equal(loop.state.frame,60,'scrub endpoint is visible');assert.equal(loop.advance(.5).frame,30);
  for(const bad of [-1,NaN,Infinity,65])assert.throws(()=>clock.setSpeed(bad));
  for(const bad of [-1,NaN,Infinity,Number.MAX_VALUE])assert.throws(()=>clock.advance(bad));
});
test('playback policies validate atomically and survive recovery/runtime serialization without legacy redundancy',async()=>{
  const {p,animation}=scene({mode:'loop',iterations:3,speed:.75});
  assert.deepEqual((await openProject(await serializeProject(p))).animations[0].playback,animation.playback);
  const history=new History(p),before=history.snapshot();
  for(const patch of [{iterations:-1},{iterations:1.5},{iterations:10001},{speed:0},{speed:17},{mode:'unknown'},{mode:'once',iterations:3},{extra:true}])
    assert.throws(()=>history.transact('Invalid playback',q=>Object.assign(q.animations[0].playback,patch)));
  assert.deepEqual(history.snapshot(),before);
  const redundant=structuredClone(p);redundant.animations[0].loop=true;assert.throws(()=>validateProject(redundant),/unsupported field/);
  history.transact('Ping-pong',q=>q.animations[0].playback.mode='ping-pong');history.undo();assert.deepEqual(history.snapshot(),before);
  assert.deepEqual(playbackSettings(scene().animation),{mode:'loop',iterations:0,speed:1});
});
test('machines apply counted, ping-pong and authored-speed policy while state timing remains real seconds',()=>{
  const {p,a}=scene({mode:'ping-pong',iterations:1,speed:2});const machine=createMachine(p,p.artboards[0].id);
  const m=new MachinePlayer(p,machine);assert.equal(m.advance(.25).nodes[0].transform[4],50);
  assert.equal(m.advance(.5).nodes[0].transform[4],50);assert.equal(m.advance(.25).nodes[0].transform[4],0);
  assert.equal(m.advance(10).nodes[0].transform[4],0);m.reset();assert.equal(m.time,0);
});
test('independent layers compose keyed axes and rotation, preserve clocks on speed changes and never reset unrelated artwork',()=>{
  const {p,id,a}=scene({mode:'loop',iterations:0,speed:1});const b=createAnimation(p,p.artboards[0].id), c=createAnimation(p,p.artboards[0].id);
  p.animations[1].duration=60;p.animations[2].duration=60;
  setKey(p,b,id,'y',0,0);setKey(p,b,id,'y',60,80);setKey(p,b,id,'rotation',0,0);setKey(p,b,id,'rotation',60,Math.PI);
  setKey(p,c,id,'x',0,25);const other=addNode(p);const before=structuredClone(p);
  const mixer=new AnimationMixer(p,{layers:[{animationId:a},{animationId:b,speed:.5},{animationId:c,enabled:false}]});
  const pose=mixer.advance(.5),node=pose.nodes.find(n=>n.id===id);
  assert.equal(node.transform[4],50);assert.equal(node.transform[5],20);assert(Math.abs(node.transform[0]-Math.SQRT1_2)<1e-10);
  assert.deepEqual(pose.nodes.find(n=>n.id===other),p.nodes.find(n=>n.id===other));
  mixer.setSpeed(a,0);mixer.advance(.5);assert.equal(mixer.playback(a).frame,30);assert.equal(mixer.playback(b).frame,30);
  mixer.setEnabled(c,true);assert.equal(mixer.pose().nodes[0].transform[4],25,'later keyed x wins');
  mixer.setEnabled(c,false);assert.equal(mixer.pose().nodes[0].transform[4],50);
  mixer.restart(b);assert.equal(mixer.playback(a).frame,30);assert.equal(mixer.playback(b).frame,0);
  assert.deepEqual(p,before);assert.throws(()=>mixer.setEnabled(a,1));assert.throws(()=>mixer.setSpeed('missing',1));
  assert.throws(()=>new AnimationMixer(p,{layers:[{animationId:a},{animationId:a}]}));
});
test('native export carries mode/speed, fixed-count policy and keyed scope remain explicit host metadata',async()=>{
  for(const mode of ['once','loop','ping-pong']) {
    const {p,animation}=scene({mode,iterations:mode==='once'?1:3,speed:1.5});
    const result=compileProject(p),record=readRiv(result.bytes).records.find(r=>r.type==='LinearAnimation');
    assert.equal(record.fields.loopValue,{once:0,loop:1,'ping-pong':2}[mode]);assert.equal(record.fields.speed,1.5);
    assert.deepEqual(result.mapping.animations[animation.id].playback,animation.playback);
    assert.equal(result.mapping.animations[animation.id].repeatPolicy,mode==='once'?'native':'host');
    const restored=await importRiv(result.bytes);assert.equal(restored.animations[0].playback.mode,mode);
    assert.equal(restored.animations[0].playback.iterations,mode==='once'?1:0,'raw .riv cannot preserve a finite count');
    assert.equal(restored.animations[0].playback.speed,1.5);
  }
});
