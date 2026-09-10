<template>
  <div v-if="rows.length" class="progression-abilities">
    <button v-for="row in rows" :key="row.item.id" type="button" class="progression-ability" :class="{ 'progression-ability--upgrade': row.upgraded }" @click="$emit('open-item', row.item)">
      <ObjectListItem :item="row.item" :type="type" :name-en="row.item.nameEn || ''" :custom="row.item.userId != null">
        <template #subtitle>
          <span class="progression-ability-details">
            <span class="progression-ability-kind"><TrendingUp v-if="row.upgraded" :size="13" aria-hidden="true" /><Plus v-else :size="13" aria-hidden="true" />{{ row.upgraded ? 'Усиление' : 'Новая способность' }}</span>
            <span v-for="change in row.changes" :key="change" class="progression-ability-change">{{ change }}</span>
          </span>
        </template>
      </ObjectListItem>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Plus, TrendingUp } from '@lucide/vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem.vue'
import { progressionFeatureRows } from '@/features/items/lib/progressionFeatureRows'

const props = defineProps({
  features: { type: Array, default: () => [] },
  improvements: { type: Array, default: () => [] },
  type: { type: Object, default: null },
})
defineEmits(['open-item'])
const rows = computed(() => progressionFeatureRows(props.features, props.improvements))
</script>

<style scoped>
.progression-abilities { display: grid; margin-top: 8px; }
.progression-ability { min-width: 0; width: 100%; padding: 6px 0; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: var(--text-1); font: inherit; text-align: left; cursor: pointer; }
.progression-ability:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); }
.progression-ability-details { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 8px; padding: 4px 0; white-space: normal; }
.progression-ability-kind { display: inline-flex; align-items: center; gap: 4px; color: var(--text-muted); font-size: 10px; }
.progression-ability--upgrade .progression-ability-kind { color: var(--accent-soft); }
.progression-ability-change { padding: 3px 7px; border-radius: 5px; background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent-soft); font-size: 11px; font-weight: 650; overflow-wrap: anywhere; }
</style>
