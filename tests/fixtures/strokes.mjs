import {createProject,upgradeAdvanced,defaultStroke} from '@evir/project-model';
import {setKey} from '@evir/authoring';
export function strokeCases() {
  const cases=[];
  const make=(name,points,{closed=false,rectangle=false,fill=null,transform=[1,0,0,1,0,0],...style}={})=>{
    const p=upgradeAdvanced(createProject());p.id=name+'-project';p.name=name;p.artboards=[{id:'board',name:'Board',width:256,height:256}];p.editor.cameras={board:{x:0,y:0,zoom:1}};
    p.nodes=[{id:'line',name:'Line',kind:rectangle?'rectangle':'path',parentId:null,artboardId:'board',order:0,transform,
      geometry:{...(rectangle?{width:128,height:96}:{closed,skin:null,points:points.map(([anchor,incoming=anchor,outgoing=anchor],i)=>({id:'point-'+i,anchor,in:incoming,out:outgoing}))}),fill,stroke:{...defaultStroke('#24594aff'),width:14,...style}}}];
    cases.push(p);return p;
  };
  const curved=[[[30,174],[30,174],[36,34]],[[132,96],[76,38],[192,154]],[[226,72],[223,150]]];
  for(const cap of ['butt','round','square'])make('stroke-cap-'+cap,curved,{cap});
  for(const join of ['miter','round','bevel'])make('stroke-join-'+join,[[[32,190]],[[128,60]],[[224,190]]],{join});
  make('stroke-rectangle',null,{rectangle:true,transform:[.98,.2,-.2,.98,58,38],fill:'#f6c7a0ff',join:'miter'});
  make('stroke-reflected',curved,{transform:[-0.9,0,0,0.65,245,37],cap:'square'});
  make('stroke-dash',curved,{dash:[18,12]});
  make('stroke-dash-negative',curved,{dash:[18,12,4,9],dashOffset:-22});
  make('stroke-dash-closed',[[[48,48]],[[208,48]],[[208,208]],[[48,208]]],{closed:true,dash:[35,17],dashOffset:21});
  make('stroke-trim',curved,{trim:{start:.2,end:.8,offset:0}});
  make('stroke-trim-wrap',curved,{trim:{start:.1,end:.65,offset:.65}});
  make('stroke-trim-reversed',curved,{trim:{start:.8,end:.2,offset:-.15}});
  make('stroke-trim-closed',[[[48,48]],[[208,48]],[[208,208]],[[48,208]]],{closed:true,trim:{start:.1,end:.7,offset:.65}});
  make('stroke-dash-trim',curved,{dash:[18,12],dashOffset:10,trim:{start:.1,end:.7,offset:0}});
  make('stroke-dash-trim-wrap',curved,{dash:[18,12],dashOffset:-10,trim:{start:.1,end:.7,offset:.7}});
  make('stroke-alpha',curved,{color:'#24594a80'});
  make('stroke-hidden',curved,{width:0});
  const p=make('stroke-animated',curved,{dash:[18,12]});
  const a={id:'motion',name:'Motion',artboardId:'board',fps:60,duration:120,loop:false,tracks:[]};p.animations.push(a);
  for(const [property,values] of Object.entries({'stroke.width':[6,22,6],'stroke.color':['#24594aff','#dc805aff','#24594aff'],'stroke.trimEnd':[.25,.75,1],'stroke.trimOffset':[0,.1,0],'stroke.dashOffset':[0,14,0]}))
    values.forEach((v,i)=>setKey(p,a.id,'line',property,i*60,v,{type:'linear',curve:null}));
  return cases;
}
