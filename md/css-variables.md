# CSS variables

The shared application palette lives in `@sylvieshare/share-ui/styles.css`.
`frontend/src/app/theme.css` contains only DnD Share layout, its exact purple
accent shades and domain colors. Component styles must use these tokens;
`npm run check:colors` rejects direct hex/RGB/HSL colors and removed legacy
tokens.

The package defines `--accent-hover` and `--accent-soft` from `--accent`, so a
consumer can normally select one product accent. DnD Share overrides all three
to preserve its established palette. TrenchShare can set a green `--accent`,
and HavenShare may set it at runtime on `document.documentElement`.

## Surface model

The dark UI uses one application canvas plus a compact surface scale. Do not create component-specific grey colors.

| Token | Value | Purpose |
| --- | --- | --- |
| `--bg` | `#1b1b1d` | Background of every form, wizard and editor, plus global header chrome. |
| `--app-canvas-bg` | `var(--bg)` | Shared routed-page and session-canvas background. |
| `--app-canvas-dot-color` | 42% of `--border-strong` | Shared color for the global and session-canvas dot grid. |
| `--app-canvas-dot-size` | `24px` | Shared static dot-grid step; session zoom scales the same base step. |
| `--app-canvas-pattern` | 1px radial dot | Reusable global page backdrop pattern. |
| `--surface` | `#242427` | Cards, tiles, unified content panels and toolbar chrome on `--bg`. |
| `--surface-raised` | `#2c2c30` | Inputs, selects, toggles and quiet buttons. This is the default control background on `--bg`. |
| `--surface-active` | `#35353b` | Hovered, pressed and selected neutral controls. |
| `--popover-bg` | `#202024` | Dropdowns, tooltips and detached popovers. |
| `--scrim` | black at 62% | Modal/overlay dimming. |

Canvas rule: every routed screen inherits the shared `--app-canvas-bg` plus
`--app-canvas-pattern` backdrop from `App.vue`; print mode explicitly removes
the pattern. Full-page features stay transparent unless their working canvas
must deliberately hide the global grid: the full character-creation wizard and
the handbook use opaque `--bg`, while handbook list rows use `--surface`. The
pannable session chapter grid may reposition and scale the pattern, but must use
the same background and dot-color tokens. The global header and regular forms,
editors and modal bodies use `--bg`; toolbar chrome inside a `--bg` editor uses
`--surface`. A standard modal header uses `--surface`,
while its body and footer use `--bg`, matching the contrast model of
character-sheet morph editors. Fields are `var(--surface-raised)`, field borders
are `var(--border-strong)`, and focus is `var(--accent)`. `AppModal`/`AppModalFrame`
already supply this modal canvas; do not wrap their content in an additional grey panel.

## Lines and text

| Token | Purpose |
| --- | --- |
| `--border` | Quiet dividers and card outlines. |
| `--border-strong` | Field, modal and popover borders. |
| `--text-1` | Primary text. |
| `--text-2` | Secondary text. |
| `--text-muted` | Labels, placeholders, disabled/decorative text. |
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

## Shape, effects and typography

| Tokens | Purpose |
| --- | --- |
| `--shadow-lg` | Modal, menu and detached-surface shadow. |
| `--r-xs`, `--r-sm`, `--r-md`, `--r-lg`, `--r-pill` | Shared radius scale. |
| `--font-ui` | All controls, body text and numeric data. |
| `--font-display` | Entity names and display headings only. |

Keep numbers in the UI font with `font-variant-numeric: tabular-nums`; display-serif digits are easy to misread.

## Allowed raw-color exceptions

Raw values are allowed only where color is data rather than application chrome:

- `shared/ui/colorPresets.js` and stored user/entity colors;
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
| `.app-dropdown` | Anchored dropdown chrome using `--popover-bg`, border, radius and shadow tokens. |
