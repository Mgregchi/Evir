export function explainImport(error){
  const diagnostic=String(error?.message||error),match=diagnostic.match(/^([^\n]+?) at byte (\d+):/);
  const type=match?.[1];let feature;
  if(type?.startsWith('DataConverter'))feature='data converters';
  else if(/animated .* geometry cannot be preserved/.test(diagnostic))feature='animated contour geometry';
  else if(['Ellipse','Rectangle','PointsPath','StraightVertex','CubicMirroredVertex','CubicAsymmetricVertex','CubicDetachedVertex'].includes(type))feature='contour features outside the supported static geometry subset';
  else if(type?.includes('ViewModel')||type?.includes('DataBind'))feature='data binding';
  else if(type?.includes('Audio'))feature='audio';
  else if(type?.includes('Text'))feature='text features';
  else feature='features outside the current editable import support';
  return {title:'This file could not be converted for editing',
    message:type?`This file uses ${feature} that Evir cannot yet convert into editable layers. Viewing the original may still work with the official Rive runtime.`:
      'Evir could not convert this file into an editable project. You can try viewing the original with the official Rive runtime.',
    diagnostic,type,offset:match?Number(match[2]):null};
}
export function mcpConfiguration(checkoutPath){
  const root=checkoutPath.trim().replaceAll('\\','/').replace(/\/+$/,'');
  if(!root||!(root.startsWith('/')||/^[A-Za-z]:\//.test(root))||/[\x00-\x1f]/.test(root)||root.split('/').some(p=>p==='..'||p==='.')||root==='/path/to/Evir')
    throw Error('Enter the full folder path to your Evir checkout, such as /home/you/Evir or C:/Projects/Evir.');
  return {mcpServers:{'evir-local':{command:'node',args:[root+'/tools/mcp-local.mjs','--project',root+'/apps/web/assets/examples/compass.evir-project']}}};
}
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const button=(label,fn)=>{const b=el('button',label);b.type='button';b.onclick=fn;return b;};
export function showMcpGuide(){
  if(document.querySelector('#mcp-setup-sheet'))return;
  const opener=document.activeElement,dialog=el('dialog');dialog.id='mcp-setup-sheet';dialog.className='interaction-sheet guidance-sheet';
  const title=el('h2','MCP setup');title.id='mcp-setup-title';dialog.setAttribute('aria-labelledby',title.id);dialog.append(title,
    el('p','MCP lets an agent inspect and edit an Evir scene through tools. The current server runs on your computer, using a local project file. It is a local prototype.'),
    el('p','It does not connect to this open Studio tab. Live tools is the separate browser preview. A live agent-to-Studio connection is still planned.'));
  const steps=el('ol');
  for(const [title,text] of [
    ['1. Prepare Evir on your computer','Install Node.js 24 and Git, clone the Evir repository, then run npm ci in its folder. This setup needs a desktop computer and a client that supports local stdio MCP servers.'],
    ['2. Add the local server to your agent client','Enter your checkout folder below. Copy the configuration into your client’s MCP server settings and restart or enable the server there. Client configuration formats vary; this uses mcpServers.'],
    ['3. Start with the Compass sample','Ask your agent to call inspect_scene first, then apply_scene_patch or expose_controls using that context and revision. get_scene_snapshot returns the edited source.'],
    ['4. Open the result in Studio','Save the project object returned by get_scene_snapshot as an .evir-project JSON file, then use Open project in Studio. The process edits in memory and does not save files automatically. To use your own project, save it from Studio and change the --project argument to its full local path.'],
  ]){const li=el('li');li.append(el('strong',title),el('p',text));steps.append(li);}dialog.append(steps);
  const link=el('a','View the Evir repository ↗');link.href='https://github.com/Mgregchi/Evir';link.target='_blank';link.rel='noopener noreferrer';dialog.append(link);
  const field=el('label','Your Evir checkout folder'),input=el('input');input.type='text';input.placeholder='/home/you/Evir or C:/Projects/Evir';input.setAttribute('aria-label','Your Evir checkout folder');field.append(input);dialog.append(field);
  const code=el('pre');code.tabIndex=0;code.setAttribute('aria-label','MCP server configuration');dialog.append(code);
  const status=el('p');status.setAttribute('role','status');dialog.append(status);let json='';
  const copy=button('Copy configuration',async()=>{try{await navigator.clipboard.writeText(json);status.textContent='Configuration copied. Paste it into your desktop MCP client settings.';status.setAttribute('role','status');}catch{status.textContent='Clipboard access was unavailable. Select the configuration text or download it instead.';status.setAttribute('role','alert');}});
  const download=button('Download configuration',()=>{const url=URL.createObjectURL(new Blob([json+'\n'],{type:'application/json'})),a=el('a');a.href=url;a.download='evir-mcp-config.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Configuration downloaded. Import or paste it into your desktop MCP client settings.';});
  const update=()=>{try{json=JSON.stringify(mcpConfiguration(input.value),null,2);code.textContent=json;copy.disabled=download.disabled=false;status.textContent='This starts the Compass sample in a separate local process.';}catch(e){json='';code.textContent='Enter your local checkout folder to generate the configuration.';copy.disabled=download.disabled=true;status.textContent=input.value?e.message:'';}};
  input.oninput=update;update();const actions=el('div');actions.className='dialog-actions';actions.append(copy,download,button('Close MCP setup',()=>dialog.close()));dialog.append(actions);
  dialog.addEventListener('close',()=>{dialog.remove();(opener?.offsetParent?opener:document.querySelector('[aria-label="Project menu"]'))?.focus();},{once:true});document.body.append(dialog);dialog.showModal();
}
