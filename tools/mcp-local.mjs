// Host-selected, in-memory stdio server. stdout contains JSON-RPC only.
import {readFile,stat} from 'node:fs/promises';
import {openProject} from '@evir/project-model';
import {CommandSession} from '@evir/commands';
import {sceneTools} from '@evir/commands/mcp-tools';
import {object,encoded} from '../packages/commands/validation.mjs';
const argv=process.argv.slice(2),options={};
try{
  for(let i=0;i<argv.length;i+=2){if(!['--project','--session','--artboard'].includes(argv[i])||!argv[i+1]||options[argv[i]])throw Error('Expected --project FILE [--session ID] [--artboard ID]');options[argv[i]]=argv[i+1];}
  if(!options['--project'])throw Error('A host-selected --project FILE is required');
  if((await stat(options['--project'])).size>2097152)throw Error('Local project limit is 2 MiB');
}catch(e){process.stderr.write(e.message+'\n');process.exit(1);}
let session;
try{const project=await openProject(await readFile(options['--project'],'utf8'));session=new CommandSession(project,{...(options['--session']?{sessionId:options['--session']}:{}),...(options['--artboard']?{artboardId:options['--artboard']}:{})});}
catch(e){process.stderr.write('Could not open project: '+e.message+'\n');process.exit(1);}
const tools=sceneTools;
let initialized=false,ready=false;
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
const result=value=>({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,...(value.ok===false?{isError:true}:{})});
function handle(message){
  let id=null;
  try{
    object(message,['jsonrpc','method'],['id','params']);if(message.jsonrpc!=='2.0'||typeof message.method!=='string')throw Error('Invalid JSON-RPC request');
    if('id'in message){if(!['string','number'].includes(typeof message.id)||typeof message.id==='number'&&!Number.isFinite(message.id))throw Error('Invalid request ID');id=message.id;}
    if(!('id'in message)){if(message.method==='notifications/initialized'&&initialized)ready=true;return;}
    if(message.method==='ping'){send({jsonrpc:'2.0',id,result:{}});return;}
    if(message.method==='initialize'){
      if(initialized)throw Error('Already initialized');object(message.params,['protocolVersion','capabilities','clientInfo'],['_meta']);
      if(typeof message.params.protocolVersion!=='string'||typeof message.params.capabilities!=='object'||!message.params.capabilities)throw Error('Invalid initialization');
      object(message.params.clientInfo,['name','version'],['title','description','websiteUrl','icons']);
      initialized=true;send({jsonrpc:'2.0',id,result:{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'evir-local',version:'0.1.0'},instructions:'Local in-memory project only. Inspect first. This process is separate from Studio and does not render, publish, write files or perform hosted pairing.'}});return;
    }
    if(!ready)throw Error('Initialize and send notifications/initialized before tool requests');
    if(message.method==='tools/list'){object(message.params||{},[],['cursor']);if(message.params?.cursor)throw Error('Unknown cursor');send({jsonrpc:'2.0',id,result:{tools:tools.map(({operation,...t})=>t)}});return;}
    if(message.method!=='tools/call'){send({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not supported'}});return;}
    object(message.params,['name'],['arguments','_meta']);const tool=tools.find(t=>t.name===message.params.name);
    if(!tool){send({jsonrpc:'2.0',id,error:{code:-32602,message:'Unknown tool'}});return;}
    let value;
    try{
      const args=encoded(message.params.arguments||{}).value;
      if(tool.operation)value=session.execute({...args,operation:tool.operation});
      else if(tool.name==='inspect_scene'){object(args,[],['context','offset','limit']);if(args.context)session.checkContext(args.context);value=session.inspect({offset:args.offset,limit:args.limit});}
      else {object(args,['context'],tool.name==='get_session_events'?['since']:[]);session.checkContext(args.context);
        if(tool.name==='get_session_events')value=session.events(args.since??0);
        else if(tool.name==='stop_session'){session.close();value={ok:true,...session.inspect()};}
        else value={context:session.context,project:session.snapshot()};
      }
      if(Buffer.byteLength(JSON.stringify(value))>2097152)throw Error('Snapshot exceeds 2 MiB; use paged inspection');
    }catch(e){value={ok:false,error:{code:e.code||'INVALID_ARGUMENT',message:String(e.message).slice(0,2000)}};}
    send({jsonrpc:'2.0',id,result:result(value)});
  }catch(e){send({jsonrpc:'2.0',id,error:{code:-32600,message:String(e.message).slice(0,2000)}});}
}
// Bound input even when a client omits the newline; discard until the next one.
let pending=Buffer.alloc(0),discard=false;
process.stdin.on('data',chunk=>{
  for(let start=0;start<chunk.length;){const newline=chunk.indexOf(10,start),end=newline<0?chunk.length:newline,part=chunk.subarray(start,end);
    if(!discard){if(pending.length+part.length>262144){pending=Buffer.alloc(0);discard=true;send({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Transport message exceeds 256 KiB'}});}else pending=Buffer.concat([pending,part]);}
    if(newline>=0){if(!discard&&pending.length){try{handle(JSON.parse(pending.toString('utf8')));}catch{send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}});}}pending=Buffer.alloc(0);discard=false;}start=end+(newline<0?0:1);
  }
});
process.stdin.on('end',()=>session.close());
process.stdout.on('error',()=>{session.close();process.exit(1);});
process.on('SIGTERM',()=>{session.close();process.exit(0);});
