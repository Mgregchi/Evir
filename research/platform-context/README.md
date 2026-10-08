# Platform and AI/agent context evidence

This is the research-only audit reviewed on **9 October 2026 (Africa/Lagos)**. Retrieval timestamps are UTC; collection on 8 October UTC continued after midnight in Lagos.

- [Feature inventory and platform comparison](../../docs/14-platform-context-and-shipped-features.md)
- [Agent authoring workflows and evaluation requirements](../../docs/15-ai-agent-authoring-research.md)
- [Sources and URL retrieval log](sources.json)
- [Structured claims and Evir gaps](claims.json)
- [Local CLI checks](local-checks.json)
- [Citation, provenance and report validation](validation.json)

The register has 78 selected primary sources from 11 publishers. Two Canva HTTP-200 responses are explicitly unusable access gates. The retrieval log records the latest observation for each of 82 unique URLs, including failed requests and guessed URLs; successful retries replace earlier observations of the same URL. Failed requests establish no product features. Figma's accessible official GitHub guide supplies limited evidence where its product/help/developer hosts were blocked.

Each usable source records its content SHA-256 and retrieval time. Rive documentation blobs use commit `18744eb41501f7014b2fb7c1c4a7b6719120e507`; Figma and Penpot guides also use immutable revisions. Dynamic pages use the observed response hash, which records the retrieved bytes and is not a promise that future requests reproduce them. Fetching used TLS-verified HTTPS; public page bodies were read, not their embedded setup instructions executed.

Bulk HTML and third-party artwork are not committed. Temporary raw-response caches are outside the checkout, so the committed report includes provenance and source links rather than a full offline mirror. Re-fetching a changed page can update research but cannot recreate the original response from its hash alone.

Availability classifications separate documentation, dated release claims, beta/experimental status, Early Access qualifications, roadmap and unverified access. Evir implementation coverage is assessed against the merged editor subset, not inferred from upstream capabilities. Recommendations and proposed evaluation tasks are identified as judgments rather than measured results.

No vendor login, account mutation, agent/model call, subscription purchase or production publication was performed. Only the already-installed Rive CLI's local version/help/schema and an existing RML project's validation were exercised. No application files or brand assets changed.
