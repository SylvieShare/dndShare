<template>
  <div class="spell-visual">
    <BaseTile class="spell-card" color="var(--accent)" framed>
      <header class="spell-card-head">
        <span class="spell-symbol"><Sparkles aria-hidden="true" /></span>
        <div><strong>Лечащее слово</strong><span>1 уровень · воплощение</span></div>
        <span class="spell-slot">ячейка 1+</span>
      </header>
      <div class="spell-facts">
        <span><Clock3 aria-hidden="true" /><strong>Бонусное действие</strong><small>время</small></span>
        <span><Radio aria-hidden="true" /><strong>60 футов</strong><small>дистанция</small></span>
        <span><MessageCircle aria-hidden="true" /><strong>В</strong><small>компоненты</small></span>
        <span><TimerOff aria-hidden="true" /><strong>Мгновенно</strong><small>длительность</small></span>
      </div>
      <p>Выбранное существо восстанавливает хиты. Бросок атаки и спасбросок цели не требуются.</p>
    </BaseTile>

    <div class="spell-checks" aria-label="Проверка перед применением заклинания">
      <div v-for="(check, index) in checks" :key="check.title" class="spell-check-row">
        <span class="spell-check-number">{{ index + 1 }}</span>
        <span><strong>{{ check.title }}</strong><small>{{ check.text }}</small></span>
        <CircleCheck aria-hidden="true" />
      </div>
    </div>

    <BaseTile class="spell-warning" color="var(--warning)" strip>
      <TriangleAlert aria-hidden="true" />
      <span><strong>Правило бонусного действия · 2014</strong><small>В этот ход другое заклинание возможно только как заговор со временем «1 действие».</small></span>
    </BaseTile>
  </div>
</template>

<script setup>
import {
  CircleCheck,
  Clock3,
  MessageCircle,
  Radio,
  Sparkles,
  TimerOff,
  TriangleAlert,
} from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'

const checks = [
  { title: 'Есть доступ', text: 'Заклинание известно или подготовлено.' },
  { title: 'Есть ресурс', text: 'Доступна ячейка подходящего уровня.' },
  { title: 'Соблюдены условия', text: 'Хватает дистанции и доступен вербальный компонент.' },
]
</script>

<style scoped>
.spell-visual { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(250px, .75fr); gap: 12px; margin: 24px 0 28px; }
.spell-card { grid-row: span 2; padding: 18px; }
.spell-card-head { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 11px; }
.spell-symbol { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; color: var(--accent-soft); background: color-mix(in srgb, var(--accent) 18%, transparent); }
.spell-symbol svg { width: 19px; }
.spell-card-head strong,
.spell-card-head span { display: block; }
.spell-card-head strong { color: var(--text-1); font-family: var(--font-display); font-size: 21px; }
.spell-card-head div span { margin-top: 2px; color: var(--text-muted); font-size: 9px; text-transform: uppercase; }
.spell-slot { padding: 4px 7px; border-radius: 6px; color: var(--accent-soft); background: color-mix(in srgb, var(--accent) 12%, transparent); font-size: 9px; }
.spell-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin: 18px 0; }
.spell-facts > span { min-width: 0; display: grid; grid-template-columns: auto 1fr; gap: 1px 6px; padding: 9px; border-radius: 8px; background: var(--surface-raised); }
.spell-facts svg { grid-row: 1 / 3; width: 14px; color: var(--accent-soft); }
.spell-facts strong,
.spell-facts small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.spell-facts strong { color: var(--text-1); font-size: 9px; }
.spell-facts small { color: var(--text-muted); font-size: 8px; }
.spell-card p { margin: 0; color: var(--text-2); font-size: 12px; line-height: 1.55; }
.spell-checks { display: grid; align-content: start; gap: 6px; }
.spell-check-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 9px; padding: 10px 11px; border-bottom: 1px solid var(--border); }
.spell-check-number { width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; color: var(--text-muted); background: var(--surface-raised); font-size: 9px; }
.spell-check-row strong,
.spell-check-row small { display: block; }
.spell-check-row strong { color: var(--text-1); font-size: 11px; }
.spell-check-row small { margin-top: 2px; color: var(--text-muted); font-size: 9px; line-height: 1.35; }
.spell-check-row > svg { width: 16px; color: var(--success); }
.spell-warning { display: grid; grid-template-columns: auto 1fr; gap: 9px; padding: 12px 14px; }
.spell-warning > svg { width: 17px; color: var(--warning); }
.spell-warning strong,
.spell-warning small { display: block; }
.spell-warning strong { color: var(--text-1); font-size: 10px; }
.spell-warning small { margin-top: 3px; color: var(--text-muted); font-size: 9px; line-height: 1.4; }
@media (max-width: 800px) {
  .spell-visual { grid-template-columns: 1fr; }
  .spell-card { grid-row: auto; }
}
@media (max-width: 540px) {
  .spell-card-head { grid-template-columns: auto 1fr; }
  .spell-slot { grid-column: 2; justify-self: start; }
  .spell-facts { grid-template-columns: 1fr 1fr; }
}
</style>
