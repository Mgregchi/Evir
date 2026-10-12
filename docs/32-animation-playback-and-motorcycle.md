# Playback modes, independent timelines and Sunday

Research and implementation: 12 October 2026. This increment closes Studio's missing playback selector, fixed repeat counts and ping-pong, then adds an original interactive motorcycle study. It keeps the single web host and existing independent packages. Backend services remain deferred.

## Findings before implementation

[Primary-source retrieval records](../research/playback/sources.json) record actual HTTP success, byte sizes and SHA-256 hashes. [Rive's timeline documentation](https://rive.app/docs/editor/animate-mode/timeline) documents One-Shot, Loop and Ping-Pong. Its [native loop enum](https://github.com/rive-app/rive-runtime/blob/master/include/rive/animation/loop.hpp) stores 0, 1 and 2 respectively. The [native animation instance](https://github.com/rive-app/rive-runtime/blob/master/src/animation/linear_animation_instance.cpp) scales elapsed time by speed and reverses at ping-pong boundaries. The repository's pinned schema exposes `speed` and `loopValue`, but no finite repeat-count property.

[MDN animation options](https://developer.mozilla.org/en-US/docs/Web/API/KeyframeEffect/KeyframeEffect) documents iterations and alternate direction. Evir's product choice is a **complete cycle**: a loop goes start → end; a ping-pong cycle goes start → end → start. A fixed count includes the first cycle. This terminology is explicit in the sheet; it does not claim that Evir counts Rive's individual boundary events as full cycles. Existing bottom-sheet, reduced-motion and accessible-input case studies continue to govern the UI.

## Studio controls

Choose **Animate → Playback settings…**. On compact screens, first open **Timeline** from the rail.

- **Play once:** runs once and holds its last frame.
- **Loop:** returns to the start and repeats.
- **Ping-pong:** plays forward, then backward.
- **Repeat:** continuous or a fixed count of 1–10,000 cycles for the repeating modes. A counted loop holds the last frame; counted ping-pong returns to and holds the first frame.
- **Playback speed:** authored multiplier from 0.01–16; 1 is normal speed.

Apply commits one history operation; Undo restores the previous policy. Invalid values keep the sheet open with custom feedback. Pause preserves clock phase and repeat progress. Completed playback updates the Play button; pressing Play again restarts the selected timeline. Scrubbing shows both endpoints and begins a new playback segment from that frame. Duration and FPS remain timeline controls.

**Preview layers…** combines other animations in the selected artboard with independent clocks and per-layer speeds, including 0 to freeze a component. The selected timeline wins when two layers key the same property; unkeyed properties remain unchanged. X, Y and rotation are merged against one base transform, then constraints apply once. A disabled layer contributes nothing. The selected timeline's completion stops the entire Studio preview; an application mixer can continue other layers independently. These preview choices are session state and stay out of source/runtime files. Background/foreground visual ordering continues to use normal groups and sibling order; animation layers are separate clocks, not new drawable node kinds.

## Source, runtime and compatibility

Existing v2/v3 projects and runtime snapshots with `loop: true/false` remain readable and keep their published export bytes. A configured animation replaces that legacy field with:

```json
"playback": { "mode": "ping-pong", "iterations": 2, "speed": 1.5 }
```

Animations carry exactly one of `loop` or `playback`. Iterations 0 means continuous; once requires 1. This is an additive animation-record contract in existing supported source/runtime versions. Old Evir builds that do not recognize `playback` reject the new field; they must be updated before opening new files. No editor preferences enter runtime snapshots.

`RuntimePlayer.playback` reports frame, direction, completion and current speed. `setSpeed(0–64)` changes future deltas without resetting phase; zero freezes motion. Reset restarts timing while retaining a caller's speed override. Machines apply authored mode/count/speed to each state's animation and blend child; transition timing continues to use real seconds. Dynamic speed controls on individual machine states and multi-layer machine graphs are outside this increment.

`AnimationMixer(project, {artboardId, layers})` takes ordered `{animationId, speed?, enabled?}` entries. It provides `setSpeed`, `setEnabled`, `seek`, `restart`, `reset`, `playback`, `pose` and `advance`. Later layers override only keyed properties. Reset restarts clocks while retaining speeds/enabled configuration; `restart(id)` also enables that layer. `advanceClocks(seconds)` advances clocks without constructing a pose, so a host can substep simulation and render once. This is property replacement, not additive/weighted timeline blending or a nested state-machine implementation.

Native `.riv` exports carry once/loop/ping-pong and authored speed directly. **Fixed repeat counts require host playback.** For new policies, the downloaded `.riv-map.json` records FPS, duration, playback policy and authored keyed-property scope. `new AnimationClock(map.animations[sourceAnimationId])` implements the count; a low-level native host can apply `clock.state.frame / fps` to its animation instance. Raw `.riv` imports retain native modes/speed but cannot recover finite counts that are absent from the binary. Studio explicitly reports this on export instead of silently claiming a binary count.

The compiler retains its existing constant-default tracks for isolated timeline/state pose fidelity. The map's `trackScope` lists the original authored tracks, excluding those defaults. **Applying several exported native animations directly is not the same as Evir's property-scoped mixer:** injected defaults may overwrite another animation's properties. Use Evir's source/runtime mixer for the interactive study; raw native exports demonstrate individual timelines and the combined Ride. A future native composition adapter would need to honor keyed scopes. No whole-game `.riv` interoperability is claimed.

## Sunday: the motorcycle study

[Editable project](../apps/web/assets/examples/motorcycle.evir-project), [native export](../apps/web/assets/examples/motorcycle.riv), [export map](../apps/web/assets/examples/motorcycle.riv-map.json), [host controller](../apps/web/assets/examples/motorcycle-controller.mjs) and [real captured poster](../apps/web/assets/motorcycle-poster.png) are published alongside the other examples. The artwork is original Evir geometry in the existing mint/peach/forest palette. The user's logo/icon remain unchanged. There are 101 drawable/group nodes and eleven editable timelines:

| Timeline | Purpose |
| --- | --- |
| Ride | Combined looping native showcase; useful without a host controller. |
| Wheels | Linear continuous rotation of independent front/rear wheel groups. |
| Asphalt | Seamlessly tiled road markings; velocity drives playback speed. |
| Distant hills / Passing hills | Different parallax speeds behind the bike. |
| Roadside | Foreground movement, faster than the road plane. |
| Suspension bump | One-shot chassis lift/settle with staggered wheel offsets. |
| Sunlight | Gentle continuous ping-pong motion. |
| Headlight / Brake light | Property-scoped light activation. |
| Turn signal | Three on/off cycles, then off; shows fixed-count playback. |

On **Examples → Sunday**, set Throttle and press **Start ride**. Brake toggles and stays engaged until released. Road bump triggers a suspension action; active bumps cannot retrigger. Occasional bumps are spaced by travelled distance and can be disabled. Headlight toggles independently. Turn signal runs three blinks while the ride plays. Pause freezes the simulation; Reset parks the bike and restores controls. Sliders/buttons/checkboxes are keyboard accessible, and changing a control does not start animation automatically. The example starts parked even when reduced motion is not requested.

The host integrates illustrative acceleration, braking and drag in substeps no larger than 1/120 second, then renders once per display tick. It clamps speed to 22 m/s. A 0.34 m wheel radius and the rendered 43 px tire radius synchronize wheel rotation with road displacement. Other scenery uses deliberate perspective ratios. This is a motion study, **not** a tire/contact/vehicle physics engine; chassis motion does not solve suspension mechanics or collisions.

The gallery defers source/controller loading until visible. Offscreen, hidden-page and pagehide suspension preserves phase without catch-up; the existing renderer/abort lifecycle releases resources on final navigation. Frequent telemetry is not an ARIA live announcement; the state label changes only between Parked/Cruising/Braking. Reduced motion stops playback; the user can explicitly start again. The sixteen-study gallery remains incremental.

The downloadable controller imports `@evir/runtime` and needs that package resolved by a bundler or import map. It is the same source as `apps/web/motorcycle.mjs`, copied by the generator, rather than a self-contained script for arbitrary websites. A minimal workspace integration is:

```js
import {MotorcycleController} from './motorcycle-controller.mjs';
import {CanvasRenderer} from '@evir/renderer-canvas';
const ride = new MotorcycleController(project);
const renderer = new CanvasRenderer(canvas.getContext('2d'));
await renderer.prepare(project);
ride.setThrottle(0.6);
// Only call while visible and the user has opted into motion.
renderer.draw(ride.advance(deltaSeconds), ride.artboard.id);
// Other controls: setBrake(bool), setHeadlight(bool), setRoughRoad(bool),
// bump(), signal(), reset(). Dispose the renderer when leaving the view.
```

## Evidence and remaining scope

Runtime/unit checks exercise boundary completion, large deltas, authored/dynamic speed, count reset, phase-preserving speed changes, disabled/keyed scopes, shared transform axes, serialization/history validation and native import/export metadata. Controller tests check acceleration/braking, travel/wheel synchronization, frame-rate substep equivalence, repeated bumps, three-blink completion, reset and source immutability.

[Studio browser evidence](../research/results/playback/studio.json) covers 390/1440 px sheets, all modes, invalid input, completion/restart, endpoint scrubbing and independent previews. [Motorcycle browser evidence](../research/results/playback/motorcycle-browser.json) covers 320×844, 390×844, 844×390 and 1440×900 controls, keyboard throttle, pause/reset, simulated hidden-page/offscreen suspension and automated accessibility checks. Screenshots live in that same tracked directory.

[Canvas](../research/results/playback/native-canvas.json) and [WebGL2](../research/results/playback/native-webgl2.json) records each contain 41 native clock/pixel comparisons: actual native instance advancement for mode/speed and an explicit map-clock adapter for finite counts. Fixtures, hashes, runtime/browser versions and renderer provenance accompany these results. The gallery oracle separately compares every native motorcycle timeline; it does not validate the Evir host as native game logic. [Validation ledger](../research/results/playback/validation.json) records final command outcomes and broader regression results.

All browser/renderer observations are cloud software-rendering evidence. Physical-device GPU/memory measurements, representative human/screen-reader testing and matched Rive Editor scenes remain external evidence work. Additive/weighted animation layers, general animation rebasing, persistent guides, broader text/import/rig contracts, multi-project/tab recovery and the shared live-editing/MCP command layer remain the separate tracks in the [consolidated plan](25-studio-navigation-and-remaining-work.md). Backend services remain excluded.
