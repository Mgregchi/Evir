# AI and agent authoring context

Reviewed **9 October 2026, Africa/Lagos**, before any further product implementation. Read alongside the [feature audit](14-platform-context-and-shipped-features.md) and [source register](../research/platform-context/sources.json). These are research conclusions and candidate requirements, not a commitment to an AI provider or implementation schedule.

## What an agent actually edits

There are several different products behind the phrase “AI design.” They should have separate capability labels and acceptance criteria.

| Workflow | Editable result / authority | Examples established by primary sources |
| --- | --- | --- |
| Advice / Ask | Explanation or suggestions; no document changes required. | Rive's lower-cost Ask mode; Creator's explicit advice-only prompts. [R03], [L05] |
| Native-document agent | Objects, styles, keys, data and interactions remain editable with the normal editor. | Rive Agent, Framer Agents, Creator Motion Copilot; Hana agent product claims. [R04], [F01], [L05], [S01] |
| External document tools | Another assistant reads or changes an existing editor/account through a bridge. | Rive desktop MCP, Penpot MCP, Figma remote write beta, SVGator account MCP, Creator local MCP. [R07], [P03], [G01], [V01], [L03] |
| Browser page tools | Browser and assistant expose/discover tools for the live tab. | Creator WebMCP; ordinary MCP-client compatibility alone is insufficient. [L04] |
| Text/file authoring | Agent writes source files, compiles, inspects and previews them. | Rive CLI/RML with generated agent instructions and schema lookup. [R08], [R09] |
| Asset/account automation | Library search, workspace operations, publishing/export and API resources; not necessarily canvas drawing. | LottieFiles hosted Platform MCP; Framer CMS/publishing. [L06], [F02] |
| Generated media | Images, meshes or visual variants; may not expose an editable animation graph or rig. | Firefly image/custom-model/compositing APIs; Spline AI generation/style transfer. [A01], [S04], [S05] |
| Developer assistant | Helps build an integration/plugin/application; does not imply design-account access. | Canva Dev MCP. [C01] |

These can share a user interface, but their permissions, costs and outputs are different. “Generate a mascot image,” “animate this approved mascot's arm,” and “create a reusable success-state component” are distinct operations.

## Rive's three agent paths

**In-editor Agent.** Rive documents an Agent panel, conversation controls, code explanations and layout/data-model assistance. The January scripting launch describes inline diffs and accept/reject for generated code. The Debug Panel's Changes tab reviews pending Agent changes before applying them. Free availability is supported by the April announcement and current pricing, despite the older paid-only guide note. The sources do not prove that every kind of scene mutation has the same granular review behavior. [R04], [R06], [R10], [R02], [R03]

**Desktop MCP.** Windows/macOS instructions expose hierarchy/property/path/layout/component operations, timeline/state-machine editing, view models/bindings and script/shader compilation, diagnostics, tests and console inspection. The endpoint shown is local `http://127.0.0.1:9791/mcp`. That describes where tools run; it does not establish that an external AI model receives no project data. Setup verification mentions the Early Access app, so general release/access remains qualified. No Rive desktop MCP session was exercised in this Linux environment. [R07]

**CLI/RML.** Agents can write text source, query `rive docs` and `rive schema`, compile with `--verify`, inspect the resolved scene and request rendered feedback. Project creation writes `AGENTS.md` and `CLAUDE.md`. The documentation also describes account-bound project/file operations. Local file authoring and account publishing must have different authority. Source instructions are context for authoring, not permission to publish. [R08], [R09]

This pass verified the installed **CLI 1.4.0** executable, inspected its help/schema and ran an existing static RML project's verification: exit 0, `success: true`, no errors/warnings. It needed the already-provisioned native library directory in `LD_LIBRARY_PATH`. Verification produced no `.riv` and did not render a scene. The commands and limits are saved in [local evidence](../research/platform-context/local-checks.json). No login, account write, provider call, MCP connection or production publish occurred.

## Findings from other agent systems

| System | How it gets context and edits | Review / verification evidence | Restrictions to preserve |
| --- | --- | --- | --- |
| Framer | Selected page/nodes, project patterns/styles, compact patches; broader operations through code. External bridge exposes native canvas/components/CMS. [F02], [F04] | Engineering article describes layout rectangles, rule linting, optional rendered screenshots, per-message rollback and branch copies; external documentation says changes happen on a branch. | Agent can publish when instructed; canvas editing and live-site publishing are distinct. Project access is explicitly granted/revocable. Public results are vendor-described, not our latency/quality measurements. |
| Figma | Node context, variables/components/auto layout and Code Connect; remote native writes. [G01] | Official guide emphasizes components linked to code, semantic names, annotations and layout checks. | Write/skills beta; capture rolling out; model image generation requires approval/credit disclosure in the documented workflow. Do not copy these external guide instructions into our task's authority. |
| Penpot | MCP → plugin → current focused page; local `execute_code`, overview/API information, asset import/export. [P03], [P04] | Read-only inspection is recommended before writes. An active tab and connected plugin are prerequisites; page focus can change the target. | One active MCP tab. Hosted/local tools differ; remote mode cannot read arbitrary local asset paths. Arbitrary plugin code has a broader surface than narrowly typed editing commands. |
| Creator | Selected/named layers or mentions; scenes, keys, effects, motion tokens, themes and state-machine tools shared by Copilot/MCP/WebMCP. [L03], [L04], [L05] | Preview and manual refinement; multi-step CodeMode; docs say inspect after failures because earlier edits may remain. | Open tab required for local bridge; browser AND assistant support required for WebMCP. No blanket guarantee of atomic multi-step edits. Feature access follows workspace/plan. |
| LottieFiles Platform MCP | Four-tool GraphQL workbench: discover root operations, search schema, inspect details, execute. [L06] | Schema browsing uses a cached snapshot; only execution reaches live account resources. Operations have read/write/destructive/billing/admin categories. | OAuth `mcp:full` carries account permissions, not a narrow scene-only scope. Policy and mutation review guidance apply to this hosted service, not automatically to Creator. [L07] |
| SVGator | Account/project inspection, targeted native property/key edits, returned editor links. [V01], [V02] | Validates before saving; returns the stored result, flags valid but invisible static edits, and offers still previews. [V03] | Whole-project replacement lacks concurrent-change detection; last writer wins. Still previews cannot establish timing; rendered download links expire. [V04], [V05] |
| Hana / Spline | Product pages advertise agent operations on native frames/effects/interactions or 3D objects/materials; manual editability retained. [S01], [S02] | On-canvas preview and manual iteration are product claims. | No authenticated tools exercised. Do not infer scene-transaction, rollback or provider-retention guarantees from marketing alone. |

## Requirements suggested by the evidence

These recommendations are judgments based on the sources above. They do not claim Evir has implemented them.

### Give people a clear editing context

A creator should be able to tell which document, artboard, selection, animation and frame an agent is using. Show whether the action changes design defaults, timeline keys, a component instance, a binding or a runtime input. SVGator's static-versus-animated example is a concrete failure mode: changing a base color can succeed while keyed animation continues showing another color. The result must identify that override instead of claiming a visible change. [V02], [V03]

For Evir, relevant context would include stable project/node IDs, parent transforms, selected path controls or bones, active timeline/playhead, machine/layer/state, view-model schema when one exists, and the selected export runtime. Retrieve detailed context on demand rather than transmitting the entire document for every prompt. Framer's compact context and scoped selection show why this can improve both cost and targeting. [F04]

Names are useful for people but not unique identifiers. Agent requests should resolve names to explicit IDs before writing. The scene schema should distinguish authored values, derived properties and runtime pose; the installed Rive CLI's `schema Artboard` visibly labels these differences. An agent should not write derived layout outputs as if they were source properties.

### Share the human editor's operations

Native editability is the strongest common pattern across Rive, Creator, Framer and Penpot. If Evir later exposes tools, they should use the same validated document operations as pointer, keyboard and inspector edits. A separate agent-only representation would create divergent undo, serialization and export behavior.

A candidate command surface would support inspection, selection, creation, property/key edits, rig/binding changes, previews, validation and export. Read capabilities should be separable from writes and external publication. The document schema and transaction layer need to cover each feature before exposing agent edits for it. Rive's broad MCP tool list does not make Evir's currently absent mesh/data/layout/script models available. [R07]

### Make edits reviewable and recoverable

Rive supplies pending-change/code review; Framer supplies branches and per-message rollback; SVGator validates and echoes the stored result. These support a product requirement for inspectable changes and recovery, but they are not proof that every vendor has atomic rollback for every tool. Creator explicitly documents possible partial progress after a failure. [R06], [R10], [F02], [V03], [L04]

For a future Evir agent transaction, a useful result would name the objects and properties affected, explain the time scope, show before/after artwork or poses and list validation/export issues. A canceled change should leave the source untouched; accepted changes should be grouped coherently for undo. Long multi-step jobs need visible progress, cancellation and a defined partial-success policy. Retry should inspect the current document before repeating creation.

Collaboration would add document revision preconditions and conflict handling. SVGator's documented last-writer-wins replacement is evidence of a risk to resolve, not a pattern to adopt. Branch/review UI is one option; versioned targeted patches are another. Choosing the mechanism depends on Evir's eventual collaboration model. [V04], [F04]

### Close the feedback loop

An agent should assess the stored/evaluated output. “The tool returned success” is not enough. Useful checks include:

1. Validate geometry, references, types and authored data constraints.
2. Evaluate meaningful animation frames and state-machine interactions, including reset.
3. Inspect hierarchy, active properties, bindings and diagnostics after edits.
4. Render the relevant viewport; compare timing with animation playback rather than a still image.
5. Compile/export and validate through the selected official runtime when `.riv` compatibility is claimed.

Rive CLI verification/tests/screenshots, Framer layout/lint/render feedback and SVGator returned-state checks establish practical precedents. Evir already has binary and selected official-runtime oracles, which can inform this feedback later. Existing tests do not cover all future authored features, physical devices or human usability. [R09], [R26], [F04], [V03]

Agent performance should be measured separately from renderer performance. Track task success, repair attempts, incorrect targets, source drift, preservation failures, edit latency, provider cost and manual cleanup. Do not infer good design quality from prompt completion rate alone.

### Preserve the creator's artwork and design system

When a person provides approved artwork, “animate it” should preserve the artwork unless they request a visual change. Creator's guidance explicitly recommends starting from imported art when appearance matters. Figma's guide recommends real components/variables and Code Connect instead of invented replacements. [L04], [G01]

For this project, the supplied Evir wordmark and icon are reference assets. The user allows cropping, resizing, conversion and background removal while retaining appearance. An agent workflow must carry that constraint and preserve a link to the reference; generated substitutes or altered letterforms are not acceptable brand output. This audit makes no new brand assets.

Reusable character parts, colors, typography, components and motion presets would also improve context and consistency. Those systems need real editable representations. A prompt saying “follow the brand” is not a substitute for stored assets/tokens, validated references and human visual review.

### Treat AI as an optional route through a usable editor

The visual editor still needs understandable selection, layer organization, key-state feedback, graph navigation, weight controls, recovery and export diagnostics. Users should be able to finish agent-created work manually and continue if a provider is unavailable or credits are exhausted. Creator, Hana and Framer explicitly combine native editing with agents. [L05], [S01], [F04]

Candidate UI states include advice without edits, inspection, proposed changes, applying changes, canceled/partial failure and completed-with-diagnostics. Show the affected scope before consequential changes and keep the stage usable during review. Resizing/collapsing panels, contextual shortcuts, text-field isolation and accessible navigation remain relevant regardless of AI.

These are not validated user-interface designs yet. Test tasks with people who use animation tools and newcomers before choosing panel placement, terminology or how much detail a change review needs.

## Provider, transport and privacy decisions remain open

| Option | Benefit suggested by research | Cost / missing evidence |
| --- | --- | --- |
| Embedded provider-backed agent | Integrated selection, streamed progress, review and diagnostics. | Credentials/server design, billing, provider terms, retention, abuse limits and offline failure behavior. Rive's credits are not a suitable estimate of Evir cost. |
| External local/desktop MCP | Users can bring an assistant; clear local document connection. | Desktop availability, connection lifecycle and external provider data handling. A localhost endpoint does not make model inference local. |
| Hosted account bridge | Can operate without an open editor; account/library automation. | Auth, scoped permissions, concurrent document edits and a distinct publishing boundary. Framer demonstrates this; LottieFiles' full account scope is broader than scene-only editing. |
| Browser WebMCP | Operates on the live tab without a local bridge. | Browser and assistant support, tab/session targeting, permission UX and compatibility changes. Do not assume a standard MCP client can access page tools. |
| Text/file agent authoring | Version control, inspectable diffs, local compilation and reuse of coding agents. | Round-trip/editability policy between text source and visual document, assets and unsupported concepts. Current RML experiments supply evidence, not a complete Studio workflow. |

No provider or transport is selected by this research. An open editor/format does not require a bundled paid model. BYOK is a billing/control option, not a privacy guarantee. Model training, logging, retention and generated-asset rights need separate, current terms for each service actually used. [R05], [F05], [L07]

For an eventual integration, separate authority to read context, modify a draft, fetch external assets, spend provider credits and publish. Do not silently grant account-wide powers just to animate a selected limb. This is a product requirement suggested by the compared systems' scopes, not a request for extra approval on the present read-only research task.

## Research acceptance tasks for a future agent workflow

Before comparing agent implementations, use the same editable starting projects and explicit constraints. These tasks are proposed evaluation cases, not experiments already run:

| Task | What a passing result would demonstrate |
| --- | --- |
| Explain the selected character rig without editing | Correct hierarchy, influences and active animation; unchanged source. |
| Animate a supplied illustration while preserving its artwork | Intended keys/timing; no replacement assets or unwanted path/color changes. |
| Make a keyed shape red throughout one timeline | Correct time scope; preserves base pose/other timelines where required; visible result at sampled frames. |
| Add a reusable success interaction | Named inputs/data contract, transitions/listeners, reset behavior and selected-runtime compatibility. |
| Change one bone and inspect affected controls | Correct bind/deformation data and undo; no drift of unrelated controls. |
| Reject or cancel a multi-step edit | Defined rollback/partial-success behavior; unchanged source for rejected proposals. |
| Resume after a timeout | Inspects prior progress; does not duplicate objects, keys or states. |
| Edit while another session changes the same component | Detects/reconciles revision conflict; avoids silent whole-document replacement. |
| Save source and export runtime output | Editable round trip and official-runtime validation; clear unsupported-feature diagnostics. |
| Exhaust credits or disconnect a tool | Clear state, recoverable work and functioning manual authoring. |

The next planning pass should use this evidence to choose a bounded editor scope and close missing document operations and UX evidence before promising general AI authoring. Physical-device performance and equal-scene Rive Editor comparisons remain separate unfinished audits.

## Sources

IDs link to primary sources. Claims describe public documentation and product statements; authenticated execution is limited to the local CLI checks explicitly recorded above.

[A01]: https://developer.adobe.com/firefly-services/docs/firefly-api/
[C01]: https://www.canva.dev/docs/connect/mcp-server/
[F01]: https://www.framer.com/agents/
[F02]: https://www.framer.com/agents/external/
[F04]: https://www.framer.com/blog/building-framer-agents/
[F05]: https://www.framer.com/legal/ai-notice
[G01]: https://raw.githubusercontent.com/figma/mcp-server-guide/f0493295acf5f7cbdebcbcc483c06de814420cb1/README.md
[L03]: https://docs.lottiefiles.com/en/creator/13_ai-tools/lottie-creator-mcp
[L04]: https://docs.lottiefiles.com/en/creator/13_ai-tools/lottie-creator-webmcp
[L05]: https://docs.lottiefiles.com/en/creator/13_ai-tools/motion-copilot
[L06]: https://docs.lottiefiles.com/en/platform/mcp/tools
[L07]: https://docs.lottiefiles.com/en/platform/mcp/security
[P03]: https://help.penpot.app/mcp/
[P04]: https://raw.githubusercontent.com/penpot/penpot/2c08a065bbbb12fa3036a7c9ae8526d43bec4f49/mcp/README.md
[R02]: https://rive.app/pricing
[R03]: https://rive.app/blog/free-rive-ai-agent
[R04]: https://rive.app/docs/editor/ai-agent/ai-agent
[R05]: https://rive.app/blog/rive-ai-coding-agent-faq
[R06]: https://rive.app/blog/scripting-is-live-in-rive
[R07]: https://rive.app/docs/editor/ai/mcp
[R08]: https://rive.app/docs/cli/overview
[R09]: https://rive.app/docs/cli/agents
[R10]: https://rive.app/docs/editor/interface-overview/debug-panel
[R26]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/scripting/debugging/unit-testing.mdx
[S01]: https://spline.design/hana
[S02]: https://spline.design/solutions/design-with-ai-agents-mcp-3d
[S04]: https://spline.design/ai-generate
[S05]: https://spline.design/ai-style-transfer
[V01]: https://www.svgator.com/help/svgator-mcp/what-is-the-svgator-mcp-server
[V02]: https://www.svgator.com/help/svgator-mcp/static-vs-animated-the-one-rule-to-know
[V03]: https://www.svgator.com/help/svgator-mcp/previews-and-verifying-changes
[V04]: https://www.svgator.com/help/svgator-mcp/limitations-good-practices
[V05]: https://www.svgator.com/help/svgator-mcp/export-and-deliver-your-animation
