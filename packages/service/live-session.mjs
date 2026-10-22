import {activeSession,toolPermission} from './live.mjs';
import {HttpError,json,body,random,now} from './security.mjs';
// One ephemeral browser socket; metadata/alarm only in storage. No scene payload persistence.
export class LiveSession {
  constructor(state,env){this.state=state;this.env=env;this.pending=new Map();}
  sockets(){return this.state.getWebSockets('studio');}
  failPending(message){for(const {resolve,timer} of this.pending.values()){clearTimeout(timer);resolve(json({ok:false,error:{code:'DELIVERY_UNKNOWN',message:message+' Inspect the scene and retry mutations only with the same requestId.'}}));}this.pending.clear();}
  async fetch(req) {
    try {
      const path=new URL(req.url).pathname;
      if(path==='/stop'){this.failPending('Live access stopped.');for(const ws of this.sockets())ws.close(1000,'Live access stopped');return json({ok:true});}
      if(path==='/connect'){
        const id=req.headers.get('X-Evir-Session'),row=await activeSession(this.env,id);
        if(this.sockets().length)throw new HttpError(409,'This session already has a Studio tab.');
        const pair=new WebSocketPair(),[client,server]=Object.values(pair);
        this.state.acceptWebSocket(server,['studio']);server.serializeAttachment({id});
        await this.state.storage.put('sessionId',id);await this.state.storage.setAlarm(row.expires_at*1000);
        return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'evir-live'}});
      }
      if(path!=='/call'||req.method!=='POST')throw new HttpError(404,'Not found.');
      const call=await body(req,98304);const row=await activeSession(this.env,call.sessionId,call.grantId);
      if(!JSON.parse(row.permissions).includes(toolPermission(call.name)))throw new HttpError(403,'Session permission denied.');
      const ws=this.sockets()[0];if(!ws)return json({ok:false,error:{code:'STUDIO_OFFLINE',message:'Open Studio and grant a new live session. Nothing was queued.'}});
      if(this.pending.size)return json({ok:false,error:{code:'BUSY',message:'Another live request is awaiting Studio. Retry after it finishes.'}});
      const id=random();return await new Promise(resolve=>{
        const timer=setTimeout(()=>{this.pending.delete(id);resolve(json({ok:false,error:{code:'DELIVERY_UNKNOWN',message:'Studio did not acknowledge in ten seconds. Inspect and retry mutations only with the same requestId; no automatic replay occurs.'}}));},10000);
        this.pending.set(id,{resolve,timer});
        try{ws.send(JSON.stringify({id,name:call.name,args:call.args}));}catch{this.failPending('Studio disconnected.');}
      });
    } catch(e){return json({ok:false,error:{code:e instanceof HttpError?'ACCESS_DENIED':'SERVICE_ERROR',message:e instanceof HttpError?e.message:'Live transport failed.'}},new URL(req.url).pathname==='/connect'?(e instanceof HttpError?e.status:500):200);}
  }
  async webSocketMessage(ws,message) {
    const attachment=ws.deserializeAttachment();
    try{
      if(typeof message!=='string'||new TextEncoder().encode(message).length>1048576)throw Error('Message exceeds live transport limit.');
      await activeSession(this.env,attachment.id);
      const m=JSON.parse(message);
      if(m.type==='heartbeat'){ws.send(JSON.stringify({type:'heartbeat'}));return;}
      const pending=this.pending.get(m.id);if(!pending)return;
      clearTimeout(pending.timer);this.pending.delete(m.id);pending.resolve(json(m.value));
    }catch{await this.stop(attachment.id,'Permission expired or response was invalid.');}
  }
  async stop(id,message){this.failPending(message);try{if(id)await this.env.DB.prepare('UPDATE live_sessions SET revoked_at = ? WHERE id = ?').bind(now(),id).run();}finally{for(const ws of this.sockets())try{ws.close(1000,message.slice(0,100));}catch{}}}
  async webSocketClose(ws){await this.stop(ws.deserializeAttachment()?.id,'Studio disconnected.');}
  async webSocketError(ws){await this.stop(ws.deserializeAttachment()?.id,'Studio connection failed.');}
  async alarm(){await this.stop(await this.state.storage.get('sessionId'),'Live access expired.');await this.state.storage.deleteAll();}
}
