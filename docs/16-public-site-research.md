# Public site: research, scope and acceptance

Reviewed 9 October 2026, before selecting the public-page structure and implementing it. This is an addition to the editor/runtime phases. Physical-device auditing remains deferred; public marketing does not declare it complete.

## Observations from live primary sources

The [retrieval register](../research/public-site/sources.json) records timestamps, resolved URLs, status and response hashes. The user's Rive mobile screenshots supplied additional visual context. Failed guessed community paths returned 404; the actual community destinations were discovered from the sites and fetched separately.

| Source | Observed pattern | Evir decision |
| --- | --- | --- |
| [Rive home](https://rive.app/) | Product, community and learning navigation; visual examples; editor/CLI entry points; grouped footer and use-case routes | A clear editor entry point, visible original work, and Create/Explore/Build together/Project footer groups |
| [Rive film/TV](https://rive.app/use-cases/film-tv) | A concrete audience, production imagery and a case study supporting the use-case claim | Use real Evir editor captures now; add dedicated use-case pages when Evir has corresponding evidence |
| [Rive community](https://community.rive.app/) | A separate destination for community participation | Configure the destination; start with the existing repository/issue channel |
| [Penpot](https://penpot.app/) and [its community](https://community.penpot.app/) | Open-project identity, contribution and learning entry points, a distinct community destination | Publish a contributor guide and first-run instructions alongside the public site |
| [Framer](https://www.framer.com/) | Visual product proof and clear routes into learning, examples and community | Show actual work close to the introductory promise, rather than a list of future capabilities |
| [Evir repository](https://github.com/Mgregchi/Evir) | Public source, MIT license, enabled issues; Discussions disabled when checked | Use existing GitHub feedback; do not invent a forum or subscription service |
| [GitHub Pages workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) | A build artifact, deployment job and Pages environment/permissions are separate steps | Validate PRs automatically; reserve Pages deployment for manual dispatch after configuration |

These are observations of public presentation, not conversion-rate evidence or usability studies. No Rive/Framer/Penpot text, customer endorsements or case-study images are copied into Evir. Shipped-platform/AI context remains in [the feature audit](14-platform-context-and-shipped-features.md) and [agent research](15-ai-agent-authoring-research.md).

## First increment

Ten pages answer the immediate questions: what is Evir, what can I try, what is implemented, and how can I take part?

| Page | Purpose |
| --- | --- |
| Home | Character-first introduction, original live example, actual Studio screenshot and useful next actions |
| Studio | Describe the implemented authoring subset using real captures |
| Examples | Original editable Milo and Orbit projects; pause/play and a boolean interaction |
| Learn | Download/open/edit/save workflow and documentation entry point |
| Community | Follow, contribute, and create a reviewable feedback draft |
| Roadmap | Separate working features, next authoring work, pending validation and researched possibilities |
| Updates | Two dated entries grounded in completed editor and research work |
| About | Project purpose, open source and independence from Rive |
| Contribute | Setup, existing issues and a repository contributor guide |
| Privacy | Actual static-site behavior and the external feedback handoff |

Accounts, pricing, downloads of an unbuilt desktop app, template marketplaces and customer use cases need concrete products/content before their pages. This increment includes no invented waitlist, community size, production adoption, AI agent or platform-parity claim. The footer links to implemented pages and configured destinations.

## Design and behavior

The existing Evir editor's dark neutral palette and mint accent informed the public system. Typography, spacing, original character art and graphite/mint surfaces make the site distinct from Rive's black, uppercase, industry-showcase presentation. Existing brand PNGs are copied unchanged; icons in navigation are ordinary UI symbols, not redraws of the Evir identity.

Milo and Orbit are independently authored through Evir's editable project model and compiled through its current exporter. The four Studio screenshots come from loading Milo in the actual editor and selecting real design, path, animation and interaction views. Their [provenance](../apps/site/assets/README.md) is recorded. The user's third-party exports inform research and are absent from the public build.

Public destinations are build-time frontend environment settings, as requested by the user. Optional channels disappear or fall back to configured repository/feedback routes until populated. The [configuration guide](../apps/site/README.md) lists every setting and root/subdirectory deployment behavior. The feedback form drafts escaped text and lets the visitor review/post at the destination; it creates no message, account or database entry on Evir's site.

Motion starts paused when the visitor requests reduced motion and can be explicitly played. Previews stop drawing offscreen or in a hidden document. Keyboard focus, a skip link, labeled navigation/form fields, mobile menu dismissal, image alternatives and a working no-JavaScript poster/links fallback are part of the first increment. The complete Studio workspace remains an early desktop experience; the public pages adapt to small screens.

## Evidence and limits

`npm run test:site` exercises ten pages with root and `/Evir/` configurations, internal links/assets/fragments, three viewport widths, automated WCAG A/AA rules, configured destinations, reduced-motion controls, safe feedback drafting, and actual bundled Studio project-open/export behavior. It compares both original `.riv` showcases against evaluated Evir source at selected keyframes and input transitions on the official Canvas2D/WebGL2 2.44.0 runtimes. [Browser results](../research/results/public-site/browser.json), [runtime comparisons](../research/results/public-site/examples.json) and [review screenshots](../research/results/public-site/) retain the evidence.

Automated checks and cloud screenshots do not establish device performance, complete accessibility or a validated user experience. Physical desktop/mobile studies, equivalent Rive Editor scenes, real creator feedback and further content remain part of the main work. The static build and manual deployment workflow are ready for configured hosting; this change does not itself publish a live website.
