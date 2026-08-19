# Dice

Shared dice-rolling module available from anywhere in the app.

## Files

- `shared/lib/dice.js` — pure parser/roller. `parseDiceExpression(expr)` and `rollDiceExpression(expr)`.
- `shared/lib/systemDice.js` — the fixed d4/d6/d8/d10/d12/d20/d100 catalogue. Its persisted ids are the unambiguous strings `"d4"`…`"d100"`; dice are rules-level values and are not loaded from `suggest`. Every die retains its former suggestion color.
- `shared/ui/SystemDie.vue` — shared animated die rendered with the exact geometry, dark glass, colored halo/liquid, highlight and monospace typography of the former suggestion SVGs. It accepts `sides`, an optional arbitrary displayed `value` (defaults to the maximum face), `size`, `color` and `animated`; the value scales to fit and only animated, high-contrast outlined bubbles rise inside the clipped body like spell-slot bubbles (there are no static bubble dots). Every component instance uses Vue-generated unique ids for its SVG clip and blur definitions so different die shapes cannot leak into one another.
- `shared/ui/DndRichInlineNode.vue` — renders `dice` nodes embedded in rich descriptions as compact inline 25 px `SystemDie` compositions on a borderless tinted background, vertically centred against the surrounding line and separated from prose by a small horizontal outer margin. Clicking one calls the same global dice store, so its result appears in the popup and, when a session context is active, in the session timeline. Creature detail views pass their item name as the roll actor; a card opened from encounter keeps the concrete combatant context and includes its marker (for example, `Кобольд B`).
  When a manual average exists, the rolled formula stays on the left and the
  average sits on the right after a display-font italic `или`; the edit-modal
  preview uses the same order.
- `shared/assets/dice/*.svg` — the original d4/d6/d8/d10/d12/d20/d100 artwork recovered from the former `suggest` records and kept as repository-owned visual references for `SystemDie`.
- `stores/dice.js` — Pinia store. `useDiceStore().roll(action, expression, opts?)` rolls, normally pushes onto a stack of up to 5 active popups, and returns the result. `dismiss(id)` or `clear()` close items immediately. When `stores/sessionEvents.js` has an active session context, every roll is also published as a `dice_roll` timeline event; `pushEntry({log:false,...})` is the explicit opt-out for presentation-only results. `opts.actor: {name,charUuid?}` overrides the inherited open-sheet actor for encounter creatures or handbook formulas; actor and action are sent as separate event fields.
  - `opts.crit_mode: true` — if any rolled die shows its max face (e.g. `20` on `d20`, `8` on `d8`), the popup displays that die value in a golden "КРИТ" frame instead of the regular total. If no die is max but some die is `1`, a red "ПРОВАЛ" frame is shown with that die value. `crit` takes precedence over `fumble` when both happen in the same roll. Modifiers are ignored in this display. The result is exposed on the stack entry as `outcome: { kind: 'crit'|'fumble', sides, value }`.
  - `opts.color` supplies a fallback color for every die in that roll without changing its expression or type breakdown. An explicit per-part expression color still takes precedence.
  - `opts.popup: false` skips the global popup while preserving the parsed result and full timeline event. It is used when the caller owns an embedded result surface.
- `shared/ui/DiceRollPopup.vue` — fixed bottom-right stack mounted globally in `App.vue`. Each popup auto-dismisses after ~6s with a progress bar that drains over the same duration. New rolls push from the bottom; older ones float upward. Stack is capped at 5; the oldest is evicted on overflow. On touch/pen devices a deliberate horizontal swipe or fast flick dismisses one popup; vertical motion remains available to the page and the close button still works. Gesture state lives in `shared/composables/useSwipeDismiss.js`. The stack is **`Teleport`ed to `<body>`** (not left inside `#app`) so it stays sharp when `MorphSheet` blurs the application root. Its `z-index: 9000` is above the normal `AppModal`/prompt/confirm layers; diagnostic error-report UI and explicitly high-priority session editors may be higher. On every viewport a new popup cycles display-only die faces and visibly tumbles the die for about 560 ms. Every temporary tick chooses a face different from both the stored result and the previous displayed face, so low results and low-sided dice such as d4 do not stall; the increasing intervals between ticks provide the slowdown. The muted right-hand total is recalculated from the currently displayed kept dice and starts its final blink/settle transition on the 310 ms phase, so the exact total becomes readable just before the dice finish. On the pre-final dice tick each face has an equal chance either to reveal its exact stored value already or to keep a temporary value until the final tick, so the last tick does not always visibly change the roll. A crit/fumble outcome and its colored popup frame continue to wait for that final dice tick, then appear with a settle animation. Stored rolls and total are never mutated, and reduced-motion mode skips the cycling, tumble and reveal animations. The timer/state workflow lives in `shared/composables/useDiceRollAnimation.js`.

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

`title` (bright) on top. Below it: expression with substituted rolls on the left (every rolled value is rendered inside the corresponding `SystemDie`; dropped advantage/disadvantage dice are dimmed and struck through), a vertical separator, then the total (or, after the roll settles, the КРИТ/ПРОВАЛ frame when `crit_mode` matched) on the right. A die uses its explicit expression-part color first, then the roll-level `opts.color`, then the shared purple `var(--accent)` fallback. Flat numbers remain text. Per-type breakdown is shown beneath when there is more than one distinct type. The raw expression is shown at the bottom for reference. A 2px progress bar at the very bottom drains over the auto-dismiss duration.

## Consumers

- `features/sessions/components/EncounterRow.vue` — the per-row dice button rolls a reserve NPC's HP formula via `enc.rollNpcHpFromFormula(combatant)` (it is **not** a d20/initiative button; initiative rerolls happen from the encounter toolbar).
- `features/sessions/components/DicePanel.vue` — right-column session panel: animated d4/d6/d8/d10/d12/d20/d100 buttons + advantage/normal/disadvantage `MultiToggle`. Advantage/disadvantage rolls two dice and marks the unused one as `dropped` so the popup dims and strikes it through; uses `pushEntry` for the prebuilt result. All panel dice use the shared `var(--accent)` color instead of catalogue colors; visibility is controlled by the session workspace tool switcher.
- `features/sessions/components/EncounterChallengeResult.vue` — embedded group-challenge result in a combatant row. The roll is limited to selected scene combatants, uses `opts.popup: false`, and reuses `SystemDie` plus `useDiceRollAnimation`; only the event is shown inside the tile, while the complete creature/event title remains in the session timeline.
- `features/character-editor/blocks/dnd/DndCharStat10.vue` — the stat modifier, save chip, and skill chips roll `d20+<value>` with `crit_mode: true` and the owning characteristic's suggest color as `opts.color`, via `DndStatView`'s `@roll-stat`/`@roll-save`/`@roll-skill` emits → `rollD20Plus`. No edit-mode gating (the view/edit toggle was removed).
- `features/character-list/components/wizard/steps/StepStats.vue` — each 4d6
  ability roll preserves all four faces, renders them with `SystemDie` and marks
  the discarded minimum. Duplicate totals stay distinct assignments.

To wire a new caller: `useDiceStore().roll(action, expression, opts)` for parsed expressions, or `useDiceStore().pushEntry({ action, actor?, result, outcome?, color?, duration?, log? })` for prebuilt results. No props/events — the popup is mounted once in `App.vue` and reads store state. Session attribution normally comes from the session-events context; callers that act as another combatant pass the explicit actor override.

## MultiToggle

`MultiToggle` from `@sylvieshare/share-ui` is the shared segmented control.
Props: `options: [{ value, label }]`, `modelValue` (`v-model`) and `block` to
stretch full-width. It renders an accent-colored pill that animates `transform`
and `width` to match the active button. Measurement uses each button's
`offsetLeft/offsetWidth` and re-runs on `modelValue` change and through a
`ResizeObserver` on the root.
