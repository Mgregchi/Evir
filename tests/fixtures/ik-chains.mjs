import{createProject,upgradeAdvanced}from'@evir/project-model';import{addNode,createAnimation,setKey}from'@evir/authoring';
export function chainScene(count=4,{strength=1,invert=false}={}){
 const p=createProject();upgradeAdvanced(p);p.name=`IK ${count} strength ${strength} invert ${invert}`;p.artboards[0].width=p.artboards[0].height=512;const bones=[];
 const base=addNode(p,'group');p.nodes.find(n=>n.id===base).transform=[1,0,0,1,140,250];
 for(let i=0;i<count;i++){const id=addNode(p,'bone',i?bones.at(-1):base),n=p.nodes.find(n=>n.id===id);n.name='Segment '+i;n.geometry.length=36;const angle=i%2?.13:-.09;n.transform=[Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0];bones.push(id);const art=addNode(p,'rectangle',id),r=p.nodes.find(n=>n.id===art);r.transform=[1,0,0,1,0,-7];r.geometry={width:36,height:14,fill:i%2?'#89e4c4':'#edb75f'};}
 const target=addNode(p,'group');p.nodes.find(n=>n.id===target).transform=[1,0,0,1,220,170];p.advanced.ik.push({boneId:bones.at(-1),targetId:target,count,strength,invert});const animation=createAnimation(p,p.artboards[0].id);for(const[property,values]of [['x',[220,270,220]],['y',[170,290,170]]])[0,60,120].forEach((frame,i)=>setKey(p,animation,target,property,frame,values[i]));return {p,bones,target,base};
}
