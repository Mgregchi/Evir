import test from 'node:test';import assert from 'node:assert/strict';
import {createMotionLoop} from '../../apps/web/motion-loop.mjs';
test('Preview schedules no frames while inactive, clamps time and resumes without hidden-time jumps',()=>{
 let id=0;const queue=new Map(),deltas=[];
 const loop=createMotionLoop(dt=>deltas.push(dt),{request:cb=>{queue.set(++id,cb);return id;},cancel:id=>queue.delete(id)});
 const tick=now=>{const [id,cb]=queue.entries().next().value;queue.delete(id);cb(now);};
 assert.equal(queue.size,0);loop.setActive(true);loop.setActive(true);assert.equal(queue.size,1);tick(100);tick(2000);assert.deepEqual(deltas,[0,.05]);
 loop.setActive(false);assert.equal(queue.size,0);loop.setActive(true);tick(5000);assert.equal(deltas.at(-1),0);loop.stop();assert.equal(queue.size,0);
});
test('A renderer failure stops the loop and invokes recovery once',()=>{
 let pending,errors=0;const loop=createMotionLoop(()=>{throw Error('Draw failed');},{request:cb=>{pending=cb;return 1;},cancel:()=>{},onError:()=>errors++});
 loop.setActive(true);const cb=pending;pending=null;cb(1);assert.equal(errors,1);assert.equal(pending,null);
});
