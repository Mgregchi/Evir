# Evir public site

Eleven static public pages: home, product, the `/editor/` Studio landing page, examples, learn, community, roadmap, updates, about, contribute and privacy. The editor application is a separate build at its configured URL. The site includes two independently authored editable examples and uses the shared runtime/Canvas2D APIs for live previews. No server, account, analytics service or AI provider is required.

The public home, `/product/` showcase and `/editor/` landing page ship independently from Studio and runtime package releases. The former `/studio/` public route redirects to `/editor/`. See [the boundary decision](../../docs/18-architecture-boundaries-and-deployment.md) and [implemented migration](../../docs/19-workspace-migration.md).

## Build and preview

Use Node.js 24 and the repository lockfile:

```sh
npm ci
npm run site:build
npm run site:serve
```

Open `http://127.0.0.1:8787/` (append the path from `SITE_URL` if you configured one). The production directory is `apps/site/dist`. Build and serve the separate editor with `npm run editor:build` and `npm run editor:serve`; it defaults to `http://127.0.0.1:8788/`. Committed screenshots and examples make an ordinary build independent of browser installation. To regenerate them, install Chromium with `npx playwright install chromium` and run `npm run site:assets`. Set `CHROMIUM_PATH` to use an existing browser.

## Frontend environment settings

For hosting, use **`SITE_URL` and `STUDIO_URL` with the same values on both apps**. Each is a full address, including any path. See [the deployment guide](../../docs/20-github-connected-hosting.md#two-addresses-the-same-on-both-projects) for exact provider fields. Paths are derived automatically; no base-path variable is needed.

For local defaults, no environment file is needed. For custom addresses/links, copy [`.env.example`](.env.example) to `apps/site/.env` and edit it, or set variables on your build host. Process values take precedence over the local file. All named settings are public build-time values; rebuild after editing. Never put secrets here. Other environment values are not embedded in the app.

### Optional public-site links

These go **only on the public-site project**. None is needed by Studio.

| Variable | Destination | If empty |
| --- | --- | --- |
| `REPOSITORY_URL` | GitHub repository | `https://github.com/Mgregchi/Evir` |
| `DOCS_URL` | Documentation | Repository research guide |
| `COMMUNITY_URL` | Discord/forum | Hide dedicated join link |
| `FEEDBACK_URL` | Feedback | Repository new-issue page |
| `NEWSLETTER_URL` | Updates/subscription page | Follow repository instead |
| `SOCIAL_X_URL` | X profile | Hide link |
| `SOCIAL_LINKEDIN_URL` | LinkedIn profile | Hide link |
| `SOCIAL_MASTODON_URL` | Mastodon profile | Hide link |
| `CONTACT_URL` | Contact page or `mailto:` address | Hide link |

URL settings reject executable links and credentials. Repository-derived docs/feedback defaults assume GitHub; override them if you use another service. Without a configured `SITE_URL`, local builds omit canonical/social-image URLs and the sitemap.

Community feedback creates an escaped, reviewable draft in the page. It prefills title/body only for GitHub `/issues/new`; other configured destinations open unchanged, and visitors can copy the draft. No message is posted automatically. Optional community/newsletter links open your external destination; the site does not create those services.

## Verify

```sh
npx playwright install chromium
npm run test:frontend
npm run test:site
```

The browser checks cover every page with root and `/Evir/` configurations, internal assets/links/fragments, 1440/390/320-pixel layout widths, WCAG A/AA automated checks, preview controls, reduced motion and feedback safety. They follow the configured launch link to an editor on another origin, verify independent root/subdirectory hosting, and open/export Milo with byte-identical results. Separate comparisons validate original showcase exports in official Canvas2D and WebGL2 runtimes at selected keyframes and boolean transitions. Results and review screenshots are in `research/results/public-site/`. These are cloud checks; they do not complete physical-device research or replace a usability study.

## Hosting

Use [the GitHub-connected deployment guide](../../docs/20-github-connected-hosting.md) for Cloudflare Workers, Pages or Netlify. It is the single source for hosting fields and environment settings. The separate editor can use a subdomain or [the `/editor/studio/` path](../../docs/21-studio-path-hosting.md).

This app publishes `apps/site/dist`. Static hosting must serve directory `index.html` files, JavaScript MIME types and `404.html` for missing pages. There is no blanket SPA fallback. GitHub Pages uses the supplied workflow; it derives `SITE_URL` from Pages metadata unless configured explicitly, and `STUDIO_URL` selects the separate editor.

## Scope and assets

[Public-site research](../../docs/16-public-site-research.md) records the observations and page decisions. [Asset provenance](assets/README.md) explains the original examples, real Evir Studio captures and unchanged brand PNGs. Third-party user uploads are research inputs and are absent from the public build. Product copy distinguishes today's desktop prototype from researched or planned features. Additional use-case, legal and service pages can follow when there is concrete content or a service to describe.
