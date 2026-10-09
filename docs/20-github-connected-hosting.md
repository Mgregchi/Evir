# Connect Evir to Cloudflare or Netlify through GitHub

Use this guide to have the hosting provider clone, build and deploy from `Mgregchi/Evir` automatically. You do not build locally or upload `dist` for this workflow. These instructions were checked against the providers' official Git/monorepo documentation on 9 October 2026.

Create **two hosting projects connected to the same repository**:

| Project | Example address | Contents |
| --- | --- | --- |
| Evir public site | `https://yourdomain.com` | Home, `/product/`, `/editor/` landing, examples and community pages |
| Evir Studio | `https://studio.yourdomain.com` | The actual editor application |

Use `main` as the production branch for both. PR branches can have preview deployments. Cloudflare/Netlify run their own builds; GitHub Actions does not have to deploy to them. This connection does not publish runtime npm packages. You may host both apps with either provider, or one app with each; configure their actual URLs as described below.

## Settings shared by both providers

The repository's dependency installation must use the **repository root** and its `package-lock.json`, because both applications import local npm workspaces. Netlify and Cloudflare Pages use the following layout; the separate Workers setup later has different working-directory commands.

| Dashboard setting | Public-site project | Editor project |
| --- | --- | --- |
| Repository | `Mgregchi/Evir` | `Mgregchi/Evir` |
| Production branch | `main` | `main` |
| Base/root directory | Leave empty: repository root | Leave empty: repository root |
| Application build command | `npm run site:build` | `npm run editor:build` |
| Publish/output directory | `apps/site/dist` | `apps/editor/dist` |
| Node version | `24` | `24` |

Use paths without a leading `/`. A root/base directory of `apps/site` or `apps/editor` would change how these commands and publish paths resolve. On Netlify, **package directory** is a different setting: set that to the application directory while leaving **base directory** empty.

## Public environment variables and the first deployment

Enter values in each hosting project's **build environment**, not only in a Worker runtime binding or a GitHub Actions variable. Evir reads them during the build; changing a value requires a new deployment. Local `.env` files are ignored by Git and are not present in a provider checkout.

Replace the example URLs below with your real addresses. Provider-issued `*.pages.dev`, `*.workers.dev` or `*.netlify.app` HTTPS URLs work before you have a domain.

| Project | Variable | Example value |
| --- | --- | --- |
| Public site | `PUBLIC_SITE_URL` | `https://yourdomain.com` |
| Public site | `PUBLIC_EDITOR_URL` | `https://studio.yourdomain.com/` |
| Public site | `PUBLIC_BASE_PATH` | Leave empty: site served from the origin root |
| Editor | `EDITOR_PUBLIC_SITE_URL` | `https://yourdomain.com/` |
| Editor | `EDITOR_BASE_PATH` | Leave empty: editor served from the subdomain root |

`PUBLIC_SITE_URL` accepts an origin only, without `/editor` or another path. `/editor/` remains a page on the public site; it is not the full application's publish directory. Do not use the GitHub Pages `/Evir/` base path for a provider domain served from its root.

If the final addresses are not known before the first deployment, create the editor project first, then copy its actual HTTPS URL into the public project's `PUBLIC_EDITOR_URL`. Once the public project has a URL, set `PUBLIC_SITE_URL` on that project and `EDITOR_PUBLIC_SITE_URL` on the editor project, and rebuild both. Until you finish this wiring, the local defaults can point launch/home links at localhost. Use the completed deployment checklist below before sharing the site.

Optional public-site variables include `PUBLIC_COMMUNITY_URL`, `PUBLIC_FEEDBACK_URL`, `PUBLIC_NEWSLETTER_URL`, `PUBLIC_DOCS_URL`, `PUBLIC_CONTACT_URL` and social URLs. Their full meanings/defaults are in [the site environment guide](../apps/site/README.md#frontend-environment-settings). No Evir backend, Rive login, database or model-provider key is needed for these apps.

## Cloudflare Pages: GitHub-connected setup

1. Sign in to Cloudflare and open **Workers & Pages → Create application → Pages → Connect to Git**. Choose the Pages flow; the **Import a repository** Workers flow uses the different settings later in this guide.
2. Select GitHub, authorize Cloudflare's GitHub integration for `Mgregchi/Evir`, then select that repository. If it is missing, edit the GitHub app's repository access.
3. Give the public project a unique name, such as `evir-web`, and set **Production branch** to `main`.
4. Set **Framework preset** to **None**, leave **Root directory (advanced)** empty, set **Build command** to `npm ci && npm run site:build`, and **Build output directory** to `apps/site/dist`.
5. Add `NODE_VERSION=24`, `SKIP_DEPENDENCY_INSTALL=1`, and the public-site URL variables above. Skipping the provider's automatic install lets the explicit `npm ci` use the pinned lockfile once. Set the corresponding public values for **Production** and **Preview** build environments.
6. Select **Save and Deploy**. Cloudflare clones GitHub, installs dependencies, builds the site and publishes the generated directory. Inspect its build log and record the actual `pages.dev` URL.
7. Create a second Pages project from the **same repository** for Studio, for example `evir-studio-web`. Use the same settings except **Build command** is `npm ci && npm run editor:build`, output is `apps/editor/dist`, and the URL variables are the editor variables.
8. Complete the URL wiring, rebuild as needed, then open **Custom domains** on each project to connect your domain and editor subdomain. Follow the dashboard's DNS instructions for your domain provider.

For an existing Pages project, edit its build configuration and environment variables under **Settings**, then retry the build. An environment change does not alter an already deployed bundle.

To avoid rebuilding both apps for every change, set **Settings → Build → Build watch paths** independently. Remove the default catch-all `*` include and use these include paths; leave excludes empty:

| Project | Include paths |
| --- | --- |
| Public site | `apps/site/*`, `assets/brand/*`, `packages/project-model/*`, `packages/runtime/*`, `packages/renderer-canvas/*`, `tools/build-support.mjs`, `package.json`, `package-lock.json` |
| Editor | `apps/editor/*`, `assets/brand/*`, `packages/project-model/*`, `packages/runtime/*`, `packages/renderer-canvas/*`, `packages/authoring/*`, `packages/format/*`, `tools/build-support.mjs`, `package.json`, `package-lock.json` |

Pages' `*` matches nested paths. Shared model/runtime changes rebuild the consuming apps; a public-page-only change does not rebuild Studio. Manual retries and some large/empty pushes can bypass provider path filtering.

## Existing Cloudflare Workers integration

The repository has reported a **`Workers Builds: evir`** check. That is a Workers Git integration, not a Pages project. If you want to keep it, use these settings for the supplied static-assets Wrangler files rather than entering a Pages publish directory.

Open **Workers & Pages → your Worker → Settings → Builds/Build** and edit its connected Git repository/build settings. For a new Worker, use **Create application → Import a repository → GitHub**, select `Mgregchi/Evir` and configure the same settings.

| Setting | Public-site Worker | Editor Worker |
| --- | --- | --- |
| Worker name | `evir` | `evir-studio` |
| Production branch | `main` | `main` |
| Root directory | `apps/site` | `apps/editor` |
| Build command | `npm --prefix ../.. ci && npm --prefix ../.. run site:build` | `npm --prefix ../.. ci && npm --prefix ../.. run editor:build` |
| Production deploy command | `npx wrangler deploy --config wrangler.jsonc` | `npx wrangler deploy --config wrangler.jsonc` |
| Build variables | `NODE_VERSION=24`, `SKIP_DEPENDENCY_INSTALL=1`, public-site variables | `NODE_VERSION=24`, `SKIP_DEPENDENCY_INSTALL=1`, editor variables |

The build commands deliberately return to the repository root for installation/building, while Wrangler runs beside each app's configuration and `dist` directory. `wrangler.jsonc` selects static assets from `./dist`; there is no Pages publish-directory field in this workflow. **The Worker name in Cloudflare must match the configuration's `name`.** If you choose different Worker names, update those configuration names in Git first.

Set frontend values in **Build Variables and Secrets**, not just Worker runtime variables. For nonproduction branches, current Workers Builds uses a separate **Preview command**; leave it at `npx wrangler preview --config wrangler.jsonc` or keep previews disabled during initial setup. A production `wrangler deploy` command should not be used as the preview command. Manage custom domains separately on each Worker after its provider URL works.

The earlier failed Workers check contained only a dashboard link, so its cause is unconfirmed. Open that build's log and compare its root directory, install/build command, configuration name and deploy command with this table. Saving configuration applies it to subsequent builds/retries. Do not assume a local build proves account permissions or deployment success.

## Netlify: GitHub-connected setup

1. Sign in to Netlify, choose your team, then **Add new project → Import an existing project → GitHub**. Authorize Netlify's GitHub app for `Mgregchi/Evir`, and select the repository.
2. Deploy the public application first or Studio first. If Netlify detects multiple workspaces, select the app under **Site to deploy**. Otherwise select **Other (configure manually)** and use the explicit settings below.
3. Set **Branch to deploy** to `main`. Leave **Base directory** empty, set **Package directory** to `apps/site` for the public project, use **Build command** `npm run site:build`, and **Publish directory** `apps/site/dist`.
4. Netlify finds [apps/site/netlify.toml](../apps/site/netlify.toml) through that package-directory setting. It installs dependencies at the repository root, uses Node 24, runs the site's build and deploys its output. File settings override equivalent dashboard settings; check the resolved settings in the deployment log.
5. Add the public-site URL variables in **Environment variables**, with **Builds** scope and values for **Production** and **Deploy Previews** where those options are available. Deploy the project and record its actual `netlify.app` URL.
6. Use **Add new project → Import an existing project** again with the same repository to create Studio. Keep **Base directory** empty; change **Package directory** to `apps/editor`, command to `npm run editor:build` and publish directory to `apps/editor/dist`. Netlify then reads [apps/editor/netlify.toml](../apps/editor/netlify.toml). Add the editor URL variables.
7. Complete the URL wiring and rebuild both as needed. Use **Domain management** on each project to add the public domain and editor subdomain, following Netlify's DNS/HTTPS instructions.

For an existing Netlify project, use **Project configuration → Developer settings → Continuous deployment → Build settings** to edit base/package/build/publish values. The package directory is a dashboard setting; the two `netlify.toml` files do not set it for you.

Each config also contains an `ignore` command scoped to its app and shared dependencies. Netlify's convention is **exit 0 skips**, **exit 1 builds**. Missing/unknown cached Git revisions proceed with a build. Equal current/cached revisions also build: Netlify supplies equal revisions for uncached builds, and rebuilding a commit must apply changed environment settings. This keeps public-only changes from rebuilding the editor; the first deployment still builds. Keep the base directory at repository root so those Git paths and publish paths resolve correctly.

## Previews, domains and deployment checks

Production deploys follow pushes to `main`; provider preview settings control other branches/PRs. Give preview builds the required frontend variables too. Site previews use the explicitly configured `PUBLIC_EDITOR_URL`; they do not automatically discover or pair with the editor preview for the same PR. You can use the stable editor URL initially or set a matching preview URL deliberately.

Cloudflare/Netlify's Git integrations do not require Evir-specific tokens in GitHub Actions. Authorization happens through the hosting provider and its GitHub app. The existing GitHub Pages workflow remains a separate destination; you do not need to enable it to use either provider. Each hosted app gets its own project/domain settings.

Before announcing a deployment:

1. Confirm the deployed commit matches the intended `main` revision and that both provider builds succeeded.
2. Open the public home, `/product/` and `/editor/`; launch Studio and confirm it opens the configured HTTPS editor address.
3. Confirm the editor's brand/home link returns to the public site. Check that neither link points at localhost.
4. Load an original example in Studio, save/open an editable project and export `.riv`; check public live previews and feedback links.
5. Open a nonexistent URL on each app: it should be a 404, not an unrelated editor/home page. These are static builds; do not add a blanket SPA rewrite to `/index.html`.
6. After changing domains, update the frontend URL variables and rebuild. Download existing editor projects before changing its origin, because browser storage is origin-specific.

The workspace can validate commands/configuration locally, but account authorization, DNS, provider UI settings and deployed URLs require checks in your connected hosting account. No account or production deployment was created by these instructions.

Local verification for this guide: both app-root installation/build commands completed with the pinned lockfile and included the configured HTTPS URLs. Wrangler 4.149.0 dry runs resolved the correct static-assets directory for each app; no upload occurred. Both Netlify files parsed, and their ignore commands passed 18 real Git path-change cases plus 6 missing/unknown/equal-revision cases. Account connection, actual provider builds and DNS remain checks to perform after following the dashboard setup.

## Official references

- [Cloudflare Pages GitHub integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Pages monorepos](https://developers.cloudflare.com/pages/configuration/monorepos/), [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [build image/Node settings](https://developers.cloudflare.com/pages/configuration/build-image/) and [watch paths](https://developers.cloudflare.com/pages/configuration/build-watch-paths/)
- [Workers Git-connected builds](https://developers.cloudflare.com/workers/ci-cd/builds/), [build settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) and [build variables/image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)
- [Netlify Git workflows](https://docs.netlify.com/build/git-workflows/overview/), [monorepos](https://docs.netlify.com/build/configure-builds/monorepos/), [configuration files](https://docs.netlify.com/build/configure-builds/file-based-configuration/) and [Node/dependency installation](https://docs.netlify.com/build/configure-builds/manage-dependencies/)
- [Netlify ignore-command behavior](https://docs.netlify.com/build/configure-builds/ignore-builds/) and [built-in Git revision variables](https://docs.netlify.com/build/configure-builds/environment-variables/)
