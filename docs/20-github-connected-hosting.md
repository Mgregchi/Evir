# Deploy the web app from GitHub

**One repository connection, one hosting project, one output:** `apps/web/dist`.

The web build imports `@evir/studio` and includes its workspace at `/editor/studio/`. `/editor/` remains the public landing page. Studio and the engine remain separate packages; they do not need separate hosting projects.

## Environment

The public address defaults to `https://evir.idey.click/`. To use a different domain or subdirectory, set `SITE_URL` in the web project's **build environment**, for example:

```dotenv
SITE_URL=https://evir.idey.click/
```

This is the full public address, including any subdirectory. GitHub project hosting could use `https://mgregchi.github.io/Evir/`; Studio then lives at `/Evir/editor/studio/` automatically. Without an override, canonical metadata, link-preview images and the sitemap use the default public address; navigation and Studio still work on the current host. No `STUDIO_URL` or editor/base-path variables are needed.

Optional `COMMUNITY_URL`, `FEEDBACK_URL`, newsletter/social/contact URLs also go on this same web project. See [the optional-link list](../apps/web/README.md#optional-public-links). These are public build-time settings; rebuild after changing them. Never put credentials here.

## Cloudflare Workers

For the existing `evir` Worker, open **Workers & Pages → evir → Settings → Builds**. Connect GitHub repository `Mgregchi/Evir` and configure:

| Field | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `apps/web` |
| Build command | `npm --prefix ../.. ci && npm --prefix ../.. run web:build` |
| Deploy command | `npm --prefix ../.. run cloudflare:deploy` |
| Non-production builds/previews | Disable for the production account service |

Create a D1 database named `evir-accounts` in the Cloudflare dashboard first. Copy its UUID into **Build Variables and Secrets** as `D1_DATABASE_ID`. Give the connected build API token **Account → D1 → Edit** permission (Cloudflare’s documented default token omits it). The deploy command applies pending migrations automatically before publishing; no local Wrangler setup or SQL console steps are needed. See [the account setup guide](53-cloudflare-accounts-and-mcp.md) for runtime settings, connection callbacks and failure recovery.

Under **Build Variables and Secrets**, add `NODE_VERSION=24` and `SKIP_DEPENDENCY_INSTALL=1`; add `SITE_URL` only to override the default public address. Optional links belong here too, rather than Worker runtime bindings. Account settings such as `OAUTH_CLIENTS` belong in the Worker’s runtime **Variables and Secrets**. Dashboard variables and secrets are preserved on deployment (`keep_vars` and `--keep-vars`); the repository contains no value overrides. The command installs from the root lockfile, then builds the web app; Wrangler serves `./dist` beside its app configuration.

Build/deploy, then use **Domains → Add Domain** to connect the public hostname. **Studio needs no separate Worker, path route or proxy:** its files are inside the same web output. The Worker name must match `name` in `apps/web/wrangler.jsonc` (currently `evir`).

For a new project, use **Create application → Import a repository → GitHub** with the same settings. If a preview reports “This Worker does not exist on your account”, check the selected account, connected Worker and configured name.

## Netlify

This hosts the frontend only. The passkey/D1/MCP account service requires the Cloudflare Worker setup above; it does not run on Netlify.

Use **Add new project → Import an existing project → GitHub**, authorize `Mgregchi/Evir`, and configure:

| Field | Value |
| --- | --- |
| Branch | `main` |
| Base directory | Empty (repository root) |
| Package directory | `apps/web` |
| Build command | `npm run web:build` |
| Publish directory | `apps/web/dist` |

The package directory selects `apps/web/netlify.toml`; installation uses the root lockfile. The file already sets Node 24 and filters builds to web/Studio/shared dependencies. Under **Environment variables**, put any `SITE_URL` override and optional links in **Builds** scope. Deploy and add your hostname under **Domain management**.

Studio is a directory in this same output. Do not add an external editor proxy or a blanket SPA rewrite to `/index.html`.

## Cloudflare Pages

This hosts the frontend only. Use Workers above for the passkey/D1/MCP account service.

Use **Create application → Pages → Connect to Git**, select `Mgregchi/Evir`, and configure:

| Field | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Root directory | Empty |
| Build command | `npm ci && npm run web:build` |
| Output directory | `apps/web/dist` |

Set `NODE_VERSION=24` and `SKIP_DEPENDENCY_INSTALL=1` in the project's build environment; add `SITE_URL` only to override the default address. Deploy and connect the hostname under **Custom domains**. Pages serves the public pages and Studio from the same output.

## Updating an existing deployment

Change old `apps/site` root/package/output settings to the web settings above. Replace old build commands with `web:build`. One web deployment replaces the two frontend deployments.

Remove `STUDIO_URL`, `PUBLIC_EDITOR_URL`, `EDITOR_PUBLIC_SITE_URL` and `EDITOR_BASE_PATH`; the web build does not use them. Legacy `PUBLIC_SITE_URL` plus `PUBLIC_BASE_PATH` still work, but one full `SITE_URL` is the preferred replacement. Existing optional `PUBLIC_*` links are also accepted; new setup uses the plain names in the web environment example.

If you previously installed a Studio Worker route or Netlify proxy, remove that rule after deploying the combined output so it cannot intercept the new local files. Do not delete an old Studio deployment until users have downloaded projects stored on its origin. Moving to another origin does not transfer browser storage; changing only the path on the same origin retains it.

GitHub Pages uses the supplied workflow and publishes this same web artifact. Its Pages metadata supplies the public origin/path when `SITE_URL` is not configured explicitly.

## Check before sharing

- The provider deployed the intended commit successfully.
- `/`, `/product/` and `/editor/` load; launch buttons open `/editor/studio/` on the same origin.
- Studio loads its modules/styles/icons, opens/saves a project, exports `.riv`, and its home link returns to the web home.
- `/editor/studio` redirects to the directory URL with its trailing slash. Missing pages/assets return 404.

No live hosting account, domain or deployment was changed by this repository update. Preview navigation stays on its own host because launch/home links are relative to the web route.

## References

The settings follow the providers' official Git/monorepo/static-asset documentation:

- Cloudflare [Workers Git builds](https://developers.cloudflare.com/workers/ci-cd/builds/), [build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/) and [static assets](https://developers.cloudflare.com/workers/static-assets/).
- Cloudflare Pages [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [monorepos](https://developers.cloudflare.com/pages/configuration/monorepos/) and [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).
- Netlify [monorepos](https://docs.netlify.com/build/configure-builds/monorepos/), [file configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/) and [build filtering](https://docs.netlify.com/build/configure-builds/ignore-builds/).

## Link previews

The public pages ship Open Graph and X image tags in the initial HTML, without JavaScript. The preview uses `/assets/evir-showcase.jpg`, a 1200×630 JPEG. Builds default to `https://evir.idey.click/` so leaving `SITE_URL` empty no longer removes the image tags. Use the single `SITE_URL` override for another public domain, then rebuild and deploy. Setting it as a Worker runtime binding cannot change already-built HTML.

For an older deployment missing image tags, an immediate workaround is to set `SITE_URL=https://evir.idey.click/` in **Build Variables and Secrets** and trigger a new build. The default-address fix applies automatically when its PR is merged and the GitHub-connected build redeploys.

Check the deployed page source for `og:image` and `twitter:image` (not just the browser's JavaScript DOM), and open the absolute JPEG address. Both should return HTTP 200 without login or a bot challenge. LinkedIn's [Post Inspector](https://www.linkedin.com/post-inspector/) can request a new inspection after deployment. Other services may retain an earlier empty preview; create a fresh share after deployment. If it remains stale, try a one-time query such as `?preview=2` on the page URL to distinguish it from the previously shared link. This is a cache retry, not a substitute for correct image tags.

Studio and 404 pages remain `noindex`; share `/editor/` when introducing Studio, rather than its workspace route.
