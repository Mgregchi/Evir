export class CommandError extends Error {
  constructor(code,message){super(message);this.code=code;}
}
export function fail(code,message){throw new CommandError(code,message);}
export function object(value,required,optional=[]){
  if(!value||typeof value!=='object'||Array.isArray(value))fail('INVALID_ARGUMENT','Expected object');
  for(const key of required)if(!Object.hasOwn(value,key))fail('INVALID_ARGUMENT',`Missing ${key}`);
  for(const key of Object.keys(value))if(![...required,...optional].includes(key))fail('INVALID_ARGUMENT',`Unknown field ${key}`);
}
export function text(value,label,max=120){if(typeof value!=='string'||!value.trim()||value.length>max)fail('INVALID_ARGUMENT',`${label} must be 1–${max} characters`);}
export function integer(value,label,min,max){if(!Number.isInteger(value)||value<min||value>max)fail('INVALID_ARGUMENT',`${label} must be ${min}–${max}`);}
export function encoded(value){
  let json;
  try{json=JSON.stringify(value);}catch{fail('INVALID_ARGUMENT','Commands must be JSON data');}
  if(!json||new TextEncoder().encode(json).length>65536)fail('TOO_LARGE','Command payload exceeds 64 KiB');
  // Also detach accepted objects from the caller. Canonical form ignores key order.
  const detached=JSON.parse(json);
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  return {value:detached,fingerprint:JSON.stringify(canonical(detached))};
}
