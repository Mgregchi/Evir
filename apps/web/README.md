# Evir web app

The single hosted frontend: eleven public pages plus Studio at `/editor/studio/`. The public `/editor/` page introduces the editor; its launch buttons open the workspace on this same host. `@evir/studio` owns the editor UI, and the engine/authoring/format packages retain their own APIs and releases.

## Build and preview

Use Node.js 24 and the repository lockfile:

```sh
npm ci
npm run web:build
npm run web:serve
```

Open `http://127.0.0.1:8787/`, or `http://127.0.0.1:8787/editor/studio/` for Studio. If `SITE_URL` includes a prefix, append that prefix first. The sole production output is `apps/web/dist`.

Ordinary builds use committed screenshots/examples and need no browser installation. To regenerate them, install Chromium and run `npm run web:assets`. `CHROMIUM_PATH` can select an existing browser.

## Environment

The web app has one address setting: `SITE_URL`, its full public URL including any prefix. Studio's route and home link are derived automatically. Local builds need no environment file. For custom settings, copy [`.env.example`](.env.example) to `apps/web/.env`, or set values in the provider's build environment. Process values take precedence. All named settings are public; rebuild after editing. Unrelated environment values are not embedded.

### Optional public links

These configure the public pages within the same web app.

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
npm run test:web
```

The browser checks cover all public pages at root and under `/Evir/`, internal assets/links/fragments, 1440/390/320-pixel layouts, automated WCAG A/AA checks, live previews and feedback safety. They open Studio on the same origin, check slash/query redirects and missing assets, then open/export Milo with unchanged bytes. Separate oracles compare showcase exports with official Canvas2D/WebGL2 runtimes. These checks do not replace physical-device research or a usability study.

## Hosting

Follow [the single-project GitHub deployment guide](../../docs/20-github-connected-hosting.md) for Cloudflare Workers, Pages or Netlify. Serve `apps/web/dist` with directory index handling, JavaScript MIME types and `404.html` for missing pages. No proxy or blanket SPA fallback is needed. A web deployment does not publish engine packages.

## Scope and assets

[Public-site research](../../docs/16-public-site-research.md) records the observations and page decisions. [Asset provenance](assets/README.md) explains the original examples, real Evir Studio captures and unchanged brand PNGs. Third-party user uploads are research inputs and are absent from the public build. Product copy distinguishes today's desktop prototype from researched or planned features. Additional use-case, legal and service pages can follow when there is concrete content or a service to describe.
