<template>
  <div class="turn-visual">
    <BaseTile class="turn-main" color="var(--accent)" tint>
      <div class="turn-heading">
        <span><Clock3 aria-hidden="true" /> Твой ход</span>
        <strong>скорость 30 фт.</strong>
      </div>
      <div class="turn-track" role="img" aria-label="Пример хода: 10 футов перемещения, действие, затем ещё 20 футов перемещения">
        <div class="turn-move turn-move--first"><Footprints aria-hidden="true" /><strong>10 фт.</strong><span>подойти</span></div>
        <ArrowRight aria-hidden="true" />
        <div class="turn-action"><Swords aria-hidden="true" /><strong>Действие</strong><span>Атака</span></div>
        <ArrowRight aria-hidden="true" />
        <div class="turn-move"><Footprints aria-hidden="true" /><strong>20 фт.</strong><span>отойти</span></div>
      </div>
      <div class="turn-budget" aria-label="Дополнительные возможности хода">
        <span><PackageOpen aria-hidden="true" /><strong>1 взаимодействие</strong><small>достать оружие</small></span>
        <span><MessageCircle aria-hidden="true" /><strong>Короткая речь</strong><small>без отдельного действия</small></span>
        <span class="turn-conditional"><Sparkles aria-hidden="true" /><strong>Бонусное действие</strong><small>только если его даёт правило</small></span>
      </div>
    </BaseTile>

    <BaseTile class="turn-reaction" color="var(--warning)" strip>
      <span class="turn-reaction-icon"><Zap aria-hidden="true" /></span>
      <span><strong>Реакция</strong><small>Один ответ на подходящий триггер. Восстанавливается в начале твоего следующего хода.</small></span>
      <span class="turn-reaction-cycle"><RotateCcw aria-hidden="true" /> следующий ход</span>
    </BaseTile>
  </div>
</template>

<script setup>
import {
  ArrowRight,
  Clock3,
  Footprints,
  MessageCircle,
  PackageOpen,
  RotateCcw,
  Sparkles,
  Swords,
  Zap,
} from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
</script>

<style scoped>
.turn-visual { display: grid; gap: 12px; margin: 24px 0 28px; }
.turn-main { padding: 18px; }
.turn-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: .07em; }
.turn-heading span { display: flex; align-items: center; gap: 6px; color: var(--accent-soft); font-weight: 800; }
.turn-heading svg { width: 15px; height: 15px; }
.turn-heading strong { color: var(--text-2); }
.turn-track { display: grid; grid-template-columns: 1fr 20px 1.2fr 20px 1fr; align-items: center; gap: 8px; margin-top: 18px; }
.turn-track > svg { width: 18px; color: var(--text-muted); }
.turn-move,
.turn-action { min-height: 92px; display: grid; grid-template-columns: auto 1fr; align-content: center; gap: 3px 9px; padding: 12px 14px; border-radius: 10px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--border); }
.turn-move > svg,
.turn-action > svg { grid-row: 1 / 3; align-self: center; width: 21px; color: var(--info); }
.turn-action > svg { color: var(--danger); }
.turn-move strong,
.turn-action strong { color: var(--text-1); font-size: 14px; }
.turn-move span,
.turn-action span { color: var(--text-muted); font-size: 10px; }
.turn-budget { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.turn-budget > span { display: grid; grid-template-columns: auto 1fr; gap: 1px 7px; align-items: center; padding: 9px; border-radius: 8px; color: var(--text-2); background: color-mix(in srgb, var(--text-on-accent) 3%, transparent); }
.turn-budget svg { grid-row: 1 / 3; width: 16px; color: var(--text-muted); }
.turn-budget strong { font-size: 10px; }
.turn-budget small { color: var(--text-muted); font-size: 8px; }
.turn-budget .turn-conditional svg { color: var(--accent-soft); }
.turn-reaction { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 11px; padding: 13px 16px; }
.turn-reaction-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; color: var(--warning); background: color-mix(in srgb, var(--warning) 13%, transparent); }
.turn-reaction-icon svg { width: 17px; }
.turn-reaction strong,
.turn-reaction small { display: block; }
.turn-reaction strong { color: var(--text-1); font-size: 12px; }
.turn-reaction small { margin-top: 2px; color: var(--text-muted); font-size: 9px; line-height: 1.4; }
.turn-reaction-cycle { display: flex; align-items: center; gap: 5px; color: var(--text-muted); font-size: 9px; white-space: nowrap; }
.turn-reaction-cycle svg { width: 14px; }
@media (max-width: 680px) {
  .turn-track { grid-template-columns: 1fr; }
  .turn-track > svg { justify-self: center; transform: rotate(90deg); }
  .turn-budget { grid-template-columns: 1fr; }
  .turn-reaction { grid-template-columns: auto 1fr; }
  .turn-reaction-cycle { grid-column: 2; }
}
</style>
