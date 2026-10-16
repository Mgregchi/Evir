import test from 'node:test';
import assert from 'node:assert/strict';
import {FreehandDraft} from '../../packages/studio/freehand.mjs';
import {ContinuationDraft} from '../../packages/studio/path-continuation.mjs';
import {strokeCases} from '../fixtures/strokes.mjs';
import {validateProject,createProject} from '@evir/project-model';
import {History,addNode} from '@evir/authoring';
import {CommandSession} from '@evir/commands';

test('freehand centerlines keep constant editable width and support two-point open strokes',()=>{
  const draft=new FreehandDraft({artboardId:'board',zoom:1,smoothing:1,closed:true,style:'stroke',width:20});
  draft.down({x:30,y:20,pressure:.1});draft.move({x:90,y:20,pressure:1});draft.up({x:120,y:20,pressure:0});
  const g=draft.geometry();assert.equal(g.closed,false);assert.equal(g.fill,null);assert.equal(g.stroke.width,20);assert.equal(g.points.length,2);
  draft.configure({smoothing:1,closed:false,style:'stroke',width:32,pressure:false});assert.equal(draft.geometry().stroke.width,32);
});
test('endpoint continuation preserves native paint and point identity in one undo step',()=>{
  const p=strokeCases()[0],before=structuredClone(p),draft=new ContinuationDraft(p,'line');
  draft.down({x:225,y:200},1);draft.up();const h=new History(p);
  h.transact('extend',p=>draft.apply(p,draft.geometry()));const next=h.committed();validateProject(next);
  assert.deepEqual(next.nodes[0].geometry.stroke,before.nodes[0].geometry.stroke);
  assert.deepEqual(next.nodes[0].geometry.points.slice(0,3),before.nodes[0].geometry.points);
  h.undo();assert.deepEqual(h.committed(),p);
});
test('local command patches can add native stroke geometry and key width atomically',()=>{
  const p=createProject(),id=addNode(p,'rectangle',null,p.artboards[0].id),session=new CommandSession(p),geometry={...p.nodes[0].geometry,stroke:strokeCases()[0].nodes[0].geometry.stroke};
  const result=session.execute({schemaVersion:1,context:session.context,requestId:'stroke-update',expectedRevision:0,operation:'patch',payload:{commands:[{op:'update_node',nodeId:id,changes:{geometry}}]}});
  assert(result.ok,JSON.stringify(result));assert.equal(session.snapshot().schemaVersion,3);assert.equal(session.snapshot().nodes[0].geometry.stroke.width,14);
});
