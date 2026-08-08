# Frontend Overview

This file is the AI-agent entry point to the frontend. It enumerates every shared primitive you should reach for before writing new UI plumbing. The "Shared UI primitives" and "Modals and forms" sections below are the single source of truth — if you find yourself building a modal/dropdown/form trio from scratch, you missed something here.

## Project

D&D character sheet manager. The frontend is a Vue 3 single-page app that renders editable character sheets, templates, dictionaries, and item objects. Backend details are intentionally omitted unless they affect frontend contracts.

## Stack

- Vue 3
- Vue Router
- Pinia
- Composition API with composables
- **Vite 8** build (`vite` + `@vitejs/plugin-vue` 6); config in `frontend/vite.config.js`. There is no webpack/Babel/eslint toolchain anymore (migrated off the EOL `@vue/cli-service`). The Maven build runs npm via `frontend-maven-plugin`; the pinned Node is **v20.19.0** (Vite 8 and vue-router 5 require `^20.19.0 || >=22.12.0`). Bump `node.version` in `frontend/pom.xml`, not anywhere else.

Source root: `frontend/src/`.

Key Vite specifics (don't reintroduce webpack-isms):
- Entry is `frontend/index.html` (project root, **not** `public/`); it loads `/src/main.js` as a module.
- `@` → `src` alias and a `.vue` entry in `resolve.extensions` (so existing extensionless `@/.../ViewX` imports keep resolving) live in `vite.config.js`.
- Browser env is `import.meta.env.*`, never `process.env.*`. Base path is `import.meta.env.BASE_URL`.
- Static assets in `frontend/public/` are served at the site root; reference them with absolute URLs like `/static/foo.svg` (not relative `../public/...`).
- Build output goes to `frontend/target/dist` (`build.outDir`) with assets under `static/` (`build.assetsDir`) to match the backend resource copy in `backend/pom.xml`.

### Dependency security

`npm audit` is clean (**0 vulnerabilities**, ~116 packages) after the Vite migration — the whole vue-cli/webpack vuln surface is gone. Keep it that way: pin `axios` to a current patch (≥1.18.0; older 1.x has shipped runtime advisories) and prefer adding few, modern devDependencies.

## Structure

```text
frontend/src/
  app/
    router.js          # route definitions, prefetch guard, document titles

  shared/
    api/               # low-level and feature API clients
    ui/                # reusable UI widgets
    lib/               # shared pure helpers

  features/
    admin/             # admin panel (users, roles, logs) — see md/features/admin.md
    auth/
    error-report/      # global point-at-element bug reports — see md/features/error-reports.md
    character-list/
    character-editor/
    handbook/
    items/
    sessions/          # session shell, encounter, scenes, dice, music — see md/features/sessions.md
    template-editor/

  stores/              # Pinia stores
  views/
    PageMain.vue       # main landing/shell page
```

Dice tray and music player live inside the sessions UI but have their own dedicated docs
(`md/features/dice.md`, `md/features/music.md`); their state is in `stores/dice.js` and
`stores/music.js`, with parsing helpers in `shared/lib/dice.js`.

Import the router from `@/app/router` and HTTP helpers from `@/shared/api/http` (or a feature API client). The old `Router.js` / `myFetch.js` / `app/store.js` re-export shims have been deleted.

## Routing

Routes live in `frontend/src/app/router.js`.

Route components are imported **statically** into `router.js` — the whole app ships as a single bundle on purpose (the project is small enough that one chunk is simpler than route-level splitting). `vite.config.js` enforces this with `build.rolldownOptions.output.codeSplitting = false` + `cssCodeSplit = false` (one JS + one CSS file), and raises `build.chunkSizeWarningLimit` so the deliberately-large bundle doesn't warn. If the app grows enough to warrant it, switch routes to `component: () => import('@/...')` and drop those overrides.

The router uses HTML5 history mode (clean URLs, no `#`), so deep-linking a route like `/chars` makes the browser request that path from the backend. The backend serves the SPA for such navigation paths via a `PathResourceResolver` fallback to `index.html` in `backend/.../base/WebApplicationConfig.kt` (any path that isn't an existing static file, `/api/**`, `/mcp`, or a file with an extension returns `index.html`). Do not remove this when upgrading Spring — in Boot 4 the old `ErrorPage(NOT_FOUND → /notFound)` fallback stopped working because `ResponseEntityExceptionHandler` now intercepts `NoResourceFoundException` and returns a ProblemDetail 404 first.

### Route transitions and prefetch

`App.vue` wraps the routed content (but not `AppHeader`, the global dice popup, or the global error reporter) in a short horizontal Vue transition. `router.js` exposes `pageTransitionName` and derives its direction from route meta: moving deeper within one section is forward, moving back to its parent is backward, and moving between top-level sections follows the `HorizontalMenu` order. Query-only changes reuse the same `route.path` key and do not animate. Initial deep links do not animate because the transition has no `appear` prop. `prefers-reduced-motion` disables the motion.

Every page route must declare `meta.section` and `meta.depth`; sibling detail routes may also use `meta.pageOrder`. Keep the section order in `router.js` aligned with `HorizontalMenu` when changing the main navigation. The fixed `mode="out-in"`, a single keyed component branch, and the always-present transition wrapper are intentional: do not switch modes dynamically or add `v-if/v-else` branches around the route component.

Route prefetch is independent of the animation — it warms a page's data the moment navigation starts so the view usually has it on mount.

Main-menu pages declare `meta.prefetch(to)` in `router.js`. A `router.beforeEach` guard fires the prefetch function the moment navigation starts and stores the returned promise in a Map keyed by `to.fullPath` (TTL 30s). The new page reads it inside `onMounted` via `consumePrefetch(route.fullPath)` and feeds it to its loader instead of starting a fresh request. If nothing is prefetched (deep link, reload mid-transition, or admin page), the loader falls back to its normal HTTP call.

When adding a new main-menu page:
1. Add `meta.prefetch: () => useFooStore().ensure()` (preferred — uses existing ensure-store dedup) or `meta.prefetch: () => fetchGet('/foo')` to its route entry in `router.js`.
2. In the page's `onMounted`, import `consumePrefetch` from `@/app/router` and pass its result to the loader as the optional first arg. The loader should accept `(preFetched)` and use `preFetched || freshFetch()`.
3. Don't use this for nested pages with route params (`/char/:uuid`, `/session/:uuid`) yet — those need a different scheme (per-id cache, not per-path).

### List ↔ character navigation

Opening a character from the list (`CharBox.navigate`) and "back" (`CharEditorToolbar.goBack`) are plain `router.push` navigations between `/chars` and `/char/:uuid`. The shared route transition supplies the small forward/backward page slide; there is no tile-expand morph.

History: this used to be a tile→page **View Transition** morph (shared elements `char-expand` / `char-expand-ava`, driven by `expandController.js` / `expandState.js` / `viewTransition.js`, with the timing block in `App.vue` global CSS). All of that was **deleted** — the three files are gone, the VT CSS is gone, and `AvatarBlock` / `ViewCharacter` no longer tag a `viewTransitionName`. If you find references to `openExpand` / `closeExpand` / `expandingUuid` / `char-expand`, they're stale.

`App.vue` keeps `ViewListCharacters` alive, so returning to the list restores scroll and avoids a refetch. The transition has one keyed component branch (`route.path`) inside that same `keep-alive`: this preserves the list cache and remounts parameterized detail pages with their current id. Query changes intentionally keep the same key.

**Synchronous content (kept).** `CharBox` still seeds the full character into `charSeed.js` on click; `useCharacterData.loadSync()` applies it **synchronously in `ViewCharacter` setup()** (auth resolves in the background and only flips `isOwner` after). Idempotent (one-shot seed). No `/char/:uuid` fetch when seeded → the page renders content immediately with no skeleton flash. This is a prefetch optimization, independent of any animation.

**Deep link** to `/char/:uuid` renders the page as a normal route — no animation. Don't break this.

Important pages:
- `/admin` -> `features/admin/pages/ViewAdmin.vue`
- `/sessions` -> `features/sessions/pages/ViewSessions.vue`
- `/sessions/:uuid` -> `features/sessions/pages/ViewSession.vue`
- `/chars` -> `features/character-list/pages/ViewListCharacters.vue`
- `/char/:uuid` -> `features/character-editor/pages/ViewCharacter.vue`
- `/templates` -> `features/template-editor/pages/ViewTemplates.vue`
- `/template/:id/edit` -> `features/template-editor/pages/ViewTemplateEditor.vue`
- `/handbook`, `/handbook/objects` -> `features/handbook/pages/ViewHandbook.vue`
- `/handbook/dictionary` -> `features/handbook/dictionary/ViewDictionary.vue`

## State

State is managed by Pinia stores in `frontend/src/stores/`.

Current stores:
- `account.js` - auth status, login/logout/checkAuth
- `suggest.js` - suggest dictionary cache and batched loading (see "Request dedupe / caching" below)
- `itemTypes.js` - item-type schema cache (`/api/item-types`); single fetch per session, all components read from this store instead of calling the endpoint directly
- `template.js` - template cache
- `text.js` - localized/common text
- `ui.js` - app UI state such as header title and scroll position
- `dice.js` - dice roller history and popup state (see `md/features/dice.md`)
- `music.js` - per-session music player state, crossfade engine (see `md/features/music.md`)

Use stores directly from `setup()` / `<script setup>`:

```js
import { useSuggestStore } from '@/stores/suggest'

const suggestStore = useSuggestStore()
await suggestStore.ensure(typeId)
```

When reading Pinia state that must stay reactive after destructuring, use `storeToRefs`.

### Request dedupe / caching rules

Two endpoints are always-hot and previously got hammered by many parallel callers. Don't call them directly from components — use the store wrappers below. They guarantee one in-flight HTTP request per session per cache key.

**`/api/item-types` → `useItemTypesStore`** (`stores/itemTypes.js`):

- `ensureAll()` — loads `/item-types` once per session, returns array of all types. Subsequent calls return the cached array. Concurrent callers share the same in-flight promise.
- `ensureBySource(sourceId)` — does `ensureAll()` then filters on the frontend. The legacy `/item-types?sourceId=N` URL is no longer used anywhere — backend filter is functionally identical to a client-side `filter(t => t.sourceId === sourceId)`.
- `ensureType(id)` — convenience helper around `ensureAll()` + `getType(id)`.
- `getType(id)` / `typesBySource(sourceId)` — sync getters over the cached state.

Components that previously called `fetchGet('/item-types')` (ViewHandbook, HandbookLanding, ItemEditModal, ItemPickerModal, NpcPickerModal, ItemViewModal, HeaderSearch, DndWeapons, DndItems, sessions `encounterHelpers`) now all go through this store. `itemsApi.getTypes()` was removed.

**`/api/suggest/batch` → `useSuggestStore.ensure(typeId)`** (`stores/suggest.js`):

- Multiple calls to `ensure(typeId)` for the same typeId — even across ticks while a fetch is in flight — share one promise (`ensureInflight` map). After the response, the cache is populated and further calls resolve synchronously.
- Calls to `ensure(typeId)` for different typeIds within the same microtask are coalesced into a single `/suggest/batch?typeIds=A,B,C,...` request via `batchQueue` + a microtask flush.
- The previous implementation reset its inflight flag *before* the fetch resolved, so callers arriving after the microtask but before the response started a new batch — that bug caused 3× duplicate `batch?typeIds=...` requests on the bestiary handbook page and is fixed.
- `ensureItems(typeId, ids)` — also deduped: parallel callers asking for the same `(typeId, missingIds)` tuple share one `/suggest/{typeId}/items?ids=...` request via `itemsInflight`.

Invalidation: `useItemTypesStore.reset()` clears the cache (call it after admin edits item types). Suggest cache mutations are done via `set/addItem/removeItem` actions which keep the cached arrays in sync.

## Shared UI primitives — quick index

Everything in `shared/ui/` that you should reuse. Listed by what you'd build if you didn't know they existed:

| Need | Use | Don't reimplement |
| --- | --- | --- |
| Modal dialog with overlay | `shared/ui/AppModal` | overlay+box+backdrop+Escape+swipe-to-close |
| Window that morphs out of a tapped tile | `shared/ui/MorphSheet` | FLIP container-morph + subpage track + mobile fullscreen/swipe (see "Morph window") |
| Confirm yes/no | `shared/ui/ConfirmDialog` | mini-modal with title/message/confirm/cancel |
| Item view modal | `shared/ui/ItemViewModal` | wraps `AppModal` + `HandbookItemDetail` |
| Dropdown menu anchored to a button | `shared/ui/BasePopover` | Teleport + `getBoundingClientRect` + outside-click listeners |
| Status/role/multi-select toggles | `shared/ui/{ToggleSwitch,MultiToggle,EncCheckbox,ValueSelect}` | hand-rolled radio/checkbox/select. `MultiToggle` supports `neutralValue` — when the model equals it, the pill renders gray (used for tri-state filters like `Не важно / Да / Нет` and for dice `Помеха / Норм / Преимущество`). |
| Pick a color from presets | `shared/ui/ColorPresetPicker` | per-site arrays of preset hex swatches + bespoke swatch/native/hex markup (there were 7 divergent copies). The **one** color picker — see below. |
| Suggest (dictionary) autocomplete | `shared/ui/{SuggestAdd,SuggestDropdown,SuggestMultiSelect,SuggestPicker,SuggestEditModal}` | querying `useSuggestStore` + dropdown |
| Tags / bonus rows | `shared/ui/{BonusList}` | label+value+delete row arrays |
| Dashed "+ add" button | `shared/ui/AddButton` | re-styling a dashed add affordance per editor (there were 5 divergent ones). Props: `block` (full-width). Default slot = label (the `+` glyph is built in). |
| Remove "×" button | `shared/ui/RemoveButton` | re-drawing a delete cross per editor. Props: `variant` (`inline` default / `boxed`), `label`. Token-based dim→`--danger` hover. Renders a `<button>` — do **not** nest it inside another `<button>` row (use a `<span role=button>` there). |
| View-block header (title + edit pencil) | `shared/ui/SheetBlockTitle` | re-drawing a "title + pencil that opens the morph editor" per block. Props: `title`, `showEdit` (show pencil), `editFade` (fade pencil as the morph opens — bind the shell's `revealed`), `clickableTitle` (title text also emits `edit` — **default `true`**, so clicking the title opens the morph everywhere a pencil is shown; pass `:clickable-title="false"` to opt out). Slot `#aside` for a right-aligned extra (e.g. the stat save-chip). Emits `edit`. Used by `DndStatView`/`DndAbilitiesView`. Standard label = 11px/700/uppercase/`--text-muted`. |
| Rich text editor | `shared/ui/InputDescription` | contenteditable + foreColor execCommand |
| Display rich HTML (descriptions/notes) | `shared/ui/RichContent` | a bare `v-html` + per-site `:deep(h*/ul/li/table)` copies. **Single renderer** for any HTML produced by `InputDescription` — props: `html`. Owns the canonical typography; base font-size/colour are inherited from the call site (put your sizing class on `<RichContent>`). It is the one seam where future interactive elements (dice rolls, references) get parsed out of the stored markup — keep that in its `rendered` computed. Every description/notes display goes through it (item/ability/spell/potion/weapon/enemy detail, weapon notes, tooltips, handbook, dictionary, scene tiles). |
| Search input with results | `shared/ui/HeaderSearch` | input + dropdown of results |
| Dice popup stack | `shared/ui/DiceRollPopup` (auto-mounted from `App.vue`) | toasts for dice rolls |
| Header bar | `shared/ui/AppHeader` (auto-mounted from `App.vue`) | top app bar |
| Row 3-dot menu | `shared/ui/RowActionMenu` | inline kebab menu with slot |
| Slider | `shared/ui/AppSlider` | range input |
| Horizontal scroll menu | `shared/ui/HorizontalMenu` | scrollable tab strip |
| Desktop tab switcher (sliding underline) | `shared/ui/SlidingTabs` | the animated tab nav with the accent underline that slides/resizes to the active tab. Props `tabs` (`[{ key, title, svg? }]`) + `v-model` on the active key. **Use this for any tab bar** — do not re-style buttons + a `border-bottom`. Used by `LayoutInnerTabs` (character sheet) and `ViewSession` (Бой/Сцена/Заметки). It renders only the nav; the consumer owns the content panes. |
| Borderless tile / card chrome | `shared/ui/BaseTile` | re-styling `--block-bg` card wrappers; props `color`, `strip` (left color strip), `tint` (faint fill), `framed` (gradient + colored border, e.g. HP), `interactive` |
| HP / progress / stat bar | `shared/ui/StatBar` | **the one** fill bar for HP and the LVL bar. Props: `percent` (0–100), `color`, `size` (`small` ~4px / `medium` ~14px pill / `large` ~22px pill), `tempPercent`+`tempColor` (temp-HP overlay), `decorated` (character-sheet glow + shine + bubbles). Consumers own the surrounding numbers/labels/death-saves. Used by `EncounterHpBar` (medium), `SessionParticipantCard` (small), `DndHpView` (large widget / small compact), `DndLvlView` (medium widget). Do not hand-roll a `track + fill + temp` trio. |
| Inline SVG icon (suggest/item-type `svg`) | `shared/ui/SvgIcon` | hand-rolling `v-html` + `:deep(svg)` + per-call recolor. Props `svg`, `color`, `filter` (svgColorFilter recolor for fixed-fill svgs; omit for `currentColor` svgs), `size`. Pass a class for sizing or use `size`. |
| Pick a named icon from a set | `shared/ui/IconPicker` | a search box + grid of selectable icon buttons. `v-model` is the stored icon **name** (a Lucide component name). Backed by the curated set in `shared/ui/icons/counterIcons.js` (`COUNTER_ICONS` list + `resolveIcon(name)` → the markRaw'd `@lucide/vue` component, + `DEFAULT_ICON`). Icons come from **`@lucide/vue`** (the project icon library — import named icons; tree-shaken). Extend the picker by adding one row to that file; render a stored icon anywhere via `<component :is="resolveIcon(name)" :size :stroke-width />`. Used by `DND_COUNTERS`. |

Composables and helpers:

| Need | Use |
| --- | --- |
| Drag-and-drop sortable list | `shared/composables/useSortable` (+ its `reorderByDrop(array, fromIndex, toIndex)` export — the **one** correct reorder splice; `onDrop`'s `toIndex` is already source-removed, so no `-1` adjustment. Use it in every `onDrop`; do not hand-roll the splice) |
| Swipe-down to dismiss | `shared/composables/useSwipeToClose` |
| Suppress click after touch | `shared/lib/touchGuard` |
| Recolor an inline SVG | `shared/lib/svgColorFilter` |
| Roll dice from expression | `shared/lib/dice` (parser) + `stores/dice` (history/popup) |

## Modals and forms

- **Modal shell:** `shared/ui/AppModal.vue` is the standard animated modal (Teleport, overlay+backdrop, Escape, click-outside, swipe-to-close on mobile). Props: `wide`, `fullscreen` (`min(1400px,96vw) × 92vh`, zero padding, built-in ✕ hidden — for large content like a character sheet; the slotted content provides its own close affordance), `tile` (use the BaseTile block surface `var(--block-bg)` instead of the darker page `var(--bg)` — set on the item/suggest edit+create modals `ItemEditModal`/`SuggestEditModal`), `zIndex`. Emit: `close`. Use it for any new modal — do not roll your own overlay.
- **Confirm dialog:** `shared/ui/ConfirmDialog.vue` — small modal with title/message/cancel/confirm. Use for any "are you sure?" prompt; don't reimplement.
- **Anchored popover:** `shared/ui/BasePopover.vue` — Teleport-based popover anchored to an element. Props: `open` (v-model), `anchor` (ref/element), `placement` (`bottom-start` | `bottom-end`), `offset`, `minWidth`, `zIndex`, `transition` (a `<Transition>` name wrapping the popover so it can animate in/out — empty default = instant, unchanged for existing menus; the leaving element keeps its computed `positionStyle`, define the transition CSS **globally** since the popover is teleported). Handles click-outside, Escape, resize/scroll close, position computation. Use for dropdowns/menus instead of manual `document.addEventListener` + `getBoundingClientRect` plumbing. Default styling comes from the global `.app-dropdown` class.
- **Color preset picker:** `shared/ui/ColorPresetPicker.vue` — the **single** color picker for the whole app. One shared 6×4 palette (`shared/ui/colorPresets.js` → `PRESET_COLORS`, 24 colors; `randomPreset()`). Props: `modelValue`, `allowCustom` (adds a hex text field + native `<input type=color>` inside the popup), `allowClear` (adds a "Сбросить" action), `clearValue` (what clear emits — default `null`; pass `""` where the field stores an empty string), `inline` (render the grid directly, for use inside an already-open menu/dropdown — otherwise it renders a swatch trigger that opens a `BasePopover`), `placement`, `zIndex` (default **4000** — above the morph overlay `1000` and `AppModal` `3000`, so the popover is visible on top of both instead of behind them). Emits `update:modelValue`. Default trigger is a 22px swatch; override via the `#trigger` slot (`{ toggle, open, value }`). Picks fire on `@mousedown.prevent` so the rich-text editor keeps its selection. **Popover mode uses `BasePopover` (teleported, high z-index)** — so the palette never expands a morph window, never gets clipped by `overflow:hidden`, and never hides behind the morph/modal (all three bugs the old in-flow `ColorPicker` / absolute dropdowns had). The popover **animates in/out** via `BasePopover`'s `transition` prop with a **reason-specific leave**: picking a color (or clear) plays a confirming grow-and-fade (`cpppop-pick`), closing without choosing (outside-click / Escape / re-toggle) plays a quick retract (`cpppop-cancel`). Transition CSS is in a **global** `<style>` block in `ColorPresetPicker` (the popover root is teleported, so scoped wouldn't match). Used by: `BlockResourcesEditor` (popover), `SuggestEditModal` / `ItemEditModal` color field (inline + custom), `SceneItemTile` / `EncounterRowMenu` (inline + clear, inside `RowActionMenu`), `InputDescription` text-color (**popover** via `#trigger` = the toolbar "А" button + clear — teleported so it doesn't stretch the morph the note editor sits in). The old per-site `PALETTE`/`COLOR_PRESETS`/`COLORS` arrays and the standalone `features/character-editor/components/ColorPicker.vue` were removed; `scenePalette.js` now re-exports `PRESET_COLORS`. When you need a color field, use this — do not hand-roll swatches.
- **Form fields:** `shared/ui/form/`
  - `FormField` — label + slot. Default horizontal layout (label on left). Pass `vertical` for column layout (uppercase mini-label on top) used by modal forms. Optional `hint` for an inline label hint.
  - `FormTextInput` — text input styled with input tokens (`--input-bg/border/focus`). `v-model:value`. Forwards focus/blur/keydown via fallthrough; emits `enter` on Enter.
  - `FormTextarea` — sibling of FormTextInput for multiline.
  - `FormNumberInput` — spinner with `−`/`+` buttons. Background `--bg` (text/number fields use the global page bg so they read as recessed into the `--block-bg` tile), **no border** (borderless everywhere — KD/armor, prof bonus, HP, stats, resources, etc. — since it's one shared component). `FormTextInput` and the inline editor inputs (weapon count, tag-section, add-skill) match this `--bg` background.
  - `FormActionButtons` — standard footer with cancel/submit buttons. Props: `submitText`, `cancelText`, `loadingText`, `loading`, `canSubmit`, `disabled`. Emits: `cancel`, `submit`.

There is **one** text input — `FormTextInput`. The old hardcoded-color `FormInput.vue` was removed; its only consumer (`BonusList`) now uses `FormTextInput`. Do not reintroduce a second text-input component.

`BonusList` is the canonical "name + number + remove" repeater and the reference consumer of `FormTextInput` + `FormNumberInput` + `AddButton` + `RemoveButton`. The morph editors (`DndStatEditor`, `NumBonusEditor`, `WeaponEditor`) build on it / those primitives — when you add an editor with an "+ add" affordance or a delete cross, use `AddButton`/`RemoveButton`, never a new dashed/`×` style.

Reuse these instead of re-styling label/input/button trios per modal.

## Morph window (`shared/ui/MorphSheet`)

`shared/ui/MorphSheet.vue` is a "window" that animates **out of a tapped tile** into a centered panel and collapses back. Ported from the havenShare project. Use it for inline edit-in-place panels (the D&D stat block uses it — see `md/features/character-editor.md`). Do **not** reach for `AppModal` when you want the open animation to come *from* a specific tile.

Three pieces, all under `shared/`:

- `shared/composables/useContainerMorph.js` — the FLIP morph: measures the panel's natural rect, positions it at the origin tile's rect, then animates `left/top/width/height + border-radius + box-shadow` (open 420ms, close 300ms; no scale, so content isn't distorted). `playOpen`/`playClose`, plus `visible` (drive the backdrop) and `morphing` (block interaction mid-flight).
- `shared/composables/useSheetSubpages.js` — optional **subpage track**: two cells (`detail` left, `sub` right), a single `pos` ref (0=detail, 1=sub) drives both `translateX` transforms. `goSub(id)`/`backToDetail()` animate it; the mobile swipe-right gesture drives it live. Returns `nav` to pass to `<MorphSheet :nav>`.
- `shared/composables/useIsMobile.js` — `matchMedia('(max-width: 768px)')` ref (no shared one existed before; `ViewCharacter` keeps its own local `isMobile`).

`MorphSheet` props: `originRect` (`{left,top,width,height}` from the tile's `getBoundingClientRect`), `originEl` (tile element, so close morphs back to its current position), `originRadius`, `width` (desktop panel width px, default 440), `nav`, `showBack`. Slots: `detail` + `sub` (when `nav` is passed) or the default slot as a single static pane. The `detail`/default slot receives a `revealed` slot prop — `false` for the initial frame, then `true` during the open morph. Bind it to opacity transitions that finish together with the container morph (for example `MorphEditorShell` uses `0.42s`). Emits `close`. Desktop = centered fixed-width panel whose body height is JS-synced to the active cell, but height sync is suppressed while `morphing` is true; mobile = fullscreen with grab handle, swipe-down-to-close and swipe-right-back. There is **no close ✕ button** — close via overlay click, Escape, or (mobile) swipe-down. The consumer lays out its own header/columns inside the content; `MorphSheet` only owns the chrome, morph, height-sync and gestures. Token mapping vs. havenShare: `--block-bg` panel surface, `--shadow-lg`, 18px desktop radius.

Three non-obvious internals — **do not "simplify" them away**: (1) the panel width is applied via a `--ms-w` CSS variable (`width: var(--ms-w)`), **not** a reactive `:style="{width}"`, so reactive re-renders never re-assert width and fight the imperative left/top/width/height morph. The inner `.ms-body` is **also** pinned to a final-width CSS var (desktop) so the content is laid out at the final width from frame 1 — the panel's animating width just reveals it (`overflow:hidden`) instead of the text reflowing as the panel grows. Framed panels draw their 1px border with an absolute pseudo-element, not a real border, so the content box remains the same width and HP does not show a right-edge offset. (2) The overlay centers with **flexbox**, not `display:grid; place-items:center` — a grid `auto` track plus `max-width:100%` collapses the panel to its content's min-width the moment the morph clears `position:fixed` (especially with a `min-width:0` flex child inside), so the width snaps back instead of staying expanded. (3) The whole overlay is wrapped in `<teleport to="body">` (so it's a sibling of `#app`, not inside it) — teleport keeps `position: fixed` correct under transformed ancestors (e.g. `ViewCharacter`'s `.mobile-swipe-track`) and keeps the panel out of the blurred content.

Do not add `scrollbar-gutter: stable` to `.ms-cell`: it reserves right-side width even when no scrollbar is present, which makes HP/status vertical morphs look like their content jumps horizontally.

**Source tile:** while the window is open, `setOriginHidden()` sets the origin tile's `opacity: 0` (instantly, on open; restored on unmount) — the morph panel is its stand-in, so a visible tile behind would read as a duplicate. `opacity` (not `display:none`/unmount) preserves the tile's layout box and `getBoundingClientRect`, so the close morph can still target it.

**Backdrop blur:** the window does **not** use `backdrop-filter` — it's unsupported/hardware-gated in some Chromium builds (Yandex Browser strikes it through) and our CSS minifier drops the unprefixed property. Instead the overlay only dims (`background: rgba(0,0,0,.45)`), and `setBgBlur()` applies a real `filter: blur(8px)` to `#app` while the window is open (toggled on open / close / unmount). `filter` is universally supported and blurs the actual content; the teleported overlay/panel sit outside `#app`, so they stay sharp.

**Seamless morph tip:** when the panel's first column is "the tile growing", make that column pixel-identical to the tile (same padding, font sizes) and size it to the captured `originRect.width` (e.g. via a `--tile-w` CSS var), and set the panel `width = originRect.width + <editorWidth>`. Then the morph only *reveals* the new column on the right — the existing content never shifts, avoiding a jump at open-start / close-end. The D&D stat block does exactly this.

## CSS Hygiene

When touching a `<style>` block, remove any CSS rules that are no longer used:

- If you rename, restructure, or delete a template element — check whether its old CSS class still has a rule and delete it.
- If you touch a rule or a block of related rules — scan the surrounding rules for orphaned selectors (classes not present in the `<template>` section) and remove them.
- Applies to scoped component styles and global stylesheet sections alike.

You do not need to audit the entire file on every touch — only the area you edited and its immediate neighbours.

## Verifying UI changes — show a rendered mockup

This environment usually **cannot run the real app**: there is no backend/DB (nothing on `:8080`, no dev proxy), and the sandbox `node` has been broken before (built against a Homebrew `icu4c` that was later bumped, so the binary won't even launch — `npm run build` dies before reaching our code). So a live `/chars`, character sheet, or session view often can't be rendered here.

When you make a **visible** UI change and can't run it, the owner explicitly likes seeing a **rendered mockup** of the result. Do this:

- Use the visualization tool (`show_widget`) to render an **HTML/SVG fragment** inline in the chat — a faithful, static reproduction of the component you changed.
- Reproduce it honestly: use the **real CSS tokens / hex values** from `App.vue` (e.g. `#242427`, `#7c5ce2`, `#fcbe24`), the real layout (flex order, sizes, paddings), and for computed graphics (e.g. the `CharStatRadar` hexagon) compute the geometry with the **same formulas the component uses** (center 50, grid radius, 60° axis steps) so the mockup matches what ships.
- **Label it as a mockup, not proof of correctness.** It confirms layout/geometry/visual intent only — it does **not** prove the code compiles or that data binds correctly (it uses hardcoded sample data, doesn't import the component, doesn't hit the backend). Always say so, and flag that `npm run build` + a real run on a working machine are still needed.

This is the agreed substitute for the `preview_*` verification workflow when the preview/app can't run.
