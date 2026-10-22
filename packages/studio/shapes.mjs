import {SHAPES,shapeGeometry,addShape,setShapeParameters,detachShape} from '@evir/authoring';
import {sheet} from './advanced.mjs';

const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function shapePreview(preset,options={}){
  const {kind,width,height,geometry:g}=shapeGeometry(preset,options),
    root=document.createElementNS('http://www.w3.org/2000/svg','svg');
  root.setAttribute('viewBox',`${-width*.12} ${-height*.12} ${width*1.24} ${height*1.24}`);
  root.setAttribute('aria-hidden','true');root.setAttribute('focusable','false');
  const node=document.createElementNS(root.namespaceURI,kind==='rectangle'?'rect':'path');
  if(kind==='rectangle'){node.setAttribute('width',width);node.setAttribute('height',height);}
  else{
    const p=g.points,c=v=>v.join(' ');let d='M '+c(p[0].anchor);
    for(let i=1;i<p.length;i++)d+=` C ${c(p[i-1].out)} ${c(p[i].in)} ${c(p[i].anchor)}`;
    if(g.closed)d+=` C ${c(p.at(-1).out)} ${c(p[0].in)} ${c(p[0].anchor)} Z`;
    node.setAttribute('d',d);
  }
  node.setAttribute('fill',g.fill??'none');
  if(g.stroke){node.setAttribute('stroke',g.stroke.color);node.setAttribute('stroke-width',g.stroke.width);node.setAttribute('stroke-linecap',g.stroke.cap);}
  root.append(node);return root;
}

export function mountShapes(api){
  const opener=document.querySelector('#create-toggle'),menu=el('button','Shapes…');menu.id='add-shapes';menu.type='button';
  document.querySelector('#creation-tools').prepend(menu);
  const open=()=>{
    if(!api.ready())return;
    if(api.mode()!=='Design'){api.notice('Switch to Design to add shapes.');return;}
    const revision=api.revision(),source=api.project(),selection=api.selected(),scope=source.id,
      selected=source.nodes.find(n=>n.id===selection),parentId=['group','bone'].includes(selected?.kind)?selected.id:null;
    let preset='circle',applied=false,parametric=true;
    const options={width:120,height:100,fill:'#89e4c4',radius:20,sides:5,inner:45,strokeWidth:4};
    const guard=()=>{if(api.revision()!==revision||api.project().id!==scope||api.mode()!=='Design'||api.selected()!==selection)
      throw Error('The project or selection changed. Close Shapes and open it again.');};
    const dialog=sheet('Create a shape',body=>{
      body.className='shape-sheet';body.append(el('p','Choose a shape, adjust its size, then Add shape. It becomes an editable layer; no imported artwork is needed.'));
      const choice=el('label');choice.className='shape-live-choice';const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=true;checkbox.onchange=()=>parametric=checkbox.checked;choice.append(checkbox,el('span','Keep editable shape controls'));body.append(choice);
      const palette=el('div');palette.className='shape-palette';
      const fields=el('div');fields.className='shape-fields';
      const preview=el('div');preview.className='shape-preview';
      const status=el('p');status.setAttribute('role','status');status.className='shape-status';
      const update=()=>{try{guard();preview.replaceChildren(shapePreview(preset,options));status.textContent=`${SHAPES.find(s=>s.id===preset).name} preview. ${preset==='line'?'Open centerline with editable stroke width.':'Filled editable vector geometry.'}`;}
        catch(e){preview.replaceChildren();status.textContent=e.message;}};
      const field=(label,key,type='number',min=2,max=4096)=>{
        const l=el('label'),input=el('input');l.className='field';l.append(el('span',label));input.type=type;
        input.setAttribute('aria-label',label);input.value=options[key];
        if(type==='number'){input.min=min;input.max=max;input.step=key==='sides'?1:'any';}
        input.oninput=()=>{options[key]=type==='number'?input.valueAsNumber:input.value;update();};
        l.append(input);fields.append(l);return input;
      };
      const renderFields=()=>{
        fields.replaceChildren();field(preset==='circle'?'Size':'Width','width');
        if(preset!=='circle'&&preset!=='line')field('Height','height');
        if(preset==='rounded'||preset==='bubble')field('Corner radius','radius','number',0,2048);
        if(preset==='polygon'||preset==='star')field(preset==='star'?'Star points':'Polygon sides','sides','number',3,12);
        if(preset==='star')field('Inner radius (%)','inner','number',10,90);
        if(preset==='line')field('Stroke width','strokeWidth','number',.1,128);
        field(preset==='line'?'Line color':'Fill color','fill','color');update();
      };
      for(const category of ['Basic','Decorative']){
        const group=el('section');group.append(el('h3',category));const grid=el('div');grid.className='shape-grid';
        for(const shape of SHAPES.filter(s=>s.category===category)){
          const choice=el('button');choice.type='button';choice.dataset.shape=shape.id;
          choice.setAttribute('aria-label',shape.name);choice.setAttribute('aria-pressed',String(shape.id===preset));
          choice.append(shapePreview(shape.id),el('span',shape.name));
          choice.onclick=()=>{preset=shape.id;for(const b of palette.querySelectorAll('[data-shape]'))b.setAttribute('aria-pressed',String(b===choice));renderFields();};grid.append(choice);
        }
        group.append(grid);palette.append(group);
      }
      const optionsPanel=el('div');optionsPanel.className='shape-options';
      optionsPanel.append(preview,fields,status,el('p','New shapes appear in the active artboard, or inside a selected group/bone. Use Properties to move, scale, recolor or edit points afterwards. Keep shape controls to adjust size, radius or points later. Convert to a free path when you want to edit individual curve handles.'));
      body.append(palette,optionsPanel);
      renderFields();
    },signal=>{
      if(signal.aborted)return false;guard();
      // Validate outside history so invalid drafts stay inline in the sheet.
      const draft=structuredClone(api.project());addShape(draft,preset,{...options,parametric,parentId,artboardId:api.artboardId()});
      let created;
      applied=api.commit('Add '+SHAPES.find(s=>s.id===preset).name,p=>{created=addShape(p,preset,{...options,parametric,parentId,artboardId:api.artboardId()});});
      if(applied)api.select(created);
      return applied;
    },api.notice,opener);
    dialog.querySelector(':scope > .dialog-actions button:last-child').textContent='Add shape';
    const heading=dialog.querySelector('h2');heading.tabIndex=-1;heading.focus();dialog.scrollTop=0;
    dialog.addEventListener('close',()=>{if(applied)requestAnimationFrame(()=>document.querySelector('#stage').focus());},{once:true});
  };
  menu.onclick=open;document.querySelector('#empty-shapes').onclick=open;
}

export function shapeParameterControls(p,n,api){
 const definition=n.geometry?.shape;if(!definition)return null;
 const section=el('section');section.className='property-section';section.append(el('h3',SHAPES.find(s=>s.id===definition.type).name+' controls'));
 const labels={width:definition.type==='circle'?'Shape size':'Shape width',height:'Shape height',radius:'Shape corner radius',sides:definition.type==='star'?'Star points':'Polygon sides',inner:'Inner radius (%)'};
 for(const [key,value]of Object.entries(definition.options)){
  const l=el('label'),input=el('input');l.className='field';l.append(el('span',labels[key]));input.type='number';input.value=value;input.step=key==='sides'?'1':'any';input.min=key==='radius'?0:key==='inner'?10:key==='sides'?3:2;input.max=key==='sides'?12:key==='inner'?90:4096;input.setAttribute('aria-label',labels[key]);
  input.onchange=()=>{try{api.commit('Edit shape parameters',q=>setShapeParameters(q,n.id,{[key]:input.valueAsNumber}));}catch(e){api.notice(e);}};l.append(input);section.append(l);
 }
 const detach=el('button','Convert to free path');detach.type='button';detach.onclick=()=>api.commit('Convert live shape to free path',q=>detachShape(q,n.id));
 section.append(detach,el('p','Shape controls stay in editable source. Convert to a free path to edit anchors and handles. Undo restores the controls.'));return section;
}
