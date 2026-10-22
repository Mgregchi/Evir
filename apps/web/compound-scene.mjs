import {shapeGeometry} from '@evir/authoring';
import {booleanPaths} from '@evir/authoring/boolean';
import {pathContours,defaultStroke,upgradeAdvanced,canonicalShape} from '@evir/project-model';
export function compoundStudy(makeProject,{starting=false}={}){
 const{p,node,path,oval,anim,key}=makeProject('nocturne','Nocturne — a window into the night');upgradeAdvanced(p);
 const shape=(id,type,x,y,width,height,fill,parent=null,extra={})=>{const {kind,geometry}=shapeGeometry(type,{width,height,fill,...extra});if(kind==='path')for(const[c,part]of pathContours(geometry).entries())part.points.forEach((v,i)=>v.id=`nocturne-${id}-${c}-${i}`);return node(id,kind,geometry,parent,x,y);};
 shape('night-card','rounded',30,35,452,442,'#e5e6de',null,{radius:42});
 shape('dusk','circle',58,59,396,396,'#354d59');
 const moon=shape('moon','circle',322,84,86,86,'#f3d69d'),cut=shape('moon-cut','circle',344,70,72,72,'#354d59');booleanPaths(p,[moon,cut],{operation:'subtract'});
 for(const[x,y,size]of[[132,98,10],[205,76,6],[427,215,8],[88,210,6],[376,315,6]])shape('star-'+x,'star',x,y,size,size,'#e8ce9b',null,{sides:4,inner:30});
 path('branch',[[[67,408]],[[227,424],[155,430],[316,420]],[[438,397]]],null);p.nodes.at(-1).geometry.closed=false;p.nodes.at(-1).geometry.stroke={...defaultStroke('#b58a6b'),width:12};
 const owl=node('owl','group',null,null,251,280);
 for(const x of[-47,30])shape('foot-'+x,'capsule',x,116,23,32,'#eac18a',owl);
 const left=node('left-wing','group',null,owl,-90,0),right=node('right-wing','group',null,owl,87,0);
 oval('left-wing-shape',-12,23,35,62,'#589d93',left);oval('right-wing-shape',12,23,35,62,'#589d93',right);
 shape('eye-light','rounded',-80,-76,160,90,'#f5e8c9',owl,{radius:35});
 const body=shape('owl-body','rounded',-109,-120,218,255,'#a5d6bb',owl,{radius:80});
 const l=shape('left-ear','triangle',-111,-159,93,105,'#a5d6bb',owl),r=shape('right-ear','triangle',17,-159,93,105,'#a5d6bb',owl);booleanPaths(p,[body,l,r],{operation:'union'});
 const holeL=shape('left-window','circle',-78,-77,65,65,'#f5e8c9',owl),holeR=shape('right-window','circle',13,-77,65,65,'#f5e8c9',owl);
 if(starting)for(const id of [holeL,holeR])p.nodes.find(n=>n.id===id).geometry.shape=canonicalShape('circle',{width:65}).definition;
 for(const x of[-46,46]){oval('eye-'+x,x,-45,14,20,'#25494c',owl);oval('shine-'+x,x-4,-52,4,6,'#ffffff',owl);oval('cheek-'+x,x*1.45,0,18,9,'#d6a78f',owl);}
 shape('beak','diamond',-12,-20,24,29,'#edbd75',owl);
 for(let i=0;i<3;i++)shape('belly-mark-'+i,'capsule',-34+i*27,57,12,29,'#78b7a4',owl);
 const a=anim('night-watch','Night watch');key(a,owl,'y',[[0,280],[60,273],[120,280]]);key(a,left,'rotation',[[0,-.03],[60,.06],[120,-.03]]);key(a,right,'rotation',[[0,.03],[60,-.06],[120,.03]]);
 if(!starting){booleanPaths(p,[body,holeL,holeR],{operation:'subtract'});const n=p.nodes.find(n=>n.id===body);n.geometry.stroke={...defaultStroke(),width:4,color:{type:'linear',start:[-109,-120],end:[109,135],stops:[{position:0,color:'#407a72ff'},{position:1,color:'#b7e7caff'}]}};}
 // Stable controls make both original sources and native exports reproducible.
 for(const n of p.nodes)if(n.kind==='path')for(const[c,part]of pathContours(n.geometry).entries())part.points.forEach((v,i)=>v.id=n.id+'-contour-'+c+'-point-'+i);
 return p;
}
