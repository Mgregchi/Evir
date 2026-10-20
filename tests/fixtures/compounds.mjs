import {createProject,upgradeAdvanced,defaultStroke} from '@evir/project-model';
import {addShape,addNode,combinePaths,bindSkin,createAnimation,setKey} from '@evir/authoring';
import {booleanPaths} from '@evir/authoring/boolean';
import {encodeRecords} from './riv-records.mjs';
import {importRiv,compileProject} from '@evir/format';
export async function compoundCases(){
 const cases=[];
 const base=(name,positions=[40,80])=>{const p=createProject();p.id='compound-'+name;p.name=name;p.artboards[0].width=p.artboards[0].height=512;const a=addShape(p,'circle',{width:300,x:70,y:70,fill:'#89cdb7'}),b=addShape(p,'circle',{width:140,x:70+positions[0],y:70+positions[1],fill:'#edb57d'});return{p,a,b};};
 for(const operation of ['union','subtract','intersect','exclude']){const{p,a,b}=base(operation,[190,70]);booleanPaths(p,[a,b],{operation});cases.push({name:operation,p});}
 for(const fillRule of ['nonzero','evenodd']){const{p,a,b}=base(fillRule,[80,80]);combinePaths(p,[a,b],{fillRule});cases.push({name:fillRule,p});}
 for(const effects of [false,true]){const{p,a,b}=base(effects?'stroke-effects':'stroke',[80,80]);booleanPaths(p,[a,b],{operation:'subtract'});p.nodes[0].geometry.stroke={...defaultStroke('#244a3e'),width:7,...(effects?{dash:[14,9],trim:{start:.1,end:.8,offset:.04}}:{})};cases.push({name:effects?'stroke-effects':'stroke',p});}
 for(const fillRule of ['nonzero','evenodd']){const{p,a,b}=base('clip-'+fillRule,[80,80]);combinePaths(p,[a,b],{fillRule:'nonzero'});const art=addShape(p,'rectangle',{x:0,y:0,width:512,height:512,fill:'#cd987e'});p.advanced.clips.push({targetId:art,maskId:a,visible:false,fillRule});cases.push({name:'clip-'+fillRule,p});}
 {const{p,a,b}=base('skin',[80,80]);booleanPaths(p,[a,b],{operation:'subtract'});const bone=addNode(p,'bone');bindSkin(p,a,[bone]);const id=createAnimation(p,p.artboards[0].id);setKey(p,id,bone,'x',0,0);setKey(p,id,bone,'x',60,50);cases.push({name:'skin',p});const original=compileProject(p).bytes;cases.push({name:'skin-import',p:await importRiv(original),original});}
 // Independent native input with nested same-winding rectangles and an evenodd Fill.
 const records=[{type:'Backboard',fields:{}},{type:'Artboard',fields:{name:'Native holes',width:256,height:256}},{type:'Shape',fields:{parentId:0,name:'Two native contours'}}];
 for(const [lo,hi]of[[30,225],[90,165]]){const id=records.length-1;records.push({type:'PointsPath',fields:{parentId:1,isClosed:true}});for(const[x,y]of[[lo,lo],[hi,lo],[hi,hi],[lo,hi]])records.push({type:'StraightVertex',fields:{parentId:id,x,y}});}
 const fill=records.length-1;records.push({type:'Fill',fields:{parentId:1,fillRule:1}},{type:'SolidColor',fields:{parentId:fill,colorValue:0xff89cdb7}});const native=encodeRecords(records);const imported=await importRiv(native);cases.push({name:'native-evenodd',p:imported,original:native},{name:'native-evenodd-reexport',p:imported});
 return cases;
}
