import {newId,ProjectError} from './primitives.mjs';
import {defaultStroke} from './stroke.mjs';

export const SHAPES = Object.freeze([
  ['rectangle','Rectangle','Basic'], ['rounded','Rounded rectangle','Basic'],
  ['circle','Circle','Basic'], ['ellipse','Ellipse','Basic'], ['triangle','Triangle','Basic'],
  ['diamond','Diamond','Basic'], ['polygon','Polygon','Basic'], ['star','Star','Basic'],
  ['line','Line','Basic'], ['capsule','Capsule','Decorative'], ['arrow','Arrow','Decorative'],
  ['heart','Heart','Decorative'], ['cloud','Cloud','Decorative'], ['bubble','Speech bubble','Decorative'],
].map(([id,name,category])=>Object.freeze({id,name,category})));

const fail = message => {throw new ProjectError(['shape: '+message]);};
function number(value,name,min,max,integer=false){
  if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))
    fail(`${name} must be ${integer?'a whole number':'a number'} in [${min},${max}]`);
  return value;
}
// Canonical geometry shared by validation and authoring. Paint remains independent.
export function shapeGeometry(preset,options={},pointId=()=>newId('point')){
  if(!SHAPES.some(s=>s.id===preset))fail('Unknown shape');
  const w=number(options.width??120,'Width',2,4096),
    h=preset==='circle'?w:number(options.height??100,'Height',2,4096),
    fill=options.fill??'#89e4c4';
  if(typeof fill!=='string'||!/^#[a-f\d]{6}([a-f\d]{2})?$/i.test(fill))fail('Color must be a hex color');
  if(preset==='rectangle')return {kind:'rectangle',width:w,height:h,geometry:{width:w,height:h,fill}};
  const points=[];
  const point=(x,y)=>({id:pointId(),anchor:[x,y],in:[x,y],out:[x,y]});
  const move=(x,y)=>points.push(point(x,y));
  const line=(x,y)=>{if(points.at(-1)?.anchor[0]!==x||points.at(-1)?.anchor[1]!==y)move(x,y);};
  const curve=(a,b,c,d,x,y)=>{points.at(-1).out=[a,b];const p=point(x,y);p.in=[c,d];points.push(p);};
  const polygon=vertices=>{for(const[x,y]of vertices)line(x*w,y*h);};
  const round=(r,bubble=false)=>{
    if(r===0){
      polygon(bubble?[[0,0],[1,0],[1,.76],[.62,.76],[.37,1],[.37,.76],[0,.76]]:[[0,0],[1,0],[1,1],[0,1]]);
      return;
    }
    const k=.5522847498307936*r,bottom=bubble?h*.76:h;
    move(r,0);line(w-r,0);curve(w-r+k,0,w,r-k,w,r);line(w,bottom-r);
    curve(w,bottom-r+k,w-r+k,bottom,w-r,bottom);
    if(bubble){line(w*.62,bottom);line(w*.37,h);line(w*.37,bottom);}
    line(r,bottom);curve(r-k,bottom,0,bottom-r+k,0,bottom-r);line(0,r);curve(0,r-k,r-k,0,r,0);
  };
  if(preset==='circle'||preset==='ellipse'){
    const rx=w/2,ry=h/2,k=.5522847498307936;
    move(w,ry);curve(w,ry+k*ry,rx+k*rx,h,rx,h);curve(rx-k*rx,h,0,ry+k*ry,0,ry);
    curve(0,ry-k*ry,rx-k*rx,0,rx,0);curve(rx+k*rx,0,w,ry-k*ry,w,ry);
  }else if(preset==='rounded'||preset==='capsule'||preset==='bubble'){
    const maximum=Math.min(w,(preset==='bubble'?.76:1)*h)/2;
    const r=preset==='capsule'?maximum:number(options.radius??Math.min(20,maximum),'Corner radius',0,maximum);
    round(r,preset==='bubble');
  }else if(preset==='triangle')polygon([[.5,0],[1,1],[0,1]]);
  else if(preset==='diamond')polygon([[.5,0],[1,.5],[.5,1],[0,.5]]);
  else if(preset==='polygon'||preset==='star'){
    const count=number(options.sides??(preset==='star'?5:6),preset==='star'?'Points':'Sides',3,12,true),
      inner=preset==='star'?number(options.inner??45,'Inner radius (%)',10,90)/100:1;
    for(let i=0;i<count*(preset==='star'?2:1);i++){
      const angle=-Math.PI/2+Math.PI*2*i/(count*(preset==='star'?2:1)),r=preset==='star'&&i%2?inner:1;
      line((.5+Math.cos(angle)*r/2)*w,(.5+Math.sin(angle)*r/2)*h);
    }
  }else if(preset==='arrow')polygon([[0,.32],[.58,.32],[.58,0],[1,.5],[.58,1],[.58,.68],[0,.68]]);
  else if(preset==='heart'){
    move(w*.5,h*.25);
    curve(w*.22,-h*.1,-w*.12,h*.18,w*.08,h*.48);
    curve(w*.18,h*.66,w*.36,h*.84,w*.5,h);
    curve(w*.64,h*.84,w*.82,h*.66,w*.92,h*.48);
    curve(w*1.12,h*.18,w*.78,-h*.1,w*.5,h*.25);
  }else if(preset==='cloud'){
    move(w*.22,h*.88);
    curve(-w*.07,h*.88,-w*.05,h*.38,w*.2,h*.36);
    curve(w*.14,-h*.02,w*.6,-h*.12,w*.66,h*.28);
    curve(w*.85,h*.09,w*1.06,h*.4,w*.88,h*.54);
    curve(w*1.09,h*.84,w*.83,h*.98,w*.68,h*.88);
    line(w*.22,h*.88);
  }else if(preset==='line'){move(0,h/2);line(w,h/2);}
  if(preset!=='line'&&points.length>1){
    const first=points[0],last=points.at(-1);
    if(first.anchor[0]===last.anchor[0]&&first.anchor[1]===last.anchor[1]){first.in=last.in;points.pop();}
  }
  const geometry={closed:preset!=='line',fill:preset==='line'?null:fill,skin:null,points};
  if(preset==='line')geometry.stroke={...defaultStroke(fill),width:number(options.strokeWidth??4,'Stroke width',.1,128)};
  return {kind:'path',width:w,height:h,geometry};
}

export function shapeOptionKeys(type){return ['width',...(type!=='circle'?['height']:[]),...(['rounded','bubble'].includes(type)?['radius']:[]),...(['star','polygon'].includes(type)?['sides']:[]),...(type==='star'?['inner']:[])];}
export function canonicalShape(type,options={}){
 const result=shapeGeometry(type,options),{width,height}=result;
 const defaults={width,height,radius:Math.min(20,Math.min(width,(type==='bubble'?.76:1)*height)/2),sides:type==='star'?5:6,inner:45};
 return {...result,definition:{type,options:Object.fromEntries(shapeOptionKeys(type).map(k=>[k,options[k]??defaults[k]]))}};
}
export function validateShape(n,problem){
 const definition=n.geometry.shape,label='node '+n.id+'.shape';
 if(!definition||typeof definition!=='object'||Array.isArray(definition)||Object.keys(definition).sort().join()!=='options,type'){problem(label,'expected shape type and options');return;}
 if(!definition.options||typeof definition.options!=='object'||Array.isArray(definition.options)){problem(label,'expected shape options');return;}
 if(Object.keys(definition.options).sort().join()!==shapeOptionKeys(definition.type).sort().join()){problem(label,'unsupported or missing shape options');return;}
 try{
  const expected=shapeGeometry(definition.type,definition.options,()=>'validation-point'),g=n.geometry;
  if(n.kind!==expected.kind||g.contours?.length)throw Error('live shapes need their canonical single contour');
  const same=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b));
  if(n.kind==='rectangle'){
   if(!same(g.width,expected.width)||!same(g.height,expected.height))throw Error('shape dimensions differ from parameters');
  }else{
   if(g.closed!==expected.geometry.closed||g.points?.length!==expected.geometry.points.length)throw Error('shape topology differs from parameters');
   for(let i=0;i<g.points.length;i++)for(const key of ['anchor','in','out'])if(!Array.isArray(g.points[i][key])||!g.points[i][key].every((v,j)=>same(v,expected.geometry.points[i][key][j])))throw Error('shape controls differ from parameters; detach before editing points');
  }
 }catch(e){problem(label,e.message);}
}
