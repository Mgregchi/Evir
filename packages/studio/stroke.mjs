import {defaultStroke,upgradeAdvanced,validateProject} from '@evir/project-model';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function strokeControls({project,node,commit,notice,disabled=false}) {
  const host=el('section');host.className='property-section';host.append(el('h3','Stroke'));
  host.append(el('p',node.geometry.stroke?`${node.geometry.stroke.width} units · ${node.geometry.stroke.cap} ends · ${node.geometry.stroke.join} joins`:'Add editable centerline paint to this shape.'));
  const open=el('button',node.geometry.stroke?'Edit stroke':'Add stroke');open.type='button';open.dataset.strokeNode=node.id;
  open.disabled=disabled;open.onclick=()=>{try{openStrokeSheet({project,node,commit,open});}catch(error){notice(error);}};
  host.append(open);return host;
}
function openStrokeSheet({project,node,commit,open}) {
  document.querySelector('#stroke-sheet')?.remove();
  const sheet=el('dialog');sheet.id='stroke-sheet';sheet.className='interaction-sheet stroke-sheet';
  sheet.setAttribute('aria-labelledby','stroke-title');
  const title=el('h2',`Stroke · ${node.name}`);title.id='stroke-title';
  const intro=el('p','Keep the curve editable. Width follows shape transforms. Apply makes one undo step. Animate can key width, color, trim and dash offset.');
  const form=el('form');form.noValidate=true;
  const body=el('div');body.className='stroke-fields';
  const error=el('p');error.id='stroke-error';error.setAttribute('role','alert');
  const original=structuredClone(node.geometry),draft=structuredClone(original.stroke || defaultStroke());
  let fill=original.fill;
  const field=(label,value,type,change)=>{
    const wrap=el('label');wrap.className='field';wrap.append(el('span',label));const input=el('input');input.type=type;input.value=value;
    input.setAttribute('aria-label',label);input.setAttribute('aria-describedby','stroke-error');
    if(type==='number')input.step='any';input.oninput=()=>change(type==='number'?input.valueAsNumber:input.value);wrap.append(input);body.append(wrap);return input;
  };
  const select=(label,value,options,change)=>{
    const wrap=el('label');wrap.className='field';wrap.append(el('span',label));const input=el('select');input.setAttribute('aria-label',label);
    for(const [value,text] of options){const option=el('option',text);option.value=value;input.append(option);}input.value=value;
    input.onchange=()=>change(input.value);wrap.append(input);body.append(wrap);return input;
  };
  const width=field('Stroke width',draft.width,'number',v=>draft.width=v);width.min='0';width.max='256';
  field('Stroke color',draft.color,'text',v=>draft.color=v);
  select('Stroke cap',draft.cap,[['butt','Butt'],['round','Round'],['square','Square']],v=>draft.cap=v);
  select('Stroke join',draft.join,[['miter','Miter'],['round','Round'],['bevel','Bevel']],v=>draft.join=v);
  select('Shape fill',fill===null?'none':'keep',[['keep','Keep fill'],['none','No fill']],v=>fill=v==='none'?null:(original.fill ?? '#8fd9af'));
  field('Dash and gap lengths',draft.dash.join(', '),'text',v=>{draft.dash=v.trim()===''?[]:v.split(',').map(n=>n.trim()===''?NaN:Number(n));});
  field('Dash offset',draft.dashOffset,'number',v=>draft.dashOffset=v);
  for(const key of ['start','end','offset']) {
    const input=field(`Trim ${key}`,draft.trim[key],'number',v=>draft.trim[key]=v);input.min=key==='offset'?'-1':'0';input.max='1';input.step='.01';
  }
  const note=el('p','Dash and gap lengths are paired shape-local units, e.g. 16, 8. Leave empty for a solid line. Trim uses fractions from 0 to 1; offset wraps one turn. Dashes follow Rive path-length phase. Pressure stays available through Brush outline.');
  body.append(note);
  body.addEventListener("input",()=>{error.textContent="";});
  body.addEventListener("change",()=>{error.textContent="";});
  const actions=el('div');actions.className='dialog-actions';
  const cancel=el('button','Cancel stroke');cancel.type='button';cancel.onclick=()=>sheet.close();
  if(original.stroke) {
    const remove=el('button','Remove stroke');remove.type='button';
    remove.onclick=()=>apply(true);actions.append(remove);
  }
  const save=el('button','Apply stroke');save.type='submit';save.className='primary';actions.append(cancel,save);
  form.append(body,error,actions);sheet.append(title,intro,form);document.body.append(sheet);
  function apply(remove=false) {
    try {
      const candidate=structuredClone(project),target=candidate.nodes.find(n=>n.id===node.id);
      upgradeAdvanced(candidate);
      if(remove) {
        if(original.fill===null)throw Error('Add a fill before removing the only visible paint.');
        if(project.animations.some(a=>a.tracks.some(t=>t.targetId===node.id && t.property.startsWith('stroke.'))))throw Error('Remove stroke animation tracks before removing the stroke.');
        delete target.geometry.stroke;
      } else {
        if(fill===null && project.animations.some(a=>a.tracks.some(t=>t.targetId===node.id && (t.property==='fill'||t.property.startsWith('paint.')))))throw Error('Remove fill animation tracks before removing the fill.');
        target.geometry.stroke=structuredClone(draft);target.geometry.fill=structuredClone(fill);
      }
      validateProject(candidate);
      if(!commit(remove?'Remove stroke':'Change stroke',p=>{
        const target=p.nodes.find(n=>n.id===node.id);
        if(!target || JSON.stringify(target.geometry)!==JSON.stringify(original))throw Error('The shape changed. Reopen its stroke before applying.');
        upgradeAdvanced(p);target.geometry=structuredClone(candidate.nodes.find(n=>n.id===node.id).geometry);
      }))throw Error('Finish the pending edit before applying a stroke.');
      sheet.close();
    } catch(issue){
      const labels={width:"Stroke width",color:"Stroke color",cap:"Stroke cap",join:"Stroke join",dash:"Dash and gap lengths",dashOffset:"Dash offset","trim.start":"Trim start","trim.end":"Trim end","trim.offset":"Trim offset"};
      error.textContent=(issue.issues || [issue.message]).map(message=>{
        const prefix=`node ${node.id}.stroke`;
        if(!message.startsWith(prefix))return message;
        const [field,...rest]=message.slice(prefix.length).split(":");
        return `${labels[field.replace(/^\./,"")] || "Stroke"}:${rest.join(":")}`;
      }).join("\n");
    }
  }
  form.onsubmit=e=>{e.preventDefault();apply();};
  sheet.addEventListener('close',()=>{(document.querySelector(`[data-stroke-node="${node.id}"]`) || open).focus();sheet.remove();},{once:true});
  sheet.showModal();width.focus();
}
