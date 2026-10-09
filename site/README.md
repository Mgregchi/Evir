# Evir public site

Ten static public pages: home, Studio, examples, learn, community, roadmap, updates, about, contribute and privacy. The build also includes the working desktop editor at `/editor/`, its schema for `.riv` export, and two independently authored editable examples. No server, account, analytics service or AI provider is required.

This site is the first public surface, not the long-term owner of the editor/runtime. The intended product structure is a public home and `/product` showcase, an `/editor` landing page, a separately deployed editor workspace (potentially on a studio subdomain), and independently versioned runtime packages. See [the boundary and deployment decision](../docs/18-architecture-boundaries-and-deployment.md).

## Build and preview

Use Node.js 24 and the repository lockfile:

```sh
npm ci
cp site/.env.example site/.env
# Populate the public settings below.
npm run site:build
npm run site:serve
```

Open `http://127.0.0.1:8787/` (append your base path if configured). The production directory is `site/dist`. Committed screenshots and examples make an ordinary build independent of browser installation. To regenerate them, install Chromium with `npx playwright install chromium` and run `npm run site:assets`. Set `CHROMIUM_PATH` to use an existing browser.

## Frontend environment settings

All settings are **public, compiled into the frontend at build time**. Edit `site/.env` locally or set environment variables on your build host, then rebuild. Existing process variables take precedence over the local file. Never put credentials or provider keys in these variables. Only these named values are read; the build does not expose the rest of the environment.

| Variable | Meaning | Empty/default behavior |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | Production origin, e.g. `https://evir.example` | Omit canonical URLs, social image URL and sitemap until set |
| `PUBLIC_BASE_PATH` | Optional subdirectory, e.g. `/Evir/` | Serve from the origin root |
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

The browser checks cover every page with root and `/Evir/` configurations, internal assets/links/fragments, 1440/390/320-pixel layout widths, WCAG A/AA automated checks, preview controls, reduced motion, feedback safety and the bundled editor's actual project-open/export workflow. Separate comparisons validate original showcase exports in official Canvas2D and WebGL2 runtimes at selected keyframes and boolean transitions. Results and review screenshots are in `research/results/public-site/`. These are cloud checks; they do not complete physical-device research or replace a usability study.

## Hosting

Upload the contents of `site/dist` to a static host that serves directory `index.html` files and ES modules with a JavaScript MIME type. Use `404.html` as the missing-page document. Publish only this directory, not the repository or `node_modules`. If hosted beneath a subdirectory, configure `PUBLIC_BASE_PATH` before building.

The `Public site` GitHub Actions workflow tests PRs and relevant pushes. Deployment runs **only when manually dispatched**. Enable GitHub Pages with the Actions source and populate the corresponding public **repository variables** first. The workflow has a GitHub Pages environment and deployment permissions only in its deployment job. Creating this workflow does not deploy the site.

## Scope and assets

[Public-site research](../docs/16-public-site-research.md) records the observations and page decisions. [Asset provenance](assets/README.md) explains the original examples, real Evir Studio captures and unchanged brand PNGs. Third-party user uploads are research inputs and are absent from the public build. Product copy distinguishes today's desktop prototype from researched or planned features. Additional use-case, legal and service pages can follow when there is concrete content or a service to describe.
