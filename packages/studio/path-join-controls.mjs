import { planPathJoin, joinPaths } from '@evir/authoring';
import { mapPoint } from '@evir/runtime/geometry';
import { sheet } from './advanced.mjs';

const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function select(host,label,values,value,changed) {
  const l=el('label'),s=el('select');l.className='field';l.append(el('span',label));s.setAttribute('aria-label',label);
  for(const [id,name]of values){const o=el('option',name);o.value=id;s.append(o);}s.value=value;
  s.onchange=()=>changed(s.value);l.append(s);host.append(l);return s;
}
function preview(host,plan) {
  host.replaceChildren();
  const points=plan.node.geometry.points.map(p=>Object.fromEntries(['anchor','in','out'].map(k=>[k,mapPoint(plan.matrix,p[k])])));
  const all=points.flatMap(p=>[p.anchor,p.in,p.out]).concat([plan.from,plan.to]);
  const x=Math.min(...all.map(v=>v[0])),y=Math.min(...all.map(v=>v[1])),w=Math.max(...all.map(v=>v[0]))-x,h=Math.max(...all.map(v=>v[1]))-y;
  const pad=Math.max(w,h,20)*.1,line=Math.max(w,h,20)/120;
  const svg=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
  const root=svg('svg',{viewBox:`${x-pad} ${y-pad} ${w+2*pad} ${h+2*pad}`,role:'img','aria-label':'Joined path outline preview. Endpoint markers show the chosen connection.'});
  const coord=v=>v.map(x=>Number(x.toFixed(5))).join(' ');
  let d='M '+coord(points[0].anchor);
  for(let i=1;i<points.length;i++)d+=` C ${coord(points[i-1].out)} ${coord(points[i].in)} ${coord(points[i].anchor)}`;
  root.append(svg('path',{d,fill:'none',stroke:'#8ee2c6','stroke-width':line,'stroke-linecap':'round'}));
  root.append(svg('line',{x1:plan.from[0],y1:plan.from[1],x2:plan.to[0],y2:plan.to[1],stroke:'#efbf98','stroke-width':line,'stroke-dasharray':`${line*3} ${line*2}`}));
  for(const [point,c]of[[plan.from,'#8ee2c6'],[plan.to,'#efbf98']])root.append(svg('circle',{cx:point[0],cy:point[1],r:line*2,fill:c}));
  host.append(root);
}
export function pathJoinControls(p,node,api,preferredOther=null) {
  const section=el('section');section.className='property-section';section.append(el('h3','Connect paths'));
  const button=el('button','Join paths…');button.type='button';button.dataset.pathJoin='open';
  const siblings=p.nodes.filter(n=>n.artboardId===node.artboardId&&n.parentId===node.parentId).sort((a,b)=>a.order-b.order),index=siblings.findIndex(n=>n.id===node.id);
  const candidates=[siblings[index-1],siblings[index+1]].filter(n=>n?.kind==='path');
  const preferred=p.nodes.find(n=>n.id===preferredOther);
  if(preferred?.kind==='path'&&!candidates.some(n=>n.id===preferred.id))candidates.push(preferred);
  button.disabled=node.geometry.closed||Boolean(node.geometry.skin)||!candidates.length||api.mode()!=='Design';
  section.append(button,el('p',!candidates.length?'Place another path next to this one under the same parent in Layers to connect endpoints.':
    'Keep this layer and connect another open path. Review endpoints before applying; Undo restores both layers.'));
  button.onclick=()=>{
    if(!api.ready()||api.mode()!=='Design')return;
    const revision=api.revision(),scope=p.id,selection=api.selectionKey();
    let other=candidates.find(n=>n.id===preferredOther)?.id||candidates[0].id;
    const options={keepEnd:'last',otherEnd:'first',mode:'bridge'};let applied=false;
    const guard=current=>{if(api.revision()!==revision||current.id!==scope||api.mode()!=='Design'||api.selectionKey()!==selection)
      throw Error('The project or selection changed. Close this sheet and review the paths.');};
    const dialog=sheet('Join two paths',host=>{
      host.className='path-join-sheet';host.append(el('p',`Keep “${node.name}”: its layer ID, parent, transform and paint stay. The other layer is removed only when you Apply.`));
      const diagram=el('div');diagram.className='path-join-preview';const status=el('p');status.setAttribute('role','status');status.dataset.joinStatus='';
      const update=()=>{try{const current=api.project();guard(current);const plan=planPathJoin(current,node.id,other,options);preview(diagram,plan);
        const name=current.nodes.find(n=>n.id===other).name;
        status.textContent=`${plan.pointCount} points. Endpoint gap: ${Number(plan.gap.toFixed(3))} artboard units. ${options.mode==='merge'?`Merge moves only the chosen endpoint of “${name}” onto the kept endpoint; its outgoing handle moves with it.`:'Connect adds a straight segment; existing curve segments stay in place.'}`;
      }catch(e){diagram.replaceChildren();status.textContent=e.message;}};
      select(host,'Other path',candidates.map(n=>[n.id,n.name]),other,v=>{other=v;update();});
      const ends=[['first','First endpoint'],['last','Last endpoint']];
      select(host,'Kept endpoint',ends,options.keepEnd,v=>{options.keepEnd=v;update();});
      select(host,'Other endpoint',ends,options.otherEnd,v=>{options.otherEnd=v;update();});
      select(host,'Connection', [['bridge','Connect with a straight segment'],['merge','Merge at the kept endpoint']],options.mode,v=>{options.mode=v;update();});
      host.append(diagram,status,el('p','The outline preview shows geometry and endpoint markers. Artwork paint is retained. Cancel changes nothing. Paths must be neighbors with compatible solid paint; their own animation, rigging and direct effects must be removed first.'));
      update();
    },signal=>{
      if(signal.aborted)return false;
      guard(api.project());
      applied=api.commit('Join paths',q=>joinPaths(q,node.id,other,options));
      if(applied){api.select(node.id);api.notice('Paths joined. Undo restores both layers.');}
      return applied;
    },api.notice,button);
    const heading=dialog.querySelector('h2');heading.tabIndex=-1;heading.focus();dialog.scrollTop=0;
    dialog.addEventListener('close',()=>{
      if(!applied)return;const panel=document.querySelector('#mobile-panel');
      const focus=()=>requestAnimationFrame(()=>document.querySelector('#stage').focus());
      if(panel?.open){panel.addEventListener('close',focus,{once:true});panel.close();}else focus();
    },{once:true});
  };
  return section;
}
