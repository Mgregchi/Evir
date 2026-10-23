import {HttpError} from './security.mjs';
export const scope='account:read';
export const scopes=[scope,'scene:read','scene:write','scene:control'];
export const clientAuthMethods=['none','client_secret_post','client_secret_basic'];
export function parseScopes(value=scope){
  if(typeof value!=='string')throw new HttpError(400,'Choose supported account and scene permissions.');
  const selected=value.split(' ');
  if(!selected.includes(scope)||new Set(selected).size!==selected.length||selected.some(s=>!scopes.includes(s))||selected.some(s=>['scene:write','scene:control'].includes(s))&&!selected.includes('scene:read'))throw new HttpError(400,'Choose supported account and scene permissions. Scene editing/control also require scene reading.');
  return scopes.filter(s=>selected.includes(s)).join(' ');
}
export function validRedirect(value){
  if(typeof value!=='string'||!value||value.length>2048||/[\u0000-\u0020\u007f*#]/.test(value))return false;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash;}catch{return false;}
}
