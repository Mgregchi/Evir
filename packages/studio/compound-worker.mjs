import {booleanGeometry} from '@evir/authoring/boolean';
import {newId} from '@evir/project-model';
self.onmessage=({data})=>{
 try{
  let geometry;
  if(data.operation==='combine'){
    const parts=data.shapes.flatMap(s=>s.contours).map(c=>({...c,points:c.points.map(v=>({...v,id:newId('point')}))})),first=parts.shift();
    geometry={...first,contours:parts,fillRule:data.fillRule};
  }else geometry=booleanGeometry(data.shapes,data.operation);
  self.postMessage({ok:true,geometry});
 }catch(e){self.postMessage({ok:false,error:e.message});}
};
