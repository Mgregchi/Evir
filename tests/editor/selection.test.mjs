import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject, worldTransform} from '@evir/project-model';
import {addNode,History} from '@evir/authoring';
import {prepareSelectionMove,applySelectionMove,selectionRoots,marqueeTargets,selectionBounds} from '../../packages/studio/selection.mjs';
const node=(p,id)=>p.nodes.find(n=>n.id===id);
test('Multiple selection uses world deltas under distinct affine parents and one history step',()=>{
 const p=createProject(),g1=addNode(p,'group'),g2=addNode(p,'group'),a=addNode(p,'rectangle',g1),b=addNode(p,'rectangle',g2);
 node(p,g1).transform=[0,2,-.5,0,180,60];node(p,g2).transform=[.8,.2,.5,1.2,30,40];
 const before=[a,b].map(id=>worldTransform(p,id));const prepared=prepareSelectionMove(p,[a,b]);const h=new History(p);
 h.begin('Move selection');h.preview(source=>applySelectionMove(source,prepared,12,5));h.preview(source=>applySelectionMove(source,prepared,35,-20));h.commit();
 [a,b].forEach((id,i)=>{const m=worldTransform(h.committed(),id);assert(Math.abs(m[4]-before[i][4]-35)<1e-9);assert(Math.abs(m[5]-before[i][5]+20)<1e-9);});
 h.undo();assert.deepEqual(h.committed(),p);h.redo();assert.notDeepEqual(h.committed(),p);
});
test('Selected ancestors move descendants once and invalid members reject preparation before mutation',()=>{
 const p=createProject(),g=addNode(p,'group'),a=addNode(p,'rectangle',g),b=addNode(p,'rectangle');
 assert.deepEqual(selectionRoots(p,[g,a]).map(n=>n.id),[g]);const before=worldTransform(p,a);
 applySelectionMove(p,prepareSelectionMove(p,[g,a]),10,20);const after=worldTransform(p,a);assert.equal(after[4]-before[4],10);assert.equal(after[5]-before[5],20);
 p.editor.locked.push(b);const saved=structuredClone(p);assert.throws(()=>prepareSelectionMove(p,[a,b]),/Unlock/);assert.deepEqual(p,saved);
 p.editor.locked=[];node(p,g).transform=[0,0,0,1,10,20];assert.throws(()=>prepareSelectionMove(p,[a,b]),/singular/);
});
test('Marquee respects enclosure, ancestry, hidden and locked layers',()=>{
 const p=createProject(),g=addNode(p,'group'),a=addNode(p,'rectangle',g),b=addNode(p,'rectangle');
 const bounds=selectionBounds(p,[g,b]),box={x:bounds.x-1,y:bounds.y-1,width:bounds.width+2,height:bounds.height+2};
 assert.deepEqual(marqueeTargets(p,p.artboards[0].id,box),[g,b]);assert.deepEqual(marqueeTargets(p,p.artboards[0].id,box,true),[a,b]);
 assert.deepEqual(marqueeTargets(p,p.artboards[0].id,{...box,width:1}),[]);
 p.editor.locked.push(g);assert.deepEqual(marqueeTargets(p,p.artboards[0].id,box,true),[b]);p.editor.hidden.push(b);assert.deepEqual(marqueeTargets(p,p.artboards[0].id,box),[]);
});
