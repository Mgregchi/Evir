import {defaultStroke,upgradeAdvanced} from '@evir/project-model';
// Original vector firefly: independent feelings share an explicit rest baseline.
export function directStudy(makeProject){
 const{p,node,path,oval,box,anim,key}=makeProject('lumen','Lumen — a little courage');upgradeAdvanced(p);
 oval('night-garden',256,254,208,208,'#dfe8e3');oval('moon-halo',365,129,53,53,'#f4ddbf');oval('moon',358,121,36,36,'#fbefcf');
 const leaf=(id,x,y,rotation,color)=>{const g=node(id,'group',null,null,x,y);p.nodes.find(n=>n.id===g).transform=[Math.cos(rotation),Math.sin(rotation),-Math.sin(rotation),Math.cos(rotation),x,y];path(id+'-leaf',[[[0,0],[-17,-10],[-26,-43]],[[-5,-73],[-28,-58],[26,-59]],[[0,0],[29,-23]]],color,g);};
 for(const[id,x,y,r,c]of[['leaf-left',100,407,-.5,'#8daf9c'],['leaf-right',407,419,.6,'#a7bda5'],['leaf-front',128,431,.5,'#5c8977']])leaf(id,x,y,r,c);
 oval('ground-shadow',258,430,109,17,'#bbcdbc');
 const firefly=node('firefly','group',null,null,256,282);
 const left=node('left-wing','group',null,firefly,-43,6),right=node('right-wing','group',null,firefly,43,6);
 path('left-wing-outline',[[[4,7],[12,32],[-14,-24]],[[-84,-69],[-55,-82],[-115,-30]],[[-23,60],[-77,82],[2,55]]],'#538c80',left);
 path('left-wing-glass',[[[-1,6],[6,26],[-23,-24]],[[-78,-59],[-48,-73],[-99,-29]],[[-24,48],[-65,67],[-4,45]]],'#a8dbbf',left);
 path('left-wing-vein',[[[-8,17]],[[-68,-35]],[[-10,23]]],'#78baa0',left);
 path('right-wing-outline',[[[-4,7],[-12,32],[14,-24]],[[84,-69],[55,-82],[115,-30]],[[23,60],[77,82],[-2,55]]],'#538c80',right);
 path('right-wing-glass',[[[1,6],[-6,26],[23,-24]],[[78,-59],[48,-73],[99,-29]],[[24,48],[65,67],[4,45]]],'#a8dbbf',right);
 path('right-wing-vein',[[[8,17]],[[68,-35]],[[10,23]]],'#78baa0',right);
 oval('body',0,37,62,91,'#6c6590',firefly);oval('body-light',-6,40,49,79,'#a29bc4',firefly);oval('little-lantern',0,85,37,37,'#e6ba84',firefly);oval('lantern-light',-7,78,26,25,'#f6d6a5',firefly);
 for(const x of [-25,25]){const foot=node('foot-'+x,'group',null,firefly,x,123);oval('shoe-'+x,0,0,21,9,'#57566d',foot);}
 const head=node('head','group',null,firefly,0,-48);
 path('head-outline',[[[-71,-9],[-73,38],[-77,-54]],[[-25,-69],[-58,-72],[1,-78]],[[66,-37],[47,-69],[87,-6]],[[53,42],[77,29],[18,66]],[[-49,42],[-8,62],[-74,32]]],'#6c6590',head);
 path('face',[[[-60,-5],[-62,30],[-67,-40]],[[-22,-57],[-51,-60],[3,-65]],[[56,-30],[39,-58],[71,-5]],[[44,32],[65,22],[16,52]],[[-41,34],[-5,50],[-61,25]]],'#c3bada',head);
 for(const x of [-28,28]){oval('eye-'+x,x,-8,10,14,'#303d44',head);oval('eye-shine-'+x,x-3,-13,3,4,'#fffaf0',head);oval('cheek-'+x,x*1.45,16,13,8,'#e7baa7',head);}
 const smile=node('smile','group',null,head,0,19);
 path('smile-shape',[[[-18,0],[-18,5],[-4,7]],[[18,0],[4,7],[18,9]],[[0,22],[12,22],[-12,22]]],'#614659',smile);oval('smile-light',0,10,8,4,'#e5a2a6',smile);
 for(const sign of [-1,1]){path('antenna-'+sign,[[[sign*33,-55]],[[sign*48,-91],[sign*40,-88]]],null,head);const stem=p.nodes.at(-1);stem.geometry.closed=false;stem.geometry.stroke={...defaultStroke(),color:'#6c6590',width:5,cap:'round',join:'round'};oval('antenna-tip-'+sign,sign*48,-93,10,10,'#edc591',head);}
 for(const[x,y,size]of[[143,150,5],[393,269,5],[136,317,4],[331,62,3],[366,379,4]]){oval('garden-light-'+x,x,y,size,size,'#f6d7a0');}
 const rest=anim('rest','Rest'),joy=anim('joy','Joy'),brave=anim('brave','Courage');
 key(rest,firefly,'y',[[0,282],[60,274],[120,282]]);
 for(const[id,property,value]of[[head,'rotation',0],[smile,'scaleY',1],[left,'rotation',0],[right,'rotation',0]])key(rest,id,property,[[0,value],[120,value]]);
 key(joy,head,'rotation',[[0,.12],[60,-.08],[120,.12]]);key(joy,smile,'scaleY',[[0,1.5],[60,1.9],[120,1.5]]);
 key(brave,left,'rotation',[[0,.35],[30,.65],[60,.3],[90,.6],[120,.35]]);key(brave,right,'rotation',[[0,-.35],[30,-.65],[60,-.3],[90,-.6],[120,-.35]]);
 p.machines.push({id:'lumen-feelings',name:'Feelings',artboardId:p.artboards[0].id,inputs:[{id:'lumen-joy-input',name:'joy',type:'number',value:0},{id:'lumen-courage-input',name:'courage',type:'number',value:0}],states:[{id:'lumen-mix',name:'Make a feeling',animationId:rest,position:[60,60],blend:{type:'direct',children:[{animationId:rest,weight:100},{animationId:joy,inputId:'lumen-joy-input'},{animationId:brave,inputId:'lumen-courage-input'}]}}],entryStateId:'lumen-mix',transitions:[],listeners:[]});
 return p;
}
