import {shapeGeometry,addShape,setKey,createAnimation} from '@evir/authoring';
import {createProject,upgradeAdvanced} from '@evir/project-model';

export function shapeGarden(makeProject){
  const {p,node,anim,key}=makeProject('garden','Pocket garden — made from shapes');
  const shape=(name,type,x,y,width,height,fill,parent=null,extra={})=>{
    const {kind,geometry}=shapeGeometry(type,{width,height,fill,...extra});
    geometry.points?.forEach((point,i)=>point.id=`garden-${name}-point-${i}`);
    if(geometry.stroke)upgradeAdvanced(p);
    return node(name,kind,geometry,parent,x,y);
  };
  shape('garden-card','rounded',32,48,448,408,'#dfe9df',null,{radius:36});
  shape('sky-cloud-left','cloud',75,112,110,65,'#f8f7ec');
  shape('sky-cloud-right','cloud',377,245,68,43,'#f8f7ec');
  const sun=node('sun','group',null,null,350,157);
  shape('sun-rays','star',-76,-76,152,152,'#edc576',sun,{sides:9,inner:78});
  shape('sun-face','circle',-53,-53,106,106,'#f4dca1',sun);
  for(const x of [-20,20]){shape('sun-eye-'+x,'circle',x-4,-12,8,8,'#304b43',sun);shape('sun-cheek-'+x,'ellipse',x-8,3,16,8,'#e7ae90',sun);}
  shape('sun-smile','capsule',-12,14,24,7,'#304b43',sun);
  shape('garden-bed','rounded',49,352,414,78,'#b7ccb7',null,{radius:36});
  for(const [name,x,y,color,petals]of[['lavender',151,292,'#b9a5ca',6],['peach',258,255,'#e6aa89',7],['mint',361,310,'#80b9a4',5]]){
    const flower=node(name+'-flower','group',null,null,x,y);
    shape(name+'-stem','capsule',-4,0,8,110,'#5c8977',flower);
    shape(name+'-left-leaf','ellipse',-44,42,44,20,'#7aa58c',flower);
    shape(name+'-right-leaf','ellipse',0,61,44,20,'#7aa58c',flower);
    shape(name+'-petals','star',-42,-42,84,84,color,flower,{sides:petals,inner:74});
    shape(name+'-center','circle',-16,-16,32,32,'#f5e6bd',flower);
    shape(name+'-pot','rounded',x-31,383,62,44,'#b68063',null,{radius:12});
  }
  shape('little-heart','heart',74,220,36,36,'#d9a3a0');
  shape('hello-bubble','bubble',177,157,94,58,'#fbf8ec',null,{radius:16});
  for(let i=0;i<3;i++)shape('hello-dot-'+i,'circle',196+i*18,177,7,7,'#638d7b');
  const a=anim('grow','A little sunshine');
  key(a,sun,'y',[[0,157],[60,148],[120,157]]);
  for(const[name,angle]of[['lavender',.05],['peach',-.04],['mint',.06]])key(a,'garden-'+name+'-flower','rotation',[[0,0],[60,angle],[120,0]]);
  return p;
}

// The exact, deliberately small result of the public beginner lesson.
export function firstBounce(){
  const p=createProject();p.id='first-bounce-project';p.name='First bounce';
  p.artboards=[{id:'first-bounce-board',name:'Artboard 1',width:640,height:480}];
  p.editor.cameras={'first-bounce-board':{x:0,y:0,zoom:1}};
  addShape(p,'circle',{width:96,x:120,y:220,fill:'#edb75f',name:'Sun'});
  const sun=p.nodes[0];sun.id='first-bounce-sun';sun.geometry.points.forEach((v,i)=>v.id='first-bounce-point-'+i);
  createAnimation(p,p.artboards[0].id);const a=p.animations[0];a.id='first-bounce-animation';a.name='Bounce';
  delete a.loop;a.playback={mode:'loop',iterations:0,speed:1};
  for(const[frame,y]of[[0,220],[60,100],[120,220]])setKey(p,a.id,sun.id,'y',frame,y);
  return p;
}
