// Test-only binary construction for hostile/unsupported semantic-import cases.
import {runtimeSchema} from '@evir/format';
export function encodeRecords(records) {
  const out=[82,73,86,69,7,0,0,0], types=new Map(Object.entries(runtimeSchema.types).map(([id,t])=>[t.name,{id:Number(id),...t}]));
  const uint=v=>{do{const byte=v%128;v=Math.floor(v/128);out.push(byte+(v?128:0));}while(v);};
  const float=v=>{const raw=new Uint8Array(4);new DataView(raw.buffer).setFloat32(0,v,true);out.push(...raw);};
  for(const r of records) {
    const type=types.get(r.type);uint(type.id);
    for(const [field,value] of Object.entries(r.fields)) {
      let current=type;while(current&&!Object.hasOwn(current.properties,field))current=types.get(current.parent);
      const key=current.properties[field],wire=runtimeSchema.properties[key].wire;uint(key);
      if(wire==='uint')uint(value);
      else if(wire==='bool')out.push(Number(value));
      else if(wire==='float')float(value);
      else if(wire==='color'){for(let i=0;i<4;i++)out.push((value>>>(i*8))&255);}
      else if(wire==='string'||wire==='bytes'){const raw=wire==='string'?new TextEncoder().encode(value):value;uint(raw.length);out.push(...raw);}
      else throw Error('Unknown test wire '+wire);
    }
    uint(0);
  }
  return Uint8Array.from(out);
}
