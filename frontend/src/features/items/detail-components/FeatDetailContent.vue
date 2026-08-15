<template>
  <article class="fdc">
    <header class="fdc-hero">
      <div class="fdc-sigil" aria-hidden="true">
        <span class="fdc-sigil-ring"></span>
        <ItemIcon v-if="item.iconImageUrl || item.svg" class="fdc-item-icon" :item="item" :fallback-to-type="false" :size="42" />
        <svg v-else viewBox="0 0 40 40" fill="none">
          <path d="M20 5l4.4 10.6L35 20l-10.6 4.4L20 35l-4.4-10.6L5 20l10.6-4.4L20 5Z" stroke="currentColor" stroke-width="1.5" />
          <circle cx="20" cy="20" r="4.5" fill="currentColor" />
        </svg>
      </div>
      <div class="fdc-heading">
        <div v-if="showTitle" class="fdc-title-row">
          <h2>{{ item.name }}</h2>
          <span v-if="item.nameEn" class="fdc-name-en">{{ nameEn }}</span>
        </div>
        <div class="fdc-badges">
          <span v-if="data.repeatable" class="fdc-badge fdc-badge-repeat">Можно брать повторно</span>
          <span v-if="choices.length" class="fdc-badge">{{ choicesCountLabel }}</span>
          <span v-if="data.max_use" class="fdc-badge">{{ data.max_use }} исп.</span>
          <span v-if="restLabel" class="fdc-badge fdc-badge-rest">{{ restLabel }}</span>
          <span v-for="tag in tags" :key="tag" class="fdc-badge fdc-badge-tag">{{ tag }}</span>
        </div>
      </div>
    </header>

    <section v-if="prereqText" class="fdc-prereq">
      <div class="fdc-prereq-icon" aria-hidden="true">◇</div>
      <div>
        <div class="fdc-eyebrow">Необходимое условие</div>
        <div class="fdc-prereq-text">{{ prereqText }}</div>
      </div>
    </section>

    <section v-if="benefits.length" class="fdc-benefits">
      <div v-for="benefit in benefits" :key="benefit.label" class="fdc-benefit">
        <span class="fdc-benefit-value">{{ benefit.value }}</span>
        <span class="fdc-benefit-label">{{ benefit.label }}</span>
      </div>
    </section>

    <section v-if="grantGroups.length" class="fdc-section">
      <div class="fdc-section-title">Даёт персонажу</div>
      <div class="fdc-grants">
        <div v-for="group in grantGroups" :key="group.label" class="fdc-grant-group">
          <span class="fdc-grant-label">{{ group.label }}</span>
          <span v-for="value in group.values" :key="value" class="fdc-grant-chip">{{ value }}</span>
        </div>
      </div>
    </section>

    <section v-if="choices.length" class="fdc-section">
      <div class="fdc-section-title">Выбор при получении</div>
      <div class="fdc-choice-grid">
        <div v-for="choice in choices" :key="choice.key" class="fdc-choice">
          <div class="fdc-choice-head">
            <span>{{ choice.text || 'Выберите вариант' }}</span>
            <b>{{ choice.count }}</b>
          </div>
          <div class="fdc-choice-source">{{ choiceSource(choice) }}</div>
          <div v-if="choiceEffects(choice).length" class="fdc-choice-effects">
            <span v-for="effect in choiceEffects(choice)" :key="effect">{{ effect }}</span>
          </div>
          <div v-if="choice.options?.length" class="fdc-choice-options">
            <span v-for="option in choice.options" :key="option.value || option.label">
              {{ option.label || option.value }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <div class="fdc-divider"></div>
    <RichContent v-if="description" class="fdc-description" :html="description" />
    <div v-else class="fdc-empty">Описание отсутствует</div>

    <footer v-if="data.source_page" class="fdc-source">Книга игрока · стр. {{ data.source_page }}</footer>
  </article>
</template>

<script setup>
import { computed } from 'vue'

import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { RichContent } from '@sylvieshare/share-ui'
import { featChoices, featDescription, featPrereq } from '@/features/items/lib/featRules'
import { useSuggestStore } from '@/stores/suggest'
import { STAT_FULL, SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
  showTitle: { type: Boolean, default: true },
})

const suggestStore = useSuggestStore()
;[3, 4, 5, 6, 15, 16].forEach((typeId) => suggestStore.ensure(typeId))
const data = computed(() => props.item.data || {})
const description = computed(() => featDescription(props.item))
const prereq = computed(() => featPrereq(props.item))
const choices = computed(() => featChoices(props.item))
const nameEn = computed(() => String(props.item.nameEn || '').replace(/_/g, ' ').replace(/\b[a-z]/g, (char) => char.toUpperCase()))
const tags = computed(() => String(data.value.tags || '').split(/[,;]+/).map((tag) => tag.trim()).filter(Boolean))

function suggestLabel(typeId, id) {
  return suggestStore.items(Number(typeId))?.find((item) => String(item.id) === String(id))?.value || `#${id}`
}

const prereqText = computed(() => {
  if (prereq.value.text) return prereq.value.text
  const parts = []
  const stats = Array.isArray(prereq.value.min_stats) ? prereq.value.min_stats : []
  if (stats.length) {
    const glue = prereq.value.min_stats_mode === 'any' ? ' или ' : ' и '
    parts.push(stats.map((row) => `${STAT_FULL[SUGGEST16_TO_STAT[Number(row.ability)]] || 'Характеристика'} ${row.value}+`).join(glue))
  }
  if (prereq.value.spellcasting) parts.push('Способность накладывать хотя бы одно заклинание')
  if (prereq.value.armor_prof?.length) parts.push(`Владение: ${prereq.value.armor_prof.map((id) => suggestLabel(3, id)).join(', ')}`)
  if (prereq.value.min_level) parts.push(`${prereq.value.min_level} уровень`)
  return parts.join(' · ')
})

const restLabel = computed(() => {
  if (data.value.rollback_short_rest && data.value.rollback_long_rest) return 'Короткий или длинный отдых'
  if (data.value.rollback_short_rest) return 'Короткий отдых'
  if (data.value.rollback_long_rest) return 'Длинный отдых'
  return ''
})

const choicesCountLabel = computed(() => {
  const count = choices.value.reduce((sum, choice) => sum + choice.count, 0)
  return `${count} ${count === 1 ? 'выбор' : count < 5 ? 'выбора' : 'выборов'}`
})

const benefits = computed(() => {
  const rows = []
  for (const asi of (data.value.asi || [])) {
    const stat = STAT_FULL[SUGGEST16_TO_STAT[Number(asi.ability)]] || 'Характеристика'
    rows.push({ value: `${Number(asi.bonus) >= 0 ? '+' : ''}${asi.bonus}`, label: stat })
  }
  if (data.value.asi_choice?.bonus) {
    const count = Number(data.value.asi_choice.count) || 1
    rows.push({ value: `+${data.value.asi_choice.bonus}`, label: `${count} хар. на выбор` })
  }
  return rows
})

const GRANT_META = [
  ['armor_prof', 'Доспехи', 3],
  ['weapon_prof', 'Оружие', 4],
  ['tool_prof', 'Инструменты', 5],
  ['skill_prof', 'Навыки', 15],
  ['save_prof', 'Спасброски', 16],
  ['languages', 'Языки', 6],
]
const grantGroups = computed(() => GRANT_META.map(([key, label, typeId]) => ({
  label,
  values: (data.value.grants?.[key] || []).map((id) => suggestLabel(typeId, id)),
})).filter((group) => group.values.length))

function choiceSource(choice) {
  if (choice.source === 'suggest') return `Выбрать ${choice.count} из словаря #${choice.from_suggest_id}`
  if (choice.source === 'item') return `Выбрать ${choice.count} из коллекции #${choice.from_item_type_id}`
  return `Выбрать ${choice.count} из вариантов`
}

const GRANT_LABELS = {
  armor_prof: 'владение доспехом',
  weapon_prof: 'владение оружием',
  tool_prof: 'владение инструментом',
  skill_prof: 'владение навыком',
  save_prof: 'владение спасброском',
  languages: 'знание языка',
}

function choiceEffects(choice) {
  const effects = []
  if (Number(choice.ability_bonus)) effects.push(`+${choice.ability_bonus} к выбранной характеристике`)
  if (GRANT_LABELS[choice.grant_proficiency]) effects.push(GRANT_LABELS[choice.grant_proficiency])
  if (choice.grant_spells) effects.push('добавляет выбранные заклинания')
  return effects
}
</script>

<style scoped>
.fdc { --feat: var(--warning); display: flex; flex-direction: column; gap: 15px; }
.fdc-hero { position: relative; display: flex; align-items: center; gap: 16px; min-height: 72px; padding: 3px 0; }
.fdc-sigil { position: relative; display: grid; place-items: center; width: 62px; height: 62px; flex-shrink: 0; color: var(--feat); }
.fdc-sigil::before { content: ''; position: absolute; inset: 8px; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--feat) 25%, transparent), transparent 70%); filter: blur(3px); }
.fdc-sigil-ring { position: absolute; inset: 3px; border: 1px solid color-mix(in srgb, var(--feat) 36%, transparent); border-radius: 50%; box-shadow: inset 0 0 18px color-mix(in srgb, var(--feat) 8%, transparent); }
.fdc-sigil svg, .fdc-item-icon { position: relative; width: 42px; height: 42px; filter: drop-shadow(0 0 8px color-mix(in srgb, var(--feat) 35%, transparent)); }
.fdc-heading { min-width: 0; display: flex; flex-direction: column; gap: 9px; }
.fdc-title-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 9px; padding-right: 24px; }
.fdc-title-row h2 { margin: 0; color: var(--text-1); font-family: var(--font-display); font-size: 25px; font-weight: 700; line-height: 1.12; }
.fdc-name-en { color: var(--text-muted); font-size: 12px; }
.fdc-badges { display: flex; flex-wrap: wrap; gap: 5px; }
.fdc-badge { padding: 3px 8px; border: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, transparent); border-radius: var(--r-pill); background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); color: var(--text-2); font-size: 9px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; }
.fdc-badge-repeat { border-color: color-mix(in srgb, var(--feat) 40%, transparent); background: color-mix(in srgb, var(--feat) 12%, transparent); color: var(--feat); }
.fdc-badge-rest { color: var(--info); }
.fdc-badge-tag { color: var(--text-muted); text-transform: none; }
.fdc-prereq { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--feat) 28%, var(--border)); border-left: 3px solid var(--feat); border-radius: 9px; background: linear-gradient(100deg, color-mix(in srgb, var(--feat) 11%, transparent), transparent 65%); }
.fdc-prereq-icon { color: var(--feat); font-size: 24px; line-height: 1; }
.fdc-eyebrow, .fdc-section-title { color: var(--feat); font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
.fdc-prereq-text { margin-top: 3px; color: var(--text-1); font-size: 12px; font-weight: 600; line-height: 1.45; }
.fdc-benefits { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); overflow: hidden; border: 1px solid var(--border); border-radius: 10px; background: color-mix(in srgb, var(--surface) 78%, transparent); }
.fdc-benefit { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px; border-right: 1px solid var(--border); }
.fdc-benefit:last-child { border-right: none; }
.fdc-benefit-value { color: var(--feat); font-family: var(--font-display); font-size: 21px; font-weight: 700; }
.fdc-benefit-label { color: var(--text-muted); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; }
.fdc-section { display: flex; flex-direction: column; gap: 8px; }
.fdc-grants { display: flex; flex-direction: column; gap: 7px; }
.fdc-grant-group { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.fdc-grant-label { width: 84px; color: var(--text-muted); font-size: 10px; }
.fdc-grant-chip, .fdc-choice-options span { padding: 4px 8px; border-radius: var(--r-pill); background: var(--surface-raised); color: var(--text-2); font-size: 10px; }
.fdc-choice-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
.fdc-choice { padding: 10px 11px; border: 1px solid var(--border); border-radius: 9px; background: color-mix(in srgb, var(--surface) 84%, transparent); }
.fdc-choice-head { display: flex; justify-content: space-between; gap: 8px; color: var(--text-1); font-size: 11px; font-weight: 650; }
.fdc-choice-head b { display: grid; place-items: center; width: 19px; height: 19px; flex-shrink: 0; border-radius: 50%; background: color-mix(in srgb, var(--feat) 16%, transparent); color: var(--feat); font-size: 10px; }
.fdc-choice-source { margin-top: 3px; color: var(--text-muted); font-size: 9px; }
.fdc-choice-effects { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
.fdc-choice-effects span { padding: 3px 7px; border: 1px solid color-mix(in srgb, var(--feat) 25%, transparent); border-radius: var(--r-pill); color: var(--feat); font-size: 9px; }
.fdc-choice-options { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
.fdc-divider { height: 1px; background: linear-gradient(90deg, color-mix(in srgb, var(--feat) 45%, transparent), var(--border) 35%, transparent); }
.fdc-description { color: var(--text-2); font-size: 13px; line-height: 1.68; }
.fdc-empty { color: var(--text-muted); font-size: 12px; font-style: italic; }
.fdc-source { align-self: flex-end; color: var(--text-muted); font-size: 9px; letter-spacing: 0.05em; text-transform: uppercase; }
@media (max-width: 560px) { .fdc-sigil { width: 50px; height: 50px; } .fdc-title-row h2 { font-size: 21px; } }
</style>
