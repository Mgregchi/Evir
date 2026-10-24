import {registerClient} from './oauth-clients.mjs';
import {liveApi} from './live.mjs';
import {HttpError,json,origin,secure,cleanup} from './security.mjs';
import {passkeys} from './passkeys.mjs';
import {accounts} from './accounts.mjs';
import {metadata,scopes,authorize,consent,token,revoke} from './oauth.mjs';
import {mcp} from './mcp.mjs';
import {accountPage} from './account-page.mjs';
const isService=p=>p==='/account'||p==='/account/'||p.startsWith('/api/live')||p.startsWith('/api/account')||p.startsWith('/api/passkeys/')||p.startsWith('/api/oauth/')||p==='/api/service'||p.startsWith('/oauth/')||p==='/mcp'||p.startsWith('/.well-known/oauth-');
const publicEndpoint=p=>p==='/mcp'||p==='/oauth/register'||p==='/oauth/token'||p==='/oauth/revoke'||p.startsWith('/.well-known/');
export async function fetchService(req,env) {
  const url=new URL(req.url),path=url.pathname;
  if(!isService(path))return null;
  let r;
  try {
    const o=origin(env);if(url.origin!==o)throw new HttpError(421,'Use the configured Evir site address for accounts and connections.');
    if(req.method==='OPTIONS'&&publicEndpoint(path))r=new Response(null,{status:204});
    else if(!env.DB)throw new HttpError(503,'Accounts are not configured on this deployment yet.');
    else if(path==='/api/service'&&req.method==='GET')r=json({accounts:true,mcp:true,liveStudioPairing:!!env.LIVE_SESSIONS});
    else if((path==='/account'||path==='/account/'||path==='/oauth/authorize')&&req.method==='GET'){
      if(path==='/oauth/authorize')await authorize(url.searchParams,env);
      r=new Response(accountPage,{headers:{'Content-Type':'text/html; charset=utf-8'}});
    }
    else if(path.startsWith('/api/passkeys/')&&req.method==='POST'&&/^\/api\/passkeys\/(register|login)\/(options|verify)$/.test(path))r=await passkeys(req,env,path);
    else if(path.startsWith('/api/live'))r=await liveApi(req,env,path);
    else if(path.startsWith('/api/account'))r=await accounts(req,env,path);
    else if(path==='/api/oauth/request'&&req.method==='GET'){const a=await authorize(url.searchParams,env);r=json({clientName:a.client.client_name,registration:a.client.registration,redirectUri:a.redirect,scope:a.scope,permissions:a.scope.split(' ').map(p=>({'account:read':'Read your account identifier and connection status','scene:read':'Read projects you explicitly share from Studio','scene:write':'Edit the selected artboard in a shared project','scene:control':'Play shared scenes and expose typed audience controls'}[p]))});}
    else if(path==='/api/oauth/consent'&&req.method==='POST')r=await consent(req,env);
    else if(path==='/oauth/register'&&req.method==='POST')r=await registerClient(req,env);
    else if(path==='/oauth/token'&&req.method==='POST')r=await token(req,env);
    else if(path==='/oauth/revoke'&&req.method==='POST')r=await revoke(req,env);
    else if(path==='/mcp')r=await mcp(req,env);
    else if(path==='/.well-known/oauth-authorization-server'&&req.method==='GET')r=json(metadata(env));
    else if(['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'].includes(path)&&req.method==='GET')r=json({resource:o+'/mcp',authorization_servers:[o],scopes_supported:scopes,bearer_methods_supported:['header']});
    else throw new HttpError(404,'Not found.');
  } catch(e) { r=json({error:e instanceof HttpError?e.message:'The service could not complete this request. Please try again.'},e instanceof HttpError?e.status:500); }
  if(r.status===101)return r;
  r=secure(r);
  if(publicEndpoint(path)) {
    r.headers.set('Access-Control-Allow-Origin','*');r.headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');r.headers.set('Access-Control-Allow-Headers','Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id');r.headers.set('Access-Control-Expose-Headers','WWW-Authenticate');
  }
  return r;
}
export {cleanup};
