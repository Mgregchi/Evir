// Retained centerline paint. Source v3 / runtime v2; earlier readers reject it.
export const STROKE_CAPS = ["butt", "round", "square"];
export const STROKE_JOINS = ["miter", "round", "bevel"];
export function defaultStroke(color = "#243f33") {
  return {color, width: 8, cap: "round", join: "round", dash: [], dashOffset: 0,
    trim: {start: 0, end: 1, offset: 0}};
}
export function strokeProperties(n) {
  return n.geometry?.stroke ? ["stroke.width", "stroke.color", "stroke.trimStart", "stroke.trimEnd", "stroke.trimOffset",
    ...(Array.isArray(n.geometry.stroke.dash) && n.geometry.stroke.dash.length ? ["stroke.dashOffset"] : [])] : [];
}
export function strokeValue(n, property, value) {
  const key = property.slice(7), stroke = n.geometry.stroke;
  const host = key.startsWith("trim") ? stroke.trim : stroke;
  const field = key.startsWith("trim") ? key.slice(4).toLowerCase() : key;
  if (arguments.length === 3) host[field] = field === "width" ? Math.max(0, value) :
    ["start", "end"].includes(field) ? Math.max(0, Math.min(1, value)) : value;
  return host[field];
}
export function validateStroke(n, p, problem) {
  const g = n.geometry, path = `node ${n.id}.stroke`;
  if (!Object.hasOwn(g, "stroke")) return;
  const rec = (v, label, keys) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) {problem(label, "expected object"); return false;}
    for (const k of keys) if (!Object.hasOwn(v,k)) problem(label+"."+k, "required");
    for (const k of Object.keys(v)) if (!keys.includes(k)) problem(label+"."+k,"unsupported stroke field");
    return true;
  };
  if (!p.advanced) problem(path, "native strokes require source v3 / runtime v2");
  if (g.skin) problem(path, "strokes on skinned paths are outside the tested contract");
  if (p.advanced?.feathers?.some(f => f.targetId === n.id)) problem(path, "stroke feathering is outside the tested contract");
  const s = g.stroke;
  if (!rec(s,path,["color","width","cap","join","dash","dashOffset","trim"])) return;
  if (typeof s.color !== "string" || !/^#[\da-fA-F]{6}([\da-fA-F]{2})?$/.test(s.color)) problem(path+".color", "expected hex color");
  const finite = (v,k,lo,hi) => {if (!Number.isFinite(v) || v < lo || v > hi) problem(path+"."+k,`expected number in [${lo},${hi}]`);};
  finite(s.width,"width",0,256);
  if (!STROKE_CAPS.includes(s.cap)) problem(path+".cap","expected butt, round or square");
  if (!STROKE_JOINS.includes(s.join)) problem(path+".join","expected miter, round or bevel");
  if (!Array.isArray(s.dash) || s.dash.length > 16 || s.dash.length % 2 || !s.dash.every(v => Number.isFinite(v) && v >= 1 && v <= 16384))
    problem(path+".dash","expected zero or up to sixteen paired dash/gap lengths in [1,16384]");
  finite(s.dashOffset,"dashOffset",-16384,16384);
  if (rec(s.trim,path+".trim",["start","end","offset"])) {
    finite(s.trim.start,"trim.start",0,1); finite(s.trim.end,"trim.end",0,1); finite(s.trim.offset,"trim.offset",-1,1);
  }
  // Bound effect construction using the cubic control-polygon upper bound.
  let length = 0;
  if (n.kind === "rectangle") {
    const maximum=property=>{
      let value=g[property];
      for(const a of Array.isArray(p.animations)?p.animations:[])
        for(const t of Array.isArray(a?.tracks)?a.tracks:[]) if(t?.targetId===n.id&&t.property===property)
          for(const k of Array.isArray(t.keys)?t.keys:[]) if(Number.isFinite(k?.value))value=Math.max(value,k.value);
      return value;
    };
    length=2*(maximum("width")+maximum("height"));
  }
  else if (Array.isArray(g.points)) {
    const count = g.points.length - (g.closed ? 0 : 1);
    for (let i=0;i<count;i++) {
      const a=g.points[i],b=g.points[(i+1)%g.points.length];
      if (![a?.anchor,a?.out,b?.in,b?.anchor].every(v=>Array.isArray(v)&&v.length===2)) continue;
      const controls=[a.anchor,a.out,b.in,b.anchor];
      for(let j=1;j<4;j++) length+=Math.hypot(controls[j][0]-controls[j-1][0],controls[j][1]-controls[j-1][1]);
    }
    if (g.points.length > 256) problem(path,"at most 256 centerline points per stroked path");
  }
  if (!Number.isFinite(length) || length > 16384) problem(path,"centerline control polygon exceeds the 16,384-unit effect budget");
}
