<template>
  <DetailSection v-if="effects.length" :label="kind === 'weapon' ? 'Что добавляется к оружию' : 'Что меняется у доспеха'" tone="combat">
    <template #icon><Sparkles /></template>
    <div class="equipment-additions">
      <BaseTile v-for="effect in effects" :key="effect.key" class="equipment-addition">
        <component :is="effect.icon" :size="20" class="equipment-addition-icon" aria-hidden="true" />
        <div class="equipment-addition-copy">
          <span class="equipment-addition-label">{{ effect.label }}</span>
          <strong :class="{ 'equipment-addition-bonus': effect.key === 'bonus' }">{{ effect.value }}</strong>
          <small v-if="effect.note">{{ effect.note }}</small>
        </div>
      </BaseTile>
    </div>
  </DetailSection>
</template>
<script setup>
import { computed } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { BadgeCheck, Dumbbell, Eye, Flame, MoveHorizontal, ShieldCheck, Sparkles, Swords, Tags } from '@lucide/vue'
import DetailSection from '@/shared/ui/DetailSection.vue'
import { useSuggestStore } from '@/stores/suggest'
const props = defineProps({ item: { type: Object, required: true }, kind: { type: String, required: true } })
const suggest = useSuggestStore()
function names(type, ids) {
  return ids.map(id => suggest.items(type).find(row => String(row.id) === String(id))?.value || 'Название загружается…').join(', ')
}
const effects = computed(() => {
  const data = props.item.data || {}, rule = data[props.kind] || {}, rows = []
  const add = (key, icon, label, value, note = '') => rows.push({ key, icon, label, value, note })
  if (Number(rule.magic_bonus)) {
    const conditions = []
    if (data.attunement !== 'none') conditions.push(rule.bonus_without_attunement ? 'Действует и без настройки' : 'После настройки на предмет')
    if (Number(data.level) > 1) conditions.push(`с уровня ${data.level}`)
    add('bonus', props.kind === 'weapon' ? Swords : ShieldCheck,
      props.kind === 'weapon' ? 'К броскам атаки и урона' : 'К классу доспеха',
      `${Number(rule.magic_bonus) > 0 ? '+' : ''}${rule.magic_bonus}`, conditions.join(' · '))
  }
  if (props.kind === 'weapon') {
    if (rule.damage_type != null) add('damage', Flame, 'Тип основного урона', names(12, [rule.damage_type]), 'Заменяет тип урона основы')
    if (rule.extra_tags?.length) add('tags', Tags, 'Дополнительные свойства', names(14, rule.extra_tags))
    if (rule.extra_proficiencies?.length) add('proficiencies', BadgeCheck, 'Также подходит владение', names(4, rule.extra_proficiencies))
    if (rule.range_min != null || rule.range_max != null) {
      const both = rule.range_min != null && rule.range_max != null
      add('range', MoveHorizontal, both ? 'Дистанция' : rule.range_min != null ? 'Обычная дистанция' : 'Предельная дистанция',
        `${both ? `${rule.range_min} / ${rule.range_max}` : rule.range_min ?? rule.range_max} фт.`, both ? 'Обычная / предельная' : 'Вместо значения основы')
    }
  } else {
    if (rule.ignore_strength) add('strength', Dumbbell, 'Требование Силы', 'Без ограничения', 'Отменяет требование основы')
    if (rule.ignore_stealth_disadvantage) add('stealth', Eye, 'Скрытность', 'Без помехи от доспеха')
    if (rule.grants_proficiency) add('proficiency', BadgeCheck, 'Владение доспехом', 'Предоставляется владельцу')
  }
  return rows
})
</script>
<style scoped>
.equipment-additions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.equipment-addition { display: flex; align-items: flex-start; gap: 12px; padding: 14px; min-width: 0; }
.equipment-addition-icon { flex: none; margin-top: 2px; color: var(--accent-soft); }
.equipment-addition-copy { display: flex; flex-direction: column; gap: 5px; min-width: 0; overflow-wrap: anywhere; }
.equipment-addition-label { font-size: 11px; color: var(--text-muted); }
.equipment-addition-copy strong { font-size: 15px; font-weight: 650; line-height: 1.35; color: var(--text-1); }
.equipment-addition-copy .equipment-addition-bonus { font-size: 28px; font-variant-numeric: tabular-nums; line-height: 1.15; color: var(--accent-soft); }
.equipment-addition-copy small { font-size: 11px; color: var(--text-muted); line-height: 1.45; }
@media (max-width: 540px) { .equipment-additions { grid-template-columns: minmax(0, 1fr); } }
</style>
