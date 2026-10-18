import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,upgradeAdvanced,validateProject,worldTransform} from '@evir/project-model';
import {addNode,bindSkin,setSkinWeights,setWeight,History} from '@evir/authoring';
import {WeightBrush} from '../../packages/studio/weight-brush.mjs';
import {compileProject,importRiv} from '@evir/format';
export function fixture(){
 const p=createProject();p.id='weight-test-project';p.artboards[0].id='board';p.artboards[0].width=p.artboards[0].height=256;p.editor.cameras={board:{x:0,y:0,zoom:1}};
 const root=addNode(p,'group',null,'board');p.nodes.find(n=>n.id===root).transform=[.9,.2,-.2,1.1,24,25];
 const a=addNode(p,'bone',null,'board'),b=addNode(p,'bone',null,'board');p.nodes.find(n=>n.id===a).name='Root';p.nodes.find(n=>n.id===b).name='Tip';
 const id=addNode(p,'path',root,'board');bindSkin(p,id,[a,b]);return{p,id,a,b,root};
}
test('binding and normalized edits support paths and preserve deformed bind coordinates',()=>{
 const{p,id,a,b}=fixture(),n=p.nodes.find(n=>n.id===id),v=n.geometry.points[0];assert.deepEqual(n.geometry.skin.bindWorld,worldTransform(p,id));
 setSkinWeights(p,id,[{pointId:v.id,control:'anchor',boneId:a,value:1}]);assert.equal(n.geometry.skin.weights[0].anchor.find(([id])=>id===a)[1],1);
 n.geometry.skin.weights[0].anchor=[[a,1]];setWeight(p,id,v.id,'anchor',b,.4);assert.deepEqual(n.geometry.skin.weights[0].anchor,[[a,.6],[b,.4]]);
 assert.notDeepEqual(n.geometry.skin.weights[0].anchor,n.geometry.skin.weights[0].in);validateProject(p);
});
test('invalid batches, binding choices and hidden/locked ancestry reject without partial mutation',()=>{
 for(const change of [()=>({pointId:'missing',boneId:'x',value:.2}),f=>({pointId:f.p.nodes.find(n=>n.id===f.id).geometry.points[0].id,boneId:f.a,control:'anchor',value:NaN}),f=>({pointId:f.p.nodes.find(n=>n.id===f.id).geometry.points[0].id,boneId:'unbound',control:'anchor',value:.2})]){
  const f=fixture(),before=structuredClone(f.p),pointId=f.p.nodes.find(n=>n.id===f.id).geometry.points[0].id;assert.throws(()=>setSkinWeights(f.p,f.id,[{pointId,control:'anchor',boneId:f.a,value:1},change(f)]));assert.deepEqual(f.p,before);
 }
 const f=fixture();assert.throws(()=>bindSkin(f.p,f.id,[f.a,f.a]),/different bones/);for(const key of ['locked','hidden']){f.p.editor[key].push(f.root);const before=structuredClone(f.p);assert.throws(()=>setSkinWeights(f.p,f.id,[]),/Unlock and show/);assert.deepEqual(f.p,before);f.p.editor[key]=[];}
 bindSkin(f.p,f.id,[f.a]);const before=structuredClone(f.p);assert.throws(()=>setWeight(f.p,f.id,f.p.nodes.find(n=>n.id===f.id).geometry.points[0].id,'anchor',f.a,.2),/single bound bone/);assert.deepEqual(f.p,before);
});
test('swept weight gestures are event-rate independent, immutable at construction and one-step undoable',()=>{
 const{p,id,a}=fixture(),before=structuredClone(p);
 const make=()=>new WeightBrush({source:p,nodeId:id,boneId:a,control:'anchor',target:1,strength:.7,radius:90,zoom:1});
 const sparse=make(),dense=make();sparse.move({x:0,y:80});sparse.move({x:220,y:80});for(let x=0;x<=220;x+=2)dense.move({x,y:80});
 const q=structuredClone(p),r=structuredClone(p);sparse.apply(q);dense.apply(r);assert.deepEqual(q,r);assert.notDeepEqual(q,p);assert.deepEqual(p,before);
 const h=new History(p);h.begin('Paint');h.preview(q=>sparse.apply(q));h.preview(q=>dense.apply(q));h.commit();assert.deepEqual(h.committed(),q);h.undo();assert.deepEqual(h.committed(),p);h.redo();assert.deepEqual(h.committed(),q);
 h.begin('Cancel');h.preview(q=>dense.apply(q));h.cancel();assert.deepEqual(h.committed(),q);
});
test('brush is screen sized, capped and does not accumulate repeated stationary samples',()=>{
 const{p,id,a}=fixture(),one=new WeightBrush({source:p,nodeId:id,boneId:a,radius:50,target:1,strength:.4}),many=new WeightBrush({source:p,nodeId:id,boneId:a,radius:50,target:1,strength:.4});
 const at={x:70,y:70};one.move(at);for(let i=0;i<60;i++)many.move(at);const q=structuredClone(p),r=structuredClone(p);one.apply(q);many.apply(r);assert.deepEqual(q,r);
 assert.equal(new WeightBrush({source:p,nodeId:id,boneId:a,radius:50,zoom:2}).radius,25);
 assert.throws(()=>new WeightBrush({source:p,nodeId:id,boneId:a,radius:NaN}),/settings/);
 const large=structuredClone(p),n=large.nodes.find(n=>n.id===id);n.geometry.points=Array.from({length:1400},(_,i)=>({...n.geometry.points[0],id:'v'+i}));assert.throws(()=>new WeightBrush({source:large,nodeId:id,boneId:a}),/4,096/);
});

test('multi-bone mesh weights stay synchronized across anchor/control slots and survive native export/import',async()=>{
 const{readFileSync}=await import('node:fs'),p=JSON.parse(readFileSync('apps/web/assets/examples/gust.evir-project')),n=p.nodes.find(n=>n.kind==='mesh'),bones=n.geometry.skin.bones.map(b=>b.boneId);
 bindSkin(p,n.id,bones);setSkinWeights(p,n.id,[{pointId:n.geometry.vertices[0].id,control:'anchor',boneId:bones[2],value:.8}]);
 const w=n.geometry.skin.weights[0];assert.deepEqual(w.anchor,w.in);assert.deepEqual(w.anchor,w.out);assert.equal(w.anchor.find(([b])=>b===bones[2])[1],.8);validateProject(p);
 const imported=await importRiv(compileProject(p).bytes),mesh=imported.nodes.find(n=>n.kind==='mesh');assert.equal(mesh.geometry.skin.bones.length,3);assert.equal(mesh.geometry.skin.weights[0].anchor.find(([b])=>b===imported.nodes.find(n=>n.name==='scarf tip').id)[1],.8);
 const before=structuredClone(p);assert.throws(()=>setSkinWeights(p,n.id,[{pointId:n.geometry.vertices[0].id,control:'out',boneId:bones[0],value:1}]),/supported control/);assert.deepEqual(p,before);
});

test('four-bone edits preserve exact packed totals, missing influences and atomic invalid binding',()=>{
 const f=fixture(),c=addNode(f.p,'bone',null,'board'),d=addNode(f.p,'bone',null,'board');bindSkin(f.p,f.id,[f.a,f.b,c,d]);
 const n=f.p.nodes.find(n=>n.id===f.id),pointId=n.geometry.points[0].id;
 setSkinWeights(f.p,f.id,[{pointId,control:'anchor',boneId:d,value:.37}]);const w=n.geometry.skin.weights[0].anchor;
 assert.equal(w.length,4);assert.equal(w.reduce((v,[,weight])=>v+Math.round(weight*255),0),255);
 const before=structuredClone(f.p);assert.throws(()=>bindSkin(f.p,f.id,[f.a,f.b,c,d,'missing']),/one to four/);assert.deepEqual(f.p,before);
});
