// Web composition only. Authentication and MCP implementations belong to the service package.
import {fetchService,cleanup} from '@evir/service';
export default {
  async fetch(request,env) {
    const service=await fetchService(request,env);if(service)return service;
    const asset=await env.ASSETS.fetch(request);
    // Add account discovery only on the service-enabled host; static-only hosts stay unchanged.
    if(env.DB&&asset.status===200&&asset.headers.get('Content-Type')?.includes('text/html'))
      return new HTMLRewriter()
        .on('nav#site-nav',{element:e=>e.append('<a href="/account/">Connections</a>',{html:true})})
        .on('#project-file-actions',{element:e=>e.append('<a href="/account/" target="_blank" rel="noopener" aria-label="Account and agent connections (opens in a new tab)">Account &amp; agent connections</a>',{html:true})})
        .transform(asset);
    return asset;
  },
  async scheduled(_event,env,ctx) { ctx.waitUntil(cleanup(env)); },
};
