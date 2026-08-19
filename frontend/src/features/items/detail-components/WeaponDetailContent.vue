<template>
  <div class="wdc-detail">
    <div v-if="showTitle" class="wdc-title-row">
      <ItemIcon v-if="item.iconImageUrl || item.svg" :item="item" :fallback-to-type="false" :size="38" />
      <div class="wdc-title-text">
        <div class="wdc-name">{{ item.name }}</div>
        <div v-if="item.nameEn" class="wdc-name-en">{{ nameEnFormatted }}</div>
      </div>
    </div>

    <div v-if="showTitle" class="wdc-pills">
      <span class="wdc-pill" :class="{ 'wdc-pill-on': data.is_military }">
        {{ data.is_military ? 'Воинское' : 'Простое' }}
      </span>
      <span class="wdc-pill" :class="{ 'wdc-pill-range': data.is_long_range }">
        {{ data.is_long_range ? 'Дальнобойное' : 'Ближний бой' }}
      </span>
    </div>

    <div v-if="showTitle" class="wdc-stat-grid">
      <div v-if="rangeLabel" class="wdc-stat-cell">
        <span class="wdc-stat-value">{{ rangeLabel }}</span>
        <span class="wdc-stat-label">Дистанция</span>
      </div>
      <div v-if="costLabel" class="wdc-stat-cell">
        <span class="wdc-stat-value wdc-cost">{{ costLabel }}</span>
        <span class="wdc-stat-label">Стоимость</span>
      </div>
      <div v-if="data.weight != null" class="wdc-stat-cell">
        <span class="wdc-stat-value">{{ data.weight }}</span>
        <span class="wdc-stat-label">Вес, фунт.</span>
      </div>
    </div>

    <DetailSection v-if="showTitle && hasDamageInfo" label="Урон" tone="combat">
      <template #icon><Swords /></template>
      <div
        class="wdc-damage-grid"
        :class="{ 'wdc-damage-grid-paired': attacks.length && universeAttacks.length }"
      >
        <div v-if="attacks.length" class="wdc-damage-section">
          <div class="wdc-section-title">Атака</div>
          <div class="wdc-attacks">
            <div v-for="(attack, idx) in attacks" :key="idx" class="wdc-attack">
              <span class="wdc-dice" :class="{ 'wdc-dice-icon-wrap': attackDisplay(attack).diceSides }">
                <template v-if="attackDisplay(attack).diceSides">
                  <span v-if="attackDisplay(attack).count !== 1" class="wdc-dice-count">{{ attackDisplay(attack).count }}</span>
                  <SystemDie :sides="attackDisplay(attack).diceSides" :size="46" />
                </template>
                <template v-else>{{ attackDisplay(attack).label }}</template>
              </span>
              <span v-if="damageTypeLabel(attack)" class="wdc-attack-sep"></span>
              <span v-if="damageTypeLabel(attack)" class="wdc-damage-type">{{ damageTypeLabel(attack) }}</span>
            </div>
          </div>
        </div>

        <div v-if="universeAttacks.length" class="wdc-damage-section wdc-damage-section-alt">
          <div class="wdc-section-title">Атака двумя руками</div>
          <div class="wdc-attacks">
            <div v-for="(attack, idx) in universeAttacks" :key="idx" class="wdc-attack wdc-attack-alt">
              <span class="wdc-dice" :class="{ 'wdc-dice-icon-wrap': attackDisplay(attack).diceSides }">
                <template v-if="attackDisplay(attack).diceSides">
                  <span v-if="attackDisplay(attack).count !== 1" class="wdc-dice-count">{{ attackDisplay(attack).count }}</span>
                  <SystemDie :sides="attackDisplay(attack).diceSides" :size="46" />
                </template>
                <template v-else>{{ attackDisplay(attack).label }}</template>
              </span>
              <span v-if="damageTypeLabel(attack)" class="wdc-attack-sep"></span>
              <span v-if="damageTypeLabel(attack)" class="wdc-damage-type">{{ damageTypeLabel(attack) }}</span>
            </div>
          </div>
        </div>
      </div>
    </DetailSection>

    <DetailSection v-if="showTitle && tagItems.length" label="Свойства">
      <template #icon><Tags /></template>
      <div class="wdc-tags">
        <span
          v-for="tag in tagItems"
          :key="tag.id"
          class="wdc-tag"
          :class="{ 'wdc-tag-has-desc': tag.desc }"
          @mouseenter="showTagTooltip($event, tag)"
          @mouseleave="hideTagTooltip"
        >
          {{ tag.label }}
        </span>
      </div>
    </DetailSection>

    <DetailSection v-if="data.notes" label="Описание">
      <template #icon><BookOpen /></template>
      <RichContent class="wdc-notes" :html="data.notes" />
    </DetailSection>

    <ItemTooltip
      v-if="tooltip.visible"
      :title="tooltip.title"
      :desc="tooltip.desc"
      :x="tooltip.x"
      :top="tooltip.top"
      :bottom="tooltip.bottom"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BookOpen, Swords, Tags } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import DetailSection from '@/shared/ui/DetailSection.vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'
import { useSchemaSuggests } from '@/features/handbook/objects/lib/useSchemaSuggests'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { diceById } from '@/shared/lib/systemDice'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
  showTitle: { type: Boolean, default: true },
})

const { suggestItems } = useSchemaSuggests(() => props.type)

const damageTypeMap = computed(() => Object.fromEntries(suggestItems('type').map(s => [s.id, s.value])))
const tagDetailsMap = computed(() => Object.fromEntries(suggestItems('tags').map(s => [s.id, s])))
const tagMap = computed(() => Object.fromEntries(suggestItems('tags').map(s => [s.id, s.value])))

const tooltip = ref({
  visible: false,
  title: '',
  desc: '',
  x: 0,
  top: null,
  bottom: null,
})

const data = computed(() => props.item.data || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))

const attacks = computed(() => {
  if (!Array.isArray(data.value.attacks)) return []
  return data.value.attacks.map(attack => ({
    count: attack.count,
    dice_id: attack.dice_id,
    type: attack.type,
  }))
})

const universeAttacks = computed(() => {
  if (!Array.isArray(data.value.universe_attacks)) return []
  return data.value.universe_attacks.map(attack => ({
    count: attack.count,
    dice_id: attack.dice_id,
    type: attack.type,
  }))
})

const hasDamageInfo = computed(() => attacks.value.length || universeAttacks.value.length)

const tagItems = computed(() =>
  (Array.isArray(data.value.tags) ? data.value.tags : [])
    .map(id => {
      if (id && typeof id === 'object') {
        return {
          id: id.id ?? id.value,
          label: id.value || id.label || id.name || String(id.id ?? ''),
          desc: id.desc || '',
        }
      }
      const item = tagDetailsMap.value[id] || {}
      return {
        id,
        label: item.value || tagMap.value[id] || String(id),
        desc: item.desc || '',
      }
    })
    .filter(item => item.label)
)

const rangeLabel = computed(() => {
  const min = data.value.range_min
  const max = data.value.range_max
  if (min == null && max == null) return ''
  if (min != null && max != null) return `${min}/${max} фт.`
  if (min != null) return `${min} фт.`
  return `${max} фт.`
})

const nameEnFormatted = computed(() =>
  (props.item.nameEn || '')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, ch => ch.toUpperCase())
)

function attackDisplay(attack) {
  const count = Number(attack.count) || 1
  const dice = diceById(attack.dice_id)
  const diceLabel = dice?.value || ''
  if (!diceLabel) return { count, diceLabel: '', diceSides: null, label: String(count) }
  return { count, diceLabel, diceSides: dice.sides, label: `${count}${diceLabel}` }
}

function damageTypeLabel(attack) {
  return damageTypeMap.value[attack.type] || attack.type || ''
}

function showTagTooltip(event, tag) {
  if (!tag.desc) return
  const rect = event.currentTarget.getBoundingClientRect()
  const placeAbove = window.innerHeight - rect.bottom < 220
  tooltip.value = {
    visible: true,
    title: tag.label,
    desc: tag.desc,
    x: Math.max(8, Math.min(rect.left, window.innerWidth - 380)),
    top: placeAbove ? null : rect.bottom + 8,
    bottom: placeAbove ? window.innerHeight - rect.top + 8 : null,
  }
}

function hideTagTooltip() {
  tooltip.value.visible = false
}
</script>

<style scoped>
.wdc-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wdc-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 24px;
  flex-wrap: wrap;
}

.wdc-title-text { min-width: 0; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }

.wdc-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.2;
}
.wdc-name-en { font-size: 13px; color: var(--text-muted); }

.wdc-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.wdc-pill {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  color: var(--text-muted);
}
.wdc-pill-on    { background: color-mix(in srgb, var(--accent-soft) 15%, transparent); color: var(--accent-soft); }
.wdc-pill-range { background: color-mix(in srgb, var(--info) 16%, transparent);  color: var(--info); }

.wdc-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 3%, transparent);
}

.wdc-stat-grid:empty { display: none; }

.wdc-stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 58px;
  padding: 9px 8px;
  border-right: 1px solid color-mix(in srgb, var(--text-on-accent) 6%, transparent);
}
.wdc-stat-cell:last-child { border-right: none; }

.wdc-stat-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
}
.wdc-stat-label {
  font-size: 9px;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: center;
}
.wdc-cost { color: var(--warning); }

.wdc-damage-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.wdc-damage-grid {
  display: grid;
  gap: 12px;
}

.wdc-damage-grid-paired {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.wdc-damage-section-alt {
  padding-left: 12px;
  border-left: 1px solid var(--border);
}

.wdc-section-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.wdc-attacks {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wdc-attack {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  min-height: 36px;
  padding: 3px 10px 3px 6px;
  border: 1px solid color-mix(in srgb, var(--accent-soft) 20%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--accent-soft) 10%, transparent);
  color: var(--text-1);
}

.wdc-dice {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  color: var(--text-1);
  font-size: 15px;
  font-weight: 700;
  padding: 0;
}

.wdc-dice-icon-wrap {
  min-height: 31px;
  background: transparent;
  border-color: transparent;
  padding: 0;
}

.wdc-dice-count {
  min-width: 10px;
  text-align: right;
}

.wdc-attack-alt .wdc-dice {
  color: var(--text-1);
}

.wdc-attack-alt {
  background: color-mix(in srgb, var(--success) 11%, transparent);
  border-color: color-mix(in srgb, var(--success) 22%, transparent);
}

.wdc-attack-sep {
  width: 1px;
  height: 18px;
  background: color-mix(in srgb, var(--text-on-accent) 12%, transparent);
}

.wdc-damage-type {
  color: var(--text-2);
  font-size: 12px;
  padding-left: 1px;
}

.wdc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.wdc-tag {
  position: relative;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  color: var(--text-muted);
}
.wdc-tag-has-desc {
  cursor: help;
  transition: background .12s ease, color .12s ease;
}
.wdc-tag-has-desc:hover {
  background: color-mix(in srgb, var(--accent-soft) 16%, transparent);
  color: var(--accent-soft);
}

.wdc-notes {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.65;
}

.wdc-no-desc { font-size: 13px; color: var(--text-muted); font-style: italic; }

@media (max-width: 620px) {
  .wdc-damage-grid-paired { grid-template-columns: 1fr; }
  .wdc-damage-section-alt {
    padding-left: 0;
    padding-top: 12px;
    border-left: none;
    border-top: 1px solid var(--border);
  }
}
</style>
