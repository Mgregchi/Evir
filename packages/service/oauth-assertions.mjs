import {createLocalJWKSet,decodeProtectedHeader,jwtVerify,errors} from 'jose';
import {hash,now,origin} from './security.mjs';
import {signingKeys} from './oauth-published.mjs';

export async function verifyClientAssertion(req,env,client,assertion){
  try{
    if(typeof assertion!=='string'||assertion.length>6144)return false;
    const header=decodeProtectedHeader(assertion);
    if(!['RS256','ES256'].includes(header.alg)||client.signingAlg&&client.signingAlg!==header.alg||typeof header.kid!=='string'||!header.kid||header.kid.length>128||['crit','jku','jwk','x5u','x5c'].some(k=>k in header))return false;
    const verify=keys=>jwtVerify(assertion,createLocalJWKSet(keys),{issuer:client.client_id,subject:client.client_id,audience:[origin(env),origin(env)+new URL(req.url).pathname],algorithms:['RS256','ES256'],maxTokenAge:'5m',clockTolerance:30,requiredClaims:['iat','exp','jti']});
    let result;try{result=await verify(await signingKeys(client));}catch(e){if(!(e instanceof errors.JWKSNoMatchingKey)||!client.jwks_uri)throw e;result=await verify(await signingKeys(client,true));}
    const p=result.payload;
    if(!Number.isInteger(p.iat)||!Number.isInteger(p.exp)||p.exp<=p.iat||p.exp-p.iat>300||typeof p.jti!=='string'||!p.jti||p.jti.length>128)return false;
    // A nonce is consumed only after signature/claim validation, atomically across
    // Worker instances. Invalid codes still need a new assertion on a later try.
    const used=await env.DB.prepare('INSERT INTO oauth_assertions VALUES (?, ?) ON CONFLICT(token_hash) DO NOTHING').bind(await hash(client.client_id+'\0'+p.jti),p.exp+30).run();
    return used.meta.changes===1;
  }catch{return false;}
}
