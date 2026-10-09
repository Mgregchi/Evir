# Deploy from GitHub

Create two hosting projects from `Mgregchi/Evir`, both using production branch `main`:

- **Public site** builds `apps/site`: home, product, community and `/editor/` landing pages.
- **Studio** builds `apps/editor`: the actual editor workspace.

The provider builds from GitHub; you do not upload a local `dist`. Use the section for your provider below. Your existing `evir` deployment is **Cloudflare Workers**.

## Two addresses, the same on both projects

Set these in the **build environment of both hosting projects**:

| Variable | What to enter | Example |
| --- | --- | --- |
| `SITE_URL` | Full address of the public website | `https://yourdomain.com/` |
| `STUDIO_URL` | Full address where visitors open the editor workspace | `https://studio.yourdomain.com/` |

The site uses `SITE_URL` for page links/search metadata and `STUDIO_URL` for its launch buttons. Studio uses `SITE_URL` for its home link and the path in `STUDIO_URL` for its mount. Include any subdirectory in the full URL. **There are no separate base-path settings to enter.**

For example, a GitHub project site uses `SITE_URL=https://mgregchi.github.io/Evir/`. A mounted editor uses `STUDIO_URL=https://yourdomain.com/editor/studio/`. `/editor/` is the public landing page, so do not use it as the workspace address.

Provider URLs (`workers.dev`, `pages.dev`, `netlify.app`) work before you connect a domain. Deploy both projects, copy their actual addresses into these two variables on both projects, then rebuild. For custom domains, attach the domains in the provider dashboard and update the same two values. Neither variable contains a secret.

**Optional links belong only on the public-site project.** Add `COMMUNITY_URL`, `FEEDBACK_URL`, `NEWSLETTER_URL` or social/contact links when you have them. Studio needs none of these. See [the site's optional-link list](../apps/site/README.md#optional-public-site-links); empty values use the documented defaults or hide the link.

## Cloudflare Workers

This matches the **Domains → Add Domain / Add Route** screen you shared.

1. Open **Workers & Pages → evir → Settings → Builds** for the existing public Worker. Connect GitHub repository `Mgregchi/Evir` if needed. Create another Worker from the same repository for Studio using **Create application → Import a repository → GitHub**.
2. Set production branch `main` and these fields:

| Field | Public site | Studio |
| --- | --- | --- |
| Worker name | `evir` | `evir-studio` |
| Root directory | `apps/site` | `apps/editor` |
| Build command | `npm --prefix ../.. ci && npm --prefix ../.. run site:build` | `npm --prefix ../.. ci && npm --prefix ../.. run editor:build` |
| Deploy command | `npx wrangler deploy --config wrangler.jsonc` | `npx wrangler deploy --config wrangler.jsonc` |

3. Under **Build Variables and Secrets**, add the same `SITE_URL` and `STUDIO_URL` to both projects, plus `NODE_VERSION=24` and `SKIP_DEPENDENCY_INSTALL=1`. These are build variables, not Worker runtime bindings. Optional community links go on `evir` only.
4. Build/deploy both. Leave the nonproduction **Preview command** at `npx wrangler preview --config wrangler.jsonc`, or disable previews for initial setup.
5. For separate domains, use **Domains → Add Domain**: the public hostname on `evir`, the Studio hostname on `evir-studio`. Update the two URL values and rebuild both.

Worker names must match each app's `wrangler.jsonc`. The commands install at the repository root but run Wrangler beside the app's `dist`. There is no Pages publish-directory field here.

## Netlify

1. Choose **Add new project → Import an existing project → GitHub**, authorize `Mgregchi/Evir`, and create the public-site project. Repeat for Studio with the same repository and branch `main`.
2. Configure each project:

| Field | Public site | Studio |
| --- | --- | --- |
| Base directory | Empty (repository root) | Empty (repository root) |
| Package directory | `apps/site` | `apps/editor` |
| Build command | `npm run site:build` | `npm run editor:build` |
| Publish directory | `apps/site/dist` | `apps/editor/dist` |

3. Under **Environment variables**, give both projects the same `SITE_URL` and `STUDIO_URL` with **Builds** scope. Optional community links go on the public project only. Each app's `netlify.toml` already sets Node 24 and build filtering.
4. Deploy, complete the URL values with the actual provider addresses, and rebuild. Connect separate public/Studio domains under **Domain management**, then update the values if the addresses change.

**Base directory** and **Package directory** are different Netlify fields. The root lockfile owns installation; the package directory selects the app's `netlify.toml`. Check the resolved settings in the build log because file settings override matching dashboard settings.

## Cloudflare Pages (alternative to Workers)

Use **Create application → Pages → Connect to Git** to create two projects from the repository and branch `main`:

| Field | Public site | Studio |
| --- | --- | --- |
| Framework preset | None | None |
| Root directory | Empty | Empty |
| Build command | `npm ci && npm run site:build` | `npm ci && npm run editor:build` |
| Output directory | `apps/site/dist` | `apps/editor/dist` |

Set the same two URL values, `NODE_VERSION=24` and `SKIP_DEPENDENCY_INSTALL=1` in each project's build environment. Deploy, wire the actual addresses, and rebuild. Connect separate hostnames under each project's **Custom domains**. This Pages flow is separate from the existing Workers deployment.

For optional Pages build filtering, consult the linked official watch-path documentation. Netlify's supplied app configs already filter unrelated changes.

## Serve Studio at `/editor/studio/` on the public domain

Keep the same two projects and set `STUDIO_URL=https://yourdomain.com/editor/studio/` on both. Then follow [the path-routing recipe](21-studio-path-hosting.md). Cloudflare needs the editor's asset handler and path route; Netlify needs a proxy rewrite. Setting a URL alone does not create a route. `/editor/` remains the public landing page.

## Check before sharing

- Both provider builds succeeded and published the intended commit.
- The public home and `/editor/` landing load; launch buttons open Studio.
- Studio loads its stage, opens/saves a project, exports `.riv`, and its home link returns to the public site.
- No production links point to localhost. Missing URLs return 404.

Rebuild after changing environment values. Copy the required values into preview build environments too; public previews use the configured Studio address rather than automatically discovering a matching editor preview. Before moving Studio to a different domain, download existing projects: browser storage belongs to the old origin.

If a provider build fails, open its build log first. The earlier `Workers Builds: evir` check exposed only a dashboard link, so its cause is still unconfirmed. Local checks do not establish provider-account authorization or DNS success.

## Existing settings

Older deployments keep working. You can replace them with the two names above and remove the old entries:

| Old setting | Replacement |
| --- | --- |
| Site's `PUBLIC_SITE_URL` + `PUBLIC_BASE_PATH` | One full `SITE_URL`, including the path |
| Site's `PUBLIC_EDITOR_URL` | `STUDIO_URL` |
| Studio's `EDITOR_PUBLIC_SITE_URL` | The same `SITE_URL` |
| Studio's `EDITOR_BASE_PATH` | Derived from `STUDIO_URL`; remove it |
| Optional `PUBLIC_COMMUNITY_URL`, etc. | `COMMUNITY_URL`, etc. on the public project |

Nonempty new values take precedence over their old equivalents. New setup does not require the old names.

## References

Provider settings and routing behavior were checked against official documentation on 9 October 2026:

- Cloudflare [Workers Git builds](https://developers.cloudflare.com/workers/ci-cd/builds/), [build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/) and [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
- Cloudflare Pages [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [monorepos](https://developers.cloudflare.com/pages/configuration/monorepos/), [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [build image](https://developers.cloudflare.com/pages/configuration/build-image/) and [watch paths](https://developers.cloudflare.com/pages/configuration/build-watch-paths/).
- Netlify [monorepos](https://docs.netlify.com/build/configure-builds/monorepos/), [file configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/), [dependency installation](https://docs.netlify.com/build/configure-builds/manage-dependencies/), [build filtering](https://docs.netlify.com/build/configure-builds/ignore-builds/) and [revision variables](https://docs.netlify.com/build/configure-builds/environment-variables/).
