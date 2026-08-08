# Music

Read this before touching the music library or session player.

Two halves: a global per-user music library (uploaded to S3) and a per-session player state controlled by the DM. The right column of `ViewSession.vue` hosts `MusicPanel` next to `DicePanel`; `MusicLibraryModal` is a fullscreen overlay launched from the panel's "библиотека ↗" link.

## Data model

Tables (see `resources/music.sql`):

- `music_track (id, uuid, owner_user_id, name, file_key, file_name, duration_sec, file_size, mime_type, created_at)` — file metadata. `file_key` is the S3 key.
- `music_album (id, owner_user_id, name, color, created_at)` — per-user collection. `color` is a hex string for the sidebar dot.
- `music_album_track (id, album_id, track_id, position)` — many-to-many membership + per-album ordering. `UNIQUE (album_id, track_id)`. Cascade delete on either side.
- `music_tag (id, owner_user_id, name)` — per-user tags, `UNIQUE (owner_user_id, name)`.
- `music_track_tag (track_id, tag_id)` — m:m, primary key `(track_id, tag_id)`.
- `session_music_state (id, session_id UNIQUE, data JSONB, changed_at)` — current player state per session. Upserted by `session_id`.

`session_music_state.data` shape:
```ts
{
  playing: boolean
  trackId: number | null
  albumId: number | null         // album the current track is playing from (drives auto-advance in album loop mode)
  positionSec: number
  durationSec: number            // not persisted as authoritative — taken from track on load
  volume: number                 // 0..1
  crossfadeDurSec: number        // 0..15
  nextTrackId: number | null     // explicit "play next" override; max one item
  loopMode: 'album' | 'track'
}
```

## Backend

### Library — `/api/music/...` (owner-only)

`MusicLibraryController.kt` enforces `track.owner_user_id == userId` / `album.owner_user_id == userId` via `requireOwnedTrack` / `requireOwnedAlbum`.

- `GET /tracks` — returns `{ tracks: MusicTrack[] }` with embedded `albumIds: number[]` and `tags: MusicTag[]`.
- `POST /tracks` — multipart: `file`, optional `name`, `durationSec`, `albumId`. Validates `mime.startsWith("audio/")` and size ≤ 50MB. Uploads to S3 under `music/<userId>/<uuid>.<ext>`. If `albumId` is supplied and owned, the track is appended to that album.
- `PATCH /tracks/{id}` `{ name }` — rename.
- `DELETE /tracks/{id}` — DB delete + best-effort S3 delete (ignored on error).
- `GET /tracks/{id}/url` — `{ url, ttlSec: 3600 }`, presigned via `ObjectStorageService.presignGet`.
- `GET /tracks/search?q=&tagIds=` — server-side filter (substring + AND across tags).
- `GET /albums` — returns `{ albums: MusicAlbum[] }` with `trackCount`.
- `POST /albums` `{ name, color? }`.
- `PATCH /albums/{id}` `{ name?, color?, colorChanged }` — `colorChanged` flag required to write `null` color.
- `DELETE /albums/{id}` — cascades `music_album_track`; tracks stay in the library.
- `GET /albums/{id}/tracks` — ordered by `music_album_track.position`.
- `POST /albums/{id}/tracks` `{ trackId }` — appends to album with `MAX(position) + 1`.
- `DELETE /albums/{id}/tracks/{trackId}`.
- `PUT /albums/{id}/order` `{ trackIds: number[] }` — rewrites positions to match the array order.
- `GET /tags` — list user's tags.
- `POST /tags` `{ name }` — create a global tag (idempotent — returns existing if found by case-insensitive name).
- `PATCH /tags/{id}` `{ name }` — rename. Cascades into every track's embedded tag copy on the client.
- `DELETE /tags/{id}` — drops the tag and unbinds it from every track via `ON DELETE CASCADE` on `music_track_tag`.
- `POST /tracks/{id}/tags` `{ name }` — create-or-reuse + attach by name (used by inline tag adding).
- `POST /tracks/{id}/tags/{tagId}` — attach an existing tag to a track by id (used by the per-track tag picker).
- `DELETE /tracks/{id}/tags/{tagId}` — detach.

### Session state — `/api/sessions/{uuid}/music`

`SessionController.kt` reuses `requireSession` semantics:

- `GET /sessions/{uuid}/music` — any member, returns raw JSON (`{}` if missing).
- `PUT /sessions/{uuid}/music` — DM only (`ownerUserId == userId`). Whole body is stored verbatim as JSONB.
- `GET /sessions/{uuid}/music/tracks/{trackId}/url` — DM only. Looks up the track via `MusicLibraryRepository.getTrackById`, verifies it belongs to the DM, returns a presigned URL.

### S3

`ObjectStorageService.uploadAudio` writes audio mime types under a folder; `presignGet(key, ttlSeconds = 3600)` returns a signed GET URL. The presigner is a lazy `S3Presigner` built with the same credentials/endpoint as the upload client.

### Tomcat / multipart

`application.yml` sets `spring.servlet.multipart.max-file-size: 50MB` and `max-request-size: 55MB`. nginx in front must also allow at least `client_max_body_size 60M;` in the HTTPS `server` block (typo trap — the HTTP→HTTPS redirect block does not consume the body, so setting it there has no effect).

## Frontend

### `shared/api/musicApi.js`

Thin wrappers per endpoint. `uploadTrack` is special — uses `XMLHttpRequest` with multipart `FormData` and reports `onProgress`.

### `stores/music.js` — `useMusicStore`

Owns both the library cache and the player engine. The engine is single-instance per page (two `<audio>` elements created at module load).

**Library cache:**
- `tracks`, `albums`, `tags` flat refs. `ensureLibrary()` triggers a single batched fetch.
- `trackById`, `albumById` — O(n) lookups.
- `uploadTrack`, `renameTrack`, `deleteTrack`, `createAlbum`, `updateAlbum`, `deleteAlbum`, `addTrackToAlbum`, `removeTrackFromAlbum`, `addTrackTag`, `removeTrackTag` — call the API and mutate the cache in-place.
- `albumOrder: { [albumId]: number[] }` — saved track order per album. Populated on demand by `loadAlbumTracks(albumId)`. `reorderAlbum(albumId, ids)` optimistically updates this map and calls the order endpoint.

**Player engine:**
- `state` is a `reactive({...})` mirroring `session_music_state.data` plus a transient `crossfading` flag.
- Two `Audio` elements (`audioA`, `audioB`); `activeEl` is currently audible, `idleEl` is preloaded for the next crossfade.
- `setContext({ uuid, dm })` is called by `ViewSession.onMounted` after loading the session. The DM flag gates writes and chooses which presign endpoint to use.
- `getPlayableUrl(trackId)` caches URLs in a `Map<trackId, { url, expiresAt }>` and refreshes when close to expiry. For non-DM viewers it uses `/api/music/tracks/{id}/url` (but they typically can't reach that — they read the session state and rely on `getSessionMusic` to display "now playing" without playback).
- `playTrack(id, { albumId, immediate })`:
  - If `immediate` or `crossfadeDurSec <= 0` or the active element is paused, the URL is swapped into `activeEl` and played directly.
  - Otherwise the URL is loaded into `idleEl` at volume 0; `runCrossfade()` ramps `fromEl.volume` down and `toEl.volume` up over `crossfadeDurSec` seconds using `requestAnimationFrame`. At the end the roles flip.
- `pause()` / `resume()` toggle `activeEl`. `resume()` re-acquires the URL if `activeEl.src` is empty (e.g. after `loadSessionState`).
- `seek(sec)` writes `activeEl.currentTime` and immediately persists.
- A 500ms `positionTimer` mirrors `activeEl.currentTime` into `state.positionSec`.
- `setNext(trackId)` — single-slot queue. Silently ignored if `trackId === state.trackId` (current track can't be its own "next").
- `clearNext()` — drop the override.
- `toggleLoopMode()` — flips `'track'` ↔ `'album'`.
- `playNextFromQueue()` — pops `nextTrackId` and plays it (uses crossfade unless `immediate`).
- `ended` handler on both audio elements decides what to do next:
  1. If `nextTrackId` set → play it immediately (with crossfade).
  2. Else if `loopMode === 'track'` → restart the current track.
  3. Else (`'album'`) → find the next track in `state.albumId` via `nextAlbumTrackId()` (loops to first at the end). If no album context, stop.

**Persistence:** `schedulePersist()` debounces 500ms; `schedulePersist(true)` writes immediately. `persist()` builds a snapshot and PUTs to `/api/sessions/{uuid}/music`. `loadSessionState()` hydrates the state on mount; `playing` is always `false` after load (auto-play would clobber browser autoplay policies and surprise the DM).

`dispose()` is called from `ViewSession.onBeforeUnmount` — pauses both audio elements, kills the timers, flushes the debounce.

### `features/sessions/components/MusicPanel.vue`

Right-column widget. It renders **flat on the surrounding `.side-tile`** — content sits directly on the tile background (like `DicePanel`), NOT inside its own bordered/rounded card. Do **not** wrap the "now playing" area in a `var(--block-bg)` card again: a same-bg card inside the same-bg tile reads as a "block in a block". Layout:
- Header: `МУЗЫКА · «<album>» · библиотека ↗`.
- `.now` (transparent, flows on the tile) with:
  - Transport row: play/pause button, status (`ИГРАЕТ` / `ПАУЗА` / `НИЧЕГО НЕ ИГРАЕТ`), track title, time `mm:ss / mm:ss`, and a loop button on the right (solid/outlined album-loop SVG; the `'track'` variant overlays a "1" glyph).
  - `.now-seek` — a full-width 6px rounded seek bar below the transport row, clickable to seek (DM only).
  - Volume slider (`AppSlider`) under a hairline `var(--border)` divider.
- `.next-card` (dashed border) — appears only when `state.nextTrackId` is set. "Play now" arrow on the left, name in the middle, × on the right to clear.

Cross-fade duration is **not** in the widget — it lives only in the library modal footer.

### `features/sessions/components/MusicLibraryModal.vue`

DOM tree (matters for layout):
```
.music-lib
├── .music-lib-head            (var(--bg-header))
└── .music-lib-body            (row flex)
    ├── .music-lib-sidebar     (260px, var(--bg)) — albums + dropzone
    └── .music-lib-main-col    (column flex)
        ├── .music-lib-main    (var(--bg-deep)) — header/search/tags/tracks, scrollable
        └── .music-lib-foot    (var(--bg-header)) — player bar, prevented from covering the sidebar by being nested inside main-col
```

The footer is intentionally **inside** `.music-lib-main-col` so it spans only the right column. Putting it back as a sibling of `.music-lib-body` will make it overlap the sidebar.

**Sidebar:**
- "Все треки" pseudo-album always present and pre-selected.
- Each `MusicAlbum` is a row with a color dot and a `trackCount`. Clicking selects it.
- The dropzone is the only upload trigger — it is both a `<button>` (clicking opens the system file picker via a hidden `<input ref="fileInputEl">`) and a drop target. The dragenter/dragleave flicker that comes from child elements is avoided by setting `pointer-events: none` on the dropzone's children **and** keeping a `dragCounter` that increments on `dragenter` and decrements on `dragleave`; `dropActive` is true while `dragCounter > 0`.

**Main column:**
- Search input filters by name and tag substring. Tag chips toggle an AND filter.
- The track list is sorted by `albumOrder[selectedAlbumId]` when an album is selected (via `displayedTracks`). For "Все треки" or when search/tag filters are active, the list keeps the underlying `tracks` order.
- Drag-to-reorder is wired via the shared `useSortable` composable from `@/shared/composables/useSortable`. It is enabled only when `canSort` is true (`selectedAlbumId` set and no search/tag filters active). The drag handle on each row is the 3×2 dot grid in `MusicTrackRow`. On drop, `reorderAlbum(albumId, newIds)` is called.
- The track list is rendered via `sortable.displayItems('tracks')` (not directly from `displayedTracks`) so the source row visually moves to the hover position during the drag. The current source is marked with `:is-placeholder="sortable.isSource(t)"`, which `MusicTrackRow` translates into the `music-row--placeholder` class — content hidden with `visibility: hidden`, dashed accent border kept in place.
- "Все треки" or any filtered view disables the drag handle to avoid ambiguous reorder semantics.

**Footer (player bar):**
- Left: large play/pause button, loop button, track title, clickable progress, `mm:ss / mm:ss`.
- Center: "Переключить сейчас" (calls `playNextFromQueue`, disabled when no next), `фейд` slider (0–15s), `громкость` slider (0–100%).
- Right: `СЛЕДУЮЩИЙ` block with title / album, and a `× убрать` button (`clearNext`).

**Album picker** (popup over the modal): triggered from the row menu "Изменить альбом". Lists all albums with checkboxes for the track; toggling adds/removes via `addTrackToAlbum` / `removeTrackFromAlbum`. The track's `albumIds` is read back from the store on each toggle so the picker stays in sync.

**Track tag picker** — same overlay style, triggered from the row menu "Теги". Checkboxes against the user's full tag list; toggles call `attachTrackTag` / `removeTrackTag` (the store keeps the modal's bound track reference fresh from the cache after each call).

**Tag manager** — opened from the `изменить теги` button at the end of the tag filter row under the search bar. Plain list of tags with inline rename (pencil icon swaps to an input — Enter saves via `renameTag`, Esc cancels) and `×` delete. The bottom has a `новый тег` input + `+ добавить` button (`createTag`). Deleting a tag also removes it from any active filter (`activeTagIds`).

### `features/sessions/components/MusicTrackRow.vue`

Single row. Layout: `[drag-handle?] [play] [title + state badge] [tags] [time] [«след.» button] [⋯ menu]`.

- Background is transparent by default; only the **currently playing** row gets a quiet `color-mix()` tint derived from `--accent` plus the accent border. The `--current` class (currently-playing but paused) uses `--input-border`. This keeps the list visually quiet — only one row stands out.
- The «след.» toggle is disabled when `isCurrent` (you can't queue the track that's already playing).
- The menu items are `Изменить альбом`, `Теги`, `Переименовать`, `Удалить`. There is no "Добавить в очередь" — the row's own «след.» button is the only way to set the next track.
- The drag handle (6 dots, 3×2) is rendered only when `draggable` is true. The parent passes an `onDragStart(e, track)` callback that wraps `sortable.startDrag` with the correct index.

### `shared/ui/AppSlider.vue`

Reusable slider built on pointer events (no native `<input type="range">`). API: `v-model:modelValue` (number), `min`, `max`, `step`, `disabled`. Emits `update:modelValue` continuously while dragging and `change` on pointerup. Track has a fill + a 12px round thumb in `var(--accent)`. Used by `MusicPanel` (volume) and `MusicLibraryModal` (fade, volume).

When adding a new use site, the slider is `flex: 1` and 18px tall — give it a containing flex row with a label on the left and a value readout on the right.

## File layout

```
backend/
  src/main/kotlin/com/sylvieshare/dndshare/
    model/Music.kt
    repository/MusicLibraryRepository.kt
    repository/SessionMusicStateRepository.kt
    rest/MusicLibraryController.kt
    rest/SessionController.kt        (music endpoints appended)
    service/ObjectStorageService.kt  (presignGet + uploadAudio)
  src/main/resources/application.yml (50MB multipart)

frontend/src/
  shared/api/musicApi.js
  shared/ui/AppSlider.vue
  stores/music.js
  features/sessions/components/
    MusicPanel.vue
    MusicLibraryModal.vue
    MusicTrackRow.vue
  features/sessions/pages/ViewSession.vue (mounts MusicPanel + MusicLibraryModal, sets store context)

resources/music.sql
```

## Things to remember when changing this

- The footer (`.music-lib-foot`) **must** stay nested inside `.music-lib-main-col`. Moving it out makes it cover the album sidebar.
- `nextTrackId` is a single-slot value, not an array. If you reintroduce a multi-track queue, change `MusicPanel`/`MusicLibraryModal`/`MusicTrackRow` together — they all assume "either set or null".
- The crossfade engine swaps `activeEl` ↔ `idleEl` mid-ramp. Don't access them by literal `audioA`/`audioB` from outside the closure.
- Uploads bigger than ~1MB will fail at nginx unless `client_max_body_size` is set in the **HTTPS** `server` block (not the HTTP redirect block).
- The wiki under `md/features/sessions.md` references the right column hosting `DicePanel`. Both DicePanel and MusicPanel now stack there — see the `.col-right { display: flex; flex-direction: column; overflow-y: auto; }` rule in `ViewSession.vue`.
