# CSS variables

Shared palette defaults live in `@sylvieshare/share-ui/styles.css`; the complete
DnD Share neutral dark palette is authoritative in `design/tokens.json`.
Product dimensions, responsive thresholds, typography roles and the exact purple
accent shades come from [design/tokens.json](../design/tokens.json), generated into
`frontend/src/app/design-tokens.css`/JS, shared by web and Android WebView.
The product `theme.css` imports generated CSS, including for isolated UI fixtures.
`frontend/src/app/theme.css` contains domain colors, product font stacks and the
player-handout paper palettes. Local `fonts.css` supplies variable WOFF2 from the
same pinned TTF files as Android; see [design sources](../design/README.md). Component styles must use these tokens;
`npm run check:colors` rejects direct hex/RGB/HSL colors and removed legacy
tokens.

The package defines `--accent-hover` and `--accent-soft` from `--accent`, so a
consumer can normally select one product accent. DnD Share overrides all three
to preserve its established palette. TrenchShare can set a green `--accent`,
and HavenShare may set it at runtime on `document.documentElement`.

## Surface model

`--map-screen-void` — тёмный фон выключенного экрана игрового стола,
независимый от темы приложения. Задан в product theme. Цвета материалов,
стен и тумана внутри WebGL renderer — палитра содержимого карты;
панели редактора используют обычные share-ui tokens.

The dark UI uses one application canvas plus a compact surface scale. Do not create component-specific grey colors.

| Token | Value | Purpose |
| --- | --- | --- |
| `--bg` | `#1a1a1e` | Application canvas, forms and the main navigation rail. |
| `--app-canvas-bg` | `var(--bg)` | Shared routed-page and session-canvas background. |
| `--app-canvas-dot-color` | transparent | Ordinary pages have no dot grid. |
| `--app-canvas-dot-size` | `24px` | Shared static dot-grid step; session zoom scales the same base step. |
| `--app-canvas-pattern` | none | Flat application canvas. |
| `--app-story-canvas-pattern` | 1px radial dot | Explicit chapter/story canvas; its dot color derives from `--border-strong`. |
| `--surface` | `#26262b` | Cards, tiles and unified content panels on `--bg`. |
| `--subheader` | `#1e1e22` | Shared headers, local tab bars and workspace side panels. |
| `--surface-raised` | `#303035` | Inputs, selects, toggles and quiet buttons. This is the default control background on `--bg`. |
| `--surface-active` | `#3b3b42` | Hovered, pressed and selected neutral controls. |
| `--popover-bg` | `#2b2b30` | Dropdowns, tooltips and detached popovers. |
| `--scrim` | black at 62% | Modal/overlay dimming. |

Canvas rule: routed screens inherit the flat `--app-canvas-bg`; the session's
pannable story/chapter view explicitly enables the shared story dot pattern.
Print mode removes it. Full-page features stay transparent unless their working
canvas requires an opaque background: the character-creation wizard uses `--bg`,
while handbook list rows use `--surface`. The global header and session command
bar use `--subheader`; forms, editors and modal bodies use `--bg`. Workspace
panels use Subheader, navigation rails use Background, and cards use Surface.
The ordinary desktop sidebar uses the standard `AppSidebar` surface.
Shared headers have one persistent 1px neutral bottom divider and keep their
existing scroll-dependent shadow. Lines use opaque neutral Border (#323238)
and BorderStrong (#45454d); purple is reserved for accent states. A standard modal header uses
`--surface`, while its body and footer use `--bg`, matching the contrast model of
character-sheet morph editors. Fields are `var(--surface-raised)`, field borders
are `var(--border-strong)`, and focus is `var(--accent)`. `AppModal`/`AppModalFrame`
already supply this modal canvas; do not wrap their content in an additional grey panel.

## Lines and text

| Token | Purpose |
| --- | --- |
| `--border` | Quiet dividers and card outlines. |
| `--border-strong` | Field, modal and popover borders. |
| `--text-1` | Primary text (#ececef). |
| `--text-2` | Secondary text (#bdbdc6). |
| `--text-muted` | Labels, placeholders, disabled/decorative text (#a8a8b2). |
| `--text-on-accent` | Text/icons on filled accent and semantic buttons. |

Three text levels are enough. Do not reintroduce a separate faint text color; non-essential text uses `--text-muted`.

## Product and semantic colors

| Token | Purpose |
| --- | --- |
| `--accent` | Navigation, selection, links and the primary action. |
| `--accent-hover` | Hover/pressed state of a filled accent control. |
| `--accent-soft` | Accent text on a quiet tinted surface; also attack highlights. |
| `--danger` | Errors, destructive actions and low HP. |
| `--success` | Confirmation, healthy HP and positive state. |
| `--warning` | Warning, pause and gold state. |
| `--info` | Informational/planned/blue state. |

Use `color-mix()` for translucent states instead of adding another color:

```css
.selected {
  color: var(--accent-soft);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-color: color-mix(in srgb, var(--accent) 38%, transparent);
}
```

`--side-enemy`, `--side-neutral` and `--side-minion` are the only extra UI colors. They encode encounter sides, not generic states. Ally and player reuse `--success` and `--info`.

Styled player notes use paired `--material-note-*-bg/text/border` content
tokens for parchment, letter, dossier and arcane designs. They describe the
transmitted artifact itself and must not be reused for application chrome.

## Shape, effects and typography

| Tokens | Purpose |
| --- | --- |
| `--shadow-lg` | Modal, menu and detached-surface shadow. |
| `--r-xs`, `--r-sm`, `--r-md`, `--r-lg`, `--r-pill` | Shared radius scale. |
| `--font-ui` | All controls, body text and numeric data. |
| `--font-display` | Entity names and display headings at readable display sizes; DnD Share uses variable Cormorant Garamond 500–700. |
| `--font-prose` | Long-form descriptions, rules, world notes and rich-text editor content; DnD Share uses variable Literata 400–700 with optical sizing and italic. |
| `--font-mono` | Logs, identifiers, data keys, formulas and other technical text. |
| `--font-print-ui`, `--font-print-display`, `--font-print-prose` | Print-only role stacks. They currently preserve the proven Arial/Georgia metrics and must not be changed without pagination QA. |

Keep functional numbers in the UI font with `font-variant-numeric: tabular-nums`;
display-serif digits are easy to misread. Compact summaries, hints, operational
messages and card snippets also remain UI text even when their CSS class contains
`description`. Use prose for text intended to be read as sentences or paragraphs,
not merely scanned.

## Allowed raw-color exceptions

Raw values are allowed only where color is data rather than application chrome:

- Presets owned by share-ui and stored user/entity colors;
- rarity/album/dice palettes that must emit or persist concrete hex values;
- the `PotionVial`, `SpellSlotSphere` and `SystemDie` CSS/SVG illustrations;
- SVG masks and generated screenshot/canvas color parsing where a concrete value is technically required.

Do not use those exceptions for page, card, form, modal, text, border, hover or status styling.

## Global utility classes

Declared in `App.vue`:

| Class | Use |
| --- | --- |
| `.sheet-tag-chip` / `.sheet-tag-remove` | Shared sheet tag chip. |
| `.sheet-tile-title` | Small uppercase title at the top of a tile. |

### Колонка игроков сессии

В `.campaign-workspace` ширина задаётся `--participant-rail-width: 264px`.
`--participant-selection-width: 36px` и `--participant-card-gap: 9px` общие для
карточки и колонки. Их сумма `--participant-selection-extra` прибавляется в бою
к ширине колонки и безопасной области карты истории. Карточка использует ту же
сумму для скрытия полосы галочки вне боя; ширина имени/HP сохраняется.

## Связанные страницы

[Оглавление wiki](README.md)
