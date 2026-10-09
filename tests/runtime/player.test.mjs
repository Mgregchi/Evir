import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toRuntimeProject, validateRuntimeProject, openRuntimeProject, createProject} from '@evir/project-model';
import {createRuntime, loadRuntime, evaluate} from '@evir/runtime';
import {compileProject} from '@evir/format';
import {scenes} from '../editor/scenes.mjs';

test('runtime snapshots exclude editor state and preserve source, skinning, animation and input contracts',()=>{
  const {p,m,a}=scenes(),before=structuredClone(p);
  p.editor.hidden=p.nodes.map(n=>n.id);const source=structuredClone(p);
  const player=createRuntime(p,{machineId:m}),scene=player.snapshot();
  assert.equal(scene.format,'evir-runtime');assert(!('editor' in scene));
  assert(scene.machines.every(m=>m.states.every(s=>!('position' in s))));
  assert.deepEqual(p,source);assert.deepEqual(scene.nodes,before.nodes);
  validateRuntimeProject(scene);
  assert.deepEqual(player.pose(),evaluate(scene,a,0));
  scene.nodes[0].name='Outside mutation';assert.notEqual(player.snapshot().nodes[0].name,'Outside mutation');
  player.artboard.width=1;assert.equal(player.artboard.width,256);
});

test('runtime validates input types and preserves transitions, trigger consumption, click and reset',()=>{
  const {p,m,front}=scenes(),player=createRuntime(p,{machineId:m});
  assert.equal(player.state.name,'Bend');
  player.setInput('enabled',true);assert.equal(player.state.name,'Bend');
  player.setInput('amount',2);assert.equal(player.state.name,'Active');
  player.setInput('enabled',false);player.setInput('amount',-1);assert.equal(player.state.name,'Bend');
  player.reset();player.setInput('go',true);assert.equal(player.state.name,'Active');
  player.reset();assert.equal(player.state.name,'Bend');player.advance(.25);
  player.click(front);assert.equal(player.state.name,'Active');
  player.reset();assert.equal(player.state.name,'Bend');
  assert.throws(()=>player.setInput('enabled',3));assert.throws(()=>player.setInput('amount',NaN));
  assert.throws(()=>player.setInput('missing',true));assert.throws(()=>player.click('missing'));
  assert.throws(()=>player.advance(-1));assert.throws(()=>player.advance(Infinity));
});

test('runtime seconds match source keyframe evaluation, loop/clamp and reset',()=>{
  const {p,a}=scenes(),player=createRuntime(p,{animationId:a}),scene=player.snapshot();
  assert.deepEqual(player.advance(.5),evaluate(scene,a,30));
  assert.deepEqual(player.advance(2),evaluate(scene,a,30));
  assert.deepEqual(player.reset(),evaluate(scene,a,0));
  p.animations[0].loop=false;const once=createRuntime(p,{animationId:a});
  assert.deepEqual(once.advance(100),evaluate(once.snapshot(),a,120));
  assert.throws(()=>player.setInput('go',true));
});

test('runtime JSON loader validates references, schema and asset hashes without editor metadata',async()=>{
  const {p,m}=scenes();
  const fromSource=await loadRuntime(JSON.stringify(p),{machineId:m});
  const fromSnapshot=await loadRuntime(JSON.stringify(toRuntimeProject(p)),{machineId:m});
  assert.deepEqual(fromSource.pose(),fromSnapshot.pose());
  const scene=toRuntimeProject(p);scene.editor={};assert.throws(()=>validateRuntimeProject(scene));
  delete scene.editor;scene.machines[0].states[0].position=[0,0];assert.throws(()=>validateRuntimeProject(scene));
  delete scene.machines[0].states[0].position;scene.nodes[0].parentId='missing';assert.throws(()=>validateRuntimeProject(scene));
  assert.throws(()=>createRuntime(p,{animationId:'missing'}));
  assert.throws(()=>createRuntime(p,{machineId:m,animationId:p.animations[0].id}));
  assert.throws(()=>createRuntime(p,{artboardId:'missing'}));
  const assetProject=createProject();assetProject.assets=[{id:'asset-one',name:'Test bytes',mimeType:'image/png',sha256:'0'.repeat(64),data:'AQID'}];
  await assert.rejects(()=>openRuntimeProject(JSON.stringify(toRuntimeProject(assetProject))),/hash mismatch/);
  await assert.rejects(()=>openRuntimeProject('{'),/invalid JSON/);
});

test('format package embeds the pinned schema and preserves published showcase bytes',()=>{
  for(const name of ['milo','orbit']) {
    const source=JSON.parse(readFileSync(new URL(`../../apps/site/assets/examples/${name}.evir-project`,import.meta.url)));
    assert.deepEqual(Buffer.from(compileProject(source).bytes),readFileSync(new URL(`../../apps/site/assets/examples/${name}.riv`,import.meta.url)));
  }
});
