// Draft-only state controls. The containing sheet owns atomic history/apply.
export function blendControls(host,p,m,state){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const select=(label,choices,value,set)=>{
  const field=el('label'),input=el('select');field.className='field';field.append(el('span',label));input.setAttribute('aria-label',label);
  for(const[id,name]of choices){const o=el('option',name);o.value=id;input.append(o);}input.value=value;input.onchange=()=>set(input.value);field.append(input);host.append(field);return input;
 };
 const button=(label,fn,disabled=false)=>{const b=el('button',label);b.type='button';b.disabled=disabled;b.onclick=fn;return b;};
 const animations=p.animations.filter(a=>a.artboardId===m.artboardId).map(a=>[a.id,a.name]),numbers=m.inputs.filter(i=>i.type==='number').map(i=>[i.id,i.name]);
 const choice=select(state.name+' blend input',[['','Single animation'],...numbers,['@direct','Direct · ordered weights']],state.blend?.type==='direct'?'@direct':state.blend?.inputId??'',value=>{
  if(value==='@direct'){
   const children=state.blend?.children??[{animationId:state.animationId},{animationId:animations.find(([id])=>id!==state.animationId)?.[0]??state.animationId}];
   state.blend={type:'direct',children:children.slice(0,8).map((c,i)=>({animationId:c.animationId,weight:i?0:100}))};state.animationId=state.blend.children[0].animationId;
  }else if(value){
   if(state.blend?.type==='1d')state.blend.inputId=value;
   else state.blend={type:'1d',inputId:value,children:[{animationId:state.animationId,position:0},{animationId:animations.find(([id])=>id!==state.animationId)?.[0]??state.animationId,position:1}]};
  }else delete state.blend;
  render();
 });
 const body=el('div');body.className='blend-children';host.append(body);
 function render(){
  const focused=body.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
  body.replaceChildren();const b=state.blend;if(!b)return;
  if(b.type!=='direct'){
   // Retain source-authored intermediate children when changing another field.
   for(const[i,label]of[[0,'at 0'],[b.children.length-1,'at 1']]){
    const field=select(state.name+' animation '+label,animations,b.children[i].animationId,value=>{b.children[i].animationId=value;});body.append(field.parentElement);
   }
   return;
  }
  body.append(el('p','Rows apply from top to bottom. Fixed 100% on a baseline restores its keyed properties each tick. Number inputs clamp to 0–100%; zero keeps the previous result unless another row keys that property. Direct mode currently needs one state and no transitions.'));
  b.children.forEach((child,index)=>{
   const row=el('fieldset'),legend=el('legend','Row '+(index+1));row.append(legend);body.append(row);
   const animation=select(state.name+' row '+(index+1)+' animation',animations,child.animationId,value=>{child.animationId=value;state.animationId=b.children[0].animationId;});row.append(animation.parentElement);
   const source=select(state.name+' row '+(index+1)+' weight source',[['@fixed','Fixed percentage'],...numbers],child.inputId??'@fixed',value=>{
    if(value==='@fixed'){delete child.inputId;child.weight=100;}else{delete child.weight;child.inputId=value;}render();
   });row.append(source.parentElement);
   if('weight'in child){
    const label=el('label'),input=el('input');label.className='field';const name=state.name+' row '+(index+1)+' weight';label.append(el('span','Fixed weight (%)'));input.setAttribute('aria-label',name);input.type='number';input.min=0;input.max=100;input.step=1;input.value=child.weight;input.oninput=()=>child.weight=input.value===''?NaN:Number(input.value);label.append(input);row.append(label);
   }
   const actions=el('div');actions.className='dialog-actions';
   const move=delta=>{[b.children[index],b.children[index+delta]]=[b.children[index+delta],b.children[index]];state.animationId=b.children[0].animationId;render();body.querySelectorAll('fieldset')[index+delta]?.querySelector('select')?.focus();};
   actions.append(button('Move row '+(index+1)+' up',()=>move(-1),index===0),button('Move row '+(index+1)+' down',()=>move(1),index===b.children.length-1),button('Remove row '+(index+1),()=>{b.children.splice(index,1);state.animationId=b.children[0].animationId;render();body.querySelectorAll('fieldset')[Math.min(index,b.children.length-1)]?.querySelector('select')?.focus();},b.children.length<=2));row.append(actions);
  });
  if(focused)[...body.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focused)?.focus();
  body.append(button('Add blend row',()=>{b.children.push({animationId:animations[0][0],weight:0});render();body.querySelector('fieldset:last-of-type select')?.focus();},b.children.length>=8));
 }
 render();return choice;
}
