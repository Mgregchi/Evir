const $=s=>document.querySelector(s);
const status=(text,error=false)=>{const p=$('#status');p.textContent=text;p.toggleAttribute('data-error',error);p.setAttribute('role',error?'alert':'status');};
async function api(path,value){const r=await fetch(path,{method:value===undefined?'GET':'POST',headers:value===undefined?{}:{'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});const data=await r.json();if(!r.ok){const error=Error(data.error||'This action could not finish. Please try again.');error.status=r.status;throw error;}return data;}
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const encode=v=>btoa(String.fromCharCode(...new Uint8Array(v))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
let running=false;
async function action(fn){if(running)return;running=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);status('Working…');try{await fn();}catch(e){status(e.name==='NotAllowedError'?'Passkey action was cancelled or unavailable. You can try again.':e.message,true);}finally{running=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
async function ceremony(register){
  if(!window.PublicKeyCredential)throw Error('Passkeys need a supported browser on HTTPS.');
  const kind=register?'register':'login';const options=await api(`/api/passkeys/${kind}/options`,{});options.challenge=decode(options.challenge);
  let c;
  if(register){options.user.id=decode(options.user.id);options.excludeCredentials?.forEach(c=>c.id=decode(c.id));c=await navigator.credentials.create({publicKey:options});}
  else{options.allowCredentials?.forEach(c=>c.id=decode(c.id));c=await navigator.credentials.get({publicKey:options});}
  if(!c)throw Error('No passkey was selected.');
  const response={clientDataJSON:encode(c.response.clientDataJSON)};
  if(register){response.attestationObject=encode(c.response.attestationObject);response.transports=c.response.getTransports?.()||[];}
  else{response.authenticatorData=encode(c.response.authenticatorData);response.signature=encode(c.response.signature);response.userHandle=c.response.userHandle?encode(c.response.userHandle):undefined;}
  await api(`/api/passkeys/${kind}/verify`,{id:c.id,rawId:encode(c.rawId),type:c.type,response,clientExtensionResults:c.getClientExtensionResults(),authenticatorAttachment:c.authenticatorAttachment});
  await load();status(register?'Passkey saved. Create recovery codes or add another passkey to keep access.':'Signed in.');
}
function row(parent,label,buttonLabel,fn){const div=document.createElement('div');div.className='row';const text=document.createElement('span');text.textContent=label;const b=document.createElement('button');b.textContent=buttonLabel;b.className='secondary';b.onclick=()=>action(fn);div.append(text,b);parent.append(div);}
async function load(){
  let account;try{account=await api('/api/account');}catch(e){if(e.status!==401)throw e;}
  $('#intro').textContent=account?`Signed in as Evir account ${account.accountId.slice(0,8)}.`:'Sign in with your device. No email or password.';
  $('#signin').hidden=!!account;$('#account').hidden=!account;$('#consent').hidden=true;
  if(!account){status('Choose an existing passkey, or create your first Evir account.');return;}
  if(location.pathname==='/oauth/authorize'){
    const c=await api('/api/oauth/request'+location.search);$('#client-name').textContent=`${c.clientName} requests: ${c.permissions.join('; ')}. Studio project access still requires a separate grant inside Studio.`;$('#account').hidden=true;$('#consent').hidden=false;status('Review this connection before allowing access.');return;
  }
  $('#endpoint').textContent=location.origin+'/mcp';$('#connections').replaceChildren();$('#credentials').replaceChildren();
  for(const c of account.connections)row($('#connections'),`${c.client_name} · ${c.scope}`,'Revoke',async()=>{await api('/api/account/revoke',{id:c.id});await load();status('Connection revoked.');});
  if(!account.connections.length)$('#connections').textContent='No connected agents yet.';
  account.credentials.forEach((c,i)=>row($('#credentials'),`Passkey ${i+1} · added ${new Date(c.created_at*1000).toLocaleDateString()}`,'Remove',async()=>{await api('/api/account/remove-passkey',{id:c.id});await load();status('Passkey removed.');}));
  $('#recovery-count').textContent=account.recoveryCodesRemaining?`${account.recoveryCodesRemaining} recovery codes remaining.`:'No recovery codes saved yet. Create a set before you lose access to this device.';
  status('You control which agents can connect.');
}
$('#login').onclick=()=>action(()=>ceremony(false));$('#register').onclick=$('#add-passkey').onclick=()=>action(()=>ceremony(true));
$('#logout').onclick=$('#switch-account').onclick=()=>action(async()=>{await api('/api/account/logout',{});await load();});
$('#recover').onsubmit=e=>{e.preventDefault();action(async()=>{await api('/api/account/recover',{code:$('#recovery-code').value});$('#recovery-code').value='';await load();status('Account recovered. Existing sessions and connections were revoked. Add a replacement passkey, then remove any lost-device passkey.');});};
for(const [id,approved] of [['approve',true],['deny',false]])$('#'+id).onclick=()=>action(async()=>{const r=await api('/api/oauth/consent',{query:location.search.slice(1),approved});location.assign(r.redirect);});
let codes='';$('#recovery').onclick=()=>action(async()=>{const r=await api('/api/account/recovery-codes',{});codes=r.codes.join('\n');$('#code-list').textContent=codes;$('#codes').showModal();status('Save your codes before closing the sheet.');});
$('#close-codes').onclick=()=>$('#codes').close();$('#codes').addEventListener('close',()=>{codes='';$('#code-list').textContent='';action(load);});
$('#download').onclick=()=>{const url=URL.createObjectURL(new Blob(['Evir single-use recovery codes. Keep private.\n\n'+codes+'\n'],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='evir-recovery-codes.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
action(load);
