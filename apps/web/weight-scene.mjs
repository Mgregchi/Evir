import {PNG} from 'pngjs';
import {createHash} from 'node:crypto';
import {upgradeAdvanced} from '@evir/project-model';
import {bindSkin,setSkinWeights} from '@evir/authoring';
// Original curved bird and fluttering scarf, with a tiny generated weave PNG.
export function weightStudy(makeProject){
 const{p,node,path,oval,box,anim,key}=makeProject('gust','Gust — a scarf in the breeze');upgradeAdvanced(p);
 oval('sky',256,250,202,202,'#e1ece1');oval('sun',365,127,45,45,'#edc19c');oval('sun-light',356,118,30,30,'#f4d4b2');
 path('branch',[[[55,400]],[[330,400]],[[344,415]],[[55,415]]],'#587967');
 const bird=node('little-bird','group',null,null,188,284);
 path('tail',[[[-44,60]],[[26,51]],[[5,111]],[[-58,119]],[[-28,85]]],'#346b58',bird);
 path('body',[[[-70,40],[-61,85],[-91,-12]],[[-37,-73],[-72,-60],[-21,-98]],[[34,-77],[10,-96],[83,-61]],[[73,-11],[80,-52],[87,45]],[[20,91],[66,85],[-27,99]]],'#438773',bird);
 path('body-light',[[[-61,34],[-49,78],[-76,-12]],[[-28,-68],[-61,-56],[-12,-84]],[[33,-68],[13,-85],[70,-54]],[[60,-9],[69,-44],[73,40]],[[14,79],[52,76],[-24,84]]],'#9ad4b9',bird);
 path('crest',[[[-29,-71]],[[-45,-113],[-71,-96],[-7,-117]],[[11,-80],[28,-104]]],'#438773',bird);
 oval('face',24,-34,37,32,'#e8f2d8',bird);oval('eye',36,-41,7,10,'#234d40',bird);oval('glint',34,-45,2,2.5,'#fffaf0',bird);
 path('beak',[[[60,-26]],[[89,-17]],[[60,-8]]],'#dca36d',bird);oval('cheek',41,-11,12,6,'#e3b092',bird);
 path('wing',[[[-48,12],[-52,50],[-26,-15]],[[31,17],[17,-4],[8,64]],[[-37,58],[-2,64],[-49,47]]],'#5aa889',bird);
 for(const x of [-19,13]){box('leg-'+x,x,88,7,25,3,'#dca36d',bird);box('foot-'+x,x-5,108,23,6,3,'#dca36d',bird);}
 const root=node('scarf-root','bone',{length:78},null,235,275),middle=node('scarf-middle','bone',{length:78},root),tip=node('scarf-tip','bone',{length:70},middle),bones=[root,middle,tip];
 const outline=path('scarf-edge',[[[226,254]],[[305,245],[276,238],[341,254]],[[425,247],[383,234],[452,249]],[[438,291],[454,275],[393,310]],[[313,288],[361,310],[275,270]],[[226,296]]],'#805b4c');
 const scarf=path('flying-scarf',[[[232,260]],[[305,252],[277,244],[343,260]],[[422,254],[380,242],[441,254]],[[431,285],[441,274],[393,301]],[[313,281],[360,301],[275,264]],[[232,289]]],'#e8ad89');
 const texture=new PNG({width:32,height:8});for(let y=0;y<8;y++)for(let x=0;x<32;x++){const light=(x%8<2||y%4===0),c=light?[255,230,193]:[185,125,93],i=(y*32+x)*4;texture.data.set([...c,255],i);}
 const bytes=PNG.sync.write(texture);p.assets.push({id:'gust-weave',name:'Original tiny weave',mimeType:'image/png',data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')});
 const vertices=[],triangles=[];for(let y=0;y<2;y++)for(let x=0;x<5;x++)vertices.push({id:`gust-weave-${x}-${y}`,position:[246+x*42,268+y*9],uv:[x/4,y]});
 for(let x=0;x<4;x++){const a=x,b=x+1,c=x+5,d=x+6;triangles.push(a,b,c,b,d,c);}
 const mesh=node('woven-panel','mesh',{assetId:'gust-weave',vertices,triangles,skin:null});
 p.nodes.find(n=>n.id===root).transform[5]+=55;
 for(const id of[outline,scarf])for(const v of p.nodes.find(n=>n.id===id).geometry.points)for(const c of['anchor','in','out'])v[c]=v[c].map((value,i)=>value+(i===1?55:0));
 for(const v of vertices)v.position[1]+=55;
 for(const id of[outline,scarf,mesh]){
  bindSkin(p,id,bones);const n=p.nodes.find(n=>n.id===id),points=n.kind==='path'?n.geometry.points:n.geometry.vertices;
  for(const v of points)for(const control of(n.kind==='path'?['anchor','in','out']:['anchor'])){
   const x=(n.kind==='path'?v[control]:v.position)[0],t=Math.max(0,Math.min(2,(x-235)/78)),left=Math.min(1,Math.floor(t)),right=left+1,omit=3-left-right;
   setSkinWeights(p,id,[{pointId:v.id,control,boneId:bones[omit],value:0}]);
   setSkinWeights(p,id,[{pointId:v.id,control,boneId:bones[right],value:t-left}]);
  }
 }
 oval('scarf-knot',229,332,20,27,'#bd7f60');oval('knot-light',224,327,12,18,'#edbb94');
 const a=anim('breeze','Breeze');key(a,root,'rotation',[[0,-.05],[60,.06],[120,-.05]]);key(a,middle,'rotation',[[0,-.16],[60,.19],[120,-.16]]);key(a,tip,'rotation',[[0,.16],[60,-.24],[120,.16]]);
 return p;
}
