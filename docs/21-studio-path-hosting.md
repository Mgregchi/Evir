# Serve Studio at `/editor/studio/` on the public domain

This is an alternative to a Studio subdomain. First complete [the GitHub-connected setup](20-github-connected-hosting.md). Keep its two applications and build/output settings. The public host adds a routing layer for the editor path; site changes and editor changes still build and deploy independently.

| Browser URL | Application |
| --- | --- |
| `https://yourdomain.com/` | Public home |
| `https://yourdomain.com/product/` | Product overview |
| `https://yourdomain.com/editor/` | Public editor landing |
| `https://yourdomain.com/editor/studio/` | Full Studio workspace |

Set the same two **build-time** values on both hosting projects, then rebuild:

```dotenv
SITE_URL=https://yourdomain.com/
STUDIO_URL=https://yourdomain.com/editor/studio/
```

The builds derive `/editor/studio` from `STUDIO_URL`. Continue publishing `apps/editor/dist` as the editor project's root. The route/proxy must map `/editor/studio/studio.mjs` to `/studio.mjs` and do the same for the remaining assets. URL settings do not create hosting routes.

## Netlify public host

1. Complete [the two-project setup](20-github-connected-hosting.md) and obtain the editor's actual HTTPS origin, such as `https://your-editor-project.netlify.app`. For two Netlify projects, both must belong to the same Netlify team; Netlify blocks proxies between teams and into separately password-protected sites.
2. Add these blocks to **the public site's** `apps/site/netlify.toml`, replacing the example editor origin with the actual one. Keep the existing build settings. Commit/push the routing configuration and let GitHub-connected deployment rebuild the public project.

```toml
[[redirects]]
from = "/editor/studio"
to = "/editor/studio/"
status = 301
force = true

[[redirects]]
from = "/editor/studio/*"
to = "https://your-editor-project.netlify.app/:splat"
status = 200
force = true
```

3. Apply the two URL values above and rebuild the editor too. Visit the public `/editor/` landing and launch Studio.

The first rule makes the trailing slash explicit so relative module/style URLs resolve under the Studio mount. The second is a proxy rewrite: the browser keeps the public domain while Netlify strips the mount and fetches the editor project. It covers modules, styles, icons and error responses, not just the editor HTML. Keep these specific rules before any broad redirect rules; no blanket SPA fallback is needed. Netlify's `to` is routing configuration with a literal upstream URL, not an interpolation of `STUDIO_URL`.

## Cloudflare Workers: use Add Domain and Add Route

The **Domains** screen for a Worker exposes **Custom Domains and Routes → Add Route / Add Domain**. These controls support this arrangement with the two application Workers in the setup guide; a third router is not required when the editor Worker serves its own assets.

| Application Worker | Domain/route |
| --- | --- |
| Public `evir` | **Add Domain:** `yourdomain.com` |
| Editor `evir-studio` | **Add Route:** `yourdomain.com/editor/studio*`, zone `yourdomain.com` |

The domain attaches a hostname to the public Worker. The more specific path route sends Studio requests to the editor Worker on that hostname. A route selects a Worker and preserves the requested path, so the editor Worker also needs a small handler to map `/editor/studio/studio.mjs` to its own `/studio.mjs` asset. This is hosting code; the editor and engine retain their existing ownership/build boundaries.

1. Deploy the two GitHub-connected Workers using the [Cloudflare Workers settings](20-github-connected-hosting.md#cloudflare-workers). Apply the same-domain frontend variables above and rebuild both. Use the public Worker's **Add Domain** button to attach the public hostname. Zone routes require a domain you manage in Cloudflare and its proxied hostname; `evir.mgregchi.workers.dev` is a provider address, not a zone you own for adding another Worker's path route.
2. Add `apps/editor/cloudflare-worker.mjs` with the following module. This is a setup example to copy into the repository when configuring this hosting mode; the guide update itself does not install or deploy the handler.

```js
export default {
  async fetch(request, env) {
    const mount = '/editor/studio';
    const url = new URL(request.url);
    if (url.pathname === mount) {
      return new Response(null, {
        status: 308, headers: { Location: mount + '/' + url.search },
      });
    }
    const mounted = url.pathname.startsWith(mount + '/');
    if (!mounted && url.pathname.startsWith(mount)) {
      return new Response('Not found', { status: 404 });
    }
    if (mounted) url.pathname = url.pathname.slice(mount.length);
    const assetRequest = new Request(new Request(url, request), {
      redirect: 'manual',
    });
    const response = await env.ASSETS.fetch(assetRequest);
    const location = response.headers.get('Location');
    if (!mounted || !location) return response;
    const destination = new URL(location, url);
    if (destination.origin !== url.origin) return response;
    const headers = new Headers(response.headers);
    headers.set('Location', mount + destination.pathname +
      destination.search + destination.hash);
    return new Response(response.body, {
      status: response.status, statusText: response.statusText, headers,
    });
  },
};
```

3. Update **the editor's** `apps/editor/wrangler.jsonc` to include the module, asset binding and route. Replace the example hostname/zone:

```json
{
  "name": "evir-studio",
  "main": "cloudflare-worker.mjs",
  "compatibility_date": "2026-10-09",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": true,
    "not_found_handling": "404-page"
  },
  "routes": [
    { "pattern": "yourdomain.com/editor/studio*", "zone_name": "yourdomain.com" }
  ]
}
```

`binding` exposes the editor's files as `env.ASSETS`; `run_worker_first` lets the handler remove the mount before the asset lookup. The handler also allows root requests on the editor's own provider URL for checking that deployment. Missing assets retain the editor's 404 response. The `routes` entry keeps the path route in GitHub so later deployments retain it.

4. Commit/push these hosting changes and let the existing editor Git integration build/deploy them. The root/build/deploy settings stay the same. On **the editor Worker's** Domains screen, **Add Route** uses the pattern/zone above; the equivalent route is declared in the file for ongoing GitHub deployments. **Do not assign the Studio route to the public `evir` Worker**, which contains the public-site assets. For `www.yourdomain.com`, change the route pattern's hostname while keeping the zone name `yourdomain.com`.
5. Verify the complete path after deployment. Query strings are preserved, asset redirects stay under the public mount, and 404/status/MIME headers are retained. `/editor/` remains the public landing page. No extra frontend CORS setting is required: visitors load the files at the public hostname.

If the public site is Cloudflare Pages on a custom hostname, an editor Worker can similarly use a route on that proxied hostname. If **both applications are Pages projects**, a routing Worker or Pages Function must proxy to the editor project instead: Pages `_redirects` cannot proxy another domain. On provider-issued `workers.dev` URLs without a custom zone, the public Worker can use a [service binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/http/) to forward Studio paths to the editor Worker; that is a different handler from the zone-route recipe above. The provider-root subdomain arrangement remains available during initial setup.

## Check the mounted application

- `/editor/studio` redirects to `/editor/studio/`, including when a query string is present.
- `/editor/` still shows the public landing; its launch link opens the mounted application.
- The stage loads, including `studio.mjs`, `studio.css` and icons under `/editor/studio/`; a missing asset returns 404.
- Save/open an editable example, export `.riv`, and confirm the editor's home link returns to `/`.
- Rebuild either application independently and confirm the configured routing still reaches its current deployment.

Use the public mounted URL consistently. Opening the editor's provider origin directly uses a different browser-storage origin. Before switching from a Studio subdomain/provider origin to the public domain, download existing projects and reopen them at the new address. Changing only the path on an unchanged origin retains that origin's local storage; moving origins does not.

## References and verification

Checked against official documentation on 9 October 2026:

- [Netlify proxy rewrites](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/) and [redirect options](https://docs.netlify.com/manage/routing/redirects/redirect-options/).
- Cloudflare [routes](https://developers.cloudflare.com/workers/configuration/routing/routes/), [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [asset bindings](https://developers.cloudflare.com/workers/static-assets/binding/) and [Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).
- [Pages rewrite limitations](https://developers.cloudflare.com/pages/configuration/redirects/).

The handler was checked with Wrangler 4.149.0's local runtime and a browser: scripts/styles/icons, slash/query redirects, 404, project open/save and byte-identical `.riv` export passed. Focused checks covered redirect rewriting and response preservation. Netlify's rules parsed correctly; live provider routing and account/DNS settings still need deployment checks. No production deployment was changed.
