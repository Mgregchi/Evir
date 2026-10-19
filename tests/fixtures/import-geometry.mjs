// Independently encoded native Rive contours: these do not pass through Evir's
// compiler before import. Original synthetic geometry, no uploaded artwork.
import {encodeRecords} from './riv-records.mjs';
import {importRiv} from '@evir/format';
import {stableImport} from '../../tools/stabilize-import.mjs';
export function geometryCases() {
  const cases=[];
  const mixed=[
    {type:'StraightVertex',fields:{x:45,y:65}},
    {type:'CubicMirroredVertex',fields:{x:158,y:60,rotation:.3,distance:30}},
    {type:'CubicAsymmetricVertex',fields:{x:203,y:165,rotation:1.8,inDistance:48,outDistance:22}},
    {type:'CubicDetachedVertex',fields:{x:70,y:195,inRotation:.4,inDistance:29,outRotation:-2,outDistance:46}},
  ];
  function make(name,{type='PointsPath',fields={isClosed:true},vertices=mixed,stroke=false,gradient=false,skin=false,motion=false,shape={}}={}) {
    const records=[{type:'Backboard',fields:{}},{type:'Artboard',fields:{name:'Board',width:256,height:256}}];
    const emit=(type,fields)=>{records.push({type,fields});return records.length-2;};
    const bone=skin?emit('RootBone',{name:'Pivot',parentId:0,x:128,y:128,length:70}):null;
    const steadyBone=skin?emit('RootBone',{name:'Anchor',parentId:0,x:128,y:128,length:70}):null;
    const shapeId=emit('Shape',{name:'Contour',parentId:0,...shape});
    const path=emit(type,{parentId:shapeId,...fields});
    for(const vertex of (type==='PointsPath'?vertices:[])) {
      const id=emit(vertex.type,{parentId:path,...vertex.fields});
      if(skin){const weight={parentId:id,indices:1,values:255};emit(vertex.type==='StraightVertex'?'Weight':'CubicWeight',vertex.type==='StraightVertex'?weight:{...weight,inIndices:2,inValues:255,outIndices:1,outValues:255});}
    }
    if(skin){const id=emit('Skin',{parentId:path,xx:1,yy:1});emit('Tendon',{parentId:id,boneId:bone,xx:1,yy:1,tx:128,ty:128});emit('Tendon',{parentId:id,boneId:steadyBone,xx:1,yy:1,tx:128,ty:128});}
    if(stroke){const id=emit('Stroke',{parentId:shapeId,thickness:9,cap:1,join:1});emit('SolidColor',{parentId:id,colorValue:0xff275b49});}
    else{const fill=emit('Fill',{parentId:shapeId});if(gradient){const id=emit('LinearGradient',{parentId:fill,startX:45,startY:30,endX:200,endY:190});emit('GradientStop',{parentId:id,position:0,colorValue:0xffa1dfbd});emit('GradientStop',{parentId:id,position:1,colorValue:0xffd79771});}else emit('SolidColor',{parentId:fill,colorValue:0xff8acbab});}
    if(motion){emit('LinearAnimation',{name:'Motion',fps:60,duration:120,loopValue:1});emit('KeyedObject',{objectId:skin?bone:shapeId});emit('KeyedProperty',{propertyKey:15});for(const [frame,value]of [[0,0],[60,.35],[120,0]])emit('KeyFrameDouble',{frame,value,interpolationType:1});}
    cases.push({name,records,bytes:encodeRecords(records)});
  }
  make('import-mixed-closed');
  make('import-mixed-open-stroke',{fields:{isClosed:false},stroke:true});
  make('import-mixed-transformed',{fields:{isClosed:true,x:216,y:5,rotation:.2,scaleX:-.75,scaleY:.9},gradient:true});
  make('import-default-controls',{vertices:[{type:'StraightVertex',fields:{x:40,y:40}},{type:'CubicMirroredVertex',fields:{x:210,y:50}},{type:'CubicAsymmetricVertex',fields:{x:190,y:205}},{type:'CubicDetachedVertex',fields:{x:50,y:190}}]});
  make('import-ellipse-centered',{type:'Ellipse',fields:{width:130,height:85},shape:{x:128,y:128}});
  make('import-ellipse-origin',{type:'Ellipse',fields:{width:150,height:85,originX:.2,originY:.8},shape:{x:70,y:160}});
  make('import-ellipse-transformed',{type:'Ellipse',fields:{width:140,height:90,x:15,y:-8,rotation:.42,scaleX:-1.2,scaleY:.7},shape:{x:128,y:128},stroke:true});
  make('import-ellipse-animated-shape',{type:'Ellipse',fields:{width:90,height:60,x:45,y:8},shape:{x:100,y:118},motion:true,gradient:true});
  make('import-rectangle-centered',{type:'Rectangle',fields:{width:150,height:92},shape:{x:128,y:128}});
  make('import-rectangle-origin',{type:'Rectangle',fields:{width:105,height:70,originX:-.2,originY:1.2},shape:{x:42,y:177},stroke:true});
  make('import-rectangle-transformed',{type:'Rectangle',fields:{width:100,height:80,originX:0,originY:0,x:80,y:48,rotation:.35,scaleX:.9,scaleY:1.1},gradient:true});
  make('import-mixed-skinned',{skin:true,motion:true});
  return cases;
}
export async function importedCases(){return Promise.all(geometryCases().map(async c=>({...c,project:stableImport(await importRiv(c.bytes),c.name)})));}
