# Platform context and shipped-feature audit

Reviewed **9 October 2026, Africa/Lagos**. HTTP observations were collected on 8 October UTC, including the evening that falls on 9 October in Lagos. This is a public primary-source audit before further implementation, extending the [earlier UX study](11-editor-ux-research.md). It does not report authenticated editor testing or new physical-device measurements.

The comparison now needs to cover an entire authoring system: artwork, rigging, animation, interaction, data, reusable components, scripts, agents, validation and delivery. Rive has documented capabilities in all these areas. Several competitors also let agents change editable native documents. A chat panel alone would cover only a small part of that workflow.

## Evidence and availability

[The source register](../research/platform-context/sources.json) contains 78 selected primary sources from 11 publishers, content hashes, retrieval times, immutable documentation revisions and the request log. Two selected Canva pages are access gates rather than usable feature evidence. [Structured claims](../research/platform-context/claims.json) distinguish external availability from Evir implementation status.

Use these labels literally:

| Label | What the evidence establishes |
| --- | --- |
| Announced available | A dated official release says people can use the feature. Account/plan restrictions still apply. |
| Documented | Official instructions describe an available workflow. This is vendor evidence, not our acceptance test. |
| Beta / experimental | The source explicitly qualifies maturity. Do not relabel it generally available. |
| Early Access qualification | Instructions contain an Early Access requirement or conflicting maturity language. |
| Roadmap | The source says coming soon, planned or future. |
| Not verified | Access failed, only adjacent functionality was found, or a relevant account/device test remains unrun. |

“Shipped in the editor,” “supported by a runtime,” and “verified by Evir” are different statements. A successful file load does not establish that every feature renders or behaves correctly. Current documentation is pinned to Rive commit `18744eb41501f7014b2fb7c1c4a7b6719120e507`, newer than the revision used for the first editor milestones.

## Corrections to earlier assumptions

| Question | Current evidence | How to use it |
| --- | --- | --- |
| Is the Rive Agent paid-only? | The 30 April announcement explicitly includes Free users; current pricing agrees. The agent guide still lists Cadet/Voyager/Enterprise and the January FAQ has older access restrictions. [R02], [R03], [R04], [R05] | Free access with limits is the current public offer. Preserve the older statements as historical/conflicting evidence. |
| Are `.riv` exports paid-only? | Current pricing advertises Free exports with a Rive splash screen. The runtime-export guide still says paid plans. [R02], [R29] | Do not repeat the paid-only statement as current fact. Verify export/signing behavior in the specific account before a product integration depends on it. |
| Is scripting only Early Access? | Rive announced scripting as a core platform feature on 13 January; the feature landing page still has Early Access badges for scripting and the Agent. [R01], [R06] | The dated launch establishes availability; a stale landing-page badge does not settle every protocol's maturity. |
| Are external agents only a Rive roadmap idea? | April's announcement described MCP/BYOK exploration. Current MCP instructions exist, and pricing lists bring-your-own Agent API key. MCP instructions still mention the Early Access app and desktop-only access. [R02], [R03], [R07] | Record the newer documented integration and its qualification. Do not claim browser MCP or universal account access. |
| Does WebGL2 support literally every editor feature? | The support-page introduction says so, but its detailed matrix marks text input coming soon. [R12], [R13] | Use the specific feature row and SDK version, not the broad introduction. |
| Does WebMCP mean Chrome-only or work with any MCP client? | LottieFiles' product page says Chrome; its 8 October guide requires a compatible browser **and** an assistant able to discover page tools, and documents a built-in-browser workflow. [L02], [L04] | Follow the more specific current guide. Ordinary MCP support does not establish WebMCP support. |

The public Rive changelog fetched during this pass led with February 2025 entries. It is insufficient by itself to date all 2026 features; dated announcements and the current versioned support matrix supply better evidence. No date of first release is inferred from a page retrieval date.

## Rive feature inventory and Evir coverage

Evir coverage below refers to the merged [four-milestone subset](13-editor-milestone-acceptance.md), not to everything already studied by the binary/runtime research harness. A feature tested in a research fixture may still have no editable Studio representation or exporter support.

| Area | Rive's public feature surface | Availability / boundaries | Evir Studio today |
| --- | --- | --- | --- |
| Vector artwork | Paths, procedural shapes, fills/strokes, gradients, clipping, trim paths, draw order and vector feathering. [R01] | Documented/product-listed. Feathering needs the Rive Renderer; this is not a claim that feathering is ordinary MSAA. [R12], [R40] | Rectangles and cubic paths with solid fills; numeric/pointer anchor and detached-handle editing, subdivision and closure. Gradients, strokes/trim, clipping and feather authoring remain outside the tested export subset. |
| Character rigging | Bones, weighted mesh deformation and IK constraints. [R34], [R35], [R36] | Documented. Geometry, bind pose and constraint behavior must be represented in authored data. | Root/child bone chains and independent weighted path controls. Textured mesh topology, weight-paint UX, IK and a wider constraint system remain. |
| Timelines | Property keys, easing/graph editing, animation mixing and draw-order animation. [R01] | Documented/product-listed; distinguish source defaults from animation evaluation. | Typed numeric/color keys, hold/linear/cubic easing, retiming and scrub/play. Broader property coverage, graph gestures, mixing and draw-order authoring remain. |
| State machines | Entry/Exit/Any, animation states, 1D and additive/direct blending, concurrent layers, conditions, transitions and state/transition actions. [R31], [R32] | Documented. Blend terminology varies within the guide; exact additive semantics need runtime comparisons. | One-layer typed conditional machine, boolean/number/trigger inputs, AND conditions and reset. Layering, blends, transition mixing, state actions and broader reset/interrupt cases remain. |
| Listeners | Pointer/event-driven actions and interactions tied to scene targets. [R33] | Documented; event exposure differs across runtime generations. | Click listener actions for the declared subset. Richer pointer/focus/semantic interactions remain. |
| Data binding | Typed view models and instances, property binding, lists, converters and reusable data contracts. [R16], [R18], [R19], [R20] | Documented; later property families have different runtime floors. [R12] | No Studio view-model/binding authoring. Existing state-machine inputs are not equivalent to a reusable application data contract. |
| Stateful components | Exposed inputs and read-only outputs per nested instance; input properties can be keyed. [R17] | Documented; broad runtime support with version floors. [R12] | No editable nested component/instance model or component data contract. |
| Responsive layout | Reflow/size rules, component sizing, n-slicing and scrolling constraints. [R21], [R22], [R23] | Documented; runtime must support layout sizing and scrolling behavior. | Fixed artboard and transforms; responsive layout/scroll authoring remains. |
| Text and localization | Text runs/styles, dynamic text, fonts and fallback handling; RTL/text-path support has separate matrix rows. [R37], [R38], [R12] | Documented. **Text input is a separate feature**, currently marked coming soon in the matrix. | Text/font rendering and export remain. Asset storage alone does not establish text support. |
| Images and audio | Imported/dynamic assets, audio assets and clips; runtime asset delivery and audio behavior are platform-specific. [R01], [R39], [R12] | Documented. Playback/autoplay and licensing must be checked for actual target applications. | Assets can persist in project data, but the compiler rejects attached assets and Studio does not render/export them. |
| Luau scripting | Node, converter, path-effect, layout, listener-action, transition-condition, utility and test protocols. [R06], [R24], [R26] | Announced available; scripting is omitted from web Lite builds. [R12] | No script authoring/execution/export workflow. Prior RML experiments do not establish this in Studio. |
| WGSL / GPU Canvas | Custom vertex/fragment shader programs, uniforms, textures and offscreen rendering controlled through scripts. [R25] | Documented, renderer/platform-dependent. Not general compute shader support. | No authoring/export support; no hardware performance evidence. |
| Native AI Agent | In-editor help and code generation, plus documented layout/data-model assistance; conversation controls and review of pending changes. [R04], [R10] | Available with plan/capacity limits; older access notes conflict. [R02], [R03] | No in-product AI agent, model provider or credit system. |
| External agents | Desktop MCP scene/data/animation/script/shader tools. [R07] | Documented Windows/macOS integration with Early Access wording; not exercised here. | No agent-facing protocol/server. |
| CLI / RML | Text authoring, schema/docs lookup, local compile/preview/inspection and account-connected file workflows. [R08], [R09] | Documented. Local verification was exercised here; remote account actions were not. | CLI/RML research exists; Studio has no RML editing/round-trip authoring workflow. |
| Libraries | Publish/version components and view models, notify downstream files, detach and control exports. [R27] | Voyager/Enterprise; same-project access documented. Cross-project/workspace and public libraries are still described as planned. | No library publishing/version/update system. |
| Team workflow | Realtime collaboration, permissions, file browser and revision history. Restoring a revision creates a new history entry. [R02], [R28] | Product/plan-dependent. Editor collaboration does not establish runtime multiplayer. | Local browser persistence, validated downloads and transaction undo/redo; no cloud/team service. |
| Delivery | Runtime `.riv`, editable `.rev` backups, share/embed hosting and raster/video exports. [R02], [R29], [R30] | Formats preserve different information. Free runtime exports advertise a splash screen; backup/hosting entitlements need account checks. | Editable `.evir-project` persistence and a validated `.riv` subset with a source map. Full semantic `.riv` import remains unsupported. |
| Accessibility | Semantic roles/properties/traits/states/actions and an authored reduced-motion path. [R14], [R15] | Semantics retains experimental/development wording; support varies. Reduced motion is not applied automatically. | Editor control labels/shortcut checks exist. Authored semantic output, screen-reader testing and reduced-motion runtime behavior remain. |

The `.riv` runtime artifact is not a substitute for editable source: `.rev` retains information stripped from `.riv`. This directly affects the supplied SOBO export. Structural inspection and playback cannot reconstruct every authoring concept without a defined, tested import policy. [R30]

## Runtime support: specific rows matter

These are **documented minimums in the pinned matrix**, not SDK versions newly installed or device-tested during this pass. Existing Evir export acceptance uses official Canvas2D and WebGL2 **2.44.0** in cloud software graphics.

| Feature | Current public support evidence | Consequence for Evir |
| --- | --- | --- |
| Feathering | WebGL2 uses the Rive Renderer; Canvas2D does not support feathering. [R13], [R40] | Canvas2D-only parity cannot validate feathered output. |
| Scripting | Web Canvas/WebGL2 2.34.0+; Canvas Lite excludes scripting. [R12] | Export diagnostics need a selected runtime/build target. |
| Stateful components | Web 2.33.0+; Nitro React Native 0.3.1+, unlike the older matrix's 9.x entry. [R12] | Record package identity as well as version. |
| GPU Canvas | WebGL2 2.42.0+, React WebGL2 4.34.0+; unavailable in web Canvas. Nitro React Native 0.5.3+ requires `RiveRuntime.setGPUCanvasEnabled(true)` before any files load. [R12], [R13] | GPU export and fallback require explicit validation. For native SDK overrides, the guide requires Apple 6.25.0+ / Android 11.12.0+. The standalone Android matrix row still says coming soon: do not transfer the RN claim without checking that package. |
| Semantics | Web 2.39.0+; Nitro React Native 0.5.0+ is iOS-only and requires an enabled semantics mode. The semantics guide still qualifies runtime maturity. [R12], [R13], [R14] | SDK support is not an accessibility acceptance result; test keyboard, screen reader and action/value synchronization. |
| Focus | Web Canvas/WebGL2 2.43.1+; several native rows still coming soon. [R12] | Pointer-only preview is insufficient for a keyboard interaction claim. |
| Global view models / bound fonts | Different support across Apple, Android, Flutter and React Native, with individual version floors. [R12] | A blanket “data binding supported” badge hides meaningful gaps. |
| Text input | Every listed runtime row says coming soon or not applicable. [R12] | Dynamic text support must not be presented as editable text-entry support. |
| Gamepad | C++ supported; other listed runtime rows coming soon. [R12] | Treat as a target-specific capability. |
| Legacy integrations | Old web WebGL is deprecated from 2.37.0; React WebGL from 4.30.0. Legacy React Native is deprecated. Nitro 0.5.0+ removes old event/text-run methods; use data binding. [R13] | New integration design should follow current APIs; older examples need migration checks. |

WGSL export includes backend shader variants rather than original WGSL source. The shader guide excludes compute shaders and several advanced language features. Consequently shader editability, backend portability and runtime playback must be evaluated separately. [R25]

## Comparable platforms beyond the original four

| Platform | Verified public feature context | AI / agent availability evidence | Useful comparison and limits |
| --- | --- | --- | --- |
| **Framer** | Responsive website canvas, components, CMS and publishing integrated with design. [F01], [F02] | Native Agents and an external-agent bridge are documented. External changes use branches; review/merge and publishing are separate. The bridge is not a manual MCP-server setup. [F02], [F04] | Strong precedent for editable results, message rollback, scoped context and layout/visual feedback. Website authoring is not skeletal/vector-runtime parity. |
| **Figma** | Official guide covers variables/components/auto layout, design context and Code Connect. [G01] | Remote **write-to-canvas and skills are beta**; webpage capture is rolling out. Read-context workflows and native write workflows are distinct. | Design-system reuse and precise node context matter. Main product/help/developer hosts were blocked by the network proxy; Make/product-wide AI availability and pricing were not independently settled. |
| **Penpot** | SVG editing, booleans, Flex/Grid, design systems, tokens and prototype interactions. [P01] | Official local and hosted MCP read/write native documents through a plugin. Current focused page and active MCP tab determine the target. [P03], [P04] | Open integration architecture and explicit document context. Self-hosting the editor/server does not automatically keep an external model's prompts local. |
| **Spline / Hana** | Hana is a relevant **2D** vector/interactive canvas: vector networks, booleans, gradients/effects, frames, states/events, motion, collaboration and web delivery. Spline's 3D editor is a separate comparison. [S01], [S02] | Native agents and desktop external MCP are product-listed for Hana; Spline advertises agent creation/editing of native 3D scenes. Image/3D generation and style transfer are separate features. [S01], [S04], [S05] | On-canvas interactivity and editable agent output are directly relevant. Public claims were not authenticated editor tests; embeds/code/mobile/self-hosted export rights differ by plan. [S03] |
| **LottieFiles / Creator** | Timeline/path/text/effect editing, themes/motion tokens, segments, state machines, transitions and inputs. [L01], [L04], [L05] | Native Motion Copilot, local Creator MCP and browser WebMCP document the **same editing capabilities** through different entry points. Hosted Platform MCP manages account/API resources; it is a different service. [L03], [L04], [L06] | Do not retain the old blanket assumption that Lottie has no meaningful interactivity. Ordinary Lottie JSON, Creator source and interactive delivery/runtime support need separate tests. |
| **SVGator** | Vector/timeline animation, interactive SVG and several vector/raster/mobile delivery formats. [V01], [V05] | Official account-connected MCP documents inspection, native edits, animation creation, preview and exports. [V01], [V03] | Excellent evidence for validating edits and reporting static values overridden by keys. Whole-project rewrites have last-writer-wins behavior. Lottie support still has a Beta label in the help page. [V02], [V04], [V06] |
| **Canva** | Accessible developer docs describe Apps SDK/Connect APIs and a **Dev MCP server** for building Canva apps. [C01] | Product AI and end-user design-connector pages returned “Unsupported client” content despite HTTP 200. Native-agent/editing scope is **not verified** in this pass. | Dev MCP documentation must not be used as evidence that agents can edit users' design accounts. Resolve the access gap before adopting product claims. |
| **Adobe Firefly** | Official APIs cover image generation/editing, custom models, compositing and upscaling. [A01] | Documented generative services. This source does not establish a native animation-document agent. | Separate reference-consistent generated media from editable geometry, rigging, timelines and interactive logic. No claim of lossless brand reproduction. |
| **Spine** | Mesh attachments, editable topology, keyed deformation and automatic deformation using bone weights. [B01], [B02] | No native AI-agent availability established by these sources. Meshes are excluded from Essential. | Strong character-authoring reference. Its published runtime license has conditions and is not interchangeable with MIT; studying UX does not authorize adopting that runtime. [B03] |
| **Cavalry** | Desktop 2D motion/creative-coding application; current docs describe scene/file workflows. [Q01], [Q02] | AI/agent availability not established by the reviewed sources. | A secondary reference for motion authoring and source management; broader procedural/agent evaluation remains a follow-up rather than an assumed feature inventory. |

“Not established” does not mean “the product has no such feature.” No public marketing promise in this table is counted as an Evir benchmark result.

## Costs, control and distribution

For Rive, the current offer gives Free/Cadet limited Agent modes; the April release says free capacity recharges hourly. New Cadet plans do not include premium AI credits, while pre-change Cadet accounts have a documented grandfathering exception. Voyager pricing lists $20/seat monthly Agent credits, top-ups and a bring-your-own Agent API key; Enterprise lists $40/seat. Exact model access, capacity and effective billing require the actual account. January's FAQ explains workspace pooling, monthly expiry and non-expiring top-ups but predates the new free tiers. [R02], [R03], [R05]

The Rive FAQ says user data is not used to train its models/provider models and describes provider Zero Data Retention. This is a vendor policy statement, not an independent audit, and does not establish the policy for a separate external-agent provider. [R05]

Framer's current AI notice distinguishes third-party providers from Framer's own training: providers cannot train on customer input/output; Enterprise is excluded from Framer training, while non-Enterprise workspaces must disable that training in settings to opt out. An undifferentiated “no training” claim would be inaccurate. [F05]

Figma's guide currently gives Starter/View/Collab users up to six **read** tool calls per month. Paid Dev/Full seats have other rate limits. Write tools are exempt from those read limits and free during beta, with future usage-based charging explicitly planned. Do not infer permanent free write access. [G01]

Spline's pricing distinguishes recurring credits and MCP tool limits from export rights. LottieFiles' hosted Platform MCP uses OAuth with an `mcp:full` scope, acting with the connected account's permissions; its no-training statement for the transport explicitly leaves the AI provider's terms separate. Neither that scope nor its token lifetime should be assumed for Creator's local bridge. [S03], [L07]

Export decisions also need to distinguish editable source, interactive runtime artifacts, hosted URLs and raster/video output. Hosted access is not an offline ownership guarantee. Temporary SVGator export links need downloading, and a still preview cannot validate animation timing. [V03], [V05]

## Context still needed before a broader implementation commitment

| Missing evidence / decision | Why it matters | Status |
| --- | --- | --- |
| Rive desktop/account walkthrough of Agent, Changes, MCP and export signing | Public availability and contradictory notes do not verify the exact account/app workflow. | Unrun; no desktop account session used. |
| Equal-scene Rive Editor exports | Compare actual editor-produced geometry, rigging, state-machine/data contracts and assets with equivalent Evir scenes. | Four controlled comparisons remain pending; SOBO is an additional real-world workload, not an equal-scene pair. |
| Physical GPU/mobile measurements | Software rendering is not a mobile power/frame-time/memory measurement. | User's device audit remains deferred. |
| Representative usability and accessibility sessions | Clean screenshots and automation cannot establish discoverability, animation editing comfort or assistive-technology behavior. | Task protocol exists in the earlier UX research; participants/device sessions remain. |
| Semantic `.riv` import and editable-source policy | Exported runtime data may omit authoring information. | Must define supported reconstruction and preserved unknown data before claiming import/edit parity. |
| Editor scope | Character-focused authoring, general interactive UI, procedural motion and 3D have different minimum product surfaces. | Character-first project goals remain the baseline; this audit does not silently expand them. |
| Agent deployment and data handling | Embedded model, external bridge and offline file-agent workflow differ in cost, privacy, context and recovery. | Options researched in the [agent study](15-ai-agent-authoring-research.md); no provider/protocol selected. |
| Gated competitor evidence | Canva end-user connector and Figma product-wide AI/Make details remain inaccessible here. | Explicit gaps; not filled with third-party speculation. |

The four implemented milestones are a useful authoring/export foundation. Closing their declared subset does not close the larger feature inventory above. Further planning should use this audit, the agent workflow study and actual user-task evidence; it should not present unimplemented features or pending device tests as completed.

## Sources

Bracketed IDs resolve to official URLs below. Immutable Rive documentation and Figma/Penpot guides make the observation reproducible. The source register records redirect/access failures and hashes; live pricing and legal pages may change.

[A01]: https://developer.adobe.com/firefly-services/docs/firefly-api/
[B01]: https://esotericsoftware.com/spine-meshes
[B02]: https://esotericsoftware.com/spine-weights
[B03]: https://esotericsoftware.com/spine-runtimes-license
[C01]: https://www.canva.dev/docs/connect/mcp-server/
[F01]: https://www.framer.com/agents/
[F02]: https://www.framer.com/agents/external/
[F04]: https://www.framer.com/blog/building-framer-agents/
[F05]: https://www.framer.com/legal/ai-notice
[G01]: https://raw.githubusercontent.com/figma/mcp-server-guide/f0493295acf5f7cbdebcbcc483c06de814420cb1/README.md
[L01]: https://lottiefiles.com/lottie-creator
[L02]: https://lottiefiles.com/mcp
[L03]: https://docs.lottiefiles.com/en/creator/13_ai-tools/lottie-creator-mcp
[L04]: https://docs.lottiefiles.com/en/creator/13_ai-tools/lottie-creator-webmcp
[L05]: https://docs.lottiefiles.com/en/creator/13_ai-tools/motion-copilot
[L06]: https://docs.lottiefiles.com/en/platform/mcp/tools
[L07]: https://docs.lottiefiles.com/en/platform/mcp/security
[P01]: https://penpot.app/features
[P03]: https://help.penpot.app/mcp/
[P04]: https://raw.githubusercontent.com/penpot/penpot/2c08a065bbbb12fa3036a7c9ae8526d43bec4f49/mcp/README.md
[Q01]: https://docs.cavalry.scenegroup.co/
[Q02]: https://cavalry.studio/docs/user-interface/menus/file-menu/
[R01]: https://rive.app/features
[R02]: https://rive.app/pricing
[R03]: https://rive.app/blog/free-rive-ai-agent
[R04]: https://rive.app/docs/editor/ai-agent/ai-agent
[R05]: https://rive.app/blog/rive-ai-coding-agent-faq
[R06]: https://rive.app/blog/scripting-is-live-in-rive
[R07]: https://rive.app/docs/editor/ai/mcp
[R08]: https://rive.app/docs/cli/overview
[R09]: https://rive.app/docs/cli/agents
[R10]: https://rive.app/docs/editor/interface-overview/debug-panel
[R12]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/snippets/feature-support.jsx
[R13]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/feature-support.mdx
[R14]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/accessibility/semantics.mdx
[R15]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/accessibility/reduced-motion.mdx
[R16]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/data-binding/overview.mdx
[R17]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/data-binding/stateful-components.mdx
[R18]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/data-binding/property-types.mdx
[R19]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/data-binding/converters.mdx
[R20]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/data-binding/lists.mdx
[R21]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/layouts/layouts-overview.mdx
[R22]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/layouts/n-slicing.mdx
[R23]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/constraints/scroll-constraint.mdx
[R24]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/scripting/protocols/overview.mdx
[R25]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/scripting/wgsl-shaders.mdx
[R26]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/scripting/debugging/unit-testing.mdx
[R27]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/libraries.mdx
[R28]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/fundamentals/revision-history.mdx
[R29]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/exporting/exporting-for-runtime.mdx
[R30]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/exporting/exporting-for-backup.mdx
[R31]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/state-machine/states.mdx
[R32]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/state-machine/transitions.mdx
[R33]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/state-machine/listeners.mdx
[R34]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/manipulating-shapes/bones.mdx
[R35]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/manipulating-shapes/meshes.mdx
[R36]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/constraints/ik-constraint.mdx
[R37]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/text/text-overview.mdx
[R38]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/text/fonts.mdx
[R39]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/editor/assets/audio.mdx
[R40]: https://github.com/rive-app/rive-docs/blob/18744eb41501f7014b2fb7c1c4a7b6719120e507/runtimes/web/canvas-vs-webgl.mdx
[S01]: https://spline.design/hana
[S02]: https://spline.design/solutions/design-with-ai-agents-mcp-3d
[S03]: https://spline.design/pricing
[S04]: https://spline.design/ai-generate
[S05]: https://spline.design/ai-style-transfer
[V01]: https://www.svgator.com/help/svgator-mcp/what-is-the-svgator-mcp-server
[V02]: https://www.svgator.com/help/svgator-mcp/static-vs-animated-the-one-rule-to-know
[V03]: https://www.svgator.com/help/svgator-mcp/previews-and-verifying-changes
[V04]: https://www.svgator.com/help/svgator-mcp/limitations-good-practices
[V05]: https://www.svgator.com/help/svgator-mcp/export-and-deliver-your-animation
[V06]: https://www.svgator.com/help/export-and-file-formats/lottie-support-in-svgator
