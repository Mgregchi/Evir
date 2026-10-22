import {sceneTools} from '@evir/commands/mcp-tools';
import {routeLiveTool,toolPermission} from './live.mjs';
import {HttpError,json,body,origin} from './security.mjs';
import {findClient} from './oauth-clients.mjs';
import {bearer,clients,permits,scopes} from './oauth.mjs';
const protocolVersions=['2025-11-25','2025-06-18'];
export async function mcp(req,env) {
  const requestOrigin=req.headers.get('Origin');
  const grant=await bearer(req,env);
  if(requestOrigin&&requestOrigin!==origin(env)){
    const candidates=grant?[await findClient(env,grant.client_id)]:clients(env);
    if(!candidates.some(c=>c?.redirect_uris.some(r=>new URL(r).origin===requestOrigin)))throw new HttpError(403,'Unrecognized MCP request origin.');
  }
  if(!grant)return json({error:'Sign in through your MCP client to connect.'},401,{'WWW-Authenticate':`Bearer resource_metadata="${origin(env)}/.well-known/oauth-protected-resource/mcp", scope="${scopes.join(' ')}"`});
  if(req.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
  const accept=req.headers.get('Accept')||'';
  if(!accept.includes('application/json')||!accept.includes('text/event-stream'))throw new HttpError(406,'MCP clients must accept JSON and event streams.');
  if(!req.headers.get('Content-Type')?.startsWith('application/json'))throw new HttpError(415,'Expected application/json.');
  const version=req.headers.get('MCP-Protocol-Version');if(version&&!protocolVersions.includes(version))throw new HttpError(400,'Unsupported MCP protocol version.');
  const m=await body(req,98304);if(!m||Array.isArray(m)||m.jsonrpc!=='2.0'||typeof m.method!=='string'||('id'in m&&!['number','string'].includes(typeof m.id)))return json({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}},400);
  if(!('id'in m))return new Response(null,{status:202});
  const result=v=>json({jsonrpc:'2.0',id:m.id,result:v});
  if(m.method==='initialize')return result({protocolVersion:protocolVersions.includes(m.params?.protocolVersion)?m.params.protocolVersion:protocolVersions[0],capabilities:{tools:{}},serverInfo:{name:'evir-account',version:'0.1.0'},instructions:'List explicitly shared live sessions first. Every scene call requires sessionId. Inspect revisions before mutating; never guess context or retry a timeout with a new requestId. Studio is authoritative; source patches share human Undo. A browser tab must remain connected. Voice/media orchestration is supplied by the agent host.'});
  if(m.method==='ping')return result({});
  const remote=sceneTools.filter(t=>permits(grant,toolPermission(t.name))).map(({operation,...t})=>({...t,inputSchema:{...t.inputSchema,properties:{...t.inputSchema.properties,sessionId:{type:'string',pattern:'^[A-Za-z0-9_-]{43}$'}},required:['sessionId',...(t.inputSchema.required||[])]}}));
  const discovery={name:'list_live_sessions',description:'List the live projects explicitly shared with this connection. Does not select a tab automatically.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}};
  if(m.method==='tools/list')return result({tools:[{name:'get_connection_status',description:'Read the authenticated Evir account ID and granted capabilities.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},...(env.LIVE_SESSIONS&&permits(grant,'scene:read')?[discovery,...remote]:[])]});
  if(m.method==='tools/call'&&m.params?.name==='get_connection_status'){
    if(m.params.arguments&&(typeof m.params.arguments!=='object'||Array.isArray(m.params.arguments)||Object.keys(m.params.arguments).length))return json({jsonrpc:'2.0',id:m.id,error:{code:-32602,message:'This tool accepts no arguments.'}});
    const value={accountId:grant.account_id,scope:grant.scope,liveStudioPairing:!!env.LIVE_SESSIONS,projectAccess:permits(grant,'scene:read')};return result({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
  }
  if(m.method==='tools/call'&&env.LIVE_SESSIONS&&(m.params?.name==='list_live_sessions'||remote.some(t=>t.name===m.params?.name))){
    try{const args=m.params.arguments??{};if(!args||typeof args!=='object'||Array.isArray(args))throw new HttpError(400,'Tool arguments must be an object.');const value=await routeLiveTool(env,grant,m.params.name,args);return result({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,...(value.ok===false?{isError:true}:{})});}
    catch(e){return result({content:[{type:'text',text:e instanceof HttpError?e.message:'Live request failed. Inspect before retrying.'}],isError:true});}
  }
  return json({jsonrpc:'2.0',id:m.id,error:{code:m.method==='tools/call'?-32602:-32601,message:'Unsupported tool or method'}});
}
