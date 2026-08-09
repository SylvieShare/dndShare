# CSS variables

The application palette lives in `frontend/src/app/theme.css`. Component styles must use these tokens; `npm run check:colors` rejects direct hex/RGB/HSL colors and removed legacy tokens.

## Surface model

The dark UI uses a strict five-level surface scale. Do not create component-specific grey colors.

| Token | Value | Purpose |
| --- | --- | --- |
| `--bg` | `#1b1b1d` | Page canvas and the background of every form/wizard/editor. |
| `--surface` | `#242427` | Cards, tiles and grouped content on the canvas. |
| `--surface-raised` | `#2c2c30` | Inputs, selects, toggles and quiet buttons. This is the default control background on `--bg`. |
| `--surface-active` | `#35353b` | Hovered, pressed and selected neutral controls. |
| `--popover-bg` | `#202024` | Dropdowns, tooltips and detached popovers. |
| `--scrim` | black at 62% | Modal/overlay dimming. |

Form rule: the form container is `background: var(--bg)`, its fields are `var(--surface-raised)`, field borders are `var(--border-strong)`, and focus is `var(--accent)`. This is the contrast model established by the character-sheet morph editors and used project-wide. `AppModal` already supplies `--bg`; do not wrap a form in an additional grey panel.

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
- the `PotionVial` and `SpellSlotSphere` CSS illustrations;
- SVG masks and generated screenshot/canvas color parsing where a concrete value is technically required.

Do not use those exceptions for page, card, form, modal, text, border, hover or status styling.

## Global utility classes

Declared in `App.vue`:

| Class | Use |
| --- | --- |
| `.sheet-tag-chip` / `.sheet-tag-remove` | Shared sheet tag chip. |
| `.sheet-tile-title` | Small uppercase title at the top of a tile. |
| `.app-dropdown` | Anchored dropdown chrome using `--popover-bg`, border, radius and shadow tokens. |
