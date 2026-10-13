// Original command-authored lesson: a turning pointer with an audience speed control.
export function compassLesson(artboardId,prefix='compass',{x=256,y=256,scale=1,rootOrder=0}={}){
  const nodes=[],root=`${prefix}-root`,needle=`${prefix}-needle`,animationId=`${prefix}-turn`;
  const node=(id,kind,geometry,parentId,tx=0,ty=0)=>nodes.push({id:`${prefix}-${id}`,name:id.replaceAll('-',' '),kind,geometry,parentId,artboardId,order:nodes.length,transform:[1,0,0,1,tx,ty]});
  node('root','group',null,null,x,y);nodes[0].transform=[scale,0,0,scale,x,y];nodes[0].order=rootOrder;
  const path=(id,points,fill,parent=root,tx=0,ty=0)=>node(id,'path',{closed:true,fill,skin:null,points:points.map(([a,i=a,o=a],k)=>({id:`${prefix}-${id}-p${k}`,anchor:a,in:i,out:o}))},parent,tx,ty);
  const oval=(id,r,fill,tx=0,ty=0)=>{const k=r*.5522847498;path(id,[[[r,0],[r,-k],[r,k]],[[0,r],[k,r],[-k,r]],[[-r,0],[-r,k],[-r,-k]],[[0,-r],[-k,-r],[k,-r]]],fill,root,tx,ty);};
  oval('shadow',184,'#243f3320',0,10);oval('dial',180,'#243f33');oval('inner-dial',164,'#c8ead8');oval('face',138,'#eef2e8');
  for(let i=0;i<8;i++)oval(`marker-${i}`,i%2?3:6,'#34594b',Math.sin(i*Math.PI/4)*152,-Math.cos(i*Math.PI/4)*152);
  node('needle','group',null,root);
  path('north',[[[0,-115]],[[18,18]],[[0,0]],[[-18,18]]],'#e7b093',needle);
  path('south',[[[0,115]],[[18,-18]],[[0,0]],[[-18,-18]]],'#34594b',needle);
  oval('pivot',12,'#243f33');oval('pivot-light',5,'#c8ead8');
  const animation={id:animationId,name:'Find north',artboardId,fps:60,duration:240,playback:{mode:'loop',iterations:0,speed:1},tracks:[]};
  const commands=[...nodes.map(node=>({op:'create_node',node})),{op:'create_animation',animation},...[0,240].map(frame=>({op:'set_key',animationId,nodeId:needle,property:'rotation',frame,value:frame?Math.PI*2:0,easing:{type:'linear',curve:null}}))];
  const controls=[{id:`${prefix}-speed`,label:'Pointer speed',type:'slider',min:0,max:4,step:.25,value:1,binding:{kind:'speed',animationId}}];
  return {commands,controls,animationId};
}
