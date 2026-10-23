# Published identity research

The [retrieval ledger](sources.json) records primary URLs, HTTP outcomes, retrieval times, byte counts and SHA-256 digests. Metadata/JWKS files here are public protocol documents retrieved on 23 October 2026, not client secrets, private keys, OAuth tokens or redistributed artwork. Documentation HTML stays outside the repository; digests identify the fetched responses.

- `claude-code-metadata.json`: the public Claude Code identity and declared native callback contract.
- `chatgpt-metadata.json` and `chatgpt-jwks.json`: the public ChatGPT identity, supported method intersection and public verification key set observed at retrieval. Keys can rotate; these are research snapshots, not production trust stores. The service fetches current allowed publisher documents.

Implementation choices, limits and evidence are described in [guide 56](../../docs/56-published-client-identities.md). A public document identifies its publisher, not the caller. Neither a public fetch nor a synthetic test establishes actual named-host OAuth pairing.
