import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,validateProject,serializeProject,openProject} from '@evir/project-model';
import {SHAPES,shapeGeometry,addShape,addNode,History} from '@evir/authoring';
import {compileProject,importRiv} from '@evir/format';
import {evaluate} from '@evir/runtime';
import {firstBounce} from '../../apps/web/shape-scene.mjs';

test('Every preset is editable source, has isolated point IDs and round-trips without preset metadata',async()=>{
  const p=createProject(),seen=new Set();
  for(const shape of SHAPES){
    const id=addShape(p,shape.id),n=p.nodes.find(n=>n.id===id);assert.equal(n.name,shape.name);
    for(const point of n.geometry.points??[]){assert(!seen.has(point.id));seen.add(point.id);}
    assert(!Object.hasOwn(n,'preset'));validateProject(p);
  }
  assert.equal(SHAPES.length,14);assert.equal(p.nodes.length,14);
  assert.deepEqual(await openProject(await serializeProject(p)),p);
  const before=structuredClone(p),compiled=compileProject(p);assert.deepEqual(p,before);
  const imported=await importRiv(compiled.bytes);assert.equal(imported.nodes.length,14);validateProject(imported);
});
test('Curved presets use actual cubic handles; circle locks aspect and polygon/star counts are bounded',()=>{
  const circle=shapeGeometry('circle',{width:96,height:30});assert.equal(circle.height,96);
  assert.equal(circle.geometry.points.length,4);assert(circle.geometry.points.some(p=>p.out[0]!==p.anchor[0]||p.out[1]!==p.anchor[1]));
  assert.equal(shapeGeometry('ellipse',{width:200,height:50}).height,50);
  for(const count of[3,7,12]){
    assert.equal(shapeGeometry('polygon',{sides:count}).geometry.points.length,count);
    assert.equal(shapeGeometry('star',{sides:count}).geometry.points.length,count*2);
  }
  const star=shapeGeometry('star',{width:100,height:100,sides:5,inner:25});
  assert(Math.abs(Math.hypot(...star.geometry.points[1].anchor.map(v=>v-50))-12.5)<1e-9);
  for(const id of['rounded','capsule','heart','cloud','bubble'])assert(shapeGeometry(id).geometry.points.some(p=>JSON.stringify(p.anchor)!==JSON.stringify(p.out)));
  const square=shapeGeometry('rounded',{radius:0}).geometry;
  assert.equal(square.points.length,4);assert(square.points.every(p=>JSON.stringify(p.anchor)===JSON.stringify(p.in)&&JSON.stringify(p.anchor)===JSON.stringify(p.out)));
  assert.equal(shapeGeometry('bubble',{radius:0}).geometry.points.length,7);
});
test('Line retains an open centerline and editable stroke, upgrading only successful documents',()=>{
  const p=createProject();addShape(p,'line',{width:200,strokeWidth:7,fill:'#d59880'});
  const g=p.nodes[0].geometry;assert.equal(g.closed,false);assert.equal(g.fill,null);assert.equal(g.points.length,2);
  assert.equal(g.stroke.width,7);assert.equal(g.stroke.color,'#d59880');assert.equal(p.schemaVersion,3);validateProject(p);
});
test('Invalid drafts reject atomically, including invalid dimensions, geometry options, paint and scope',()=>{
  for(const[preset,options]of[['unknown',{}],['circle',{width:NaN}],['ellipse',{height:0}],['star',{sides:2}],['star',{sides:3.5}],['star',{inner:99}],['polygon',{sides:13}],['rounded',{width:20,height:20,radius:11}],['line',{strokeWidth:0}],['line',{name:''}],['heart',{fill:'red'}],['cloud',{x:Infinity}],['circle',{parentId:'missing'}],['circle',{artboardId:'missing'}]]){
    const p=createProject(),before=structuredClone(p);assert.throws(()=>addShape(p,preset,options));assert.deepEqual(p,before);
  }
});
test('Placement respects active artboard, parent coordinates, stacking and locked ancestors',()=>{
  const p=createProject();p.artboards.push({id:'other-board',name:'Other',width:800,height:600});p.editor.cameras['other-board']={x:0,y:0,zoom:1};
  const id=addShape(p,'circle',{width:100,artboardId:'other-board'});assert.deepEqual(p.nodes[0].transform,[1,0,0,1,350,250]);
  const group=addNode(p,'group',null,'other-board'),child=addShape(p,'heart',{parentId:group});
  assert.equal(p.nodes.find(n=>n.id===child).artboardId,'other-board');assert.deepEqual(p.nodes.find(n=>n.id===child).transform,[1,0,0,1,25,25]);
  const another=addShape(p,'star',{parentId:group});assert.equal(p.nodes.find(n=>n.id===another).order,1);
  p.editor.locked.push(group);const before=structuredClone(p);assert.throws(()=>addShape(p,'line',{parentId:group}),/locked/);assert.deepEqual(p,before);
  assert.throws(()=>addShape(p,'circle',{parentId:id}),/group or bone/);
  assert.throws(()=>addShape(p,'circle',{parentId:group,artboardId:p.artboards[0].id}),/another artboard/);
});
test('One history operation adds a shape and undo/redo preserves its identity and editable points',()=>{
  const p=createProject(),h=new History(p);let id;h.transact('Add star',p=>id=addShape(p,'star',{sides:7}));
  const added=h.snapshot();h.undo();assert.equal(h.snapshot().nodes.length,0);h.redo();assert.deepEqual(h.snapshot(),added);assert.equal(h.snapshot().nodes[0].id,id);
});
test('Finished beginner lesson matches the three documented keys and preserves its Design pose',()=>{
  const p=firstBounce();validateProject(p);const a=p.animations[0],n=p.nodes[0];
  assert.deepEqual([p.artboards[0].width,p.artboards[0].height],[640,480]);assert.equal(n.name,'Sun');assert.equal(a.name,'Bounce');
  assert.deepEqual(a.tracks[0].keys.map(k=>[k.frame,k.value]),[[0,220],[60,100],[120,220]]);
  assert.deepEqual([0,30,60,90,120].map(frame=>evaluate(p,a.id,frame).nodes[0].transform[5]),[220,160,100,160,220]);
  assert.equal(n.transform[5],220);assert.deepEqual(a.playback,{mode:'loop',iterations:0,speed:1});
});
