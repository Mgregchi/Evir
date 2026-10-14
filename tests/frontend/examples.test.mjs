import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {examples} from '../../apps/web/examples.mjs';
import {validateProject} from '@evir/project-model';import {compileProject} from '@evir/format';import {evaluate,createRuntime} from '@evir/runtime';import {worldPoints} from '@evir/runtime/geometry';
const source=id=>JSON.parse(fs.readFileSync(new URL(`../../apps/web/assets/examples/${id}.evir-project`,import.meta.url)));
test('Every registered study has valid editable source and its exact compatible export',()=>{
 assert.equal(new Set(examples.map(e=>e.id)).size,examples.length);
 for(const example of examples){const p=source(example.id);validateProject(p);assert.equal(p.id,`${example.id}-project`);assert.deepEqual(Buffer.from(compileProject(p).bytes),fs.readFileSync(new URL(`../../apps/web/assets/examples/${example.id}.riv`,import.meta.url)));}
});
test('Bloom contains mixed independent control weights and a visible deforming stem',()=>{
 const p=source('bloom'),stem=p.nodes.find(n=>n.id==='bloom-flexible-stem');
 assert(stem.geometry.skin.weights.some(w=>w.anchor.some(([,v])=>v>0&&v<1)&&JSON.stringify(w.in)!==JSON.stringify(w.out)));
 const rest=worldPoints(p,stem);assert(rest.every(v=>v.anchor[0]>=0&&v.anchor[0]<=512&&v.anchor[1]>=0&&v.anchor[1]<=512));
 const moved=worldPoints(evaluate(p,'bloom-breeze',30),stem);assert(moved.some((v,i)=>Math.hypot(v.anchor[0]-rest[i].anchor[0],v.anchor[1]-rest[i].anchor[1])>5));
});
test('Tempo demonstrates distinct hold/linear/cubic timing and color changes',()=>{
 const p=source('tempo'),pose=evaluate(p,'tempo-rhythm',7),get=(p,id)=>p.nodes.find(n=>n.id===`tempo-${id}-column`).geometry;
 assert.equal(get(pose,'stepped').height,get(p,'stepped').height);assert.notEqual(get(pose,'smooth').height,get(pose,'linear').height);assert.notEqual(get(evaluate(p,'tempo-rhythm',60),'smooth').fill,get(p,'smooth').fill);
});
test('Signal gates typed inputs, consumes early triggers and restores defaults on reset',()=>{
 const p=source('signal'),r=createRuntime(p,{machineId:'signal-flow'});assert.equal(r.state.name,'Waiting');r.setInput('celebrate',true);r.setInput('level',75);assert.equal(r.state.name,'Waiting');r.setInput('enabled',true);assert.equal(r.state.name,'Ready');r.setInput('level',20);assert.equal(r.state.name,'Waiting');r.setInput('level',75);r.click('signal-celebration-pad');assert.equal(r.state.name,'Celebrating');r.reset();assert.equal(r.state.name,'Waiting');r.setInput('level',75);assert.equal(r.state.name,'Waiting');
});
test('Measure provides a separately validated guide preset and three independent alignment roots',async()=>{
 const {validateGuides}=await import('../../packages/studio/guides.mjs');
 const p=source('measure'),preset=JSON.parse(fs.readFileSync(new URL('../../apps/web/assets/examples/measure.guides.json',import.meta.url)));
 validateGuides(preset);assert.equal(preset.guides.length,2);assert.equal(preset.grid.spacing,32);
 const ids=['measure-card-1','measure-reference-card','measure-card-3'];
 assert(ids.every(id=>p.nodes.some(n=>n.id===id&&n.kind==='group'&&n.parentId===null)));
 assert.equal(Object.hasOwn(p.editor,'guides'),false);
});
test('Sprig retains the open seed geometry and paint while its continuation recipe reproduces the finished study',async()=>{
 const {ContinuationDraft}=await import('../../packages/studio/path-continuation.mjs');
 const final=source('sprig'),start=source('sprig-start'),recipe=JSON.parse(fs.readFileSync(new URL('../../apps/web/assets/examples/sprig.continuation.json',import.meta.url)));
 validateProject(start);assert.deepEqual(Buffer.from(compileProject(start).bytes),fs.readFileSync(new URL('../../apps/web/assets/examples/sprig-start.riv',import.meta.url)));
 const draft=new ContinuationDraft(start,recipe.nodeId,{endpoint:recipe.endpoint,closed:recipe.closed});
 for(const [i,point]of recipe.points.entries()){draft.appendLocal(point.anchor,point.out);draft.points.at(-1).id=`sprig-extension-point-${i+1}`;}
 draft.apply(start,draft.geometry());assert.deepEqual(start,final);
});
