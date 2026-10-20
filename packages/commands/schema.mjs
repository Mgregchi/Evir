// Discovery schemas describe command shapes; the model remains final authority
// for geometry, references, animation properties and cross-field constraints.
const id={type:'string',minLength:1,maxLength:120},name={type:'string',minLength:1,maxLength:160};
const shape=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const matrix={type:'array',minItems:6,maxItems:6,items:{type:'number'}};
const geometry={type:['object','null'],description:'Existing Evir geometry contract for the node kind. Rectangle: width, height, fill. Group: null. Other kinds use the project-model contract.'};
const node=shape({id,name,kind:{enum:['rectangle','group','bone','path','text','image','mesh']},artboardId:id,parentId:{type:['string','null']},order:{type:'integer',minimum:0},transform:matrix,geometry});
const playback=shape({mode:{enum:['once','loop','ping-pong']},iterations:{type:'integer',minimum:0,maximum:10000},speed:{type:'number',minimum:.01,maximum:16}});
const command=(op,properties)=>shape({op:{const:op},...properties});
export const commandSchema={oneOf:[
  command('create_shape',{nodeId:id,preset:{enum:['rectangle','rounded','circle','ellipse','triangle','diamond','polygon','star','line','capsule','arrow','heart','cloud','bubble']},options:shape({parentId:{type:['string','null']},name,x:{type:'number'},y:{type:'number'},width:{type:'number',minimum:2,maximum:4096},height:{type:'number',minimum:2,maximum:4096},radius:{type:'number',minimum:0},sides:{type:'integer',minimum:3,maximum:12},inner:{type:'number',minimum:10,maximum:90},fill:{type:'string',pattern:'^#[a-fA-F0-9]{6}([a-fA-F0-9]{2})?$'},strokeWidth:{type:'number',minimum:.1,maximum:128},parametric:{type:'boolean'}},[])}),
  command('set_shape_parameters',{nodeId:id,changes:{...shape({width:{type:'number'},height:{type:'number'},radius:{type:'number'},sides:{type:'integer'},inner:{type:'number'}},[]),minProperties:1}}),
  command('detach_shape',{nodeId:id}),
  command('combine_paths',{nodeIds:{type:'array',items:id,minItems:2,maxItems:8,uniqueItems:true},fillRule:{enum:['nonzero','evenodd']}}),
  command('release_compound',{nodeId:id}),
  command('join_paths',{nodeId:id,otherId:id,options:shape({keepEnd:{enum:['first','last']},otherEnd:{enum:['first','last']},mode:{enum:['bridge','smooth','merge']}},[])}),
  command('create_node',{node}),
  command('update_node',{nodeId:id,changes:{...shape({name,transform:matrix,geometry},[]),minProperties:1}}),
  command('remove_node',{nodeId:id}),command('reparent_node',{nodeId:id,parentId:{type:['string','null']}}),
  command('create_animation',{animation:{type:'object',description:'Complete Evir animation with ID, name, artboardId, fps, duration, tracks and loop or playback.'}}),
  command('set_key',{animationId:id,nodeId:id,property:id,frame:{type:'integer',minimum:0},value:{type:['number','string']},easing:shape({type:{enum:['linear','hold','cubic']},curve:{type:['array','null'],items:{type:'number'},minItems:4,maxItems:4}})}),
  command('set_playback',{animationId:id,playback}),
  command('create_machine',{machine:{type:'object',description:'Complete Evir machine with ID, name, artboardId, entryStateId, inputs, states, transitions and listeners.'}}),
]};
export const controlSchema={oneOf:[
  shape({id,label:name,type:{const:'slider'},min:{type:'number'},max:{type:'number'},step:{type:'number',exclusiveMinimum:0},value:{type:'number'},binding:{oneOf:[shape({kind:{const:'speed'},animationId:id}),shape({kind:{const:'input'},machineId:id,inputId:id})]}},['id','label','type','min','max','step','value','binding']),
  shape({id,label:name,type:{const:'checkbox'},value:{type:'boolean'},binding:shape({kind:{const:'input'},machineId:id,inputId:id})}),
  shape({id,label:name,type:{const:'button'},binding:shape({kind:{const:'input'},machineId:id,inputId:id})}),
]};
