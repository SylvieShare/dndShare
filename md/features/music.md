# Music

Frontend music UI/store is under `features/sessions` and `stores/music`.
Backend routes are in `internal/web/music.go`, persistence in
`internal/store/music.go`, files in S3-compatible object storage.

## Model

Tracks belong to the uploading user and can be linked to albums and tags.
Album-track links store explicit order. Session music state stores current/next
track, playback position, playing flag, volume, loop and crossfade settings.

## API

`/api/music/tracks` provides list/upload/search/rename/delete and signed URL
access. `/api/music/albums` provides CRUD, track links and ordering.
`/api/music/tags` provides CRUD and track links. Session-authorized playback URL
and synchronized state are exposed under `/api/sessions/{uuid}/music...`.

Audio is not streamed through PostgreSQL. Metadata is relational; object keys
point to storage and playback uses short-lived URLs.

## UI standards

`MusicLibraryModal.vue` is a fullscreen `AppModal`. It uses:

- `AppModalFrame` for nested tag/album dialogs;
- `TextPromptDialog` for create/rename;
- `ConfirmDialog` for destructive actions;
- `useSortable/reorderByDrop` for track order;
- `AppSlider` for volume/crossfade.

No local modal backdrop, browser prompt/confirm or separate drag engine should
be added. Tag/album pickers are nested content inside the library and obey the
shared modal stack's Escape ordering.

## Upload limits

Frontend accepts audio files and enforces the displayed per-file limit. The Go
handler applies its own request/file validation; nginx must allow a request
large enough for the configured maximum. Upload errors are shown in UI state.

## Synchronization

DM actions update server music state; participants poll/receive the same state
and resolve playable URLs with session authorization. Track metadata cache is
owned by the music store. A newly uploaded track absent from a saved order is
appended as current product behavior, not treated as an old data format.
