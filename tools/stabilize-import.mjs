export function stableImport(p,name) {
  // New IDs are normally random. Evidence/example generation gives them stable
  // names without changing any geometry, reference, key or camera semantics.
  const ids=new Map(),counts=new Map();
  const visit=v=>{if(!v||typeof v!=='object')return;if(v.id&&!ids.has(v.id)){const kind=v.id.split('-')[0],i=(counts.get(kind)??0)+1;counts.set(kind,i);ids.set(v.id,`${name}-${kind}-${i}`);}for(const child of Object.values(v))visit(child);};visit(p);
  const replace=v=>typeof v==='string'?(ids.get(v)??v):Array.isArray(v)?v.map(replace):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[ids.get(k)??k,replace(x)])):v;
  const result=replace(p);result.id=name+'-project';result.name=name;return result;
}
