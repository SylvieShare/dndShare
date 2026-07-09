# CSS Variables

Global design tokens are declared on `:root` in `frontend/src/App.vue`. Always prefer these over hard-coded colors / shadows / radii — they ensure consistent theming and let us re-skin from a single place.

## Surfaces & backgrounds

| Var              | Value                       | Use                                        |
| ---------------- | --------------------------- | ------------------------------------------ |
| `--bg`           | `#181a24`                   | Page background.                           |
| `--bg-deep`      | `#11121a`                   | Deepest background (behind everything).    |
| `--bg-header`    | `#1c1f2a`                   | App header.                                |
| `--block-bg`     | `#1f2230`                   | Card / tile background (e.g. block cards, encounter combatant tiles). |
| `--surface-1`    | `#26283e`                   | Inputs, default buttons.                   |
| `--surface-2`    | `#2d304b`                   | Focused / hovered input states.            |
| `--popup-bg`     | `#1c1f2a`                   | Dropdowns, popovers, tooltips, modals.     |
| `--input-bg`     | `#1e1e22`                   | Form input background (use in modal forms). |
| `--input-border` | `#2e2e44`                   | Form input border.                          |
| `--input-focus`  | `var(--accent)`             | Form input focus ring colour.               |

## Borders & dividers

| Var               | Value                       | Use                                  |
| ----------------- | --------------------------- | ------------------------------------ |
| `--border`        | `rgba(255,255,255,0.07)`    | Subtle dividers and tile borders.    |
| `--border-strong` | `rgba(255,255,255,0.14)`    | Modal / popover outlines.            |

Clickable list tiles (character list `CharBox`, session list `SessionCard`, their skeletons / "create" placeholders) share one look built from existing tokens — do **not** add card-specific tokens: `background: var(--block-bg); border: 1px solid var(--border); border-radius: var(--r-lg);` with hover `border-color: var(--accent-dim); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);`.

## Text

| Var            | Value     | Use                                 |
| -------------- | --------- | ----------------------------------- |
| `--text-1`     | `#e8e8ef` | Primary body text, bright labels.   |
| `--text-2`     | `#a6a6b8` | Secondary text, subtitles.          |
| `--text-muted` | `#7c7c92` | Quiet section headers, placeholders (raised for WCAG contrast). |

## Accent

| Var            | Value     | Use                                              |
| -------------- | --------- | ------------------------------------------------ |
| `--accent`     | `#7c5cff` | Navigation accent (active nav, links, selection, "combat" section). |
| `--accent-dim` | `#5a43cc` | Hover/pressed for `--accent` buttons.            |
| `--accent-2`     | `#34c6ac` | Positive/creative actions (Войти, Создать, регистрация). Pair with dark text `#06231d`. |
| `--accent-2-dim` | `#2aa28d` | Hover/pressed for `--accent-2` buttons.          |
| `--color-attack` | `#a292ff` | Attack-related highlights in character sheets.  |

Accent rule of thumb: `--accent` (purple) = navigation / selection / active state; `--accent-2` (teal) = the primary confirm/create action of a flow (one per modal/page).

## Semantic state colors

| Var            | Value     | Use                                              |
| -------------- | --------- | ------------------------------------------------ |
| `--danger`     | `#e05555` | Delete buttons, errors, low-HP indicators.       |
| `--danger-dim` | `#c95a52` | Quieter danger tint (death-save pips, graveyard section). |
| `--success`    | `#4caf6e` | Confirmations, positive indicators.              |
| `--warning`    | `#fcbe24` | Warnings, gold accents.                          |

## Shadows & radii

| Var          | Value                                                    |
| ------------ | -------------------------------------------------------- |
| `--shadow-lg`| `0 14px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)` (only shadow token in use) |
| `--r-xs`     | `4px` (tight chips, inner inputs)                        |
| `--r-sm`     | `6px` (small buttons, mini chips)                        |
| `--r-md`     | `10px` (default card radius)                             |
| `--r-lg`     | `14px` (larger surfaces, hero panels)                    |
| `--r-pill`   | `999px` (pill / fully rounded controls)                  |

## Layout

| Var           | Value | Use                            |
| ------------- | ----- | ------------------------------ |
| `--header-h`  | `54px`| App header height — for top-padding offsets. |

## Typography

| Var              | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| `--font-display` | `'Cormorant Garamond', 'Times New Roman', serif` — display headings and entity names ONLY. |

Do NOT use `--font-display` for data numbers (ability modifiers, AC/HP/CR stat values): the serif glyphs misread (`+3` looks like `+З`). Use the inherited sans with `font-variant-numeric: tabular-nums` for numeric data. Serif stays for names/titles and the decorative big collection-card counts.

## Patterns

- Tinted section backgrounds: derive from `--block-bg` plus a local `--section-color` via `color-mix(in srgb, var(--section-color) 6%, var(--block-bg))` for the fill and `28%` for the border (see encounter sections).
- Hover-on-tile: `color-mix(in srgb, #fff 4%, var(--block-bg))` keeps the lift consistent with the base.
- Accent tints: prefer `color-mix(in srgb, var(--accent) N%, transparent)` over raw `rgba(124,92,255,...)` so the accent stays in one place.
- Danger tints: use `var(--danger)` / `var(--danger-dim)`; for translucent danger surfaces use `color-mix(in srgb, var(--danger) N%, transparent)`.
- Side colors in encounter rows (`enemy / ally / neutral / minion / pc`) are not (yet) tokens — see `SIDE_COLOR` in `useEncounter.js`. Reuse those literals if you need the same palette.
- **Text / number fields** (`FormTextInput`, `FormNumberInput`, `ValueSelect`, `CalcPad` display, and the inline editor inputs) use `background: var(--bg)` — the global page bg, so fields read as recessed into a `--block-bg` tile. Border `--input-border`, focus `--input-focus`. `--input-bg` is now only the `FormTextarea` legacy. Don't hardcode input greys (`#2a2a32`, `#252530`, `rgba(24,24,30,…)`); they were all migrated to tokens.
- **One accent purple:** active/selected controls use `var(--accent)` (toggles, slot buttons, HP pills). The stray literals `#5a50d0` / `#5a52c8` / `#6a64d8` were removed. `--color-attack` (`#a292ff`) stays distinct — it's the attack-highlight tint, not the selection accent.

## Global utility classes

Declared in `App.vue`. Don't reimplement these per-component.

| Class | Use |
| ----- | --- |
| `.sheet-tag-chip` / `.sheet-tag-remove` | Tag chip (label + remove ×) used in sheet tag blocks. |
| `.sheet-tile-title` | Unified small header at the top of every block tile (11px, 700, `0.05em`, uppercase, `--text-muted`). Use this for any tile's title instead of redefining typography per block; add only layout overrides (margin, `white-space`, `flex-shrink`) locally. |
| `.app-dropdown` | Anchored dropdown menu base — adds `--popup-bg`, `--border-strong`, `--r-md`, `--shadow-lg`, padding, z-index. Override `top/left/right/min-width` per consumer. |
