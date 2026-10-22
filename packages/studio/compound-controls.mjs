import {prepareCompound,commitCompound,releaseCompound} from '@evir/authoring';
import {pathContours as contoursOf,upgradeAdvanced} from '@evir/project-model';
import {sheet} from './advanced.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
function select(host,label,options,value,set){const l=el('label'),s=el('select');l.className='field';l.append(el('span',label));s.setAttribute('aria-label',label);for(const[v,text]of options){const o=el('option',text);o.value=v;s.append(o);}s.value=value;s.onchange=()=>set(s.value);l.append(s);host.append(l);return s;}
function preview(host,g){
 host.replaceChildren();if(!g){host.append(el('p','Empty result. Apply removes the selected shapes; Undo restores them.'));return;}
 const parts=contoursOf(g),points=parts.flatMap(c=>c.points).flatMap(p=>[p.anchor,p.in,p.out]),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,pad=Math.max(w,h,10)*.08;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');
 svg.setAttribute('viewBox',`${x-pad} ${y-pad} ${w+pad*2} ${h+pad*2}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`${parts.length} editable contours. Cutouts are transparent.`);
 const point=p=>p.join(' ');let d='';
 for(const c of parts){d+='M '+point(c.points[0].anchor);for(let i=1;i<c.points.length;i++)d+=` C ${point(c.points[i-1].out)} ${point(c.points[i].in)} ${point(c.points[i].anchor)}`;if(c.closed)d+=` C ${point(c.points.at(-1).out)} ${point(c.points[0].in)} ${point(c.points[0].anchor)} Z`;}
 path.setAttribute('d',d);path.setAttribute('fill','#89e4c4');path.setAttribute('fill-rule',g.fillRule??'nonzero');svg.append(path);host.append(svg,el('p',`${parts.length} contours · ${parts.reduce((n,c)=>n+c.points.length,0)} editable control points. Preview uses one color; Apply keeps the chosen layer’s paint.`));
}
export function compoundControls(p,ids,api){
 const nodes=ids.map(id=>p.nodes.find(n=>n.id===id));if(!nodes.length||nodes.some(n=>!['rectangle','path'].includes(n?.kind)))return null;
 const section=el('section');section.className='property-section';section.append(el('h3','Shape operations'));
 if(ids.length===1){
  const n=nodes[0];if(n.kind!=='path')return null;
  select(section,'Fill rule',[['nonzero','Nonzero winding'],['evenodd','Even-odd cutouts']],n.geometry.fillRule??'nonzero',value=>api.commit('Change fill rule',q=>{upgradeAdvanced(q);q.nodes.find(v=>v.id===n.id).geometry.fillRule=value;}));
  if(n.geometry.contours?.length)section.append(button('Release contours',()=>{if(!api.ready())return;api.commit('Release compound contours',q=>releaseCompound(q,n.id));api.select(n.id);}),el('p','Release creates separate layers. Holes become filled shapes. Undo restores the compound.'));
  return section;
 }
 const open=button('Shape operations…',()=>{
  if(!api.ready()||api.mode()!=='Design')return;
  const revision=api.revision(),scope=p.id,selection=api.selectionKey();let chosen=ids[0],operation='union',fillRule='nonzero',worker=null,timer=null,geometry,ready=false,applied=false,request=0;
  const guard=()=>{if(api.revision()!==revision||api.project().id!==scope||api.mode()!=='Design'||api.selectionKey()!==selection)throw Error('The project or selection changed. Close this sheet and review the shapes.');};
  const ordered=()=>[chosen,...ids.filter(id=>id!==chosen)];
  const stop=()=>{worker?.terminate();worker=null;clearTimeout(timer);timer=null;};
  let status,diagram,apply,run;
  const invalidate=()=>{stop();request++;ready=false;geometry=undefined;if(run)run.disabled=false;if(apply)apply.disabled=true;if(status)status.textContent='Choose Preview result before applying.';};
  const start=()=>{
   invalidate();const token=request;
   try{guard();const plan=prepareCompound(api.project(),ordered());worker=new Worker(new URL('./compound-worker.mjs',import.meta.url),{type:'module'});status.textContent='Finding the new outline…';run.disabled=true;
    const failed=message=>{stop();run.disabled=false;ready=false;status.textContent=message;};
    timer=setTimeout(()=>failed('The preview took too long. Use fewer or simpler curves and try again.'),5000);
    worker.onerror=()=>failed('The shape worker could not finish. Retry the preview.');
    worker.onmessage=({data})=>{if(token!==request)return;stop();run.disabled=false;try{guard();if(!data.ok)throw Error(data.error);geometry=data.geometry;ready=true;preview(diagram,geometry);status.textContent=geometry?'Outline ready. Review the cutouts, then Apply.':'Empty result. Apply will remove the selected layers.';apply.disabled=false;}catch(e){failed(e.message);}};
    worker.postMessage({shapes:plan.shapes,operation,fillRule});
   }catch(e){status.textContent=e.message;run.disabled=false;}
  };
  const dialog=sheet('Combine shapes',host=>{
   host.className='compound-sheet';host.append(el('p','Union adds areas. Subtract cuts the other shapes out of the kept layer. Intersect keeps shared areas; Exclude removes overlaps. Combine contours preserves their curves without a Boolean operation.'));
   select(host,'Keep appearance',nodes.map(n=>[n.id,n.name]),chosen,v=>{chosen=v;invalidate();});
   select(host,'Operation',[['union','Union'],['subtract','Subtract'],['intersect','Intersect'],['exclude','Exclude overlaps'],['combine','Combine contours']],operation,v=>{operation=v;invalidate();});
   select(host,'Combined fill rule',[['nonzero','Nonzero winding'],['evenodd','Even-odd cutouts']],fillRule,v=>{fillRule=v;invalidate();});
   run=button('Preview result',start);diagram=el('div');diagram.className='compound-preview';status=el('p');status.setAttribute('role','status');host.append(run,diagram,status,el('p','The operation replaces the selected shapes with one editable path. The kept layer keeps its transform and paint. Group motion can stay; direct keys, skin and effects need to be removed before changing topology. Cancel keeps the original layers.'));
  },signal=>{if(signal.aborted)return false;guard();if(!ready)throw Error('Preview the current operation before applying.');applied=api.commit('Combine shapes',q=>commitCompound(q,ordered(),geometry));if(applied)api.select(geometry?chosen:null);return applied;},api.notice,open);
  apply=dialog.querySelector(':scope > .dialog-actions button:last-child');invalidate();const h=dialog.querySelector('h2');h.tabIndex=-1;h.focus();dialog.scrollTop=0;
  dialog.addEventListener('close',()=>{stop();if(!applied)return;const panel=document.querySelector('#mobile-panel'),focus=()=>requestAnimationFrame(()=>document.querySelector('#stage').focus());if(panel?.open){panel.addEventListener('close',focus,{once:true});panel.close();}else focus();},{once:true});
 });section.append(open);return section;
}
