import {livingLoader} from '@evir/ui';
import {explainImport} from './guidance.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const button=(label,fn)=>{const b=el('button',label);b.type='button';b.onclick=fn;return b;};
export function mountRiveViewer(){
  let dialog,player,sequence=0,timeout,resize,file,buffer,api,canvas,status,load,play,reset,artboard,motion,inputs,notice,loading=false,playing=false,pausedByVisibility=false;
  const dispose=()=>{sequence++;clearTimeout(timeout);player?.cleanup();player=null;resize?.disconnect();resize=null;playing=false;loading=false;buffer=null;if(canvas)canvas.width=canvas.height=1;};
  const stop=()=>{playing=false;player?.pause();player?.stopRendering();if(play)play.textContent='Play original';};
  const redraw=()=>{if(!player)return;player.resizeDrawingSurfaceToCanvas(Math.min(2,devicePixelRatio||1));player.drawFrame();if(!playing)player.stopRendering();};
  const error=message=>{notice.textContent=message;notice.setAttribute('role','alert');};
  const snapshot=()=>({open:!!dialog?.open,loading,playing,artboard:player?.activeArtboard||null,animationNames:player?.animationNames||[],stateMachineNames:player?.stateMachineNames||[]});
  const readInputs=()=>{
    inputs.replaceChildren();const selected=motion.selectedOptions[0]?.dataset.kind;
    if(selected!=='machine')return;
    const name=motion.selectedOptions[0].dataset.name;
    const values=player.stateMachineInputs(name)||[];
    if(!values.length){inputs.append(el('p','This state machine has no exposed legacy inputs. Data-binding controls are not generated here.'));return;}
    for(const input of values.slice(0,32)){
      if(input.type===api.StateMachineInputType.Trigger){inputs.append(button(input.name,()=>{try{input.fire();player.drawFrame();if(!playing)player.stopRendering();}catch(e){error(e.message);}}));continue;}
      const label=el('label'),field=el('input');field.setAttribute('aria-label',input.name);
      const bool=input.type===api.StateMachineInputType.Boolean;field.type=bool?'checkbox':'number';if(bool)field.checked=input.value;else{field.value=input.value;field.step='any';}
      label.append(el('span',input.name),field);inputs.append(label);
      field.onchange=()=>{try{const value=bool?field.checked:Number(field.value);if(!bool&&(!field.value.trim()||!Number.isFinite(value)))throw Error('Enter a finite input value');input.value=value;player.drawFrame();if(!playing)player.stopRendering();}catch(e){error(e.message);}};
    }
    if(values.length>32)inputs.append(el('p','Showing the first 32 inputs.'));
  };
  const choose=()=>{
    if(!player||loading)return;stop();const option=motion.selectedOptions[0],kind=option?.dataset.kind,name=option?.dataset.name;
    try{player.reset({artboard:artboard.value,autoBind:true,autoplay:false,...(kind==='machine'?{stateMachine:name}:kind==='animation'?{animations:name}:{})});redraw();readInputs();play.disabled=!name;status.textContent='Original file ready · paused · read-only';}
    catch(e){error('Could not select this view: '+e.message);}
  };
  const fillMotions=()=>{
    motion.replaceChildren();const still=el('option','Static view');still.value='static';motion.append(still);
    for(const [kind,names] of [['animation',player.animationNames],['machine',player.stateMachineNames]])for(const [i,name] of names.slice(0,100).entries()){
      const option=el('option',`${kind==='machine'?'State machine':'Animation'} · ${name.slice(0,120)}`);option.value=kind+'-'+i;option.dataset.kind=kind;option.dataset.name=name;motion.append(option);
    }
    if(motion.options.length>1)motion.selectedIndex=1;choose();
  };
  const loadFile=async()=>{
    dispose();if(!dialog?.open||!file)return;
    if(file.size>32*1024*1024){error('This file exceeds the 32 MiB viewing limit. Use a smaller export or view it in Rive.');return;}
    const token=++sequence;loading=true;load.disabled=true;play.disabled=reset.disabled=artboard.disabled=motion.disabled=true;
    notice.textContent='';status.textContent='Preparing the original file…';canvas.setAttribute('aria-busy','true');
    const loader=dialog.querySelector('.viewer-loading');loader.innerHTML=livingLoader('Preparing the original animation…');loader.hidden=false;
    const fail=message=>{if(token!==sequence)return;sequence++;clearTimeout(timeout);player?.cleanup();player=null;buffer=null;loading=false;load.disabled=false;loader.hidden=true;canvas.setAttribute('aria-busy','false');status.textContent='Original preview unavailable';error(message+' Your Studio project and original file are unchanged.');};
    timeout=setTimeout(()=>fail('The original preview took too long to prepare.'),30000);
    try{
      const data=await file.arrayBuffer();if(token!==sequence)return;buffer=data;
      const runtime=await import('./rive-view-runtime.mjs');if(token!==sequence)return;api=runtime.configureRuntime(new URL('./',location.href));
      const external=new Set();
      const instance=new api.Rive({buffer:data,canvas,autoplay:false,autoBind:true,enableRiveAssetCDN:false,
        layout:new api.Layout({fit:api.Fit.Contain??api.Fit.contain,alignment:api.Alignment.Center??api.Alignment.center}),
        assetLoader:(asset,bytes)=>{if(bytes?.length)return false;external.add(String(asset.name||'Referenced asset').slice(0,120));return true;},
        onLoad:()=>{
          if(token!==sequence){instance.cleanup();return;}
          clearTimeout(timeout);player=instance;loading=false;load.disabled=false;loader.hidden=true;canvas.setAttribute('aria-busy','false');
          const boards=instance.contents.artboards||[];artboard.replaceChildren();
          for(const board of boards.slice(0,100)){const option=el('option',board.name.slice(0,120));option.value=board.name;artboard.append(option);}
          artboard.value=instance.activeArtboard;artboard.disabled=boards.length<2;motion.disabled=false;reset.disabled=false;fillMotions();
          resize=new ResizeObserver(()=>redraw());resize.observe(canvas);
          if(external.size)error(`Referenced assets were not fetched (${external.size}). This preview uses embedded assets only and may look incomplete.`);
        },
        onLoadError:()=>fail('The official Rive runtime could not open this original file.'),
      });
      if(token===sequence)player=instance;else instance.cleanup();
    }catch(e){fail('Could not prepare the original preview: '+String(e.message).slice(0,400));}
  };
  const open=(nextFile,{importError,viewImmediately=false}={})=>{
    dialog?.close();dispose();file=nextFile;const opener=document.activeElement;
    dialog=el('dialog');dialog.id='riv-import-sheet';dialog.className='interaction-sheet rive-view-sheet';
    const title=el('h2',importError?'Import for editing unavailable':'View an original Rive file');title.id='riv-import-title';dialog.setAttribute('aria-labelledby',title.id);dialog.append(title);
    dialog.append(el('p',nextFile.name),el('p',importError?explainImport(importError).message:'View the original artwork and motion with the official Rive runtime. This view is read-only and does not replace your Studio project.'));
    dialog.append(el('p','Your Studio project stays open. Editable import currently supports a subset of .riv features; .rev editor backups are not supported.'));
    if(importError){const d=el('details');d.append(el('summary','Why editable conversion failed'));const pre=el('pre',explainImport(importError).diagnostic);pre.tabIndex=0;pre.setAttribute('aria-label','Import diagnostic');d.append(pre);dialog.append(d);}
    notice=el('p');notice.setAttribute('role','alert');dialog.append(notice);
    const row=el('div');row.className='dialog-actions';load=button('View original animation',loadFile);load.className='primary';
    const save=button('Download original .riv',()=>{const url=URL.createObjectURL(nextFile),a=el('a');a.href=url;a.download=nextFile.name.replace(/[/\\]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});row.append(load,save);dialog.append(row);
    const viewer=el('section');viewer.className='rive-original-view';status=el('p','Original preview is paused until you choose View original animation.');status.setAttribute('role','status');viewer.append(status);
    const loader=el('div');loader.className='viewer-loading';loader.hidden=true;viewer.append(loader);
    canvas=el('canvas');canvas.width=canvas.height=512;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Read-only original Rive preview: ${nextFile.name}`);canvas.tabIndex=0;viewer.append(canvas);
    const aLabel=el('label','Artboard');artboard=el('select');artboard.setAttribute('aria-label','Original artboard');artboard.disabled=true;artboard.onchange=()=>{try{stop();player.reset({artboard:artboard.value,autoplay:false,autoBind:true});fillMotions();}catch(e){error(e.message);}};aLabel.append(artboard);viewer.append(aLabel);
    const mLabel=el('label','Motion');motion=el('select');motion.setAttribute('aria-label','Original motion');motion.disabled=true;motion.onchange=choose;mLabel.append(motion);viewer.append(mLabel);
    const actions=el('div');actions.className='dialog-actions';play=button('Play original',()=>{
      if(playing){stop();status.textContent='Original file ready · paused · read-only';return;}
      try{player.play(motion.selectedOptions[0].dataset.name);player.startRendering();playing=true;play.textContent='Pause original';status.textContent='Playing original · read-only';}catch(e){error(e.message);}
    });play.disabled=true;reset=button('Reset original',choose);reset.disabled=true;actions.append(play,reset);viewer.append(actions);
    inputs=el('div');inputs.className='original-inputs';viewer.append(inputs,el('p','Rendering: official Rive Canvas runtime 2.44.0. Embedded assets only. This viewer does not convert unsupported features into Evir layers.'));dialog.append(viewer);
    const footer=el('div');footer.className='dialog-actions';footer.append(button('Back to Studio',()=>{dispose();dialog.close();}));dialog.append(footer);
    const ownDialog=dialog;ownDialog.addEventListener('cancel',dispose,{once:true});ownDialog.addEventListener('close',()=>{if(dialog===ownDialog){dispose();file=null;dialog=null;}ownDialog.remove();(opener?.offsetParent?opener:document.querySelector('[aria-label="Project menu"]'))?.focus();},{once:true});
    document.body.append(dialog);dialog.showModal();if(viewImmediately)loadFile();
  };
  const picker=el('input');picker.type='file';picker.accept='.riv';picker.hidden=true;picker.id='riv-view-file';document.body.append(picker);
  document.querySelector('#project-file-actions').append(button('View .riv file…',()=>picker.click()));picker.onchange=()=>{const selected=picker.files[0];picker.value='';if(selected)open(selected,{viewImmediately:true});};
  document.addEventListener('visibilitychange',()=>{if(!player)return;if(document.hidden){pausedByVisibility=playing;if(playing)stop();}else if(pausedByVisibility){pausedByVisibility=false;status.textContent='Original preview paused while away. Choose Play original to resume.';}});
  window.addEventListener('pagehide',()=>{dispose();if(dialog?.open)status.textContent='Preview released. Choose View original animation to load it again.';});
  return {open,snapshot};
}
