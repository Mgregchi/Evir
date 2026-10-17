import {defaultStroke,upgradeAdvanced} from '@evir/project-model';
// Original postage/flight illustration. Painted centerlines remain editable.
export function strokeStudy(makeProject) {
  const {p,node,path,box,oval,anim,key}=makeProject('trace','Trace — a little delivery');
  upgradeAdvanced(p);
  box('paper',24,24,464,464,40,'#edf3e8');
  oval('peach-sun',370,136,53,53,'#e8b38e');
  oval('sun-center',370,136,38,38,'#f4d6ad');
  const line=(id,controls,width,color,options={})=>{
    const n=path(id,controls,options.fill ?? null,options.parent ?? null,options.x ?? 0,options.y ?? 0);
    const g=p.nodes.find(v=>v.id===n).geometry;g.closed=options.closed ?? false;
    g.stroke={...defaultStroke(color),width,...options.stroke};return n;
  };
  const postcard=node('postcard','group',null,null,256,297);
  const angle=-.12;p.nodes.find(n=>n.id===postcard).transform=[Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),256,297];
  box('card-shadow',-153,-100,314,208,22,'#244d3c18',postcard);
  box('card',-161,-111,314,208,22,'#fffcf1',postcard);
  line('postage-border',[[[-140,-90]],[[132,-90]],[[132,76]],[[-140,76]]],2.5,'#80af98',{closed:true,parent:postcard,stroke:{dash:[8,8],cap:'butt',join:'round'}});
  const bird=node('courier','group',null,postcard,-60,-15);
  line('bird-body',[[[-51,0],[-58,42],[-49,-42]],[[10,-39],[-25,-48],[44,-38]],[[51,-6],[44,-23],[69,8]],[[15,52],[44,38],[-23,57]]],4,'#284d40',{closed:true,parent:bird,fill:'#9cd6b2'});
  line('folded-wing',[[[-34,4],[-34,4],[-5,-14]],[[28,12],[18,-12],[7,44]],[[-34,4],[-16,38]]],3.5,'#397659',{parent:bird});
  path('beak',[[[49,-12]],[[70,-4]],[[50,6]]],'#d9986d',bird);
  oval('bright-eye',29,-16,4,5,'#284d40',bird);oval('eye-light',30,-18,1.3,1.5,'#fffcf1',bird);
  line('left-foot',[[[-10,48]],[[-13,62]],[[-23,62]]],3,'#284d40',{parent:bird});
  line('right-foot',[[[7,49]],[[8,62]],[[17,62]]],3,'#284d40',{parent:bird});
  box('stamp',72,-67,41,48,5,'#dfac87',postcard);
  line('stamp-mountain',[[[80,-32]],[[92,-51]],[[106,-32]]],2.5,'#734e38',{parent:postcard,stroke:{cap:'square',join:'bevel'}});
  for(const y of [2,19,36])line('address-'+y,[[[47,y]],[[110,y]]],3,'#95b8a2',{parent:postcard});
  const flight=line('flight-trail',[[[74,161],[74,161],[102,190]],[[170,121],[117,142],[223,77]],[[270,173],[284,87],[261,217]],[[214,167],[221,218],[206,120]],[[318,103],[266,137]]],4,'#3d8062',{stroke:{trim:{start:0,end:.2,offset:0}}});
  line('paper-plane',[[[315,103]],[[365,79]],[[344,127]],[[336,108]],[[315,103]],[[336,108]],[[365,79]]],3.5,'#284d40',{fill:'#fffcf1',stroke:{join:'round'}});
  line('hello-flourish',[[[127,432],[127,432],[164,397]],[[252,432],[202,465],[287,397]],[[384,427],[333,449]]],5,'#b77a53');
  const a=anim('delivery','Delivery');
  key(a,flight,'stroke.trimEnd',[[0,.2],[60,1],[120,.2]]);
  key(a,flight,'stroke.width',[[0,3],[60,5],[120,3]]);
  key(a,flight,'stroke.color',[[0,'#3d8062'],[60,'#d3956d'],[120,'#3d8062']]);
  key(a,bird,'rotation',[[0,-.03],[60,.07],[120,-.03]]);
  key(a,bird,'y',[[0,-15],[60,-20],[120,-15]]);
  return p;
}
