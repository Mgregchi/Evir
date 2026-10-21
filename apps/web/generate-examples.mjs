import {CommandSession} from '@evir/commands';
import {compassLesson} from '@evir/commands/example';
import {suite} from './advanced-examples.mjs';
import {strokeStudy} from './stroke-scene.mjs';
import {joiningStudy} from './join-scene.mjs';

import {tideRecords} from './import-scene.mjs';
import {encodeRecords} from '../../tools/encode-riv-records.mjs';
import {stableImport} from '../../tools/stabilize-import.mjs';
import {characterScenes} from './character-scenes.mjs';
import {motorcycle} from './motorcycle-scene.mjs';
import { fitFreehand, fitBrush } from '../../packages/studio/freehand.mjs';
import { defaultGuides, componentBands } from '../../packages/studio/guides.mjs';
import { ContinuationDraft } from '../../packages/studio/path-continuation.mjs';
import { exampleIds } from './examples.mjs';
import { createProject, validateProject } from '@evir/project-model';
import { setKey, bindPath, setWeight } from '@evir/authoring';
import { compileProject, importRiv } from '@evir/format';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {directStudy} from './direct-scene.mjs';
import {weightStudy} from './weight-scene.mjs';
import {shapeGarden,firstBounce} from './shape-scene.mjs';
import {kelpStudy} from './kelp-scene.mjs';
import {compoundStudy} from './compound-scene.mjs';
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
function gather() {
  const {p,node,path,oval,box,anim,key}=project('gather','Gather — find a little order');
  box('paper',54,48,404,416,36,'#e3eadd');
  const glow=anim('glow','Glow');
  for(const [i,x,y,fill] of [[0,96,85,'#89d4b5'],[1,132,210,'#edb99c'],[2,112,335,'#547e66']]) {
    const group=node(`card-${i+1}`,'group',null,null,x,y);
    box(`face-${i}`,0,0,268,92,22,fill,group);
    oval(`badge-${i}`,46,46,24,24,'#f5f3e7',group);
    if(i===0) path('leaf',[[[32,53]],[[39,30],[38,36],[59,32]],[[60,36],[57,54],[39,57]]],'#547e66',group);
    if(i===1) oval('sun',46,46,13,13,'#edb99c',group);
    if(i===2) path('hill',[[[27,56]],[[42,34]],[[52,48]],[[58,40]],[[66,56]]],'#547e66',group);
    box(`line-${i}`,88,29,112,9,4.5,i===2?'#c9dcca':'#426c56',group);
    box(`subline-${i}`,88,49,78,7,3.5,i===2?'#b2c8b7':'#688b72',group);
    const dot=oval(`light-${i}`,236,46,5,5,'#f5f3e7',group);
    key(glow,dot,'fill',[[0,'#f5f3e7'],[60,'#89d4b5'],[120,'#f5f3e7']]);
  }
  return p;
}
function wisp() {
  const {p,node,oval,anim,key}=project('wisp','Wisp — a drawn little daydream');
  oval('backdrop',256,256,194,194,'#e4ece1');
  oval('shadow',256,413,87,12,'#243f3320');
  const root=node('daydream','group',null,null,256,248);
  const sampled=(id,rx,ry,x,y,fill)=>{
    const samples=Array.from({length:361},(_,i)=>{
      const t=i/360*Math.PI*2;
      return [x+rx*Math.cos(t)*(1+.06*Math.sin(3*t)),y+ry*Math.sin(t)+9*Math.cos(4*t)];
    });
    const geometry=fitFreehand(samples,{tolerance:1.5,closed:true});
    geometry.fill=fill;
    geometry.points.forEach((p,i)=>p.id=`wisp-${id}-p${i}`);
    return node(id,'path',geometry,root);
  };
  sampled('left-wing',45,24,-95,38,'#243f33');
  sampled('left-wing-light',37,17,-95,35,'#e9c3a3');
  sampled('right-wing',45,24,95,38,'#243f33');
  sampled('right-wing-light',37,17,95,35,'#e9c3a3');
  sampled('drawn-outline',92,121,0,0,'#243f33');
  sampled('drawn-body',85,113,0,-2,'#9cdeb9');
  oval('face',0,-27,60,49,'#f5f3e7',root);
  oval('left-eye',-22,-34,6,10,'#243f33',root);
  oval('right-eye',22,-34,6,10,'#243f33',root);
  oval('left-cheek',-37,-14,9,5,'#e7b093',root);
  oval('right-cheek',37,-14,9,5,'#e7b093',root);
  oval('smile',0,-6,8,5,'#243f33',root);
  oval('belly-dot',0,66,13,12,'#f5f3e7',root);
  const drift=anim('drift','Drift');
  key(drift,root,'y',[[0,248],[60,230],[120,248]]);
  key(drift,root,'rotation',[[0,-.035],[60,.035],[120,-.035]]);
  return p;
}

function dawn() {
  const {p,node,path,oval,box,anim,key}=project('dawn','Dawn — a little light');
  const linear=(start,end,colors)=>({type:'linear',start,end,stops:colors.map((color,i)=>({position:i/(colors.length-1),color}))});
  const radial=(start,end,colors)=>({...linear(start,end,colors),type:'radial'});
  box('sky',52,52,408,408,44,linear([0,0],[0,408],['#233e34','#a9d9bd','#f5e4ca']));
  const sun=node('sun-motion','group',null,null,304,220);
  p.nodes.find(n=>n.id===sun).transform=[1,0,0,.82,304,220];
  oval('sun',0,0,92,92,radial([-22,-22],[90,0],['#fff5d9','#efbe92','#dd927a']),sun);
  path('far-hill',[[[65,368],[65,368],[137,250]],[[264,298],[176,239],[350,270]],[[448,353],[391,268],[448,353]],[[448,419]],[[65,419]]],linear([0,275],[0,420],['#8bbca0','#4c8264']));
  path('near-hill',[[[65,405],[65,405],[158,385]],[[286,360],[216,339],[360,358]],[[448,405],[404,382],[448,405]],[[448,438]],[[65,438]]],linear([70,380],[440,440],['#47775e','#213d33']));
  oval('light-mote',145,155,6,6,'#f9edc7');oval('small-mote',199,121,3,3,'#f9edc7');
  const rise=anim('rise','Rise');key(rise,sun,'y',[[0,220],[60,194],[120,220]]);key(rise,sun,'rotation',[[0,-.08],[60,.08],[120,-.08]]);
  return p;
}

function arrange() {
  const {p,node,box,oval}=project('arrange','Arrange — give things room');
  box('backdrop',35,65,442,392,38,'#dfeadd');
  for(const [i,[x,y]] of [[60,124],[201,155],[364,103],[78,314],[212,280],[350,320]].entries()) {
    const card=node(`card-${i+1}`,'group',null,null,x,y);
    const palette=['#91d8b7','#e9bb95','#34594b'];
    box(`card-${i+1}-shadow`,3,5,78,108,16,'#243f3320',card);
    box(`card-${i+1}-face`,0,0,78,108,16,palette[i%3],card);
    oval(`card-${i+1}-dot`,39,42,17,17,i%3===2?'#b4e3c8':'#34594b',card);
    box(`card-${i+1}-line`,19,74,40,6,3,i%3===2?'#b4e3c8':'#34594b',card);
  }
  return p;
}
function compass() {
  const {p}=project('compass','Compass — a shared command lesson');
  const session=new CommandSession(p,{sessionId:'compass-generation'}),lesson=compassLesson(p.artboards[0].id);
  const r=session.execute({schemaVersion:1,context:session.context,requestId:'build-compass',expectedRevision:0,operation:'patch',payload:{commands:lesson.commands}});
  if(!r.ok)throw Error(JSON.stringify(r));return session.snapshot();
}
function measure() {
  const {p,node,box,oval,anim,key}=project('measure','Measure — a little balance');
  box('backdrop',32,40,448,432,34,'#e8efe7');
  box('rail',68,340,376,10,5,'#cedcd1');
  for(const [i,x,y,color] of [[1,66,190,'#e6ba98'],[2,206,130,'#294d40'],[3,346,215,'#90d4b5']]) {
    const card=node(i===2?'reference-card':`card-${i}`,'group',null,null,x,y);
    box(`card-${i}-body`,0,0,100,150,24,color,card);
    box(`card-${i}-label`,20,106,60,7,3,i===2?'#a4d9bf':'#426b58',card);
    oval(`card-${i}-symbol`,50,52,23,23,i===2?'#a4d9bf':'#426b58',card);
    oval(`card-${i}-center`,50,52,9,9,color,card);
  }
  const glow=oval('balance-indicator',256,398,12,12,'#87bba2');
  const a=anim('breathe','Balance');key(a,glow,'scaleX',[[0,1],[60,1.3],[120,1]]);key(a,glow,'scaleY',[[0,1],[60,1.3],[120,1]]);
  return p;
}
// Generated pressure samples, not a recording of human/stylus input.
function ribbon() {
  const {p,node,box,oval,anim,key}=project('ribbon','Ribbon — a little flourish');
  box('paper',28,32,456,448,38,'#edf1e8');
  const root=node('flourish','group',null,null,0,0);
  const stroke=(id,samples,width,fill,pressure=true)=>{
    const geometry=fitBrush(samples,{width,pressure,tolerance:1});geometry.fill=fill;
    geometry.points.forEach((p,i)=>p.id=`ribbon-${id}-p${i}`);
    return node(id,'path',geometry,root);
  };
  stroke('mint-ribbon',Array.from({length:241},(_,i)=>{
    const t=i/240;return [95+320*t,200-65*Math.sin(t*Math.PI*2),.15+.8*Math.sin(t*Math.PI)**2];
  }),35,'#69b996');
  stroke('peach-ribbon',Array.from({length:201},(_,i)=>{
    const t=i/200;return [110+285*t,320-36*Math.sin(t*Math.PI*2),.85-.7*t];
  }),26,'#dca982');
  stroke('constant-thread',Array.from({length:151},(_,i)=>{
    const t=i/150;return [135+240*t,388+10*Math.sin(t*Math.PI*2),t];
  }),8,'#385c48',false);
  oval('seam',100,102,7,7,'#dca982',root);
  const a=anim('float','Float');key(a,root,'y',[[0,0],[60,-7],[120,0]]);
  return p;
}
let sprigSeed;
const sprigRecipe=[{anchor:[45,35],out:[26,56]},{anchor:[-10,65],out:[-43,60]},{anchor:[-60,35],out:[-74,15]}];
function sprig() {
  const {p,node,path,box,oval,anim,key}=project('sprig','Sprig — a story still growing');
  box('backdrop',32,40,448,432,34,'#e8efe7');
  oval('shadow',256,428,105,13,'#294d4020');
  box('pot-rim',189,335,134,24,10,'#d49d79');
  path('pot',[[[0,0]],[[118,0]],[[96,68]],[[22,68]]],'#e8bd9b',null,197,351);
  const plant=node('plant','group',null,null,256,276);
  box('stem',-5,-10,10,67,5,'#3c7555',plant);
  const leaf=path('growing-leaf',[
    [[-70,0],[-70,0],[-68,-35]],
    [[-15,-70],[-44,-70],[8,-70]],
    [[50,-25],[50,-52],[52,-15]],
  ],'#90d4b5',plant);
  p.nodes.find(n=>n.id===leaf).geometry.closed=false;
  oval('leaf-heart',-10,-5,13,13,'#477d60',plant);
  const breeze=anim('breeze','Breeze');key(breeze,plant,'rotation',[[0,-.08],[60,.08],[120,-.08]]);
  sprigSeed=structuredClone(p);
  const draft=new ContinuationDraft(p,leaf,{closed:true});
  for(const [i,point] of sprigRecipe.entries()) {
    draft.appendLocal(point.anchor,point.out);draft.points.at(-1).id=`sprig-extension-point-${i+1}`;
  }
  draft.apply(p,draft.geometry());
  return p;
}
let loomPreset;
function loom() {
  const {p,node,box,oval,path,anim,key}=project('loom','Loom — a little room to weave');
  box('backdrop',32,40,448,432,34,'#e8efe7');
  box('top-thread',84,98,344,5,2,'#b6d6c1');
  loomPreset=defaultGuides();loomPreset.rulers=true;
  loomPreset.components=[
    {id:'loom-columns',axis:'x',count:3,mode:'fixed',size:96,gap:28,margin:48,align:'center',visible:true,snap:true},
    {id:'loom-rows',axis:'y',count:2,mode:'fixed',size:100,gap:38,margin:48,align:'center',visible:true,snap:true},
  ];
  const columns=componentBands(loomPreset.components[0],p.artboards[0]), rows=componentBands(loomPreset.components[1],p.artboards[0]);
  for(let row=0;row<2;row++) for(let col=0;col<3;col++) {
    const id=row===0&&col===1?'reference-patch':`patch-${row+1}-${col+1}`;
    const dx=[[-18,0,14],[-9,6,9]][row][col],dy=[[-10,0,8],[7,-8,0]][row][col];
    const root=node(id,'group',null,null,columns[col].start+dx,rows[row].start+dy);
    const colors=['#e5b893','#294d40','#90d4b5'],fill=colors[(row+col)%3],thread=fill==='#294d40'?'#b7dfc6':'#47795d';
    box(`${id}-cloth`,0,0,96,100,15,fill,root);
    for(let k=0;k<3;k++) {
      box(`${id}-warp-${k}`,18+23*k,14,8,72,4,thread,root);
      box(`${id}-weft-${k}`,12,24+22*k,72,7,3,thread,root);
      for(let j=0;j<3;j++) if((j+k)%2===0)box(`${id}-over-${k}-${j}`,18+23*k,22+22*j,8,12,3,fill,root);
    }
  }
  const spindle=node('spindle','group',null,null,256,421);
  oval('spindle-ring',0,0,18,18,'#d6ab84',spindle);oval('spindle-heart',0,0,8,8,'#e8efe7',spindle);
  box('needle',-2,-24,4,48,2,'#47795d',spindle);
  const a=anim('weave','Weave');key(a,spindle,'rotation',[[0,0],[120,Math.PI*2]]);
  return p;
}
const tideNative=encodeRecords(tideRecords());
async function tide(){const p=stableImport(await importRiv(tideNative),'tide');p.name='Tide — a shore-side hello';return p;}
const factories={tide,trace:()=>strokeStudy(project),ribbon,loom,sprig,measure,compass,milo,orbit,bloom,tempo,signal,gather,wisp,dawn,arrange,motorcycle:()=>motorcycle(project)};
for(const original of await suite()){
 const p=structuredClone(original);p.artboards[0].width=p.artboards[0].height=512;
 for(const n of p.nodes){n.transform[4]*=2;n.transform[5]*=2;const g=n.geometry;if(!g)continue;
  for(const k of ['width','height','length','fontSize'])if(k in g)g[k]*=2;
  if(g.points)for(const v of g.points)for(const k of ['anchor','in','out'])v[k]=v[k].map(x=>x*2);
  if(g.skin){for(const m of [g.skin.bindWorld,...g.skin.bones.map(b=>b.bind)]){m[4]*=2;m[5]*=2;}}
  if(g.vertices)for(const v of g.vertices)v.position=v.position.map(x=>x*2);
  if(g.fill&&typeof g.fill!=='string'){g.fill.start=g.fill.start.map(x=>x*2);g.fill.end=g.fill.end.map(x=>x*2);}
 }
 for(const a of p.animations)for(const t of a.tracks)if(['x','y','width','height','length','fontSize','paint.startX','paint.startY','paint.endX','paint.endY'].includes(t.property))for(const k of t.keys)k.value*=2;
 for(const f of p.advanced.feathers)f.strength*=2;
 factories[p.name]=()=>p;
}
Object.assign(factories,characterScenes(project));
const outingStudy=joiningStudy(project);factories.outing=()=>outingStudy.project;
await mkdir(output,{recursive:true});
factories.gust=()=>weightStudy(project);
factories.lumen=()=>directStudy(project);
factories.garden=()=>shapeGarden(project);
factories.nocturne=()=>compoundStudy(project);
factories.kelp=()=>kelpStudy(project);
for(const name of exampleIds) {
  const p=await factories[name]();validateProject(p);
  const compiled=compileProject(p);
  await writeFile(`${output}${name}.evir-project`,JSON.stringify(p,null,2)+'\n');
  await writeFile(`${output}${name}.riv`,compiled.bytes);
  if(name==='outing') {
    validateProject(outingStudy.seed);
    await writeFile(`${output}outing-start.evir-project`,JSON.stringify(outingStudy.seed,null,2)+'\n');
    await writeFile(`${output}outing-start.riv`,compileProject(outingStudy.seed).bytes);
    await writeFile(`${output}outing.joining.json`,JSON.stringify(outingStudy.recipe,null,2)+'\n');
  }

  if(name==='tide')await writeFile(`${output}tide-native.riv`,tideNative);
  if(name==='compass') await writeFile(`${output}${name}.commands.json`,JSON.stringify(compassLesson(p.artboards[0].id),null,2)+'\n');
  if(name==='measure') {
    const guides=defaultGuides();guides.rulers=true;guides.grid={visible:true,snap:true,spacing:32,originX:0,originY:0};
    guides.guides=[{id:'measure-center',axis:'x',position:256,visible:true},{id:'measure-top',axis:'y',position:130,visible:true}];
    await writeFile(`${output}${name}.guides.json`,JSON.stringify(guides,null,2)+'\n');
  }
  if(name==='loom') await writeFile(`${output}loom.guides.json`,JSON.stringify(loomPreset,null,2)+'\n');
  if(name==='sprig') {
    validateProject(sprigSeed);
    await writeFile(`${output}sprig-start.evir-project`,JSON.stringify(sprigSeed,null,2)+'\n');
    await writeFile(`${output}sprig-start.riv`,compileProject(sprigSeed).bytes);
    await writeFile(`${output}sprig.continuation.json`,JSON.stringify({format:'evir-continuation-recipe',version:1,nodeId:'sprig-growing-leaf',endpoint:'last',closed:true,points:sprigRecipe},null,2)+'\n');
  }
  if(name==='motorcycle') {
    await writeFile(`${output}${name}.riv-map.json`,JSON.stringify(compiled.mapping,null,2)+'\n');
    await writeFile(`${output}${name}-controller.mjs`,await (await import('node:fs/promises')).readFile(new URL('./motorcycle.mjs',import.meta.url)));
  }
  console.log(`${name}: ${p.nodes.length} editable nodes, ${p.animations.length} animations, validated source and compiled export`);
}
const lesson=firstBounce();validateProject(lesson);
await writeFile(`${output}first-bounce.evir-project`,JSON.stringify(lesson,null,2)+'\n');
await writeFile(`${output}first-bounce.riv`,compileProject(lesson).bytes);

const nocturneStart=compoundStudy(project,{starting:true});validateProject(nocturneStart);await writeFile(output+'nocturne-start.evir-project',JSON.stringify(nocturneStart,null,2)+'\n');
