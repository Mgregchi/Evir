import test from 'node:test';import assert from 'node:assert/strict';
import{createProject,upgradeAdvanced,validateProject,propertiesFor,serializeProject,openProject}from'@evir/project-model';
import{addNode,createAnimation,setKey,History}from'@evir/authoring';import{compileProject,importRiv,readRiv}from'@evir/format';import{evaluate}from'@evir/runtime';import{getValue}from'@evir/runtime/geometry';
import{defaultStroke}from'@evir/project-model';
import{gradientStroke}from'../fixtures/gradient-strokes.mjs';
test('Gradient stroke geometry and keyed paint roundtrip through native import for each paint kind',async()=>{
 for(const type of ['linear','radial']){const p=gradientStroke(type),n=p.nodes[0];validateProject(p);const properties=propertiesFor(n);assert(!properties.includes('stroke.color'));assert(properties.includes('stroke.paint.stop.1.color'));const before=structuredClone(p),pose=evaluate(p,p.animations[0].id,30);assert.equal(getValue(pose.nodes[0],'stroke.paint.endX'),155);assert.equal(getValue(pose.nodes[0],'stroke.paint.stop.0.color'),'#6bbbc6ff');assert.deepEqual(p,before);const bytes=compileProject(p).bytes,records=readRiv(bytes).records;assert(records.some(r=>r.type===(type==='linear'?'LinearGradient':'RadialGradient')));const imported=await importRiv(bytes);assert.deepEqual(imported.nodes[0].geometry.stroke,n.geometry.stroke);assert.deepEqual(evaluate(imported,imported.animations[0].id,30).nodes[0].geometry.stroke,pose.nodes[0].geometry.stroke);assert.deepEqual((await openProject(await serializeProject(p))).nodes,p.nodes);}
});
test('Malformed gradient stroke paints and invalid track conversions reject atomically',()=>{
 const p=gradientStroke(),h=new History(p);for(const edit of [q=>q.nodes[0].geometry.stroke.color.stops=[],q=>q.nodes[0].geometry.stroke.color.end=[0,0],q=>q.nodes[0].geometry.stroke.color='red',q=>q.nodes[0].geometry.stroke.color='#ffffff',q=>q.animations[0].tracks[1].property='stroke.color']){assert.throws(()=>h.transact('Invalid paint',edit));assert.deepEqual(h.snapshot(),p);}
});

test('Solid and gradient skinned strokes preserve paint, bindings and bone animation through native import',async()=>{
 const{skinnedStroke}=await import('../fixtures/gradient-strokes.mjs');for(const type of ['solid','linear','radial']){const p=await skinnedStroke(type);validateProject(p);const before=structuredClone(p),imported=await importRiv(compileProject(p).bytes);assert.deepEqual(imported.nodes.find(n=>n.kind==='path').geometry.stroke,p.nodes[0].geometry.stroke);assert.equal(imported.nodes.find(n=>n.kind==='path').geometry.skin.bones.length,2);const pose=evaluate(p,p.animations[0].id,60);assert(pose.nodes.find(n=>n.kind==='bone'&&n.parentId).transform[1]>.5);assert.deepEqual(p,before);}
});

test('Skinned stroke bounds contain the deformed painted envelope rather than the bind-pose centerline',async()=>{
 const{skinnedStroke}=await import('../fixtures/gradient-strokes.mjs'),{worldPoints}=await import('@evir/runtime/geometry'),{worldTransform}=await import('@evir/project-model'),{nodeBounds}=await import('@evir/renderer-canvas');const p=await skinnedStroke(),pose=evaluate(p,p.animations[0].id,60),n=pose.nodes[0],b=nodeBounds(pose,n),m=worldTransform(pose,n.id),radius=n.geometry.stroke.width/2;for(const point of worldPoints(pose,n))for(const key of ['anchor','in','out'])for(const dx of [-radius,radius])for(const dy of [-radius,radius]){const x=point[key][0]+m[0]*dx+m[2]*dy,y=point[key][1]+m[1]*dx+m[3]*dy;assert(x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height);}
});
