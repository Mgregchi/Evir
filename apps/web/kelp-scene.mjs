import{upgradeAdvanced,defaultStroke}from'@evir/project-model';import{bindSkin}from'@evir/authoring';import{quantize}from'@evir/runtime/geometry';
export function kelpStudy(makeProject){
 const{p,node,path,oval,box,anim,key}=makeProject('kelp','Kelp — a little wave from below');upgradeAdvanced(p);
 const gradient=(start,end,a,b)=>({type:'linear',start,end,stops:[{position:0,color:a},{position:1,color:b}]});
 box('water-card',25,25,462,462,46,'#e4eeeb');oval('quiet-water',256,258,210,210,'#c9ddd9');
 for(const[x,y,r]of[[89,125,13],[401,142,9],[430,300,15],[109,285,7],[347,73,6]]){oval('bubble-'+x,x,y,r,r,'#f4f1dd');oval('bubble-light-'+x,x-r*.3,y-r*.3,r*.2,r*.2,'#ffffff');}
 oval('sea-shadow',246,430,130,16,'#aac8c1');
 const curve=(id,points,width,color)=>{const result=path(id,points,null);const n=p.nodes.find(n=>n.id===result);n.geometry.closed=false;n.geometry.stroke={...defaultStroke(),width,color};return result;};
 curve('left-tendril',[[[215,367],[215,367],[170,356]],[[119,405],[124,371],[113,424]],[[83,402],[99,424],[83,402]]],25,gradient([83,370],[220,405],'#609f9aff','#a7d8bbff'));
 curve('right-tendril',[[[260,369],[260,369],[295,366]],[[343,420],[310,418],[364,425]],[[388,396],[384,420],[388,396]]],25,gradient([260,369],[390,415],'#89c6acff','#b8e1c1ff'));
 curve('little-tendril',[[[234,389],[234,389],[224,411]],[[210,431],[225,441],[203,416]]],24,'#70b6a7');
 const bones=[];
 for(let i=0;i<4;i++){const id=node('wave-bone-'+(i+1),'bone',{length:42},i?bones.at(-1):null,i?0:190,i?0:340),n=p.nodes.find(n=>n.id===id);if(!i)n.transform=[0,-1,1,0,190,340];bones.push(id);}
 const points=Array.from({length:9},(_,i)=>[[i*21,0],[i*21-7,0],[i*21+7,0]]),arm=curve('hello-tendril',points,26,gradient([0,0],[168,0],'#579f9aff','#c9eac5ff'));
 p.nodes.find(n=>n.id===arm).transform=[0,-1,1,0,190,340];bindSkin(p,arm,bones);
 const shape=p.nodes.find(n=>n.id===arm);shape.geometry.skin.weights=shape.geometry.points.map(v=>({pointId:v.id,...Object.fromEntries(['anchor','in','out'].map(control=>{const at=Math.max(0,Math.min(3,v[control][0]/42-.5)),lo=Math.floor(at),hi=Math.min(3,lo+1),t=at-lo;return[control,lo===hi?[[bones[lo],1]]:quantize([[bones[lo],1-t],[bones[hi],t]])];}))}));
 oval('body',235,348,76,69,'#92d4b5');oval('belly-light',245,380,47,31,'#b6e4c6');
 for(const[x,y,r]of[[182,340,8],[286,337,6],[277,390,7]])oval('body-freckle-'+x,x,y,r,r*.7,'#72b8a3');
 for(const[x,y]of[[210,332],[258,329]]){oval('eye-'+x,x,y,8,12,'#2c5357');oval('shine-'+x,x-2,y-4,2.5,4,'#ffffff');}
 oval('left-cheek',193,351,12,6,'#dfb69a');oval('right-cheek',275,349,12,6,'#dfb69a');
 curve('smile',[[[225,350],[225,350],[233,363]],[[246,350],[238,362],[246,350]]],3,'#3e776e');
 const target=node('wave-target','group',null,null,245,190);p.advanced.ik.push({boneId:bones.at(-1),targetId:target,count:4,invert:false,strength:1});
 const a=anim('little-wave','A little wave');key(a,target,'x',[[0,245],[60,300],[120,245]]);key(a,target,'y',[[0,190],[60,245],[120,190]]);
 return p;
}
