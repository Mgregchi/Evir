import test from'node:test';import assert from'node:assert/strict';import{validateProject,worldTransform,mapPoint,toRuntimeProject}from'@evir/project-model';import{evaluate}from'@evir/runtime';import{compileProject,importRiv}from'@evir/format';import{chainScene}from'../fixtures/ik-chains.mjs';
test('Longer IK chains retain lengths, independent base transforms, FK zero strength and native contracts',async()=>{
 for(const count of [3,4,8])for(const strength of [0,.5,1])for(const invert of [false,true]){const{p,bones,base}=chainScene(count,{strength,invert});validateProject(p);const before=structuredClone(p),pose=evaluate(p,p.animations[0].id,30);assert.deepEqual(p,before);assert.deepEqual(pose.nodes.find(n=>n.id===base).transform,p.nodes.find(n=>n.id===base).transform);for(const id of bones){const n=pose.nodes.find(n=>n.id===id),m=worldTransform(pose,id),a=mapPoint(m,[0,0]),b=mapPoint(m,[n.geometry.length,0]);assert(Math.abs(Math.hypot(b[0]-a[0],b[1]-a[1])-36)<1e-7);if(!strength)assert.deepEqual(n.transform,p.nodes.find(v=>v.id===id).transform);}const imported=await importRiv(compileProject(p).bytes);assert.equal(imported.advanced.ik[0].count,count);assert.equal(imported.advanced.ik[0].strength,strength);assert.equal(toRuntimeProject(p).advanced.ik[0].count,count);}
});
test('Long IK rejects out-of-budget, missing, overlapping and nonunit chains',()=>{
 for(const edit of [p=>p.advanced.ik[0].count=9,p=>p.advanced.ik[0].count=3.5,p=>p.advanced.ik[0].count=8,p=>p.nodes.find(n=>n.kind==='bone').transform[0]=2,p=>p.advanced.ik.push({...p.advanced.ik[0]})]){const{p}=chainScene(4);edit(p);assert.throws(()=>validateProject(p));}
});

test('Coincident, aligned and unreachable long-chain targets stay finite without mutating the source',()=>{
 for(const[count,x,y]of [[4,140,250],[4,284,250],[8,490,40]])for(const invert of [true,false]){const{p,target}=chainScene(count,{invert});p.animations=[];p.nodes.find(n=>n.id===target).transform=[1,0,0,1,x,y];const before=structuredClone(p),pose=evaluate(p,null,0);for(const n of pose.nodes)assert(n.transform.every(Number.isFinite));assert.deepEqual(p,before);}
});
