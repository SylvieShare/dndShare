<template>
  <ObjectListItem :item="item" :name-en="item.nameEn || ''" :custom="item.userId != null" :gap="11">
    <template #leading>
      <span class="fli-sigil" aria-hidden="true">
        <ItemIcon v-if="item.iconImageUrl || item.svg" :item="item" :fallback-to-type="false" :size="17" />
        <template v-else>✦</template>
      </span>
    </template>
    <template #subtitle>
      <span v-if="subtitle" class="fli-subtitle">{{ subtitle }}</span>
      <span v-else class="fli-subtitle fli-subtitle-muted">Без требований</span>
    </template>
    <template #trailing>
      <span v-if="choiceCount" class="fli-choice">{{ choiceCount }}×</span>
      <span v-if="data.repeatable" class="fli-repeat" title="Можно брать повторно">↻</span>
    </template>
  </ObjectListItem>
</template>

<script setup>
import { computed } from 'vue'

import ItemIcon from '@/features/items/components/ItemIcon.vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import { featChoices, featPrereq } from '@/features/items/lib/featRules'
import { STAT_FULL, SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'

const props = defineProps({ item: { type: Object, required: true } })
const data = computed(() => props.item.data || {})
const prereq = computed(() => featPrereq(props.item))
const choiceCount = computed(() => featChoices(props.item).reduce((sum, choice) => sum + choice.count, 0))
const subtitle = computed(() => {
  if (prereq.value.text) return prereq.value.text
  const parts = []
  const stats = Array.isArray(prereq.value.min_stats) ? prereq.value.min_stats : []
  if (stats.length) {
    const glue = prereq.value.min_stats_mode === 'any' ? ' или ' : ' и '
    parts.push(stats.map((row) => `${STAT_FULL[SUGGEST16_TO_STAT[Number(row.ability)]] || 'Характеристика'} ${row.value}+`).join(glue))
  }
  if (prereq.value.spellcasting) parts.push('Заклинательство')
  if (prereq.value.armor_prof?.length) parts.push('Владение доспехами')
  if (prereq.value.min_level) parts.push(`${prereq.value.min_level} уровень`)
  return parts.join(' · ')
})
</script>

<style scoped>
.fli-sigil { display: grid; place-items: center; width: 23px; height: 23px; flex-shrink: 0; border: 1px solid color-mix(in srgb, var(--warning) 42%, transparent); border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--warning) 17%, transparent), transparent); color: var(--warning); font-size: 12px; }
.fli-subtitle { color: var(--text-2); }
.fli-subtitle-muted { color: var(--text-muted); }
.fli-choice { color: var(--warning); font-size: 10px; font-weight: 800; }
.fli-repeat { color: var(--warning); font-size: 14px; }
</style>
