# Evir public site

Eleven static public pages: home, product, the `/editor/` Studio landing page, examples, learn, community, roadmap, updates, about, contribute and privacy. The editor application is a separate build at its configured URL. The site includes two independently authored editable examples and uses the shared runtime/Canvas2D APIs for live previews. No server, account, analytics service or AI provider is required.

The public home, `/product/` showcase and `/editor/` landing page ship independently from Studio and runtime package releases. The former `/studio/` public route redirects to `/editor/`. See [the boundary decision](../../docs/18-architecture-boundaries-and-deployment.md) and [implemented migration](../../docs/19-workspace-migration.md).

## Build and preview

Use Node.js 24 and the repository lockfile:

```sh
npm ci
cp apps/site/.env.example apps/site/.env
# Populate the public settings below.
npm run site:build
npm run site:serve
```

Open `http://127.0.0.1:8787/` (append your base path if configured). The production directory is `apps/site/dist`. Build and serve the separate editor with `npm run editor:build` and `npm run editor:serve`; it defaults to `http://127.0.0.1:8788/`. Committed screenshots and examples make an ordinary build independent of browser installation. To regenerate them, install Chromium with `npx playwright install chromium` and run `npm run site:assets`. Set `CHROMIUM_PATH` to use an existing browser.

## Frontend environment settings

All settings are **public, compiled into the frontend at build time**. Edit `apps/site/.env` locally or set environment variables on your build host, then rebuild. Existing process variables take precedence over the local file. Never put credentials or provider keys in these variables. Only these named values are read; the build does not expose the rest of the environment.

| Variable | Meaning | Empty/default behavior |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | Production origin, e.g. `https://evir.example` | Omit canonical URLs, social image URL and sitemap until set |
| `PUBLIC_BASE_PATH` | Optional subdirectory, e.g. `/Evir/` | Serve from the origin root |
| `PUBLIC_EDITOR_URL` | Full editor application destination, e.g. `https://studio.evir.example/` | `http://127.0.0.1:8788/` for local development; set for production |
| `PUBLIC_REPOSITORY_URL` | GitHub repository URL | `https://github.com/Mgregchi/Evir` |
| `PUBLIC_DOCS_URL` | Documentation destination | Repository research guide |
| `PUBLIC_COMMUNITY_URL` | Discord, forum or other community destination | Use the configured feedback channel; hide the dedicated join link |
| `PUBLIC_FEEDBACK_URL` | Feedback destination | Repository new-issue page |
| `PUBLIC_NEWSLETTER_URL` | External updates/subscription page | Follow the repository instead |
| `PUBLIC_SOCIAL_X_URL` | X profile | Hide link |
| `PUBLIC_SOCIAL_LINKEDIN_URL` | LinkedIn profile | Hide link |
| `PUBLIC_SOCIAL_MASTODON_URL` | Mastodon profile | Hide link |
| `PUBLIC_CONTACT_URL` | Contact HTTP(S) or `mailto:` destination | Hide link |

`PUBLIC_SITE_URL` is an origin, not a URL containing a path. A GitHub project site would use `https://mgregchi.github.io` plus `/Evir/`. For a custom domain served at its root, use that origin and leave `PUBLIC_BASE_PATH` empty. HTTP(S) settings reject executable URLs and credentials. Repository-derived issue and source links assume GitHub; override the docs/feedback URLs when appropriate.

Community feedback creates an escaped, reviewable draft in the page. It prefills title/body only for GitHub `/issues/new`; other configured destinations open unchanged, and visitors can copy the draft. No message is posted automatically. Optional community/newsletter links open your external destination; the site does not create those services.

## Verify

```sh
npx playwright install chromium
npm run test:site
```

The browser checks cover every page with root and `/Evir/` configurations, internal assets/links/fragments, 1440/390/320-pixel layout widths, WCAG A/AA automated checks, preview controls, reduced motion and feedback safety. They follow the configured launch link to an editor on another origin, verify independent root/subdirectory hosting, and open/export Milo with byte-identical results. Separate comparisons validate original showcase exports in official Canvas2D and WebGL2 runtimes at selected keyframes and boolean transitions. Results and review screenshots are in `research/results/public-site/`. These are cloud checks; they do not complete physical-device research or replace a usability study.

## Hosting

For automatic deployments from GitHub, follow [Connect Evir to Cloudflare or Netlify](../../docs/20-github-connected-hosting.md). It gives dashboard steps for two separate projects, exact root/package/build/output settings, URL variables, domains and previews. Netlify reads this app's `netlify.toml` when its **package directory** is `apps/site` and **base directory** is the repository root. Cloudflare Pages and the existing Workers integration have separate instructions.

Upload the contents of `apps/site/dist` to a static host that serves directory `index.html` files and ES modules with a JavaScript MIME type. Use `404.html` as the missing-page document. Publish only this directory, not the repository or `node_modules`. If hosted beneath a subdirectory, configure `PUBLIC_BASE_PATH` before building. The editor's deployable directory is separately `apps/editor/dist`.

`Public site validation` tests relevant PRs/pushes. The existing Pages deployment workflow now builds the site and uploads `apps/site/dist`, fixing the previous absolute `/site` artifact path; it preserves deployment on relevant main pushes and manual dispatch. Pages metadata supplies the origin/base path unless overridden by public **repository variables**. Enable Pages with the Actions source and populate `PUBLIC_EDITOR_URL` with the separately hosted editor, plus your optional channels, before publishing. Editor/runtime CI has separate triggers and artifacts. A site content change does not trigger editor/runtime releases. This migration itself does not deploy a domain.

Cloudflare Pages can use build command `npm run site:build` and output directory `apps/site/dist`. The included Workers static-assets config can be used with `npx wrangler deploy --config apps/site/wrangler.jsonc` after building and configuring your account. Configure the editor as a separate project/service with its own build/output/settings. See [the hosting guide](../../docs/19-workspace-migration.md).

## Scope and assets

[Public-site research](../../docs/16-public-site-research.md) records the observations and page decisions. [Asset provenance](assets/README.md) explains the original examples, real Evir Studio captures and unchanged brand PNGs. Third-party user uploads are research inputs and are absent from the public build. Product copy distinguishes today's desktop prototype from researched or planned features. Additional use-case, legal and service pages can follow when there is concrete content or a service to describe.
