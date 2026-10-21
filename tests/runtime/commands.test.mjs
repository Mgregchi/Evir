import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject} from '@evir/project-model';
import {History} from '@evir/authoring';
import {CommandSession} from '@evir/commands';
import {compassLesson} from '@evir/commands/example';
import {scenes} from '../editor/scenes.mjs';
const setup=()=>{const p=createProject(),history=new History(p),s=new CommandSession(p,{history,sessionId:'test-session'});return {p,history,s,lesson:compassLesson(p.artboards[0].id)};};
let serial=0;
const request=(s,operation,payload)=>({schemaVersion:1,context:s.context,expectedRevision:s.inspect().revision,requestId:'request-'+(++serial),operation,payload});
const seed=({s,lesson})=>{const r=s.execute(request(s,'patch',{commands:lesson.commands}));assert(r.ok,JSON.stringify(r));return r;};
test('bounded shared patches are atomic, scoped and one undo step',()=>{
  const h=setup();seed(h);assert.equal(h.history.revision,1);assert.equal(h.s.snapshot().nodes.length,18);
  const before=h.s.snapshot(),bad=request(h.s,'patch',{commands:[{op:'update_node',nodeId:'compass-root',changes:{name:'Changed'}},{op:'reparent_node',nodeId:'compass-root',parentId:'compass-needle'}]});
  assert.equal(h.s.execute(bad).ok,false);assert.deepEqual(h.s.snapshot(),before);assert.equal(h.history.revision,1);
  h.history.undo();assert.deepEqual(h.s.snapshot(),h.p);assert.equal(h.s.inspect().revision,2);
  h.history.redo();h.history.transact('Lock',p=>p.editor.locked.push('compass-root'));
  const locked=h.s.execute(request(h.s,'patch',{commands:[{op:'update_node',nodeId:'compass-north',changes:{name:'No'}}]}));assert.equal(locked.error.code,'LOCKED');
  const out=request(h.s,'patch',{commands:[{op:'create_node',node:{...before.nodes[0],artboardId:'outside'}}]});assert.equal(h.s.execute(out).error.code,'SCOPE');
});
test('requests retry without duplicate edits; changes, stale revisions and provisional edits reject',()=>{
  const h=setup(),r=request(h.s,'patch',{commands:h.lesson.commands});assert(h.s.execute(r).ok);assert.deepEqual(h.s.execute(r),h.s.execute(r));assert.equal(h.history.revision,1);
  assert.equal(h.s.execute({...r,payload:{commands:[]}}).error.code,'REQUEST_REUSED');
  const stale=request(h.s,'patch',{commands:[{op:'update_node',nodeId:'compass-root',changes:{name:'Old'}}]});h.history.transact('Human',p=>p.nodes[0].name='Human');assert.equal(h.s.execute(stale).error.code,'CONFLICT');
  h.history.begin('Drag');assert.equal(h.s.execute(request(h.s,'patch',{commands:h.lesson.commands})).error.code,'BUSY');h.history.cancel();
  assert.equal(h.s.execute({...r,context:{...r.context,sessionId:'elsewhere'}}).error.code,'SCOPE');
});
test('control manifests check bindings/types/ranges; presentation does not enter source; ready is host-confirmed',()=>{
  const h=setup();seed(h);const source=h.s.snapshot();const expose=request(h.s,'controls',{controls:h.lesson.controls});assert(h.s.execute(expose).ok);
  const play=h.s.execute(request(h.s,'play',{animationId:h.lesson.animationId,playing:true}));assert(play.ok);assert.equal(h.s.inspect().cue.ready,false);
  assert.equal(h.s.acknowledge('wrong',play.sceneRevision),false);assert(h.s.acknowledge(play.cue.id,play.sceneRevision));assert.equal(h.s.acknowledge(play.cue.id,play.sceneRevision),false);
  const pose=h.s.advance(.5);assert.notDeepEqual(pose.nodes,source.nodes);const paused=h.s.execute(request(h.s,'control',{controlId:'compass-speed',value:0}));assert(paused.ok);const frozen=h.s.advance(.5);assert.deepEqual(h.s.advance(1),frozen);
  assert.equal(h.s.execute(request(h.s,'control',{controlId:'compass-speed',value:.3})).ok,false);assert.deepEqual(h.s.snapshot(),source);
  assert.equal(h.s.execute(request(h.s,'controls',{controls:[...h.lesson.controls,{...h.lesson.controls[0],id:'duplicate-binding'}]})).error.code,'INVALID_BINDING');
  h.s.close();assert.equal(h.s.execute(expose).error.code,'SESSION_CLOSED');assert.equal(h.s.playing,false);assert.equal(h.s.controls.length,0);
});
test('machine control triggers retry once; failed cyclic inputs retain last presentation and source',()=>{
  const {p,m}=scenes(),machine=p.machines[0],enabled=machine.inputs[0].id,amount=machine.inputs[1].id,go=machine.inputs[2].id;
  const s=new CommandSession(p),controls=[{id:'enabled',label:'Enabled',type:'checkbox',value:false,binding:{kind:'input',machineId:m,inputId:enabled}},
    {id:'amount',label:'Amount',type:'slider',min:-1,max:5,step:1,value:0,binding:{kind:'input',machineId:m,inputId:amount}},
    {id:'go',label:'Go',type:'button',binding:{kind:'input',machineId:m,inputId:go}}];
  assert(s.execute(request(s,'controls',{controls})).ok);const trigger=request(s,'control',{controlId:'go',value:true});assert(s.execute(trigger).ok);const sequence=s.events().sequence;assert(s.execute(trigger).ok);assert.equal(s.events().sequence,sequence);
  const cyclic=structuredClone(p);const a=machine.states[0].id,b=machine.states[1].id;cyclic.machines[0].transitions=[{id:'cycle-ab',fromId:a,toId:b,conditions:[{inputId:enabled,op:'eq',value:true}]},{id:'cycle-ba',fromId:b,toId:a,conditions:[{inputId:enabled,op:'eq',value:true}]}];
  const c=new CommandSession(cyclic);assert(c.execute(request(c,'input',{machineId:m,inputId:amount,value:0})).ok);const before=c.advance(0),rev=c.inspect().revision;
  assert.equal(c.execute(request(c,'input',{machineId:m,inputId:enabled,value:true})).ok,false);assert.equal(c.inspect().revision,rev);assert.deepEqual(c.advance(0),before);assert.deepEqual(c.snapshot(),cyclic);
});
test('cache/event windows are bounded and stale evicted retries cannot fire again',()=>{
  const h=setup();seed(h);assert(h.s.execute(request(h.s,'controls',{controls:h.lesson.controls})).ok);
  const first=request(h.s,'control',{controlId:'compass-speed',value:1});assert(h.s.execute(first).ok);
  for(let i=0;i<300;i++)assert(h.s.execute(request(h.s,'control',{controlId:'compass-speed',value:(i%16)/4})).ok);
  assert.equal(h.s.execute(first).error.code,'CONFLICT');assert.equal(h.s.events().events.length,256);assert.equal(h.s.events().resetRequired,true);
  assert.equal(h.s.execute(request(h.s,'patch',{commands:[],label:'x'.repeat(70000)})).error.code,'TOO_LARGE');assert.throws(()=>h.s.advance(-1));
});

test('control events carry audience values and large removals bound result/event IDs',()=>{
  const h=setup();seed(h);assert(h.s.execute(request(h.s,'controls',{controls:h.lesson.controls})).ok);
  assert(h.s.execute(request(h.s,'control',{controlId:'compass-speed',value:2})).ok);assert.equal(h.s.events().events.at(-1).value,2);
  for(let i=0;i<3;i++)assert(h.s.execute(request(h.s,'patch',{commands:Array.from({length:40},(_,k)=>({op:'create_node',node:{id:`many-${i}-${k}`,name:'Part',kind:'rectangle',artboardId:h.p.artboards[0].id,parentId:'compass-root',order:100+i*40+k,transform:[1,0,0,1,0,0],geometry:{width:1,height:1,fill:'#000000'}}}))})).ok);
  const r=h.s.execute(request(h.s,'patch',{commands:[{op:'remove_node',nodeId:'compass-root'}]}));assert(r.ok);assert.equal(r.changedTotal,138);assert.equal(r.changedIds.length,100);assert.equal(h.s.events().events.at(-1).changedIds.length,100);
});

test('playback, static reparent and a command-created machine retain validated source contracts',()=>{
  const h=setup();seed(h);const board=h.p.artboards[0].id;
  const r=h.s.execute(request(h.s,'patch',{commands:[
    {op:'set_playback',animationId:'compass-turn',playback:{mode:'ping-pong',iterations:2,speed:2}},
    {op:'create_node',node:{id:'lesson-group',name:'Static group',kind:'group',geometry:null,parentId:null,artboardId:board,order:1,transform:[1,0,0,1,100,100]}},
    {op:'reparent_node',nodeId:'compass-marker-3',parentId:'lesson-group'},
    {op:'create_machine',machine:{id:'lesson-machine',name:'Lesson controls',artboardId:board,entryStateId:'lesson-state',states:[{id:'lesson-state',name:'Turn',animationId:'compass-turn',position:[0,0]}],inputs:[{id:'lesson-enabled',name:'Enabled',type:'boolean',value:false}],transitions:[],listeners:[]}},
  ]}));assert(r.ok,JSON.stringify(r));assert.equal(h.s.snapshot().nodes.find(n=>n.id==='compass-marker-3').parentId,'lesson-group');
  assert.deepEqual(h.s.snapshot().animations[0].playback,{mode:'ping-pong',iterations:2,speed:2});
  assert(h.s.execute(request(h.s,'input',{machineId:'lesson-machine',inputId:'lesson-enabled',value:true})).ok);
  assert.equal(h.s.execute(request(h.s,'input',{machineId:'lesson-machine',inputId:'Enabled',value:false})).error.code,'MISSING_TARGET');
  const source=h.s.snapshot();assert.equal(h.s.execute(request(h.s,'patch',{commands:[{op:'set_playback',animationId:'compass-turn',playback:{mode:'loop',iterations:0,speed:0}}]})).ok,false);assert.deepEqual(h.s.snapshot(),source);
});

test('Agent shape controls and compound commands retain atomic history, scoped IDs and lock guards',()=>{
 const h=setup(),patch=commands=>h.s.execute(request(h.s,'patch',{commands}));
 let result=patch([{op:'create_shape',nodeId:'outer',preset:'circle',options:{width:180,parametric:true}},{op:'create_shape',nodeId:'inner',preset:'circle',options:{width:80,parametric:true}}]);assert(result.ok,JSON.stringify(result));assert.deepEqual(result.changedIds,['outer','inner']);assert.equal(h.history.revision,1);assert.equal(h.s.snapshot().schemaVersion,3);
 result=patch([{op:'set_shape_parameters',nodeId:'outer',changes:{width:240}},{op:'set_shape_parameters',nodeId:'inner',changes:{width:90}}]);assert(result.ok);assert.equal(h.s.snapshot().nodes[0].geometry.shape.options.width,240);h.history.undo();assert.equal(h.s.snapshot().nodes[0].geometry.shape.options.width,180);h.history.redo();
 const before=h.s.snapshot();assert.equal(patch([{op:'set_shape_parameters',nodeId:'outer',changes:{width:200}},{op:'set_shape_parameters',nodeId:'inner',changes:{width:-1}}]).ok,false);assert.deepEqual(h.s.snapshot(),before);
 assert(patch([{op:'combine_paths',nodeIds:['outer','inner'],fillRule:'evenodd'}]).ok);assert.equal(h.s.snapshot().nodes.length,1);assert.equal(h.s.snapshot().nodes[0].geometry.contours.length,1);assert.equal(h.s.snapshot().nodes[0].geometry.shape,undefined);result=patch([{op:'release_compound',nodeId:'outer'}]);assert(result.ok);assert.equal(result.changedIds.length,2);assert.equal(h.s.snapshot().nodes.length,2);h.history.undo();assert.equal(h.s.snapshot().nodes.length,1);
 h.history.undo();assert(patch([{op:'detach_shape',nodeId:'outer'}]).ok);assert.equal(h.s.snapshot().nodes[0].geometry.shape,undefined);h.history.transact('Lock inner',p=>p.editor.locked.push('inner'));assert.equal(patch([{op:'set_shape_parameters',nodeId:'inner',changes:{width:50}}]).error.code,'LOCKED');
 const safe=h.s.snapshot();assert.equal(patch([{op:'create_shape',nodeId:'outer',preset:'star',options:{parametric:true}}]).ok,false);assert.deepEqual(h.s.snapshot(),safe);assert.equal(patch([{op:'create_shape',nodeId:'outside',preset:'circle',options:{parentId:'other-artboard'}}]).ok,false);assert.deepEqual(h.s.snapshot(),safe);
});

test('Agent IK and weight patches keep chain scope, bounds, lock checks and atomic rollback',async()=>{
 const{chainScene}=await import('../fixtures/ik-chains.mjs');const{p,bones,target}=chainScene(4),history=new History(p),s=new CommandSession(p,{history});const patch=commands=>s.execute(request(s,'patch',{commands}));let result=patch([{op:'set_ik',nodeId:bones[3],constraint:{targetId:target,count:4,invert:true,strength:.5}}]);assert(result.ok,JSON.stringify(result));assert.equal(result.changedIds.length,4);assert.equal(s.snapshot().advanced.ik[0].invert,true);const before=s.snapshot();assert.equal(patch([{op:'set_ik',nodeId:bones[3],constraint:{targetId:target,count:Infinity,invert:false,strength:1}}]).ok,false);assert.deepEqual(s.snapshot(),before);assert.equal(patch([{op:'set_ik',nodeId:bones[3],constraint:{targetId:'outside',count:4,invert:false,strength:1}}]).ok,false);assert.deepEqual(s.snapshot(),before);
 const pathId='command-tendril';assert(patch([{op:'create_shape',nodeId:pathId,preset:'line',options:{parametric:false}},{op:'bind_skin',nodeId:pathId,boneIds:bones}]).ok);const point=s.snapshot().nodes.find(n=>n.id===pathId).geometry.points[0].id;assert(patch([{op:'set_skin_weights',nodeId:pathId,changes:[{pointId:point,control:'anchor',boneId:bones[0],value:.8}]}]).ok);assert(Math.abs(s.snapshot().nodes.find(n=>n.id===pathId).geometry.skin.weights[0].anchor.find(([id])=>id===bones[0])[1]-.8)<1/255);
 history.transact('Lock root',p=>p.editor.locked.push(bones[0]));const safe=s.snapshot();assert.equal(patch([{op:'set_ik',nodeId:bones[3],constraint:null}]).error.code,'LOCKED');assert.deepEqual(s.snapshot(),safe);
});
