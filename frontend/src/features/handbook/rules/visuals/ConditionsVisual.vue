<template>
  <div class="conditions-visual">
    <div class="conditions-grid" aria-label="Состояния">
      <BaseTile
        v-for="condition in conditions"
        :key="condition.code"
        class="condition-tile"
        :class="{ 'condition-tile--selected': selected.code === condition.code }"
        :color="condition.color"
        :strip="selected.code === condition.code"
      >
        <button type="button" :aria-pressed="selected.code === condition.code" @click="selectedCode = condition.code">
          <img v-if="condition.icon" :src="condition.icon" alt="" />
          <BatteryLow v-else aria-hidden="true" />
          <span>{{ condition.name }}</span>
        </button>
      </BaseTile>
    </div>

    <BaseTile class="condition-detail" :color="selected.color" tint>
      <span class="condition-detail-icon">
        <img v-if="selected.icon" :src="selected.icon" alt="" />
        <BatteryLow v-else aria-hidden="true" />
      </span>
      <span>
        <small>Состояние</small>
        <strong>{{ selected.name }}</strong>
      </span>
      <ul>
        <li v-for="effect in selected.effects" :key="effect">{{ effect }}</li>
      </ul>
    </BaseTile>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BatteryLow } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'

const path = code => `/static/conditions/${code}.svg`
const conditions = [
  { code: 'blinded', name: 'Ослеплён', color: 'var(--warning)', icon: path('blinded'), effects: ['Не видит и автоматически проваливает проверки, требующие зрения.', 'Его атаки совершаются с помехой, атаки по нему — с преимуществом.'] },
  { code: 'charmed', name: 'Очарован', color: 'var(--accent)', icon: path('charmed'), effects: ['Не может атаковать очаровавшее существо или выбирать его целью вредоносного эффекта.', 'Очаровавший получает преимущество в социальных проверках против цели.'] },
  { code: 'deafened', name: 'Оглох', color: 'var(--info)', icon: path('deafened'), effects: ['Не слышит и автоматически проваливает проверки, требующие слуха.'] },
  { code: 'frightened', name: 'Испуган', color: 'var(--danger)', icon: path('frightened'), effects: ['Пока источник страха виден, получает помеху к проверкам характеристик и атакам.', 'Не может добровольно приблизиться к источнику страха.'] },
  { code: 'grappled', name: 'Схвачен', color: 'var(--warning)', icon: path('grappled'), effects: ['Скорость становится 0 и не получает бонусов.', 'Захват заканчивается при недееспособности захватившего или если существ насильно разнесло дальше его досягаемости.'] },
  { code: 'incapacitated', name: 'Недееспособен', color: 'var(--danger)', icon: path('incapacitated'), effects: ['Не может совершать действия и реакции.'] },
  { code: 'invisible', name: 'Невидим', color: 'var(--accent-soft)', icon: path('invisible'), effects: ['Без магии или особого чувства его нельзя увидеть, но местоположение могут выдавать шум и следы.', 'Его атаки получают преимущество, а атаки по нему — помеху.'] },
  { code: 'paralyzed', name: 'Парализован', color: 'var(--danger)', icon: path('paralyzed'), effects: ['Недееспособен, не двигается и почти не говорит; автоматически проваливает спасброски Силы и Ловкости.', 'Атаки по нему получают преимущество, а попадание с 5 футов становится критическим.'] },
  { code: 'petrified', name: 'Окаменел', color: 'var(--side-neutral)', icon: path('petrified'), effects: ['Превращён в твёрдое вещество, недееспособен, неподвижен и не осознаёт окружение.', 'Атаки по нему получают преимущество; он сопротивляется любому урону и автоматически проваливает спасброски Силы и Ловкости.'] },
  { code: 'poisoned', name: 'Отравлен', color: 'var(--success)', icon: path('poisoned'), effects: ['Получает помеху к броскам атаки и проверкам характеристик.'] },
  { code: 'prone', name: 'Сбит с ног', color: 'var(--warning)', icon: path('prone'), effects: ['Может ползти или потратить половину скорости, чтобы встать; его атаки совершаются с помехой.', 'Атака с 5 футов по нему получает преимущество, более дальняя — помеху.'] },
  { code: 'restrained', name: 'Опутан', color: 'var(--accent)', icon: path('restrained'), effects: ['Скорость 0; его атаки совершаются с помехой, атаки по нему — с преимуществом.', 'Спасброски Ловкости совершаются с помехой.'] },
  { code: 'stunned', name: 'Ошеломлён', color: 'var(--warning)', icon: path('stunned'), effects: ['Недееспособен, не может двигаться и говорит сбивчиво.', 'Автоматически проваливает спасброски Силы и Ловкости; атаки по нему получают преимущество.'] },
  { code: 'unconscious', name: 'Без сознания', color: 'var(--danger)', icon: path('unconscious'), effects: ['Недееспособен, падает, выпускает предметы, не двигается и автоматически проваливает спасброски Силы и Ловкости.', 'Атаки по нему получают преимущество; попадание атакой с расстояния не более 5 футов становится критическим.'] },
  { code: 'exhaustion', name: 'Истощён', color: 'var(--warning)', icon: null, effects: ['Уровни дают по порядку: помеху к проверкам; половину скорости; помеху к атакам и спасброскам; половину максимума хитов; скорость 0; смерть.', 'Эффекты складываются. Еда, питьё и продолжительный отдых обычно снимают один уровень.'] },
]

const selectedCode = ref('prone')
const selected = computed(() => conditions.find(condition => condition.code === selectedCode.value) || conditions[0])
</script>

<style scoped>
.conditions-visual { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, .6fr); gap: 12px; margin: 24px 0 28px; }
.conditions-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.condition-tile { min-width: 0; }
.condition-tile--selected { background: color-mix(in srgb, var(--tile-color) 10%, var(--surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tile-color) 45%, var(--border)); }
.condition-tile button { width: 100%; height: 100%; min-height: 58px; display: flex; align-items: center; gap: 8px; padding: 9px; border: 0; border-radius: inherit; color: var(--text-2); background: none; font: inherit; font-size: 9px; font-weight: 700; text-align: left; cursor: pointer; }
.condition-tile button:hover { color: var(--text-1); background: color-mix(in srgb, var(--tile-color) 7%, transparent); }
.condition-tile img,
.condition-tile svg { width: 24px; height: 24px; flex: 0 0 auto; object-fit: contain; opacity: .82; }
.condition-detail { min-height: 100%; display: grid; grid-template-columns: auto 1fr; align-content: start; gap: 10px; padding: 18px; box-sizing: border-box; }
.condition-detail-icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 10px; background: color-mix(in srgb, var(--tile-color) 13%, transparent); }
.condition-detail-icon img,
.condition-detail-icon svg { width: 30px; height: 30px; object-fit: contain; }
.condition-detail small,
.condition-detail strong { display: block; }
.condition-detail small { color: var(--text-muted); font-size: 8px; text-transform: uppercase; letter-spacing: .07em; }
.condition-detail strong { margin-top: 2px; color: var(--text-1); font-family: var(--font-display); font-size: 22px; }
.condition-detail ul { grid-column: 1 / -1; display: grid; gap: 9px; margin: 8px 0 0; padding: 0; list-style: none; }
.condition-detail li { position: relative; padding-left: 15px; color: var(--text-2); font-size: 10px; line-height: 1.5; }
.condition-detail li::before { position: absolute; top: .6em; left: 0; width: 5px; height: 5px; border-radius: 50%; background: var(--tile-color); content: ''; }
@media (max-width: 800px) {
  .conditions-visual { grid-template-columns: 1fr; }
  .condition-detail { min-height: 190px; }
}
@media (max-width: 520px) {
  .conditions-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
