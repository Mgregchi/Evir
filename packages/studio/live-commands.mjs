import {CommandSession} from '@evir/commands';
import {compassLesson} from '@evir/commands/example';
import {CanvasRenderer} from '@evir/renderer-canvas';
import {newId} from '@evir/project-model';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const button=(label,fn)=>{const b=el('button',label);b.type='button';b.onclick=fn;return b;};
export function mountLiveCommands({history,artboardId,ready,changed}){
  let session,pairedHistory,dialog,renderer,canvas,controlsHost,details,result,status,start,stop,lesson,executeButton,command,motion,play;
  let generation=0,raf=0,last=0,prepared=-1,controlsKey='',busy=false,refreshQueued=false;
  const cancel=()=>{cancelAnimationFrame(raf);raf=0;last=0;};
  const stopAccess=()=>{generation++;cancel();session?.close();renderer?.dispose();renderer=null;prepared=-1;};
  const current=()=>{
    if(session&&!session.closed&&(pairedHistory!==history()||session.context.artboardId!==artboardId()))stopAccess();
    return session;
  };
  const requireSession=()=>{const s=current();if(!s||s.closed)throw Error('Open Live tools and grant local access first');return s;};
  const request=(operation,payload)=>{const s=requireSession();return {schemaVersion:1,context:s.context,requestId:newId('request'),expectedRevision:s.inspect().revision,operation,payload};};
  const apply=envelope=>{
    const s=requireSession();
    const r=busy||!ready()?{ok:false,error:{code:'BUSY',message:'Finish the active edit or wait for the preview'}}:s.execute(envelope);if(r.changed)changed();
    if(result){result.textContent=JSON.stringify(r,null,2);result.setAttribute('role',r.ok?'status':'alert');}
    refresh();return r;
  };
  function startFrames(){
    cancel();const s=current();if(!s||s.closed||!s.playing||!motion?.checked||document.hidden||busy||!renderer)return;
    const tick=time=>{
      raf=0;if(current()!==s||s.closed||!s.playing||!motion.checked||document.hidden||busy||!renderer)return;
      try{renderer.draw(s.advance(last?Math.max(0,Math.min(.05,(time-last)/1000)):0),s.context.artboardId);last=time;}
      catch(e){result.textContent=e.message;result.setAttribute('role','alert');refresh();return;}
      if(s.playing)raf=requestAnimationFrame(tick);else refresh();
    };raf=requestAnimationFrame(tick);
  }
  function renderControls(s){
    const controls=s?.closed?[]:s?.controls||[],key=JSON.stringify(controls.map(({value,...c})=>c));
    if(key!==controlsKey){controlsKey=key;controlsHost.replaceChildren();
      for(const c of controls){
        let input;
        if(c.type==='button'){input=button(c.label,()=>apply(request('control',{controlId:c.id,value:true})));controlsHost.append(input);}
        else {const label=el('label'),text=el('span',c.label);input=el('input');input.type=c.type==='slider'?'range':'checkbox';input.setAttribute('aria-label',c.label);if(c.type==='slider'){input.min=c.min;input.max=c.max;input.step=c.step;}label.append(text,input);if(c.type==='slider'){const value=el('output');value.dataset.controlOutput=c.id;label.append(value);}controlsHost.append(label);
          input.onchange=()=>apply(request('control',{controlId:c.id,value:c.type==='slider'?Number(input.value):input.checked}));
        }input.dataset.controlId=c.id;
      }
    }
    for(const c of controls){const input=[...controlsHost.querySelectorAll('input')].find(i=>i.dataset.controlId===c.id);if(!input)continue;if(c.type==='slider')input.value=c.value;else input.checked=c.value;}
    for(const output of controlsHost.querySelectorAll('output')){const c=controls.find(c=>c.id===output.dataset.controlOutput);output.textContent=String(c.value)+(c.binding.kind==='speed'?'×':'');}
  }
  async function refresh(){
    if(!dialog?.open)return;
    if(busy){refreshQueued=true;return;}
    const s=current(),info=s?.inspect();details.textContent=JSON.stringify(info||{message:'No access granted'},null,2);
    const active=!!s&&!s.closed;start.disabled=active;stop.disabled=!active;lesson.disabled=!active;executeButton.disabled=!active;play.disabled=!active||!s.active;
    play.textContent=s?.playing?'Pause preview':'Play preview';status.textContent=active?`Local access · revision ${info.revision}`:'Local access stopped';renderControls(s);
    cancel();if(!active)return;
    const token=++generation;busy=true;
    try{
      if(!renderer){renderer=new CanvasRenderer(canvas.getContext('2d'));prepared=-1;}
      const ownRenderer=renderer;
      if(prepared!==info.sceneRevision){await ownRenderer.prepare(s.snapshot());if(token!==generation||current()!==s||s.closed)return;prepared=info.sceneRevision;}
      if(token!==generation||s.closed)return;
      ownRenderer.draw(s.advance(0),s.context.artboardId);
      if(info.cue)s.acknowledge(info.cue.id,info.cue.sceneRevision);
      details.textContent=JSON.stringify(s.inspect(),null,2);
    }catch(e){if(token===generation){result.textContent=e.message;result.setAttribute('role','alert');}}
    finally{busy=false;if(refreshQueued){refreshQueued=false;refresh();}else startFrames();}
  }
  const open=()=>{
    if(!ready())return;
    if(dialog?.open){dialog.focus();return;}
    const opener=document.activeElement;dialog=el('dialog');dialog.id='live-tools-sheet';dialog.className='interaction-sheet';
    const heading=el('h2','Live tools');heading.id='live-tools-title';dialog.setAttribute('aria-labelledby',heading.id);dialog.append(heading,
      el('p','Grant local commands access to this project and artboard. Edits share Undo with your work. Closing this sheet stops access. This is separate from the local stdio MCP process.'));
    status=el('p','Local access stopped');status.setAttribute('role','status');dialog.append(status);
    const actions=el('div');actions.className='dialog-actions';
    start=button('Grant local access',()=>{if(!ready())return;stopAccess();pairedHistory=history();session=new CommandSession(pairedHistory.committed(),{history:pairedHistory,artboardId:artboardId()});controlsKey='';refresh();});
    start.className='primary';
    stop=button('Stop local access',()=>{stopAccess();refresh();});actions.append(start,stop);dialog.append(actions);
    const layout=el('div');layout.className='live-tools-grid';const preview=el('section');preview.append(el('h3','Audience preview'));
    canvas=el('canvas');canvas.width=canvas.height=512;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Current local scene preview');preview.append(canvas);
    const motionLabel=el('label');motion=el('input');motion.type='checkbox';motion.setAttribute('aria-label','Allow preview motion');motion.onchange=startFrames;motionLabel.append(motion,el('span','Allow preview motion'));preview.append(motionLabel);
    play=button('Play preview',()=>apply(request('play',{...requireSession().active,playing:!session.playing})));preview.append(play);controlsHost=el('div');controlsHost.className='live-controls';preview.append(controlsHost);
    const consolePanel=el('section');consolePanel.append(el('h3','Local command console'));
    lesson=button('Add compass lesson',()=>{const s=requireSession(),source=s.snapshot(),board=source.artboards.find(a=>a.id===s.context.artboardId),prefix=newId('compass'),lesson=compassLesson(board.id,prefix,{x:board.width/2,y:board.height/2,scale:Math.min(board.width,board.height)/512,rootOrder:Math.max(-1,...source.nodes.filter(n=>n.artboardId===board.id&&n.parentId===null).map(n=>n.order))+1});
      const r=apply(request('patch',{label:'Add compass lesson',commands:lesson.commands}));if(r.ok){const controls=s.execute(request('controls',{controls:lesson.controls}));result.textContent=JSON.stringify(controls,null,2);refresh();}
    });consolePanel.append(lesson);
    const inspectDetails=el('details');inspectDetails.append(el('summary','Session context and scene'));details=el('pre');details.tabIndex=0;details.setAttribute('aria-label','Session context and scene data');inspectDetails.append(details);consolePanel.append(inspectDetails);
    const label=el('label','Command envelope');command=el('textarea');command.setAttribute('aria-label','Command envelope');command.rows=8;command.maxLength=65536;label.append(command);consolePanel.append(label);
    executeButton=button('Run command',()=>{try{apply(JSON.parse(command.value));}catch(e){result.textContent=e.message;result.setAttribute('role','alert');}});consolePanel.append(executeButton);
    result=el('pre');result.tabIndex=0;result.className='live-command-result';result.setAttribute('aria-label','Command result');consolePanel.append(result);layout.append(preview,consolePanel);dialog.append(layout);
    const footer=el('div');footer.className='dialog-actions';footer.append(button('Close live tools',()=>{stopAccess();dialog.close();}));dialog.append(footer);
    document.body.append(dialog);dialog.addEventListener('cancel',stopAccess,{once:true});dialog.addEventListener('close',()=>{stopAccess();dialog.remove();opener?.focus();},{once:true});dialog.showModal();refresh();
  };
  document.querySelector('#project-file-actions').append(button('Live tools…',open));
  document.addEventListener('visibilitychange',()=>{cancel();if(!document.hidden)startFrames();});
  window.addEventListener('pagehide',e=>{cancel();if(!e.persisted)stopAccess();});window.addEventListener('pageshow',startFrames);
  return {refresh,api:Object.freeze({
    inspect:options=>requireSession().inspect(options),snapshot:()=>requireSession().snapshot(),events:since=>requireSession().events(since),
    execute:apply,stop:()=>{stopAccess();refresh();},
  })};
}
