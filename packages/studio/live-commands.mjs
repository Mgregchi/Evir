import {CommandSession} from '@evir/commands';
import {compassLesson} from '@evir/commands/example';
import {CanvasRenderer} from '@evir/renderer-canvas';
import {newId} from '@evir/project-model';
import {showMcpGuide} from './guidance.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const button=(label,fn)=>{const b=el('button',label);b.type='button';b.onclick=fn;return b;};
export function mountLiveCommands({history,artboardId,ready,changed}){
  let session,pairedHistory,dialog,renderer,canvas,controlsHost,details,result,status,start,stop,lesson,executeButton,command,motion,play,help,summary,target,sample;
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
    if(summary){summary.textContent=r.ok?(r.changed?'Scene updated. Use Studio Undo to restore the previous scene.':envelope.operation==='play'?(s.playing?'Preview ready to play.':'Preview paused.'):'Local controls updated.'):r.error.message;summary.setAttribute('role',r.ok?'status':'alert');}
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
    const active=!!s&&!s.closed;start.disabled=active;stop.disabled=!active;lesson.disabled=!active;executeButton.disabled=!active;sample.disabled=!active||!s.active;play.disabled=!active||!s.active||!motion.checked;
    play.textContent=s?.playing?'Pause preview':'Play preview';status.textContent=active?`Local preview enabled · ${s.active?(motion.checked?(s.playing?'playing':'paused'):'motion off'):'choose a motion or add the demo'}`:'Local preview stopped · start to try the demo';renderControls(s);
    const value=s?.active?JSON.stringify(s.active):'';target.replaceChildren();const placeholder=el('option','Choose a motion');placeholder.value='';target.append(placeholder);
    if(active){const p=s.snapshot();for(const [kind,list] of [['animationId',p.animations],['machineId',p.machines]])for(const item of list.filter(a=>a.artboardId===s.context.artboardId).slice(0,100)){const option=el('option',`${kind==='animationId'?'Animation':'State machine'} · ${item.name.slice(0,120)}`);option.value=JSON.stringify({[kind]:item.id});target.append(option);}}
    target.value=value;target.disabled=!active;
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
      el('p','Try scene changes and audience controls in a local preview. This prototype uses your editable Studio project. No external agent is connected.'));
    const badge=el('p','Local preview · prototype');badge.className='live-badge';dialog.append(badge);
    help=el('details');help.open=true;help.className='live-help';help.append(el('summary','How to use Live tools'));
    const steps=el('ol');for(const step of ['Choose Grant local access to enable commands for this project and artboard.','Choose Add compass lesson for a working demo, or select a motion from your project.','Check Allow preview motion, then choose Play preview. Change Pointer speed in the compass demo.','Pause or Stop when finished. Closing this sheet stops access; scene edits stay in your project and share Studio Undo.'])steps.append(el('li',step));help.append(steps);dialog.append(help);
    dialog.append(button('MCP setup and connection guide',()=>{stopAccess();dialog.close();showMcpGuide();}));
    status=el('p','Local access stopped');status.setAttribute('role','status');dialog.append(status);
    const actions=el('div');actions.className='dialog-actions';
    start=button('Grant local access',()=>{if(!ready())return;stopAccess();pairedHistory=history();session=new CommandSession(pairedHistory.committed(),{history:pairedHistory,artboardId:artboardId()});controlsKey='';refresh();});
    start.className='primary';
    stop=button('Stop local access',()=>{stopAccess();refresh();});actions.append(start,stop);dialog.append(actions);
    const layout=el('div');layout.className='live-tools-grid';const preview=el('section');preview.append(el('h3','Audience preview'));
    const targetLabel=el('label','Project motion');target=el('select');target.setAttribute('aria-label','Project motion');target.onchange=()=>{if(target.value)apply(request('play',{...JSON.parse(target.value),playing:false}));};targetLabel.append(target);preview.append(targetLabel);
    canvas=el('canvas');canvas.width=canvas.height=512;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Current local scene preview');preview.append(canvas);
    const motionLabel=el('label');motion=el('input');motion.type='checkbox';motion.setAttribute('aria-label','Allow preview motion');motion.onchange=()=>{if(!motion.checked&&current()?.playing)apply(request('play',{...session.active,playing:false}));else refresh();};motionLabel.append(motion,el('span','Allow preview motion'));preview.append(motionLabel);
    play=button('Play preview',()=>apply(request('play',{...requireSession().active,playing:!session.playing})));preview.append(play);controlsHost=el('div');controlsHost.className='live-controls';preview.append(controlsHost);
    const consolePanel=el('section');consolePanel.append(el('h3','Try a scene'),el('p','The compass demo adds editable layers and a turning pointer. Its speed slider is created from the same control manifest an agent can supply.'));
    lesson=button('Add compass lesson',()=>{const s=requireSession(),source=s.snapshot(),board=source.artboards.find(a=>a.id===s.context.artboardId),prefix=newId('compass'),lesson=compassLesson(board.id,prefix,{x:board.width/2,y:board.height/2,scale:Math.min(board.width,board.height)/512,rootOrder:Math.max(-1,...source.nodes.filter(n=>n.artboardId===board.id&&n.parentId===null).map(n=>n.order))+1});
      const r=apply(request('patch',{label:'Add compass lesson',commands:lesson.commands}));if(r.ok){const controls=s.execute(request('controls',{controls:lesson.controls}));result.textContent=JSON.stringify(controls,null,2);summary.textContent=controls.ok?'Compass added. Allow preview motion, then Play preview and change Pointer speed. Use Studio Undo to remove the demo.':controls.error.message;help.open=false;refresh();}
    });consolePanel.append(lesson);
    summary=el('p','Start with the demo; no JSON is required.');summary.setAttribute('role','status');consolePanel.append(summary);
    const advanced=el('details');advanced.className='live-command-options';advanced.append(el('summary','Advanced command console'));consolePanel.append(advanced);
    const inspectDetails=el('details');inspectDetails.append(el('summary','Session context and scene'));details=el('pre');details.tabIndex=0;details.setAttribute('aria-label','Session context and scene data');inspectDetails.append(details);consolePanel.append(inspectDetails);
    advanced.append(inspectDetails,el('p','For browser-capable agents or developers: inspect the current context and revision before each new command. Conflicts require a fresh command ID and revision. This console does not connect an MCP client.'));
    sample=button('Load example command',()=>{const s=requireSession(),c=s.controls.find(c=>c.type==='slider'&&c.binding.kind==='speed');command.value=JSON.stringify(c?request('control',{controlId:c.id,value:c.min+c.step*Math.max(0,Math.min(Math.round((2-c.min)/c.step),Math.floor((c.max-c.min)/c.step)))}):request('play',{...s.active,playing:false}),null,2);summary.textContent='Example loaded with the current context and revision. Choose Run command to apply it.';});advanced.append(sample);
    const label=el('label','Command envelope');command=el('textarea');command.setAttribute('aria-label','Command envelope');command.rows=8;command.maxLength=65536;label.append(command);advanced.append(label);
    executeButton=button('Run command',()=>{try{apply(JSON.parse(command.value));}catch(e){summary.textContent=e.message;summary.setAttribute('role','alert');result.textContent=e.message;result.setAttribute('role','alert');}});advanced.append(executeButton);
    result=el('pre');result.tabIndex=0;result.className='live-command-result';result.setAttribute('aria-label','Command result');advanced.append(result);layout.append(preview,consolePanel);dialog.append(layout);
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
