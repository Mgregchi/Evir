import {setKey} from '@evir/authoring';

// Original Evir artwork; all geometry and motion remain editable in Studio.
export function motorcycle(makeProject) {
  const {p,node,path,oval,box,anim}=makeProject('motorcycle','Sunday — a ride of your own');
  const forest='#243f33', mint='#91d8b7', peach='#edb99c', paper='#f5f3e7';
  box('sky',0,0,512,512,0,'#e6eee2');
  const sun=oval('sun',404,125,49,49,peach);
  const far=node('background','group',null);
  for(let i=-1;i<3;i++) {
    const x=i*256;
    path(`far-hill-${i+1}`,[[[x,320]],[[x+55,230],[x+23,250],[x+91,208]],[[x+175,277],[x+125,226],[x+207,246]],[[x+256,320],[x+237,261]],[[x+256,380]],[[x,380]]],'#b9d6bd',far);
    oval(`cloud-${i+1}`,x+60,150,35,8,'#f5f3e7',far);
  }
  const near=node('midground','group',null);
  for(let i=-1;i<3;i++) {
    const x=i*256;
    path(`near-hill-${i+1}`,[[[x,354]],[[x+83,300],[x+29,329],[x+116,286]],[[x+197,339],[x+148,305],[x+224,317]],[[x+256,354]],[[x+256,390]],[[x,390]]],'#7da68b',near);
  }
  box('road',0,374,512,138,0,'#304b3c');box('road-edge',0,374,512,4,0,'#f1e4be');
  const road=node('road-markings','group',null);
  for(let i=-1;i<5;i++)box(`road-dash-${i+1}`,i*128+20,425,68,6,3,'#a6c6aa',road);
  oval('bike-shadow',255,379,134,10,'#142b2480');
  const bike=node('motorcycle','group',null);
  const wheelIds=[];
  for(const [label,x] of [['rear',157],['front',350]]) {
    const wheel=node(`${label}-wheel`,'group',null,bike,x,335);wheelIds.push(wheel);
    oval(`${label}-tire`,0,0,43,43,forest,wheel);oval(`${label}-rim`,0,0,33,33,'#d6e8d5',wheel);oval(`${label}-hub-well`,0,0,27,27,'#628470',wheel);
    for(let i=0;i<6;i++){
      const spoke=box(`${label}-spoke-${i}`, -2,-30,4,31,2,'#d6e8d5',wheel),n=p.nodes.find(n=>n.id===spoke),t=i*Math.PI/3;
      n.transform=[Math.cos(t),Math.sin(t),-Math.sin(t),Math.cos(t),0,0];
    }
    oval(`${label}-hub`,0,0,8,8,forest,wheel);oval(`${label}-hub-light`,0,0,3,3,peach,wheel);
  }
  const chassis=node('chassis-and-rider','group',null,bike,253,302);
  // Closed filled outlines act as lightweight tubes, without a stroke contract.
  path('swing-arm',[[[-96,29]],[[-90,38]],[[-4,21]],[[-8,8]]],'#b9d6bd',chassis);
  path('frame',[[[-70,-31]],[[-3,29]],[[67,-42]],[[59,-48]],[[-4,14]],[[-60,-37]]],forest,chassis);
  path('front-fork',[[[64,-71]],[[104,34]],[[93,39]],[[54,-67]]],'#c1d2bb',chassis);
  path('front-fork-inner',[[[64,-58]],[[99,29]],[[95,31]],[[60,-56]]],forest,chassis);
  oval('engine',-6,9,28,23,forest,chassis);
  for(let i=0;i<4;i++)box(`engine-fin-${i}`,-22,-3+i*7,32,3,1.5,'#728e78',chassis);
  box('engine-core',-10,4,15,13,6,'#c8d9c1',chassis);
  path('fuel-tank',[[[-37,-58],[-43,-41],[-9,-79]],[[28,-62],[7,-74],[45,-57]],[[32,-32],[43,-37],[6,-28]],[[-30,-29],[-15,-27],[-45,-34]]],mint,chassis);
  box('tank-stripe',-18,-54,36,6,3,'#527b63',chassis);
  box('seat',-84,-65,61,13,6,forest,chassis);box('seat-top',-81,-67,54,5,2.5,peach,chassis);
  path('rear-fender',[[[-142,12],[-142,12],[-118,-31]],[[-55,-8],[-83,-26],[-57,-8]],[[-60,0]],[[-132,17]]],mint,chassis);
  path('front-fender',[[[56,17],[56,17],[72,-18]],[[134,18],[121,-17],[134,18]],[[124,20]],[ [64,21] ]],mint,chassis);
  path('exhaust-pipe',[[[-53,20]],[[-38,43]],[[-104,44]],[[-110,33]],[[-49,32]],[[-62,24]]],'#a3b9a0',chassis);
  box('exhaust-end',-116,32,19,13,5,forest,chassis);
  // Rider: one grouped silhouette moves with the suspension, not the wheels.
  path('rider-leg',[[[-35,-59]],[[-9,-41]],[[-34,-7]],[[-17,7]],[[-29,16]],[[-49,-7]],[[-29,-39]],[[-63,-60]]],forest,chassis);
  box('boot',-33,9,32,12,5,'#1b3028',chassis);
  path('rider-jacket',[[[-71,-73],[-71,-73],[-56,-111]],[[-33,-123],[-54,-114],[-14,-119]],[[-6,-75],[-19,-107],[-16,-61]],[[-51,-55],[-23,-55],[-65,-59]]],forest,chassis);
  path('jacket-light',[[[-56,-87]],[[-42,-111]],[[-25,-110]],[[-11,-76]],[[-27,-77]]],mint,chassis);
  path('rider-arm',[[[-30,-114]],[[13,-79]],[[47,-80]],[[49,-70]],[[7,-67]],[[-41,-103]]],forest,chassis);
  box('handlebar',43,-86,29,7,3.5,forest,chassis);
  oval('glove',47,-78,7,6,peach,chassis);
  box('neck',-40,-144,12,26,5,peach,chassis);
  oval('helmet',-36,-151,27,25,forest,chassis);oval('helmet-shell',-36,-156,24,20,peach,chassis);
  box('helmet-visor',-34,-161,26,11,5,'#3e6450',chassis);
  box('helmet-highlight',-51,-170,17,4,2,'#f5e7cf',chassis);
  const beam=path('headlight-beam',[[[81,-66]],[[239,-99]],[[239,-32]]],'#ffe5b500',chassis);
  oval('headlight-case',76,-66,12,12,forest,chassis);
  const lamp=oval('headlight',80,-66,8,8,'#e5d8b8',chassis);
  const tail=box('tail-light',-102,-61,12,7,3,'#b96b58',chassis);
  const indicator=oval('turn-indicator',61,-51,4,4,'#e9b65800',chassis);
  const foreground=node('foreground','group',null);
  box('foreground-ground',0,482,512,30,0,forest);
  for(let i=-1;i<5;i++){
    const x=i*128;
    path(`grass-${i+1}`,[[[x,495]],[[x+14,460]],[[x+18,483]],[[x+34,470]],[[x+30,495]]],'#527b63',foreground);
    oval(`pebble-${i+1}`,x+82,486,11,4,'#7da68b',foreground);
  }
  const make=(id,name,mode='loop',duration=60,iterations=0)=>{
    const a=anim(id,name);const record=p.animations.find(v=>v.id===a);delete record.loop;
    record.duration=duration;record.playback={mode,iterations:mode==='once'?1:iterations,speed:1};return a;
  };
  const keys=(a,id,property,values,easing={type:'linear',curve:null})=>values.forEach(([frame,value])=>setKey(p,a,id,property,frame,value,easing));
  // Ride is a combined, native .riv showcase timeline. The interactive host
  // instead composes the following independent component timelines.
  const ride=make('ride','Ride','loop',120);
  const wheels=make('wheels','Wheels');for(const id of wheelIds)keys(wheels,id,'rotation',[[0,0],[60,Math.PI*2]]);
  const asphalt=make('asphalt','Asphalt');keys(asphalt,road,'x',[[0,0],[60,-128]]);
  const distant=make('distance','Distant hills','loop',120);keys(distant,far,'x',[[0,0],[120,-256]]);
  const passing=make('passing','Passing hills','loop',120);keys(passing,near,'x',[[0,0],[120,-256]]);
  const close=make('roadside','Roadside');keys(close,foreground,'x',[[0,0],[60,-128]]);
  const bump=make('bump','Suspension bump','once',48);
  const ease={type:'cubic',curve:[.35,0,.65,1]};
  keys(bump,chassis,'y',[[0,302],[8,292],[16,308],[25,298],[36,303],[48,302]],ease);
  keys(bump,chassis,'rotation',[[0,0],[8,-.035],[16,.025],[28,-.012],[48,0]],ease);
  keys(bump,wheelIds[1],'y',[[0,335],[5,330],[12,335],[48,335]],ease);
  keys(bump,wheelIds[0],'y',[[0,335],[14,335],[19,330],[26,335],[48,335]],ease);
  const daylight=make('sunlight','Sunlight','ping-pong',180);
  keys(daylight,sun,'y',[[0,125],[180,115]],ease);
  const headlight=make('light','Headlight','once',1);keys(headlight,lamp,'fill',[[0,'#fff0c4']]);keys(headlight,beam,'fill',[[0,'#ffe5b530']]);
  const brake=make('brake','Brake light','once',1);keys(brake,tail,'fill',[[0,'#ff8c70']]);
  const signal=make('indicator','Turn signal','loop',60,3);
  keys(signal,indicator,'fill',[[0,'#e9b658ff'],[30,'#e9b65800'],[60,'#e9b65800']],{type:'hold',curve:null});
  for(const id of wheelIds)keys(ride,id,'rotation',[[0,0],[120,Math.PI*4]]);
  keys(ride,road,'x',[[0,0],[60,-128],[120,-256]]);
  keys(ride,foreground,'x',[[0,0],[60,-128],[120,-256]]);
  keys(ride,far,'x',[[0,0],[120,-256]]);keys(ride,near,'x',[[0,0],[120,-256]]);
  keys(ride,chassis,'y',[[0,302],[50,302],[58,292],[66,308],[78,299],[90,302],[120,302]],ease);
  return p;
}
