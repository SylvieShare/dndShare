<template>
  <div class="sheet-explainer">
    <BaseTile class="sheet-mock" color="var(--info)" framed>
      <header class="sheet-mock-profile">
        <span class="sheet-mock-avatar">Л</span>
        <span><strong>Лира Вейн</strong><small>Полуэльф · плут 3</small></span>
        <span class="sheet-mock-level">ур. 3</span>
      </header>

      <div class="sheet-mock-grid">
        <BaseTile
          v-for="tile in tiles"
          :key="tile.key"
          class="sheet-mock-tile"
          :class="[`sheet-mock-tile--${tile.kind}`, { 'sheet-mock-tile--selected': selectedKey === tile.key }]"
          :color="tile.color"
          :strip="selectedKey === tile.key"
        >
          <button type="button" :aria-pressed="selectedKey === tile.key" @click="selectedKey = tile.key">
            <span v-if="tile.icon" class="sheet-mock-icon"><img :src="tile.icon" alt="" /></span>
            <span v-else-if="tile.symbol" class="sheet-mock-symbol">{{ tile.symbol }}</span>
            <span class="sheet-mock-value">{{ tile.value }}</span>
            <span class="sheet-mock-label">{{ tile.label }}</span>
            <span v-if="tile.detail" class="sheet-mock-detail">{{ tile.detail }}</span>
          </button>
        </BaseTile>
      </div>
    </BaseTile>

    <BaseTile class="sheet-explanation" :color="selected.color" tint>
      <span class="sheet-explanation-index">{{ String(selectedIndex + 1).padStart(2, '0') }}</span>
      <span class="sheet-explanation-copy">
        <strong>{{ selected.title }}</strong>
        <span>{{ selected.text }}</span>
      </span>
      <code>{{ selected.formula }}</code>
    </BaseTile>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'

const tiles = [
  {
    key: 'dex', kind: 'ability', label: 'Ловкость', value: '16', detail: 'модификатор +3', symbol: 'ЛВК', color: 'var(--info)',
    title: 'Характеристика и модификатор', text: '16 описывает Ловкость, но к d20 обычно добавляется рассчитанный модификатор +3.', formula: '⌊(16 − 10) / 2⌋ = +3',
  },
  {
    key: 'proficiency', kind: 'small', label: 'Мастерство', value: '+2', icon: '/static/prof-bonus.svg', color: 'var(--accent)',
    title: 'Бонус мастерства', text: 'На 3 уровне он равен +2 и добавляется только к тем действиям, которыми Лира владеет.', formula: 'уровни 1–4 → +2',
  },
  {
    key: 'stealth', kind: 'skill', label: 'Скрытность', value: '+5', detail: 'есть владение', symbol: 'С', color: 'var(--success)',
    title: 'Навык с владением', text: 'Скрытность использует модификатор Ловкости и добавляет мастерство, потому что навык отмечен как освоенный.', formula: '+3 ЛВК + 2 мастерство = +5',
  },
  {
    key: 'ac', kind: 'small', label: 'Класс доспеха', value: '15', icon: '/static/shield.svg', color: 'var(--side-neutral)',
    title: 'Класс Доспеха', text: 'Атакующий должен получить 15 или больше итогом броска атаки, чтобы попасть по Лире.', formula: 'лёгкий доспех 12 + ЛВК 3 = 15',
  },
  {
    key: 'initiative', kind: 'small', label: 'Инициатива', value: '+3', icon: '/static/initiative.svg', color: 'var(--warning)',
    title: 'Инициатива', text: 'Этот бросок определяет место Лиры в порядке боя и обычно использует Ловкость.', formula: 'd20 + 3',
  },
  {
    key: 'speed', kind: 'small', label: 'Скорость', value: '30', detail: 'футов', icon: '/static/speed.svg', color: 'var(--info)',
    title: 'Скорость', text: 'За свой ход Лира может переместиться суммарно на 30 футов и разделить это расстояние вокруг действия.', formula: '10 фт. + действие + 20 фт.',
  },
  {
    key: 'hp', kind: 'hp', label: 'Хиты', value: '18 / 24', detail: '+3 временных', icon: '/static/hp-pulse.svg', color: 'var(--success)',
    title: 'Хиты', text: 'Сначала расходуются 3 временных хита, затем 18 текущих. Лечение не поднимает обычные хиты выше 24.', formula: '3 временных → 18 текущих → 0',
  },
  {
    key: 'weapon', kind: 'weapon', label: 'Короткий лук', value: '+5', detail: 'попадание · 1d6+3 урона', icon: '/static/tab-weapons.svg', color: 'var(--danger)',
    title: 'Готовая атака', text: 'Плюс +5 используется для попадания. Выражение 1d6+3 бросается отдельно только после успешной атаки.', formula: 'd20 + 5 → КД, затем 1d6 + 3',
  },
]

const selectedKey = ref('stealth')
const selectedIndex = computed(() => Math.max(0, tiles.findIndex(tile => tile.key === selectedKey.value)))
const selected = computed(() => tiles[selectedIndex.value])
</script>

<style scoped>
.sheet-explainer { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(250px, .7fr); align-items: stretch; gap: 12px; margin: 24px 0 28px; }
.sheet-mock { padding: 16px; }
.sheet-mock-profile { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding-bottom: 13px; border-bottom: 1px solid var(--border); }
.sheet-mock-avatar { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; color: var(--text-on-accent); background: var(--accent); font-family: var(--font-display); font-size: 20px; font-weight: 700; }
.sheet-mock-profile strong,
.sheet-mock-profile small { display: block; }
.sheet-mock-profile strong { color: var(--text-1); font-family: var(--font-display); font-size: 18px; }
.sheet-mock-profile small { margin-top: 2px; color: var(--text-muted); font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
.sheet-mock-level { color: var(--accent-soft); font-size: 10px; font-weight: 800; text-transform: uppercase; }
.sheet-mock-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.sheet-mock-tile { min-width: 0; transition: box-shadow .16s, background .16s; }
.sheet-mock-tile--selected { background: color-mix(in srgb, var(--tile-color) 10%, var(--surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tile-color) 45%, var(--border)); }
.sheet-mock-tile button { width: 100%; height: 100%; min-height: 92px; display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto auto; align-content: center; gap: 1px 7px; padding: 10px; border: 0; border-radius: inherit; color: inherit; background: none; font: inherit; text-align: left; cursor: pointer; }
.sheet-mock-tile button:hover { background: color-mix(in srgb, var(--tile-color) 7%, transparent); }
.sheet-mock-tile--ability { grid-row: span 2; }
.sheet-mock-tile--hp { grid-column: span 2; }
.sheet-mock-tile--weapon { grid-column: span 2; }
.sheet-mock-icon,
.sheet-mock-symbol { grid-row: 1 / 4; align-self: center; width: 26px; height: 26px; display: grid; place-items: center; color: var(--tile-color); font-size: 10px; font-weight: 800; }
.sheet-mock-icon img { width: 23px; height: 23px; object-fit: contain; filter: var(--rules-mock-icon-filter, none); opacity: .78; }
.sheet-mock-value { color: var(--text-1); font-size: 21px; font-weight: 800; line-height: 1; }
.sheet-mock-label { color: var(--text-2); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.sheet-mock-detail { color: var(--text-muted); font-size: 8px; line-height: 1.25; }
.sheet-explanation { min-height: 100%; display: flex; flex-direction: column; padding: 18px; box-sizing: border-box; }
.sheet-explanation-index { color: var(--tile-color); font-size: 11px; letter-spacing: .08em; }
.sheet-explanation-copy { margin-top: auto; }
.sheet-explanation-copy strong,
.sheet-explanation-copy span { display: block; }
.sheet-explanation-copy strong { color: var(--text-1); font-family: var(--font-display); font-size: 23px; }
.sheet-explanation-copy span { margin-top: 7px; color: var(--text-2); font-size: 12px; line-height: 1.55; }
.sheet-explanation code { display: block; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); color: var(--tile-color); font-size: 10px; line-height: 1.45; white-space: normal; }
@media (max-width: 800px) {
  .sheet-explainer { grid-template-columns: 1fr; }
  .sheet-explanation { min-height: 170px; }
}
@media (max-width: 560px) {
  .sheet-mock-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sheet-mock-tile--ability { grid-row: auto; }
  .sheet-mock-tile--hp,
  .sheet-mock-tile--weapon { grid-column: span 2; }
}
</style>
