# Music

Frontend music UI/store is under `features/sessions` and `stores/music`.
Backend routes are in `internal/web/music.go`, persistence in
`internal/store/music.go`. Personal and system files are in S3-compatible
object storage; the system catalog manifest and provenance are under
`internal/systemmusic`.

## Model

Personal tracks belong to the uploading user and can be linked to that user's
albums and tags. Albums and tracks with `isSystem=true` have no owner and are
available to every authenticated user. Their files and metadata are read-only,
but every user may link a system track to their own albums and tags. Those
links are returned only to their owner.
Stable internal `system_key` values make their startup seed idempotent. System album
metadata includes the author, source page, and public-domain dedication.
Album-track links store explicit order. Session music state stores current/next
track, playback position, playing flag, volume, loop and crossfade settings.

The bundled CC0 catalog contains 21 tracks in four albums:

- `Фэнтези: странствия` — 8 tracks;
- `Таверны и города` — 4 tracks;
- `Подземелья и атмосфера` — 5 tracks;
- `Бои` — 4 tracks.

Per-file authors, source pages, download dates, object keys, and SHA-256 hashes
are recorded under `internal/systemmusic`.

## API

`/api/music/tracks` lists the user's own tracks plus system tracks and provides
upload/search/rename/delete and playback URL access. Personal and system
playback both use signed S3 URLs. `/api/music/albums` lists personal plus system
albums and provides CRUD and ordering only for personal albums; personal albums
may contain both owned and system tracks. `/api/music/tags` provides personal
tag CRUD and links for owned or system tracks. Session-authorized playback URL
and synchronized state are exposed under `/api/sessions/{uuid}/music...`.
When the display flag is enabled, the anonymous presentation projection exposes
only validated playback fields and signed URLs for tracks owned by the session
owner or the system catalog; it never exposes the owner's music library.

Audio is not streamed through PostgreSQL or the Go server. Metadata is
relational and all object keys point to S3; system objects use the versioned
`system-music/v1/` prefix. Playback URLs use a one-hour lifetime.

## UI standards

`SessionMusicWorkspace.vue` is the central content of the DM-only
`Музыка` session tab. It uses the same participant/right-tool safe areas as the
other central workspaces and replaces the previous fullscreen library modal.
Albums and tracks are rendered as two sibling workspace panels on the common
session canvas, without an enclosing library-window frame.
It uses:

- `AppModalFrame` for nested tag/album dialogs;
- `TextPromptDialog` for create/rename;
- `ConfirmDialog` for destructive actions;
- `useSortable/reorderByDrop` for track order and dropping tracks on albums;
- `RowActionMenu` for track actions;
- `AppSlider` for volume/crossfade.

No local modal backdrop, browser prompt/confirm or separate drag engine should
be added. Tag/album pickers remain nested dialogs inside the workspace and obey
the shared modal stack's Escape ordering. The compact right-rail `MusicPanel`
is only the current-track player; it no longer opens a library window.

System albums are shown in a separate sidebar section and show their CC0/source
metadata. `Все треки` contains only personal tracks. Clicking a track selects
it, Shift-click selects a range, and the selection bar exposes bulk album/tag
operations. Selected tracks can be dragged by any non-interactive part of a row
onto a personal album. System tracks expose personal album and tag actions, but
not rename/delete; system albums still disable upload, album actions and sorting.
These UI guards complement the server authorization checks; they are not the
security boundary.

## Upload limits

Frontend accepts audio files and enforces the displayed per-file limit. The Go
handler applies its own request/file validation; nginx must allow a request
large enough for the configured maximum. Upload errors are shown in UI state.

## Synchronization

DM actions persist server music state and publish an SSE screen invalidation.
With display playback disabled the DM's two-audio-element engine is audible.
With it enabled the same engine runs silently as the authoritative controller
while the public display mirrors play/pause, seek, volume, loop and crossfade
from a safe projection. The display derives the current position from the
persisted position plus server timestamps, corrects drift on control sync, and
falls back to polling when SSE is unavailable. Browser autoplay rejection is a
visible recoverable state rather than a silent failure. Track metadata cache is
owned by the music store. A newly uploaded track absent from a saved order is
appended as current product behavior, not treated as an old data format.
