<template>
  <div class="origin-summary">
    <CoverSummaryLayout :side-min="145" :side-max="220" :center-min="210" :medium-center-min="76">
      <template #left>
        <CoverStatCard
          :icon="primaryIcon"
          :label="primaryLabel"
          :value="primaryValue"
          :note="primaryNote"
          tone="accent"
          :size="primaryValue.length > 18 ? 'compact' : 'large'"
        />
        <CoverStatCard v-if="secondaryValue" :icon="secondaryIcon" :label="secondaryLabel" :value="secondaryValue" size="compact" />
      </template>

      <template #right>
        <CoverStatCard v-if="rightValue" :icon="rightIcon" :label="rightLabel" :value="rightValue" size="compact" />
        <CoverStatCard v-if="rightSecondaryValue" :icon="rightSecondaryIcon" :label="rightSecondaryLabel" :value="rightSecondaryValue" size="compact" />
      </template>

      <template v-if="kind !== 'subrace'" #bottom>
        <CoverSummaryRail :columns="kind === 'class' ? 2 : 1">
          <CoverSummaryRailItem v-if="kind === 'race' || kind === 'class'" :icon="Link2" :label="relationLabel">{{ relationValue }}</CoverSummaryRailItem>
          <CoverSummaryRailItem v-if="kind.includes('class')" :icon="Sparkles" :label="specialLabel">{{ specialValue }}</CoverSummaryRailItem>
        </CoverSummaryRail>
      </template>
    </CoverSummaryLayout>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { BookOpen, Dices, Footprints, Languages, Link2, Ruler, ShieldCheck, Sparkles, Users } from '@lucide/vue'
import CoverStatCard from '@/features/items/components/cover/CoverStatCard.vue'
import CoverSummaryLayout from '@/features/items/components/cover/CoverSummaryLayout.vue'
import CoverSummaryRail from '@/features/items/components/cover/CoverSummaryRail.vue'
import CoverSummaryRailItem from '@/features/items/components/cover/CoverSummaryRailItem.vue'
import { ensureItemNames, itemName } from '@/features/handbook/objects/lib/itemNames'
import { useSuggestStore } from '@/stores/suggest'
import {
  abilityNames,
  asiLabel,
  hitDieLabel,
  originKind,
  originParentId,
  originRelationIds,
  spellcastingLabel,
  subclassGrantedSpellMetric,
  subclassSpellcastingLabel,
} from '@/features/items/lib/originPresentation'

const props = defineProps({ item: { type: Object, required: true }, type: { type: Object, default: null } })
const suggestStore = useSuggestStore()
;[6, 16].forEach(id => suggestStore.ensure(id))

const data = computed(() => props.item.data || {})
const kind = computed(() => originKind(props.type?.id || props.item.typeId))
const parentId = computed(() => originParentId(props.item))
const parentName = computed(() => parentId.value == null ? '' : itemName(parentId.value))
const relationIds = computed(() => originRelationIds(props.item))
const suggestLabels = (typeId, ids) => (Array.isArray(ids) ? ids : [])
  .map(id => suggestStore.items(typeId).find(item => String(item.id) === String(id))?.value)
  .filter(Boolean)

const primaryLabel = computed(() => {
  if (kind.value === 'class') return 'Кость хитов'
  if (kind.value === 'subclass') return 'Базовый класс'
  if (kind.value === 'subrace') return 'Базовая раса'
  return 'Бонусы характеристик'
})
const primaryValue = computed(() => {
  if (kind.value === 'class') return hitDieLabel(data.value)
  if (kind.value === 'subclass' || kind.value === 'subrace') return parentName.value || 'Не указан'
  return asiLabel(data.value) || 'На выбор'
})
const primaryNote = computed(() => kind.value === 'class' ? 'на каждом уровне' : '')
const primaryIcon = computed(() => kind.value === 'class' ? Dices : (kind.value === 'race' ? Sparkles : Link2))
const secondaryLabel = computed(() => kind.value.includes('class') ? 'Ключевые характеристики' : 'Размер')
const secondaryValue = computed(() => kind.value.includes('class')
  ? abilityNames(data.value.primary_abilities, { short: true }).join(', ')
  : String(data.value.size || ''))
const secondaryIcon = computed(() => kind.value.includes('class') ? Sparkles : Ruler)
const rightLabel = computed(() => kind.value.includes('class') ? 'Спасброски' : 'Скорость')
const rightValue = computed(() => kind.value.includes('class')
  ? abilityNames(data.value.saves, { short: true }).join(', ')
  : (data.value.speed != null ? `${data.value.speed} фт.` : ''))
const rightIcon = computed(() => kind.value.includes('class') ? ShieldCheck : Footprints)
const rightSecondaryLabel = computed(() => kind.value.includes('class') ? 'Заклинательство' : 'Языки')
const rightSecondaryValue = computed(() => kind.value.includes('class')
  ? (kind.value === 'subclass' ? subclassSpellcastingLabel(data.value) : spellcastingLabel(data.value))
  : suggestLabels(6, data.value.languages).join(', '))
const rightSecondaryIcon = computed(() => kind.value.includes('class') ? BookOpen : Languages)
const relationLabel = computed(() => kind.value === 'race' ? 'Подрасы' : kind.value === 'class' ? 'Подклассы' : 'Родитель')
const relationValue = computed(() => {
  if (kind.value === 'race' || kind.value === 'class') return relationIds.value.length || 'Нет'
  return parentName.value || 'Не связан'
})
const specialLabel = computed(() => kind.value === 'class' ? 'Архетип' : 'Дарованные заклинания')
const specialValue = computed(() => {
  if (kind.value === 'class') return data.value.subclass_level ? `выбор на ${data.value.subclass_level} ур.` : 'по правилам класса'
  return subclassGrantedSpellMetric(data.value).summary
})

watch(parentId, id => id != null && ensureItemNames([id]), { immediate: true })
</script>

<style scoped>
.origin-summary { flex: 1; width: 100%; display: flex; }
</style>
