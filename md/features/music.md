# Music

Frontend music UI/store is under `features/sessions` and `stores/music`.
Backend routes are in `internal/web/music.go`, persistence in
`internal/store/music.go`. Personal and system files are in S3-compatible
object storage; the system catalog manifest and provenance are under
`internal/systemmusic`.

## Model

Personal tracks belong to the uploading user and can be linked to that user's
albums and tags. Albums and tracks with `isSystem=true` have no owner, are
available to every authenticated user, and are read-only through the API.
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
albums and provides CRUD, track links and ordering only for personal albums.
`/api/music/tags` provides CRUD and track links. Session-authorized playback URL
and synchronized state are exposed under `/api/sessions/{uuid}/music...`.

Audio is not streamed through PostgreSQL or the Go server. Metadata is
relational and all object keys point to S3; system objects use the versioned
`system-music/v1/` prefix. Playback URLs use a one-hour lifetime.

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

System albums show their CC0/source metadata. Their upload dropzone, album
actions, sorting, and track menus are absent. These UI guards complement the
server authorization checks; they are not the security boundary.

## Upload limits

Frontend accepts audio files and enforces the displayed per-file limit. The Go
handler applies its own request/file validation; nginx must allow a request
large enough for the configured maximum. Upload errors are shown in UI state.

## Synchronization

DM actions update server music state; participants poll/receive the same state
and resolve playable URLs with session authorization. Track metadata cache is
owned by the music store. A newly uploaded track absent from a saved order is
appended as current product behavior, not treated as an old data format.
