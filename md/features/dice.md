# Dice

Shared dice-rolling module available from anywhere in the app.

## Files

- `shared/lib/dice.js` — pure parser/roller. `parseDiceExpression(expr)` and `rollDiceExpression(expr)`.
- `shared/lib/systemDice.js` — the fixed d4/d6/d8/d10/d12/d20/d100 catalogue. Its persisted ids are the unambiguous strings `"d4"`…`"d100"`; dice are rules-level values and are not loaded from `suggest`. Every die retains its former suggestion color.
- `shared/ui/SystemDie.vue` — shared animated die rendered with the exact geometry, dark glass, colored halo/liquid, highlight and monospace typography of the former suggestion SVGs. It accepts `sides`, an optional arbitrary displayed `value` (defaults to the maximum face), `size`, `color` and `animated`; the value scales to fit and only animated, high-contrast outlined bubbles rise inside the clipped body like spell-slot bubbles (there are no static bubble dots). Every component instance uses Vue-generated unique ids for its SVG clip and blur definitions so different die shapes cannot leak into one another.
- `shared/assets/dice/*.svg` — the original d4/d6/d8/d10/d12/d20/d100 artwork recovered from the former `suggest` records and kept as repository-owned visual references for `SystemDie`.
- `stores/dice.js` — Pinia store. `useDiceStore().roll(title, expression, opts?)` rolls, pushes onto a stack of up to 5 active popups, and returns the result. `dismiss(id)` or `clear()` close items immediately.
  - `opts.crit_mode: true` — if any rolled die shows its max face (e.g. `20` on `d20`, `8` on `d8`), the popup displays that die value in a golden "КРИТ" frame instead of the regular total. If no die is max but some die is `1`, a red "ПРОВАЛ" frame is shown with that die value. `crit` takes precedence over `fumble` when both happen in the same roll. Modifiers are ignored in this display. The result is exposed on the stack entry as `outcome: { kind: 'crit'|'fumble', sides, value }`.
- `shared/ui/DiceRollPopup.vue` — fixed bottom-right stack mounted globally in `App.vue`. Each popup auto-dismisses after ~6s with a progress bar that drains over the same duration. New rolls push from the bottom; older ones float upward. Stack is capped at 5; the oldest is evicted on overflow. The stack is **`Teleport`ed to `<body>`** (not left inside `#app`) so it stays sharp when `MorphSheet` blurs the application root. Its `z-index: 9000` is above the normal `AppModal`/prompt/confirm layers; diagnostic error-report UI and explicitly high-priority session editors may be higher.

## Expression syntax

```
d20            ← 1d20
3d8            ← three d8
d4+5+3d8+2d6{огнем|#faa}
```

Each additive term may carry a typed tag `{label|#color}` (color optional). Tags drive the per-type breakdown shown in the popup when more than one distinct tag (or a mix of tagged and untagged terms) is present.

## Roll result shape

```ts
{
  parts: Array<
    | { sign: '+'|'-', kind: 'dice', n, sides, rolls: number[], sum, label, color }
    | { sign: '+'|'-', kind: 'flat', value, sum, label, color }
  >,
  total: number,
  byType: Array<{ label: string|null, color: string|null, value: number }>,
  expression: string,
}
```

## Popup layout

`title` (bright) on top. Below it: expression with substituted rolls on the left (every rolled value is rendered inside the corresponding `SystemDie`; dropped advantage/disadvantage dice are dimmed and struck through), a vertical separator, then the total (or the КРИТ frame when `crit_mode` matched) on the right. Flat numbers remain text. Per-type breakdown is shown beneath when there is more than one distinct type. The raw expression is shown at the bottom for reference. A 2px progress bar at the very bottom drains over the auto-dismiss duration.

## Consumers

- `features/sessions/components/EncounterRow.vue` — the per-row dice button rolls a reserve NPC's HP formula via `enc.rollNpcHpFromFormula(combatant)` (it is **not** a d20/initiative button; initiative rerolls happen from the encounter toolbar).
- `features/sessions/components/DicePanel.vue` — right-column session panel: animated d4/d6/d8/d10/d12/d20/d100 buttons + advantage/normal/disadvantage `MultiToggle`. Advantage/disadvantage rolls two dice and marks the unused one as `dropped` so the popup dims and strikes it through; uses `pushEntry` for the prebuilt result.
- `features/character-editor/blocks/dnd/DndCharStat10.vue` — the stat modifier, save chip, and skill chips roll `d20+<value>` with `crit_mode: true`, via `DndStatView`'s `@roll-stat`/`@roll-save`/`@roll-skill` emits → `rollD20Plus`. No edit-mode gating (the view/edit toggle was removed).

To wire a new caller: `useDiceStore().roll(title, expression, opts)` for parsed expressions, or `useDiceStore().pushEntry({ title, result, outcome?, duration? })` for prebuilt results. No props/events — the popup is mounted once in `App.vue` and reads store state.

## MultiToggle

`shared/ui/MultiToggle.vue` is a generic segmented control. Props: `options: [{ value, label }]`, `modelValue` (v-model), `block` to stretch full-width. Renders a purple pill that animates `transform` + `width` to match the active button. Measurement uses each button's `offsetLeft/offsetWidth` and re-runs on `modelValue` change and via `ResizeObserver` on the root.
