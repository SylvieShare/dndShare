<template>
  <div ref="element" class="dnd-stats" :class="{ 'dnd-stats--adaptive': format !== 'desktop' }" data-sheet-section="stats">
    <CharacterBlock v-for="id in orderedAbilities" :key="id" :block-id="id"
      :options="format === 'desktop' ? {} : { variant: 'mobile' }" />
  </div>
</template>
<script setup>
import CharacterBlock from '../CharacterBlock.vue'
import { computed, inject, onMounted, onBeforeUnmount, ref } from 'vue'
import { characterSheetContext } from '../../lib/sheetContext'
import { statColumnOrder, statTileWeights } from '../../lib/statColumnOrder'
import { layoutTokens } from '@/app/design-tokens'
const props = defineProps({ format: { type: String, default: 'desktop' } })
const abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const context = inject(characterSheetContext)
const element = ref(null), width = ref(0)
const orderedAbilities = computed(() => {
  if (props.format === 'desktop') return abilities
  const columns = Math.max(1, Math.min(3, Math.floor((width.value + 12) / (layoutTokens['sheet-stat-min'] + 12))))
  return statColumnOrder(statTileWeights(context.definition.value, context.values.value), columns).map(index => abilities[index])
})
let observer
onMounted(() => {
  width.value = element.value.clientWidth
  observer = new ResizeObserver(() => { width.value = element.value?.clientWidth || 0 })
  observer.observe(element.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<style scoped>
.dnd-stats { columns: 1; column-gap: 12px; }
.dnd-stats :deep(> *) { break-inside: avoid; margin-bottom: 12px; }
.dnd-stats--adaptive { column-width: var(--layout-sheet-stat-min); column-count: 3; }
</style>
