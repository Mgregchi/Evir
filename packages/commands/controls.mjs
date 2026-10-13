import {object,fail,text} from './validation.mjs';
export function validateControls(p,board,controls){
  if(!Array.isArray(controls)||controls.length<1||controls.length>16)fail('INVALID_ARGUMENT','Expose 1–16 controls');
  const ids=new Set(),bindings=new Set();let active;
  for(const c of controls){
    const extras=c?.type==='slider'?['min','max','step','value']:c?.type==='checkbox'?['value']:[];
    object(c,['id','label','type','binding',...extras]);text(c.id,'Control ID',80);text(c.label,'Control label');
    if(ids.has(c.id))fail('INVALID_ARGUMENT','Duplicate control ID');ids.add(c.id);
    if(!['slider','checkbox','button'].includes(c.type))fail('INVALID_ARGUMENT','Unsupported control type');
    const b=c.binding;object(b,['kind'],['animationId','machineId','inputId']);let target;
    if(b.kind==='speed'){
      object(b,['kind','animationId']);target={animationId:b.animationId};
      if(!p.animations.some(a=>a.id===b.animationId&&a.artboardId===board)||c.type!=='slider')fail('INVALID_BINDING','Speed needs an animation in this artboard and a slider');
      if(c.min<0||c.max>64)fail('INVALID_BINDING','Speed bounds must stay within 0–64');
    }else if(b.kind==='input'){
      object(b,['kind','machineId','inputId']);target={machineId:b.machineId};
      const m=p.machines.find(m=>m.id===b.machineId&&m.artboardId===board),input=m?.inputs.find(i=>i.id===b.inputId);
      if(!input||input.type!=={slider:'number',checkbox:'boolean',button:'trigger'}[c.type])fail('INVALID_BINDING','Control type must match a machine input in this artboard');
    }else fail('INVALID_BINDING','Unsupported binding kind');
    const bindingKey=JSON.stringify([b.kind,b.animationId,b.machineId,b.inputId]);
    if(bindings.has(bindingKey))fail('INVALID_BINDING','Each binding may appear only once');bindings.add(bindingKey);
    const key=JSON.stringify(target);if(active&&JSON.stringify(active)!==key)fail('INVALID_BINDING','One manifest controls one animation or one machine');active=target;
    if(c.type==='slider'){
      if(![c.min,c.max,c.step,c.value].every(Number.isFinite)||c.min>=c.max||c.step<=0||c.step>c.max-c.min)fail('INVALID_ARGUMENT','Invalid slider range');
      controlValue(c,c.value);
    }else if(c.type==='checkbox'&&typeof c.value!=='boolean')fail('INVALID_ARGUMENT','Checkbox value must be boolean');
  }
  return active;
}
export function controlValue(c,value){
  if(c.type==='slider'){
    const position=(value-c.min)/c.step;
    if(!Number.isFinite(value)||value<c.min||value>c.max||Math.abs(position-Math.round(position))>1e-6)fail('INVALID_ARGUMENT','Slider value is outside its range/step');
  }else if(c.type==='checkbox'&&typeof value!=='boolean')fail('INVALID_ARGUMENT','Checkbox value must be boolean');
  else if(c.type==='button'&&value!==true)fail('INVALID_ARGUMENT','Trigger action needs true');
}
