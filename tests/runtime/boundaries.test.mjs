import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../../',import.meta.url);
const names=['project-model','runtime','renderer-canvas','authoring','format'];
test('package imports have an acyclic graph and cannot reach applications, tools or Rive runtime dependencies',()=>{
  const graph=new Map();
  for(const name of names) {
    const dir=new URL('packages/'+name+'/',root),manifest=JSON.parse(fs.readFileSync(new URL('package.json',dir)));
    graph.set(manifest.name,Object.keys(manifest.dependencies||{}));
    for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.mjs'))) {
      const source=fs.readFileSync(new URL(file,dir),'utf8');
      const imports=[...source.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+)['"]/g)].map(m=>m[1]);
      for(const spec of imports) {
        assert(!/apps|tools|research|rive-app/.test(spec),`${name}/${file}: ${spec}`);
        if(spec.startsWith('@evir/'))assert(Object.hasOwn(manifest.dependencies||{},spec.split('/').slice(0,2).join('/')),`${name}/${file}: undeclared dependency ${spec}`);
        else assert(spec.startsWith('./'),'Package imports must stay within explicit package dependencies');
      }
    }
  }
  const visit=(name,ancestors=new Set())=>{
    assert(!ancestors.has(name),'Dependency cycle at '+name);
    for(const dep of graph.get(name)){assert(graph.has(dep));visit(dep,new Set([...ancestors,name]));}
  };
  for(const name of graph.keys())visit(name);
});
