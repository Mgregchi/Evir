import {CommandSession} from '@evir/commands';
import {sceneTools} from '@evir/commands/mcp-tools';
import {CanvasRenderer} from '@evir/renderer-canvas';
import {newId} from '@evir/project-model';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const button=(label,fn)=>{const b=el('button',label);b.type='button';b.onclick=fn;return b;};
async function api(path,value,signal){const r=await fetch(path,{method:value===undefined?'GET':'POST',credentials:'same-origin',headers:value===undefined?{}:{'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal});let data;try{data=await r.json();}catch{}if(!r.ok){const e=Error(data?.error||(r.status===404?'Live connections require the Cloudflare service deployment.':'The live service is unavailable.'));e.status=r.status;throw e;}return data;}
export function mountRemoteCommands({history,artboardId,ready,changed,stopLocal,notice}) {
  let active,sheet,dock,canvas,renderer,status,controlsHost,summary,motion,ws,heartbeat,expiry,raf=0,last=0,generation=0,prepared=-1,busy=false,drawBusy=false,drawQueued=false,collapsed=false;
  const cancelFrames=()=>{cancelAnimationFrame(raf);raf=0;last=0;};
  const same=()=>active&&active.history===history()&&active.session.context.artboardId===artboardId();
  function stop(message='Live access stopped. Scene edits remain in Undo.'){
    const previous=active;active=null;generation++;cancelFrames();clearInterval(heartbeat);clearTimeout(expiry);previous?.session.close();ws?.close();ws=null;renderer?.dispose();renderer=null;prepared=-1;dock?.remove();dock=null;
    if(previous){fetch(`/api/live/${previous.id}/stop`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{});notice(message);}
  }
  function startFrames(){cancelFrames();if(!active||!active.session.playing||!motion.checked||collapsed||document.hidden||drawBusy)return;
    const tick=t=>{raf=0;if(!active||!same()||!active.session.playing||!motion.checked||collapsed||document.hidden||drawBusy)return;try{renderer.draw(active.session.advance(last?Math.min(.05,Math.max(0,(t-last)/1000)):0),active.session.context.artboardId);last=t;}catch(e){status.textContent=e.message;cancelFrames();return;}if(active.session.playing)raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
  }
  function request(operation,payload){const s=active.session;return {schemaVersion:1,context:s.context,requestId:newId('audience'),expectedRevision:s.inspect().revision,operation,payload};}
  function audience(c,value){if(!active||busy||!ready())return;const r=active.session.execute(request('control',{controlId:c.id,value}));status.textContent=r.ok?'Audience control updated.':r.error.message;draw();}
  function renderControls(){const s=active?.session;if(!s)return;const key=JSON.stringify(s.controls.map(({value,...c})=>c));
    if(controlsHost.dataset.manifest!==key){controlsHost.dataset.manifest=key;controlsHost.replaceChildren();for(const c of s.controls){if(c.type==='button'){controlsHost.append(button(c.label,()=>audience(c,true)));continue;}const label=el('label',c.label),input=el('input');input.dataset.control=c.id;input.type=c.type==='slider'?'range':'checkbox';input.setAttribute('aria-label',c.label);if(c.type==='slider'){input.min=c.min;input.max=c.max;input.step=c.step;}input.onchange=()=>audience(c,c.type==='slider'?+input.value:input.checked);label.append(input);controlsHost.append(label);}}
    for(const c of s.controls){const input=[...controlsHost.querySelectorAll('input')].find(i=>i.dataset.control===c.id);if(input){if(c.type==='slider')input.value=c.value;else input.checked=c.value;}}
  }
  async function draw(){
    cancelFrames();if(drawBusy){drawQueued=true;return false;}if(!active||collapsed||document.hidden)return false;
    const own=active,token=generation;drawBusy=true;
    try{const info=own.session.inspect();if(!renderer)renderer=new CanvasRenderer(canvas.getContext('2d'));const r=renderer;
      if(prepared!==info.sceneRevision){await r.prepare(own.session.snapshot());if(token!==generation||active!==own)return false;prepared=info.sceneRevision;}
      r.draw(own.session.advance(0),own.session.context.artboardId);if(token!==generation||active!==own)return false;
      const cue=own.session.inspect().cue;if(cue)own.session.acknowledge(cue.id,cue.sceneRevision);renderControls();return true;
    }catch(e){if(token===generation&&status)status.textContent='Preview could not finish: '+e.message;return false;}
    finally{drawBusy=false;if(drawQueued){drawQueued=false;draw();}else startFrames();}
  }
  async function dispatch(message){
    const own=active;if(!own)return;
    if(busy){ws?.send(JSON.stringify({id:message.id,value:{ok:false,error:{code:'BUSY',message:'Another scene operation is being applied.'}}}));return;}
    let value;try{
      busy=true;
      const tool=sceneTools.find(t=>t.name===message.name),args=message.args;
      if(!tool||!args||typeof args!=='object'||Array.isArray(args)||args.sessionId!==own.id)throw Error('Unknown tool or mismatched live session.');
      const allowed=['sessionId',...Object.keys(tool.inputSchema.properties)];if(Object.keys(args).some(k=>!allowed.includes(k)))throw Error('Unexpected tool arguments.');
      const permission=tool.operation==='patch'?'scene:write':tool.operation?'scene:control':'scene:read';if(!own.permissions.includes(permission))throw Error('This tab did not grant that permission.');
      const s=own.session;if(!same())throw Error('Project changed; live access ended.');
      const {sessionId,...input}=args;
      if(tool.operation){if(!ready())value={ok:false,error:{code:'BUSY',message:'Finish the human edit first.'}};
        else{const before=own.history.revision;value=s.execute({...input,operation:tool.operation});if(own.history.revision!==before)changed();if(value.ok){await draw();const latest=s.inspect(),matching=latest.cue?.id===value.cue?.id;value={...value,cue:matching?latest.cue:{...value.cue,ready:false},currentRevision:latest.revision,presentationSuperseded:!matching,visibility:document.visibilityState,motionAllowed:motion.checked};}}}
      else if(message.name==='inspect_scene'){if(input.context)s.checkContext(input.context);value=s.inspect({offset:input.offset,limit:input.limit});}
      else{ s.checkContext(input.context);value=message.name==='get_scene_snapshot'?{context:s.context,project:s.snapshot()}:s.events(input.since??0); }
      if(new TextEncoder().encode(JSON.stringify(value)).length>950000)value={ok:false,error:{code:'RESPONSE_TOO_LARGE',message:'This response exceeds the live limit. Use paged inspection; source remains in Studio.'}};
    }catch(e){value={ok:false,error:{code:'INVALID_ARGUMENT',message:String(e.message).slice(0,500)}};}
    finally{busy=false;}
    if(active===own&&ws?.readyState===WebSocket.OPEN){try{ws.send(JSON.stringify({id:message.id,value}));}catch{stop('Connection lost. Inspect before retrying any agent edit.');}}
  }
  function mountDock(name){
    dock=el('section');dock.id='remote-live-dock';dock.className='remote-live-dock';dock.setAttribute('aria-label','Live agent session');
    const top=el('div');top.className='remote-live-top';summary=el('strong',name+' · connecting');
    const collapse=button('Minimize live preview',()=>{collapsed=!collapsed;dock.toggleAttribute('data-collapsed',collapsed);collapse.textContent=collapsed?'Show live preview':'Minimize live preview';if(collapsed)cancelFrames();else draw();});
    top.append(summary,collapse,button('Stop sharing',()=>stop()));dock.append(top);
    const body=el('div');body.className='remote-live-body';status=el('p','Your selected artboard is shared. You can keep editing; Undo remains available.');status.setAttribute('role','status');
    canvas=el('canvas');canvas.width=canvas.height=512;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Live agent scene preview');
    const label=el('label','Allow live preview motion');motion=el('input');motion.type='checkbox';motion.setAttribute('aria-label','Allow live preview motion');motion.onchange=()=>{if(!motion.checked)cancelFrames();else draw();};label.prepend(motion);controlsHost=el('div');controlsHost.className='live-controls';
    body.append(status,canvas,label,controlsHost);dock.append(body);document.body.append(dock);
  }
  async function grant(data,name,signal){
    stopLocal();stop();const requestGeneration=generation,sourceHistory=history(),board=artboardId(),p=sourceHistory.committed();
    const pair=await api('/api/live',{...data,projectId:p.id,artboardId:board,label:p.name||'Studio project'},signal);
    if(signal.aborted||requestGeneration!==generation||sourceHistory!==history()||board!==artboardId()){fetch(`/api/live/${pair.sessionId}/stop`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{});throw Error('Project changed before access was granted. Start again.');}
    const token=++generation;active={id:pair.sessionId,permissions:pair.permissions,history:sourceHistory,session:new CommandSession(p,{history:sourceHistory,artboardId:board,sessionId:pair.sessionId})};collapsed=false;mountDock(name);
    const url=new URL(`/api/live/${pair.sessionId}/socket`,location.origin);url.protocol='wss:';ws=new WebSocket(url,['evir-live',pair.key]);
    ws.onopen=()=>{if(token!==generation)return;summary.textContent=name+' · sharing live';status.textContent='Connected. Source edits share Studio Undo; motion is off until you allow it.';draw();};
    ws.onmessage=e=>{if(token!==generation)return;try{const m=JSON.parse(e.data);if(m.type!=='heartbeat')dispatch(m);}catch{stop('Invalid live message. Share again to reconnect.');}};
    ws.onclose=()=>{if(token===generation)stop('Live connection closed. Applied edits remain in Undo; share again to reconnect.');};ws.onerror=()=>{if(token===generation)stop('Live connection failed. Check your account and reconnect.');};
    heartbeat=setInterval(()=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'heartbeat'}));},15000);
    expiry=setTimeout(()=>stop('Live permission expired. Share again to continue.'),Math.max(0,pair.expiresAt*1000-Date.now()));
  }
  async function open(){
    if(sheet?.open){sheet.focus();return;}if(!ready())return;
    const opener=document.activeElement,sourceHistory=history(),board=artboardId(),abort=new AbortController();const dialog=el('dialog');sheet=dialog;dialog.id='remote-pair-sheet';dialog.className='interaction-sheet';
    const title=el('h2','Live agent connection');title.id='remote-pair-title';dialog.setAttribute('aria-labelledby',title.id);
    const feedback=el('p','Loading your connected agents…');feedback.setAttribute('role','status');dialog.append(title,el('p','Choose one connected agent and this project. The agent can read the whole project; edits target the selected artboard. Only session metadata is saved on the server. Live messages pass through Cloudflare without storing scene payloads.'),feedback);
    const account=el('a','Sign in or manage agent connections (new tab)');account.href='/account/';account.target='_blank';account.rel='noopener';dialog.append(account);
    const actions=el('div');actions.className='dialog-actions';actions.append(button('Close live connection setup',()=>dialog.close()));dialog.append(actions);document.body.append(dialog);dialog.showModal();
    dialog.addEventListener('close',()=>{abort.abort();dialog.remove();if(sheet===dialog)sheet=null;if(!document.querySelector('dialog[open]'))opener?.focus();},{once:true});
    try{
      const data=await api('/api/live/connections',undefined,abort.signal);if(!dialog.open)return;
      if(!data.connections.length){feedback.textContent='No agent has scene access yet. Connect an MCP client with scene permissions from your account, then reopen this sheet. The MCP address is '+location.origin+'/mcp.';return;}
      feedback.textContent='Choose what this agent can do. Stop sharing ends access immediately in this tab.';
      const form=el('form'),label=el('label','Agent connection'),select=el('select');select.setAttribute('aria-label','Agent connection');for(const c of data.connections){const o=el('option',c.name);o.value=c.id;select.append(o);}label.append(select);form.append(label);
      const permissions=[];for(const [permission,text] of [['scene:write','Allow edits to the selected artboard'],['scene:control','Allow animation and audience controls']]){const l=el('label'),input=el('input');input.type='checkbox';input.setAttribute('aria-label',text);l.append(input,el('span',text));form.append(l);permissions.push({permission,input});}
      const update=()=>{const c=data.connections.find(c=>c.id===select.value);for(const {permission,input} of permissions){input.disabled=!c.permissions.includes(permission);if(input.disabled)input.checked=false;}};select.onchange=update;update();
      const durationLabel=el('label','Share for'),duration=el('select');duration.setAttribute('aria-label','Share for');for(const [v,text] of [[900,'15 minutes'],[3600,'1 hour']]){const o=el('option',text);o.value=v;duration.append(o);}durationLabel.append(duration);form.append(durationLabel);
      const submit=el('button','Share this project');submit.type='submit';submit.className='primary';form.append(submit);dialog.insertBefore(form,actions);
      form.onsubmit=async e=>{e.preventDefault();if(sourceHistory!==history()||board!==artboardId()){feedback.textContent='Project changed. Close this sheet and choose the project again.';return;}submit.disabled=true;
        try{await grant({grantId:select.value,duration:+duration.value,permissions:['scene:read',...permissions.filter(p=>p.input.checked&&!p.input.disabled).map(p=>p.permission)]},select.selectedOptions[0].textContent,abort.signal);dialog.close();}catch(error){feedback.textContent=error.message;feedback.setAttribute('role','alert');}finally{submit.disabled=false;}};
    }catch(e){if(e.name!=='AbortError'&&dialog.open){feedback.textContent=e.status===401?'Sign in to your Evir account in the link below, connect an agent with scene permissions, then reopen this sheet.':e.message;feedback.setAttribute('role','alert');}}
  }
  function refresh(){if(active&&!same()){stop('Project or artboard changed. Live access ended.');return;}if(active&&!busy){renderControls();draw();}}
  document.addEventListener('evir-open-live-pairing',open);
  document.querySelector('#project-file-actions').append(button('Live agent connection…',open));
  document.addEventListener('visibilitychange',()=>{cancelFrames();if(!document.hidden)draw();});window.addEventListener('pagehide',()=>{sheet?.close();stop('Studio closed. Live access ended.');});
  return {refresh,stop};
}
