import {pathPoints} from '@evir/project-model';
import {bindSkin,setSkinWeights} from '@evir/authoring';
import {sheet} from './advanced.mjs';
import {WeightBrush,weightControls,WEIGHT_BRUSH_LIMIT} from './weight-brush.mjs';
const colors=['#6dcfae','#e5a77d','#9ea7e8','#e4cf72'];
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const button=(name,fn)=>{const b=el('button',name);b.type='button';b.onclick=fn;return b;};
const pointList=n=>n.kind==='mesh'?n.geometry.vertices:pathPoints(n.geometry);
export function mountSkinWeights(api){
 let active=null,settings={boneId:null,control:'all',target:1,strength:1,radius:36},hover=null;
 const stage=document.querySelector('#stage'),stageLabel=stage.getAttribute('aria-label');
 const done=button('Done weights',()=>{api.cancel();stop();api.refresh();api.focusStage();});done.id='stop-weight-painting';done.setAttribute('aria-label','Done painting weights');done.hidden=true;document.querySelector('.stage-footer').append(done);
 const valid=(p,n)=>api.mode()==='Design'&&n?.geometry?.skin&&['path','mesh'].includes(n.kind)&&api.editable(p,n);
 const current=()=>{const p=api.authored();return[p,p.nodes.find(n=>n.id===api.selected())];};
 function stop(){active=null;hover=null;done.hidden=true;stage.setAttribute('aria-label',stageLabel);api.cursor?.();}
 function bind(n,opener){
  const [p]=current(),revision=api.revision(),chosen=new Set(n.geometry.skin?.bones.map(b=>b.boneId)??[]);
  sheet('Bind skin bones',host=>{
   host.append(el('p','Choose one to four bones in this artboard. Binding resets every vertex and handle to equal weights. Save existing weight edits first if you want to keep them.'));
   for(const b of p.nodes.filter(v=>v.kind==='bone'&&v.artboardId===n.artboardId)){
    const l=el('label'),input=el('input');l.className='check-field';input.type='checkbox';input.checked=chosen.has(b.id);input.setAttribute('aria-label','Skin bind '+b.name);input.onchange=()=>input.checked?chosen.add(b.id):chosen.delete(b.id);l.append(input,el('span',b.name));host.append(l);
   }
  },()=>{
   if(api.revision()!==revision)throw Error('The scene changed. Reopen binding to review it.');
   if(!api.commit('Bind skin bones',q=>bindSkin(q,n.id,[...chosen])))return false;stop();api.draw();return true;
  },api.notice,opener);
 }
 function open(n,opener){
  if(!n.geometry.skin){bind(n,opener);return;}
  api.cancel();stop();api.draw();let[p]=current(),revision=api.revision(),index=0;
  const draft={...settings,boneId:n.geometry.skin.bones.some(b=>b.boneId===settings.boneId)?settings.boneId:n.geometry.skin.bones[0].boneId};
  const check=()=>{const[q,node]=current();if(q.id!==p.id||node?.id!==n.id||api.revision()!==revision||!valid(q,node))throw Error('The scene changed. Close this sheet and reopen Skin weights.');return node;};
  let stats,dialog;
  dialog=sheet('Skin weights',host=>{
   host.className='skin-weight-fields';host.append(el('p','Choose a bone and target weight. Paint on the stage, or apply the same value to a numbered vertex here. Other bone weights share the remainder; totals stay at 100%. Apply weight to vertex commits immediately with its own Undo; closing keeps edits already applied.'));
   const field=(label,value,change,{min,max,step='any'}={})=>{const l=el('label'),input=el('input');l.className='field';input.type='number';input.value=value;input.step=step;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;input.setAttribute('aria-label',label);input.oninput=()=>{change(input.value.trim()===''?NaN:input.valueAsNumber);showStats();};l.append(el('span',label),input);host.append(l);return input;};
   const select=(label,items,value,change)=>{const l=el('label'),s=el('select');l.className='field';s.setAttribute('aria-label',label);for(const[id,name]of items){const o=el('option',name);o.value=id;s.append(o);}s.value=value;s.onchange=()=>{change(s.value);showStats();};l.append(el('span',label),s);host.append(l);return s;};
   select('Weight bone',n.geometry.skin.bones.map((b,i)=>[b.boneId,`${i+1}. ${p.nodes.find(v=>v.id===b.boneId).name}`]),draft.boneId,v=>draft.boneId=v);
   if(n.kind==='path')select('Weight controls',[['all','Anchor and both handles'],['anchor','Anchors only'],['in','Incoming handles only'],['out','Outgoing handles only']],draft.control,v=>draft.control=v);
   field('Target weight (%)',draft.target*100,v=>draft.target=v/100,{min:0,max:100});
   field('Brush strength (%)',draft.strength*100,v=>draft.strength=v/100,{min:0,max:100});
   field('Brush radius (screen pixels)',draft.radius,v=>draft.radius=v,{min:8,max:160});
   host.append(el('h3','Numeric alternative'));
   field('Weight vertex number',1,v=>index=v-1,{min:1,max:pointList(n).length,step:1});stats=el('p');stats.setAttribute('role','status');host.append(stats);
   host.append(button('Apply weight to vertex',()=>{try{
    if(!Number.isFinite(draft.target)||draft.target<0||draft.target>1)throw Error('Target weight must be between 0 and 100%');
    const node=check(),point=pointList(node)[index];if(!Number.isInteger(index)||!point)throw Error('Choose an existing vertex number');
    const keys=node.kind==='mesh'?['anchor']:draft.control==='all'?['anchor','in','out']:[draft.control];
    if(!api.commit('Set vertex weight',q=>setSkinWeights(q,node.id,keys.map(control=>({pointId:point.id,control,boneId:draft.boneId,value:draft.target})))))throw Error('Weight edit rejected. Review the target value.');
    revision=api.revision();showStats();dialog.querySelector('[role=alert]').textContent='';
   }catch(e){dialog.querySelector('[role=alert]').textContent=e.message;}}));
   host.append(el('p','Weights are shown with numbered bone colors and percentages. Brush radius stays the same size on screen as you zoom. One drag makes one undo step; Escape, a second finger or interruption cancels it. Settings and overlays stay outside saved/exported scenes.'));
   const legend=el('ul');legend.className='skin-weight-legend';for(const[b,i]of n.geometry.skin.bones.map((b,i)=>[b,i])){const li=el('li',`${i+1}. ${p.nodes.find(v=>v.id===b.boneId).name}`);li.style.setProperty('--weight-color',colors[i]);legend.append(li);}host.append(legend);
  },()=>{
   const node=check();new WeightBrush({source:api.authored(),nodeId:node.id,...draft,zoom:1});settings=draft;active=node.id;done.hidden=false;stage.setAttribute('aria-label','Weight painting stage. Paint the selected bone. Hold Space to pan. Escape cancels a stroke or exits painting. Numeric alternatives are in Skin weights.');api.activate();return true;
  },api.notice,opener);
  dialog.id='skin-weight-sheet';dialog.querySelector('.dialog-actions button:last-child').textContent='Start painting weights';dialog.querySelector('.dialog-actions button:first-child').textContent='Close weight tools';
  dialog.addEventListener('close',()=>{if(active){api.focusStage();api.draw();}else document.querySelector('[data-skin-weights]')?.focus();},{once:true});
  function showStats(){if(!stats)return;const[q,node]=current(),point=pointList(node??n)[index],entry=node?.geometry.skin?.weights.find(w=>w.pointId===point?.id);stats.textContent=entry?`${node.kind==='mesh'?'Vertex':'Point'} ${index+1}: `+node.geometry.skin.bones.map((b,i)=>`${i+1}. ${q.nodes.find(v=>v.id===b.boneId).name} ${Math.round((entry[draft.control==='all'?'anchor':draft.control]?.find(([id])=>id===b.boneId)?.[1]??0)*100)}%`).join(' · '):'Choose a valid vertex number.';}
  showStats();
 }
 return{
  stop,
  get active(){return !!active;},
  sync(p,n){if(active&&(active!==n?.id||!valid(p,n)))stop();},
  controls(p,n,host){if(api.mode()!=='Design'||!['path','mesh'].includes(n.kind)||!api.editable(p,n))return;const section=el('section');section.className='property-section';section.append(el('h3','Skin weights'));
   const b=button(n.geometry.skin?'Skin weights…':'Bind skin bones…',()=>{try{if(api.ready())open(n,b);}catch(e){api.notice(e.message);}});b.dataset.skinWeights=n.id;section.append(b);
   if(n.geometry.skin)section.append(button('Rebind skin bones…',()=>bind(n,b)));
   if(active===n.id)section.append(el('p','Painting weights · '+p.nodes.find(v=>v.id===settings.boneId)?.name));host.append(section);
  },
  begin(p,n,world,zoom){if(active!==n?.id||!valid(p,n))return null;hover=world;return new WeightBrush({source:api.authored(),pose:p,nodeId:n.id,...settings,zoom});},
  hover(world){hover=world;},
  overlay(ctx,p,n,zoom){
   if(active!==n?.id||!valid(p,n))return;
   ctx.save();
   const count=n.kind==='mesh'?n.geometry.vertices.length:pathPoints(n.geometry).length*(settings.control==='all'?3:1);if(count>WEIGHT_BRUSH_LIMIT){ctx.restore();return;}
   const entries=new Map(n.geometry.skin.weights.map(w=>[w.pointId,w])),bones=n.geometry.skin.bones;
   for(const v of weightControls(p,n,n.kind==='mesh'?'anchor':settings.control)){
    const weights=new Map(entries.get(v.pointId)[v.control]),r=(v.control==='anchor'?6:4)/zoom;let angle=-Math.PI/2;
    bones.forEach((b,i)=>{const next=angle+(weights.get(b.boneId)??0)*Math.PI*2;ctx.beginPath();ctx.moveTo(...v.position);ctx.arc(...v.position,r,angle,next);ctx.closePath();ctx.fillStyle=colors[i];ctx.fill();angle=next;});
    ctx.beginPath();ctx.arc(...v.position,r,0,Math.PI*2);ctx.lineWidth=1/zoom;ctx.strokeStyle='#142823';ctx.stroke();
   }
   if(hover){ctx.beginPath();ctx.arc(hover.x,hover.y,settings.radius/zoom,0,Math.PI*2);ctx.lineWidth=1/zoom;ctx.strokeStyle='#edf9f0';ctx.setLineDash([4/zoom,4/zoom]);ctx.stroke();ctx.setLineDash([]);}
   ctx.restore();
  },
 };
}
