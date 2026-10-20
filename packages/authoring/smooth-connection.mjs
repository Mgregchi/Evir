// Mirror existing endpoint tangents into the new connector. The old segments
// remain unchanged. A collapsed handle falls back to one third of the chord.
export function smoothConnection(end,start){
 const chord=start.anchor.map((v,i)=>(v-end.anchor[i])/3),incoming=end.anchor.map((v,i)=>v-end.in[i]),outgoing=start.out.map((v,i)=>v-start.anchor[i]);
 const a=Math.hypot(...incoming)>1e-10?incoming:chord,b=Math.hypot(...outgoing)>1e-10?outgoing:chord;
 end.out=end.anchor.map((v,i)=>v+a[i]);start.in=start.anchor.map((v,i)=>v-b[i]);
}
