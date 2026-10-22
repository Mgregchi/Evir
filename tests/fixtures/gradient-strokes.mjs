import{createProject,upgradeAdvanced,defaultStroke}from'@evir/project-model';
import{addNode,createAnimation,setKey}from'@evir/authoring';
export function gradientStroke(type='linear'){
 const p=createProject();upgradeAdvanced(p);const id=addNode(p,'path'),n=p.nodes.find(n=>n.id===id);n.geometry.fill=null;n.geometry.closed=false;n.geometry.stroke={...defaultStroke(),width:18,color:{type,start:[0,0],end:[120,100],stops:[{position:0,color:'#89e4c4ff'},{position:1,color:'#edb75fff'}]}};const animationId=createAnimation(p,p.artboards[0].id);p.animations[0].duration=120;
 for(const[property,values]of [['stroke.paint.endX',[120,190,120]],['stroke.paint.stop.0.color',['#89e4c4ff','#4d91c7ff','#89e4c4ff']]])[0,60,120].forEach((f,i)=>setKey(p,animationId,id,property,f,values[i]));return p;
}
export async function skinnedStroke(type='linear'){
 const {bindSkin,setSkinWeights}=await import('@evir/authoring');
 const p=gradientStroke(type==='solid'?'linear':type),n=p.nodes[0];if(type==='solid'){n.geometry.stroke.color='#89e4c4ff';p.animations[0].tracks=p.animations[0].tracks.filter(t=>!t.property.startsWith('stroke.paint.'));}
 const root=addNode(p,'bone'),tip=addNode(p,'bone',root);p.nodes.find(v=>v.id===root).transform=[1,0,0,1,80,80];p.nodes.find(v=>v.id===root).geometry.length=90;p.nodes.find(v=>v.id===tip).geometry.length=90;n.transform=[1.15,0,0,.85,90,110];bindSkin(p,n.id,[root,tip]);
 const changes=[];n.geometry.points.forEach((v,i)=>{for(const control of ['anchor','in','out'])changes.push({pointId:v.id,control,boneId:tip,value:i/(n.geometry.points.length-1)});});setSkinWeights(p,n.id,changes);
 for(const[frame,value]of[[0,0],[60,.6],[120,0]])setKey(p,p.animations[0].id,tip,'rotation',frame,value);p.name='Skinned '+type+' stroke';return p;
}
