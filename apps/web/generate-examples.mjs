import { exampleIds } from './examples.mjs';
import { createProject, validateProject } from '@evir/project-model';
import { setKey, bindPath, setWeight } from '@evir/authoring';
import { compileProject } from '@evir/format';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const output = fileURLToPath(new URL('./assets/examples/', import.meta.url));

function project(name, label) {
  const p = createProject();
  p.id = `${name}-project`; p.name = label;
  p.artboards = [{id:`${name}-board`,name:label,width:512,height:512}];
  p.editor.cameras = {[p.artboards[0].id]:{x:0,y:0,zoom:1}};
  let count = 0;
  const node = (id, kind, geometry, parentId = null, x = 0, y = 0) => {
    const n = {id:`${name}-${id}`,name:id.replaceAll('-',' '),kind,artboardId:p.artboards[0].id,parentId,
      order:count++,transform:[1,0,0,1,x,y],geometry};p.nodes.push(n);return n.id;
  };
  const path = (id, points, fill, parent, x = 0, y = 0) => node(id, 'path', {
    closed:true,fill,skin:null,points:points.map(([anchor, incoming = anchor, outgoing = anchor],i)=>({id:`${name}-${id}-p${i}`,anchor,in:incoming,out:outgoing}))
  },parent,x,y);
  const oval = (id,x,y,rx,ry,fill,parent = null) => {
    const k=.5522847498;
    return path(id,[[[rx,0],[rx,-k*ry],[rx,k*ry]],[[0,ry],[k*rx,ry],[-k*rx,ry]],
      [[-rx,0],[-rx,k*ry],[-rx,-k*ry]],[[0,-ry],[-k*rx,-ry],[k*rx,-ry]]],fill,parent,x,y);
  };
  const box = (id,x,y,w,h,r,fill,parent=null) => {
    const k=.5522847498*r;
    return path(id,[[[r,0],[r-k,0]],[[w-r,0],[w-r,0],[w-r+k,0]],[[w,r],[w,r-k]],
      [[w,h-r],[w,h-r],[w,h-r+k]],[[w-r,h],[w-r+k,h]],[[r,h],[r,h],[r-k,h]],
      [[0,h-r],[0,h-r+k]],[[0,r],[0,r],[0,r-k]]],fill,parent,x,y);
  };
  const anim = (id,label,loop=true) => {
    const a={id:`${name}-${id}`,name:label,artboardId:p.artboards[0].id,fps:60,duration:120,loop,tracks:[]};p.animations.push(a);return a.id;
  };
  const key = (a,id,property,values) => values.forEach(([frame,value])=>setKey(p,a,id,property,frame,value,{type:'cubic',curve:[.45,0,.55,1]}));
  return {p,node,path,oval,box,anim,key};
}

function milo() {
  const {p,node,path,oval,box,anim,key}=project('milo','Milo — a little hello');
  oval('shadow',256,442,100,13,'#143b231a');
  const root=node('character','group',null,null,250,277);
  box('left-foot',-69,113,66,30,15,'#243f33',root);
  box('right-foot',11,113,66,30,15,'#243f33',root);
  const shoulder=node('shoulder','bone',{length:40},root,80,-28);
  const elbow=node('elbow','bone',{length:40},shoulder);
  const arm=box('wave-arm',-5,-18,90,36,18,'#243f33',shoulder);
  const innerArm=box('wave-arm-inner',0,-12,80,24,12,'#8fd9af',shoulder);
  box('left-arm',-136,-29,75,34,17,'#243f33',root);
  box('left-arm-inner',-130,-23,62,22,11,'#8fd9af',root);
  box('stem',-3,-150,7,55,3,'#243f33',root);
  path('leaf',[[[0,-141],[0,-141],[9,-180]],[[57,-182],[38,-193],[54,-145]],[[0,-141],[25,-136]]],'#56a878',root);
  oval('body-outline',0,0,94,127,'#243f33',root);
  oval('body',0,-3,87,119,'#9cdeb9',root);
  box('face',-75,-81,150,103,39,'#f5f3e7',root);
  const eyeL=oval('left-eye',-29,-30,8,12,'#243f33',root);
  const eyeR=oval('right-eye',29,-30,8,12,'#243f33',root);
  oval('left-highlight',-31,-34,2.5,3,'#ffffff',root);
  oval('right-highlight',27,-34,2.5,3,'#ffffff',root);
  oval('left-cheek',-49,-3,10,5,'#e7b093',root);
  oval('right-cheek',49,-3,10,5,'#e7b093',root);
  path('smile',[[[-17,-5],[-17,-5],[-9,6]],[[17,-5],[9,6],[17,14]],[[0,18],[12,18],[-12,18]]],'#243f33',root);
  oval('belly',0,72,27,26,'#c5ebd3',root);
  oval('belly-dot',0,72,6,6,'#5ba77e',root);
  for(const target of [arm,innerArm]) {
    bindPath(p,target,[shoulder,elbow]);
    const bound=p.nodes.find(n=>n.id===target);
    for(const point of bound.geometry.points)for(const control of ['anchor','in','out'])
      setWeight(p,target,point.id,control,elbow,point.anchor[0]>40?.75:0);
  }
  const idle=anim('idle','Idle'),wave=anim('wave','Hello');
  key(idle,root,'y',[[0,277],[60,266],[120,277]]);
  key(idle,shoulder,'rotation',[[0,.1],[60,-.08],[120,.1]]);
  for(const eye of [eyeL,eyeR])key(idle,eye,'scaleY',[[0,1],[43,1],[48,.12],[53,1],[120,1]]);
  key(wave,root,'y',[[0,277],[60,266],[120,277]]);
  key(wave,shoulder,'rotation',[[0,-.95],[30,-.45],[60,-1.15],[90,-.45],[120,-.95]]);
  key(wave,elbow,'rotation',[[0,-.25],[60,.2],[120,-.25]]);
  const board=p.artboards[0].id;
  p.machines=[{id:'milo-machine',name:'Say hello',artboardId:board,inputs:[{id:'milo-wave-input',name:'isWaving',type:'boolean',value:false}],
    states:[{id:'milo-idle-state',name:'Idle',animationId:idle,position:[30,50]},{id:'milo-wave-state',name:'Hello',animationId:wave,position:[240,50]}],
    entryStateId:'milo-idle-state',transitions:[{id:'milo-to-wave',fromId:'milo-idle-state',toId:'milo-wave-state',conditions:[{inputId:'milo-wave-input',op:'eq',value:true}]},
      {id:'milo-to-idle',fromId:'milo-wave-state',toId:'milo-idle-state',conditions:[{inputId:'milo-wave-input',op:'eq',value:false}]}],listeners:[]}];
  return p;
}

function orbit() {
  const {p,node,oval,box,anim,key}=project('orbit','Orbit — motion in a loop');
  oval('outer-disc',256,256,181,181,'#d5e5dc');
  oval('inner-disc',256,256,165,165,'#f1f3eb');
  const root=node('orbit','group',null,null,256,256);
  oval('planet',0,0,70,70,'#243f33',root);
  oval('planet-light',-8,-9,60,60,'#a1dec0',root);
  oval('crater-one',-30,-21,16,14,'#6bad8a',root);
  oval('crater-two',14,27,24,20,'#6bad8a',root);
  oval('crater-three',27,-28,9,8,'#c9eed6',root);
  const satellite=node('satellite','group',null,root);
  oval('satellite-body',0,-174,31,31,'#253e33',satellite);
  oval('satellite-core',0,-174,24,24,'#e9c3a3',satellite);
  box('satellite-mark',-6,-185,12,22,6,'#253e33',satellite);
  const a=anim('loop','Orbit');key(a,satellite,'rotation',[[0,0],[120,Math.PI*2]]);
  return p;
}

function bloom() {
  const {p,node,path,oval,box,anim,key}=project('bloom','Bloom — rooted motion');
  oval('backdrop',256,248,187,187,'#dfeadd');
  oval('shadow',256,439,100,12,'#243f331c');
  const root=node('root-joint','bone',{length:90},null,256,378);
  p.nodes.find(n=>n.id===root).transform=[0,-1,1,0,256,378];
  const tip=node('tip-joint','bone',{length:105},root);
  const stem=box('flexible-stem',246,183,20,195,10,'#487a5c');
  const controls=p.nodes.find(n=>n.id===stem).geometry.points;
  controls[2].out=[20,40];controls[3].in=[20,155];controls[6].out=[0,155];controls[7].in=[0,40];
  controls.splice(7,0,{id:'bloom-stem-middle-left',anchor:[0,95],in:[0,125],out:[0,65]});
  controls.splice(3,0,{id:'bloom-stem-middle-right',anchor:[20,95],in:[20,65],out:[20,125]});
  bindPath(p,stem,[root,tip]);
  for(const point of p.nodes.find(n=>n.id===stem).geometry.points) for(const control of ['anchor','in','out']) {
    const y=point[control][1];setWeight(p,stem,point.id,control,tip,Math.max(0,Math.min(1,(130-y)/110)));
  }
  path('left-leaf',[[[0,0],[0,0],[70,-12]],[[82,-72],[76,-20],[24,-90]],[[0,0],[-8,-30]]],'#89c9a0',root,65,0);
  path('right-leaf',[[[0,0],[0,0],[65,8]],[[78,82],[88,35],[21,86]],[[0,0],[-10,33]]],'#579879',tip,28,0);
  path('top-leaf',[[[0,0],[0,0],[0,-30]],[[75,-18],[34,-60],[70,28]],[[0,0],[29,35]]],'#a4dfb9',tip,88,0);
  box('pot',190,370,132,64,22,'#dfac8e');box('pot-lip',180,364,152,22,11,'#efc8a9');
  oval('pot-mark',256,400,13,10,'#b47960');
  const a=anim('breeze','Breeze');key(a,root,'rotation',[[0,-Math.PI/2],[30,-1.72],[90,-1.42],[120,-Math.PI/2]]);key(a,tip,'rotation',[[0,0],[30,-.25],[90,.25],[120,0]]);
  return p;
}
function tempo() {
  const {p,node,oval,box,anim,key}=project('tempo','Tempo — three kinds of time');
  box('card',67,66,378,380,42,'#dce8db');box('inner-card',81,80,350,352,32,'#f5f3e7');
  for(let i=0;i<3;i++)box(`track-${i}`,128+i*92,146,52,218,26,'#dce7dc');
  const a=anim('rhythm','Rhythm');
  for(const [i,label,type] of [[0,'smooth','cubic'],[1,'linear','linear'],[2,'stepped','hold']]) {
    const column=node(`${label}-column`,'rectangle',{width:52,height:76,fill:['#89d4b5','#edb99c','#547e66'][i]},null,128+i*92,288);
    for(const [frame,height] of [[0,76],[30,166],[60,208],[90,120],[120,76]]) {
      setKey(p,a,column,'height',frame,height,{type,curve:type==='cubic'?[.25,0,.75,1]:null});
      setKey(p,a,column,'y',frame,364-height,{type,curve:type==='cubic'?[.25,0,.75,1]:null});
    }
    key(a,column,'fill',[[0,['#89d4b5','#edb99c','#547e66'][i]],[60,['#edb99c','#547e66','#89d4b5'][i]],[120,['#89d4b5','#edb99c','#547e66'][i]]]);
    oval(`${label}-marker`,154+i*92,399,8,8,['#89d4b5','#edb99c','#547e66'][i]);
  }
  box('top-mark',212,108,88,7,3.5,'#bdcbbd');
  return p;
}
function signal() {
  const {p,path,oval,box,anim,key}=project('signal','Signal — an interactive yes');
  box('panel',69,61,374,394,42,'#dce8db');box('panel-face',83,75,346,366,32,'#f5f3e7');
  for(let i=0;i<3;i++)oval(`header-dot-${i}`,118+i*20,110,4,4,'#98ad99');
  const ring=oval('status-disc',256,248,90,90,'#d1dccf');oval('status-face',256,248,70,70,'#f5f3e7');
  const check=path('check',[[[215,246]],[[243,274]],[[296,221]],[[306,231]],[[243,294]],[[205,256]]],'#243f3300');
  const waiting=box('waiting-mark',242,220,28,56,14,'#8ba68f');
  const pad=box('celebration-pad',175,367,162,38,19,'#c5d3c3');
  const stars=[];
  for(const [i,x,y] of [[0,150,177],[1,362,183],[2,348,312],[3,166,308]])stars.push(path(`spark-${i}`,[[[0,-12]],[[4,-4]],[[12,0]],[[4,4]],[[0,12]],[[-4,4]],[[-12,0]],[[-4,-4]]],'#e9b49600',null,x,y));
  const idle=anim('waiting','Waiting'),ready=anim('ready','Ready'),celebrate=anim('celebrating','Celebrating');
  for(const [a,color,checkColor,markColor,padColor,starColor] of [[idle,'#d1dccf','#243f3300','#8ba68f','#c5d3c3','#e9b49600'],[ready,'#89d4b5','#243f33ff','#8ba68f00','#89d4b5','#e9b49600'],[celebrate,'#edb99c','#243f33ff','#8ba68f00','#edb99c','#e9b496ff']]){
    for(const [id,value] of [[ring,color],[check,checkColor],[waiting,markColor],[pad,padColor],...stars.map(id=>[id,starColor])])setKey(p,a,id,'fill',0,value,{type:'hold',curve:null});
  }
  for(const id of stars)key(celebrate,id,'rotation',[[0,0],[60,Math.PI/2],[120,Math.PI]]);
  const inputs=[{id:'signal-enabled',name:'enabled',type:'boolean',value:false},{id:'signal-level',name:'level',type:'number',value:0},{id:'signal-celebrate',name:'celebrate',type:'trigger',value:false}];
  const states=[idle,ready,celebrate].map((animationId,i)=>({id:`signal-state-${i}`,name:['Waiting','Ready','Celebrating'][i],animationId,position:[i*200,40]}));
  const transition=(id,from,to,conditions)=>({id:`signal-transition-${id}`,fromId:states[from].id,toId:states[to].id,conditions});
  p.machines=[{id:'signal-flow',name:'Flow',artboardId:p.artboards[0].id,inputs,states,entryStateId:states[0].id,transitions:[
    transition('ready',0,1,[{inputId:inputs[0].id,op:'eq',value:true},{inputId:inputs[1].id,op:'ge',value:50}]),
    transition('disabled',1,0,[{inputId:inputs[0].id,op:'eq',value:false}]),transition('low',1,0,[{inputId:inputs[1].id,op:'lt',value:50}]),
    transition('celebrate',1,2,[{inputId:inputs[2].id,op:'fire',value:null}])],listeners:[{id:'signal-listener',targetId:pad,event:'click',inputId:inputs[2].id,value:null}]}];
  return p;
}
const factories={milo,orbit,bloom,tempo,signal};
await mkdir(output,{recursive:true});
for(const name of exampleIds) {
  const p=factories[name]();validateProject(p);
  const compiled=compileProject(p);
  await writeFile(`${output}${name}.evir-project`,JSON.stringify(p,null,2)+'\n');
  await writeFile(`${output}${name}.riv`,compiled.bytes);
  console.log(`${name}: ${p.nodes.length} editable nodes, ${p.animations.length} animations, validated source and compiled export`);
}
