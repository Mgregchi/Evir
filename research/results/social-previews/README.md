# Missing social preview image

Diagnosis: 11 October 2026. The user confirmed `https://evir.idey.click/` is the shared URL.

[Live HTTP evidence](live-before.json) shows eight HTTP 200 responses with X, Meta, WhatsApp and LinkedIn crawler User-Agent strings. The 1200×630 JPEG is publicly accessible, while the homepage lacks both `og:image` and `twitter:image`. The deployed unconfigured build conditionally omitted canonical, image and sitemap metadata. This is a missing-tag bug, rather than evidence that the image file or bot requests are blocked.

The [Open Graph protocol](https://ogp.me/) specifies title, type, image and canonical URL metadata in the page head, plus structured image type/dimensions/alt text. Retrieval URLs and response hashes are in [sources.json](sources.json). The legacy X card-documentation URL redirected to a general API overview; no card requirements were inferred from it.

The web config now defaults public metadata to the verified project address `https://evir.idey.click/`. `SITE_URL` remains the only address override for another domain or subdirectory. All eleven public pages emit absolute canonical, Open Graph and X image tags directly in the initial HTML, and X title/description tags are explicit. Navigation/Studio routes remain relative to the host. No image, brand or hosting-service implementation changes were needed.

[Regression tests](../../../tests/frontend/social.test.mjs) build with an empty environment address and a custom prefixed address. For each public page and four crawler identities, they read raw HTTP HTML without JavaScript and assert image/canonical/title/description metadata. They fetch the advertised asset path, check HTTP 200 and JPEG MIME type, and decode its frame header to verify the declared 1200×630 dimensions. Sitemap/robots addresses are checked too. These are crawler-response regressions, not screenshots of cards rendered by the actual platforms.

[Validation counts](validation.json) record 14 passing frontend tests, including 88 raw page requests across the two builds. The [public-site suite](web.log) passed 22 page/configuration checks at three viewport widths, 96 official-runtime showcase comparisons and six editable gallery studies. The [experience checks](experience.json) also passed. [Build](build.log), [frontend](frontend.log), [crawler](crawler.log), [public-page](public-pages.json), [showcase](showcase-oracles.json) and [gallery](gallery.json) records are retained here; automated accessibility results do not establish screen-reader or user-study coverage.

[Deployment and cache steps](../../../docs/20-github-connected-hosting.md#link-previews) describe rebuilding on Cloudflare, the existing-build `SITE_URL` workaround, LinkedIn Post Inspector and a fresh-share cache retry. The live deployment still needs the merged fix and a rebuild; this evidence does not claim an already-updated production page or invalidated platform caches.
