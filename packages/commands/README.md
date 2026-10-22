# Shared local commands

`@evir/commands` owns scoped authoring transactions and transient presentation controls. It has no DOM, network, filesystem, storage or official Rive runtime dependency. Studio and the local stdio MCP adapter consume the same implementation. Hosted services remain deferred.

```js
import {CommandSession} from '@evir/commands';
import {compassLesson} from '@evir/commands/example';
const session = new CommandSession(project);
const info = session.inspect();
const lesson = compassLesson(info.context.artboardId);
const result = session.execute({
  schemaVersion: 1, context: info.context,
  requestId: 'lesson-1', expectedRevision: info.revision,
  operation: 'patch', payload: {commands: lesson.commands}
});
```

Use a new prefix and unoccupied root order when inserting the lesson into an existing project. Pass a host's actual `History` to the constructor to share Undo. Every successful discrete operation advances the session revision; human commits/undo advance it on the next inspection. Source history revision is separate. `snapshot()` returns committed editable source, while `advance(seconds)` returns the presentation pose. Controls and runtime inputs never enter source exports.

`inspect` pages at most 100 nodes. `execute` accepts `patch`, `controls`, `play`, `input` and `control`. Patches contain 1–64 commands: create/update/remove/reparent nodes, create animation/machine, set key/playback, shape creation/parameters/detachment, compound combine/release, path joining, IK, skin binding and manual/automatic/smoothed weights with per-control influence locks. The exported `commandSchema` declares each payload and its bounds. All candidates must pass project validation. Locked targets/ancestors and cross-artboard targets reject. The request budget is 64 KiB; replay caches retain at most 128 successful requests and about 1 MiB of fingerprints. An identical retry returns the original result; a changed payload cannot reuse its ID. An evicted stale request conflicts instead of replaying a trigger.

Control manifests expose 1–16 labeled sliders, checkboxes or buttons and bind to one animation's speed or one machine's stable input IDs. Sliders validate range and step; checkboxes match boolean inputs; buttons match triggers. A binding may appear once. One animation/machine per presentation is the initial subset. Animation speed supports 0–64; zero freezes phase. Source-authored playback speed remains 0.01–16. This does not implement arbitrary data binding or multi-layer machine playback.

`acknowledge(cueId, sceneRevision)` is for a rendering host **after** assets prepare and the pose draws. A successful tool call alone is not visual readiness. `events(since)` retains 256 events, including audience control/input values. Changed-ID responses/events list at most 100 IDs with `changedTotal` for the full count; `resetRequired` means inspect/snapshot instead of assuming a complete replay. There is no voice/media clock or automatic agent notification transport. `close()` revokes mutations, clears runtime state/controls and drops retry storage.

See [the implementation contract](../../docs/33-local-commands-and-mcp.md), the original Compass study and [local adapter](../../tools/mcp-local.mjs). No npm publication or hosted integration is performed here.
