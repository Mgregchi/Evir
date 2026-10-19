import {createProject,upgradeAdvanced,validateProject} from '@evir/project-model';
import {encodeRecords} from '../../tools/encode-riv-records.mjs';
export function directFixture({fixed=false}={}){
 const p=createProject();p.id='direct-fixture';p.name='Direct probe';p.artboards=[{id:'board',name:'Direct probe',width:256,height:256}];p.editor.cameras={board:{x:0,y:0,zoom:1}};upgradeAdvanced(p);
 p.nodes=[{id:'box',name:'box',kind:'rectangle',artboardId:'board',parentId:null,order:0,transform:[1,0,0,1,64,128],geometry:{width:48,height:48,fill:'#2864dc'}}];
 p.animations=['left','right'].map((id,index)=>({id,name:id==='left'?'Left':'Right',artboardId:'board',fps:60,duration:60,loop:true,tracks:[{targetId:'box',property:'x',keys:[0,60].map(frame=>({frame,value:index?192:64,easing:{type:'linear',curve:null}}))}]}));
 p.machines=[{id:'direct-machine',name:'Direct',artboardId:'board',inputs:[{id:'left-weight',name:'left',type:'number',value:100},{id:'right-weight',name:'right',type:'number',value:0}],states:[{id:'direct-state',name:'Direct',animationId:'left',position:[0,0],blend:{type:'direct',children:[{animationId:'left',...(fixed?{weight:100}:{inputId:'left-weight'})},{animationId:'right',inputId:'right-weight'}]}}],entryStateId:'direct-state',transitions:[],listeners:[]}];
 validateProject(p);return p;
}
export function nativeDirectFixture({fixed=false,omitFixedValue=false}={}){
 const record=(type,fields={})=>({type,fields});const records=[record('Backboard'),record('Artboard',{name:'Direct probe',width:256,height:256}),record('Shape',{name:'box',x:64,y:128,parentId:0}),record('Rectangle',{parentId:1,width:48,height:48,originX:0,originY:0}),record('Fill',{parentId:1}),record('SolidColor',{parentId:3,colorValue:0xff2864dc})];
 for(const[name,value]of[['Left',64],['Right',192]])records.push(record('LinearAnimation',{name,fps:60,duration:60,loopValue:1}),record('KeyedObject',{objectId:1}),record('KeyedProperty',{propertyKey:13}),...[0,60].map(frame=>record('KeyFrameDouble',{frame,value,interpolationType:1})));
 records.push(record('StateMachine',{name:'Direct'}),record('StateMachineNumber',{name:'left',value:100}),record('StateMachineNumber',{name:'right',value:0}),record('StateMachineLayer',{name:'Main'}),record('EntryState'),record('StateTransition',{stateToId:3}),record('AnyState'),record('ExitState'),record('BlendStateDirect',{flags:2}),record('BlendAnimationDirect',{animationId:0,...(fixed?{blendSource:1,...(omitFixedValue?{}:{mixValue:100})}:{inputId:0})}),record('BlendAnimationDirect',{animationId:1,inputId:1}));
 return{records,bytes:encodeRecords(records)};
}
