import {HttpError,json,body,origin} from './security.mjs';
import {bearer,clients} from './oauth.mjs';
export async function mcp(req,env) {
  const requestOrigin=req.headers.get('Origin');
  if(requestOrigin&&requestOrigin!==origin(env)&&!clients(env).some(c=>c.redirect_uris.some(r=>new URL(r).origin===requestOrigin)))throw new HttpError(403,'Unrecognized MCP request origin.');
  const grant=await bearer(req,env);
  if(!grant)return json({error:'Sign in through your MCP client to connect.'},401,{'WWW-Authenticate':`Bearer resource_metadata="${origin(env)}/.well-known/oauth-protected-resource/mcp", scope="account:read"`});
  if(req.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
  const accept=req.headers.get('Accept')||'';
  if(!accept.includes('application/json')||!accept.includes('text/event-stream'))throw new HttpError(406,'MCP clients must accept JSON and event streams.');
  if(!req.headers.get('Content-Type')?.startsWith('application/json'))throw new HttpError(415,'Expected application/json.');
  const version=req.headers.get('MCP-Protocol-Version');if(version&&!['2025-11-25','2025-06-18'].includes(version))throw new HttpError(400,'Unsupported MCP protocol version.');
  const m=await body(req);if(!m||Array.isArray(m)||m.jsonrpc!=='2.0'||typeof m.method!=='string'||('id'in m&&!['number','string'].includes(typeof m.id)))return json({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}},400);
  if(!('id'in m))return new Response(null,{status:202});
  const result=v=>json({jsonrpc:'2.0',id:m.id,result:v});
  if(m.method==='initialize')return result({protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'evir-account',version:'0.1.0'},instructions:'Authenticated account connection only. This release cannot access projects or pair with an open Studio tab. Live editing and audience controls are not advertised.'});
  if(m.method==='ping')return result({});
  if(m.method==='tools/list')return result({tools:[{name:'get_connection_status',description:'Read the authenticated Evir account ID and connection capabilities. Does not read artwork or edit scenes.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}]});
  if(m.method==='tools/call'&&m.params?.name==='get_connection_status'){
    if(m.params.arguments&&(typeof m.params.arguments!=='object'||Array.isArray(m.params.arguments)||Object.keys(m.params.arguments).length))return json({jsonrpc:'2.0',id:m.id,error:{code:-32602,message:'This tool accepts no arguments.'}});
    const value={accountId:grant.account_id,scope:grant.scope,liveStudioPairing:false,projectAccess:false};return result({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
  }
  return json({jsonrpc:'2.0',id:m.id,error:{code:m.method==='tools/call'?-32602:-32601,message:'Unsupported tool or method'}});
}
