import { defaultStroke, upgradeAdvanced } from '@evir/project-model';
import { joinPaths } from '@evir/authoring';

// Original vector art, built from editable cubic curves and retained centerlines.
export function joiningStudy(makeProject) {
  const {p,node,path,oval,box,anim,key}=makeProject('outing','Outing — a little connection');upgradeAdvanced(p);
  box('paper',24,24,464,464,42,'#fbf7eb');
  oval('soft-sky',276,213,167,151,'#e4eee1');oval('peach-sun',109,125,36,36,'#edc4a0');
  const line=(id,points,width,color,parent=null,x=0,y=0)=>{
    const idn=path(id,points,null,parent,x,y),n=p.nodes.find(n=>n.id===idn);n.geometry.closed=false;n.geometry.stroke={...defaultStroke(color),width};return idn;
  };
  line('wind-one',[[[272,98]],[[302,98]]],2.5,'#b3cbb9');line('wind-two',[[[286,109]],[[329,109]]],2.5,'#b3cbb9');
  oval('ground',193,432,111,13,'#d4e1cf');
  const scene=node('afternoon','group',null),fox=node('fox','group',null,scene,156,333);
  path('curled-tail',[[[-24,30],[-23,53],[-59,5]],[[-74,34],[-94,5],[-72,72]],[[-47,87],[-86,80],[-13,90]],[[1,65],[-6,90],[3,44]]],'#c87f59',fox);
  path('tail-tip',[[[-74,34],[-94,5],[-72,59]],[[-48,63],[-65,73],[-39,58]],[[-52,34],[-46,47],[-67,24]]],'#fff7e8',fox);
  oval('left-boot',-21,87,19,11,'#39574b',fox);oval('right-boot',22,87,19,11,'#39574b',fox);
  oval('body',0,39,41,48,'#d79468',fox);oval('belly',3,45,26,31,'#f6dcb7',fox);
  path('raised-arm',[[[29,29],[15,36],[52,28]],[[59,-18],[48,-1],[69,-27]],[[74,-14],[73,-25],[70,10]],[[43,52],[60,40],[25,54]]],'#d79468',fox);
  oval('paw',68,-18,11,12,'#f6dcb7',fox);
  path('head',[[[-57,-37],[-59,-11],[-59,-63]],[[-49,-92],[-54,-94],[-43,-87]],[[-20,-64],[-36,-73],[-8,-70]],[[20,-64],[9,-70],[35,-74]],[[49,-92],[43,-87],[55,-97]],[[57,-37],[60,-65],[63,-8]],[[35,15],[56,8],[19,32]],[[-35,15],[-15,31],[-58,7]]],'#d79468',fox);
  path('left-ear',[[[-49,-78]],[[-46,-47]],[[-27,-62]]],'#ae6950',fox);
  path('right-ear',[[[49,-78]],[[27,-62]],[[46,-47]]],'#ae6950',fox);
  path('cream-cheeks',[[[-48,-29],[-49,-10],[-32,-30]],[[0,-6],[-10,-4],[13,-9]],[[48,-29],[32,-32],[49,-9]],[[29,16],[43,11],[14,28]],[[-29,16],[-12,28],[-44,10]]],'#fff4dc',fox);
  const left=oval('left-eye',-25,-28,4.7,6.5,'#2c4c3e',fox),right=oval('right-eye',25,-28,4.7,6.5,'#2c4c3e',fox);
  oval('left-glint',-23.7,-30,1.5,1.7,'#fffaf0',fox);oval('right-glint',26.3,-30,1.5,1.7,'#fffaf0',fox);
  path('nose',[[[-7,-5],[-9,-9],[-5,1]],[[0,2],[-2,3],[4,2]],[[7,-5],[7,1],[9,-9]]],'#2c4c3e',fox);
  line('smile',[[[-13,4],[-13,4],[-8,14]],[[13,4],[7,14]]],2,'#7e5846',fox);
  path('scarf-end',[[[-23,22]],[[-51,44]],[[-32,48]],[[-8,27]]],'#6caf91',fox);
  path('scarf',[[[-36,17],[-35,13],[-11,26]],[[36,17],[13,26],[36,26]],[[27,32],[38,31],[5,38]],[[-29,32],[-9,37],[-39,26]]],'#8bc9aa',fox);
  const tether=node('tether','group',null,scene);
  const keep=line('kite-string',[[[224,315],[224,315],[254,326]],[[286,270],[254,292]]],2.8,'#527f6b',tether);
  const other=line('upper-string',[[[18,-16],[18,-16],[36,-55]],[[74,-51],[58,-44]]],2.8,'#527f6b',tether,286,270);
  const kite=node('kite','group',null,scene,360,154);
  path('left-sail',[[[0,-56]],[[-40,0]],[[0,65]]],'#8fc6a6',kite);
  path('right-sail',[[[0,-56]],[[0,65]],[[40,0]]],'#e4b58d',kite);
  line('kite-ribs',[[[0,-56]],[[0,65]]],2,'#527f6b',kite);line('cross-spar',[[[-40,0]],[[40,0]]],2,'#527f6b',kite);
  path('kite-bow',[[[-7,65]],[[-22,74]],[[-22,58]],[[-7,65]],[[9,65]],[[24,74]],[[24,58]],[[9,65]]],'#d79371',kite);
  const a=anim('drift','Drift');key(a,scene,'x',[[0,0],[60,3],[120,0]]);key(a,scene,'y',[[0,0],[60,-2],[120,0]]);
  for(const eye of[left,right])key(a,eye,'scaleY',[[0,1],[52,1],[58,.12],[64,1],[120,1]]);
  const seed=structuredClone(p);joinPaths(p,keep,other);
  return {project:p,seed,recipe:{format:'evir-path-join-recipe',version:1,keepId:keep,otherId:other,options:{keepEnd:'last',otherEnd:'first',mode:'bridge'}}};
}
