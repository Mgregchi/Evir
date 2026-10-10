# Shared frontend UI

Private `@evir/ui` supplies the living seed loading state, dismissible accessible feedback and shared styles to web and Studio. It is not an engine package or hosted app. There are no new environment variables, accounts or services.

Loading motion has a static reduced-motion alternative. Feedback uses text content and status/alert roles without moving focus. Errors persist until dismissed or replaced; success messages expire after eight seconds, with timers paused while the message is hovered, focused or the document is hidden. Dismissal returns focus to the originating control when it still exists.

See [research and acceptance](../../docs/22-selection-and-experience-quality.md). Automated checks do not establish screen-reader usability.
