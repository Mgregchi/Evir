import {History} from '@evir/authoring';
import {createRuntime} from '@evir/runtime';
import {validateProject,newId} from '@evir/project-model';
import {applyCommands,commandNames} from './operations.mjs';
import {validateControls,controlValue} from './controls.mjs';
import {object,fail,text,integer,encoded} from './validation.mjs';
export {commandNames,validateControls};
export {commandSchema,controlSchema} from './schema.mjs';
export class CommandSession {
  #history;#context;#revision=0;#observed;#cache=new Map();#cacheBytes=0;#events=[];#sequence=0;#closed=false;#player=null;#active=null;#controls=[];#playing=false;#cue=null;
  constructor(project,{sessionId=newId('session'),artboardId=project.artboards[0].id,history}={}){
    validateProject(project);text(sessionId,'Session ID',80);
    if(!project.artboards.some(a=>a.id===artboardId))fail('SCOPE','Missing artboard');
    this.#history=history||new History(project);
    if(this.#history.committed().id!==project.id)fail('SCOPE','History does not own this project');
    this.#observed=this.#history.revision;this.#context={sessionId,projectId:project.id,artboardId};
  }
  get context(){return {...this.#context};}
  get closed(){return this.#closed;}
  get playing(){return this.#playing;}
  get controls(){return structuredClone(this.#controls);}
  get active(){return this.#active?{...this.#active}:null;}
  #event(type,data={}){this.#events.push({sequence:++this.#sequence,type,revision:this.#revision,sceneRevision:this.#history.revision,...structuredClone(data)});if(this.#events.length>256)this.#events.shift();}
  #resetPresentation(){this.#player=null;this.#active=null;this.#controls=[];this.#playing=false;this.#cue=null;}
  #sync(){if(this.#history.revision!==this.#observed){this.#observed=this.#history.revision;this.#revision++;this.#resetPresentation();this.#event('human_edit');}}
  #scope(context){object(context,['sessionId','projectId','artboardId']);for(const key of Object.keys(this.#context))if(context[key]!==this.#context[key])fail('SCOPE','Command does not target this paired session/project/artboard');}
  snapshot(){return this.#history.committed();}
  checkContext(context){this.#scope(context);return true;}
  inspect({offset=0,limit=100}={}){
    this.#sync();integer(offset,'Offset',0,1000000);integer(limit,'Limit',1,100);
    const p=this.snapshot(),nodes=p.nodes.filter(n=>n.artboardId===this.#context.artboardId);
    return {context:this.context,revision:this.#revision,sceneRevision:this.#history.revision,closed:this.#closed,sequence:this.#sequence,
      nodeTotal:nodes.length,nodes:nodes.slice(offset,offset+limit).map(n=>({id:n.id,name:n.name.slice(0,160),kind:n.kind,parentId:n.parentId})),
      animations:p.animations.filter(a=>a.artboardId===this.#context.artboardId).slice(0,100).map(a=>({id:a.id,name:a.name.slice(0,160)})),
      machines:p.machines.filter(m=>m.artboardId===this.#context.artboardId).slice(0,100).map(m=>({id:m.id,name:m.name.slice(0,160),inputs:m.inputs.slice(0,16).map(i=>({...i,name:i.name.slice(0,120)}))})),
      active:this.active,playing:this.#playing,controls:this.controls,commands:commandNames,cue:this.#cue?{...this.#cue}:null};
  }
  events(since=0){this.#sync();integer(since,'Event sequence',0,this.#sequence);return {resetRequired:since<(this.#events[0]?.sequence??1)-1,sequence:this.#sequence,revision:this.#revision,events:this.#events.filter(e=>e.sequence>since).map(e=>structuredClone(e))};}
  close(){if(!this.#closed){this.#closed=true;this.#revision++;this.#resetPresentation();this.#event('stopped');this.#cache.clear();this.#cacheBytes=0;}}
  #runtime(active){return createRuntime(this.snapshot(),{artboardId:this.#context.artboardId,...active});}
  #bind(player,c,value){if(c.binding.kind==='speed')player.setSpeed(value);else player.setInput(c.binding.inputId,value);}
  execute(input){
    let request,fingerprint;
    try{
      ({value:request,fingerprint}=encoded(input));object(request,['schemaVersion','context','requestId','expectedRevision','operation','payload']);
      if(request.schemaVersion!==1)fail('INVALID_ARGUMENT','Unsupported command version');this.#scope(request.context);text(request.requestId,'Request ID',80);
      if(this.#closed)fail('SESSION_CLOSED','Live access has stopped');this.#sync();
      const cached=this.#cache.get(request.requestId);if(cached){if(cached.fingerprint!==fingerprint)fail('REQUEST_REUSED','Request ID already belongs to another payload');return structuredClone(cached.result);}
      integer(request.expectedRevision,'Revision',0,Number.MAX_SAFE_INTEGER);
      if(request.expectedRevision!==this.#revision)fail('CONFLICT','Revision changed; inspect and retry with a new request ID');
      if(this.#history.active)fail('BUSY','Finish the active human edit first');
      const payload=request.payload;let changedIds=[],changed=false;
      if(request.operation==='patch'){
        object(payload,['commands'],['label']);text(payload.label||'Command patch','Patch label');
        changed=this.#history.transact(payload.label||'Command patch',p=>changedIds=applyCommands(p,payload.commands,this.#context.artboardId));
        this.#observed=this.#history.revision;
        if(changed)this.#resetPresentation();
      }else if(request.operation==='controls'){
        object(payload,['controls']);const active=validateControls(this.snapshot(),this.#context.artboardId,payload.controls),next=this.#runtime(active);
        for(const c of payload.controls)if(c.type!=='button')this.#bind(next,c,c.value);
        this.#player=next;this.#active=active;this.#controls=structuredClone(payload.controls);this.#playing=false;
      }else if(request.operation==='play'){
        object(payload,['playing'],['animationId','machineId']);if(typeof payload.playing!=='boolean'||('animationId'in payload)===('machineId'in payload))fail('INVALID_ARGUMENT','Choose one animation or machine and a boolean playing value');
        const active='animationId'in payload?{animationId:payload.animationId}:{machineId:payload.machineId};
        for(const value of Object.values(active))text(value,'Playback target');
        const same=JSON.stringify(active)===JSON.stringify(this.#active),next=same?this.#player.fork():this.#runtime(active);
        if(payload.playing&&next.playback?.completed)next.reset();next.pose();
        this.#player=next;this.#active=active;if(!same)this.#controls=[];this.#playing=payload.playing;
      }else if(request.operation==='input'){
        object(payload,['machineId','inputId','value']);
        const target=this.snapshot().machines.find(m=>m.id===payload.machineId&&m.artboardId===this.#context.artboardId);
        if(!target?.inputs.some(i=>i.id===payload.inputId))fail('MISSING_TARGET','Use a stable machine/input ID in this artboard');
        if(this.#active?.machineId!==payload.machineId){const next=this.#runtime({machineId:payload.machineId});next.setInput(payload.inputId,payload.value);this.#player=next;this.#active={machineId:payload.machineId};this.#controls=[];}
        else {const next=this.#player.fork();next.setInput(payload.inputId,payload.value);this.#player=next;}
      }else if(request.operation==='control'){
        object(payload,['controlId','value']);const c=this.#controls.find(c=>c.id===payload.controlId);if(!c)fail('INVALID_BINDING','Control is no longer exposed');
        controlValue(c,payload.value);const next=this.#player.fork();this.#bind(next,c,payload.value);this.#player=next;if(c.type!=='button')c.value=payload.value;
      }else fail('UNSUPPORTED_OPERATION','Unsupported session operation');
      this.#revision++;this.#cue={id:request.requestId,sceneRevision:this.#history.revision,ready:false};
      const changedTotal=changedIds.length;changedIds=changedIds.slice(0,100);
      const eventData=request.operation==='control'?{controlId:payload.controlId,value:payload.value}:
        request.operation==='input'?{machineId:payload.machineId,inputId:payload.inputId,value:payload.value}:
        request.operation==='play'?{active:this.active,playing:this.#playing}:{};
      this.#event(request.operation,{requestId:request.requestId,changedIds,changedTotal,...eventData});
      const result={ok:true,context:this.context,revision:this.#revision,sceneRevision:this.#history.revision,changed,changedIds,changedTotal,cue:{...this.#cue}};
      this.#cache.set(request.requestId,{fingerprint,result});this.#cacheBytes+=fingerprint.length;
      while(this.#cache.size>128||this.#cacheBytes>1048576){const key=this.#cache.keys().next().value;this.#cacheBytes-=this.#cache.get(key).fingerprint.length;this.#cache.delete(key);}
      return structuredClone(result);
    }catch(e){return {ok:false,context:this.context,revision:this.#revision,error:{code:e.code||'INVALID_SCENE',message:String(e.message).slice(0,2000)}};}
  }
  acknowledge(cueId,sceneRevision){this.#sync();if(this.#closed||!this.#cue||this.#cue.id!==cueId||this.#cue.sceneRevision!==sceneRevision||this.#cue.ready)return false;this.#cue.ready=true;this.#event('visual_ready',{cueId});return true;}
  advance(seconds){
    if(!Number.isFinite(seconds)||seconds<0)fail('INVALID_ARGUMENT','Delta must be finite and nonnegative');this.#sync();
    try {const p=this.#player?(this.#playing?this.#player.advance(seconds):this.#player.pose()):this.snapshot();if(this.#player?.playback?.completed)this.#playing=false;return p;}
    catch(e){this.#revision++;this.#resetPresentation();this.#event('presentation_error',{message:String(e.message).slice(0,2000)});throw e;}
  }
}
