<template>
  <ObjectListItem :item="item" :name-en="item.nameEn || ''" :custom="item.userId != null" :subtitle="subtitle">
    <template #leading>
      <ItemIcon class="sli-type-icon" :item="item" :type="type" />
      <span
        class="sli-lvl"
        :class="{ 'sli-lvl-zero': data.lvl === 0 }"
        :title="data.lvl === 0 ? 'Заговор' : null"
      >
        {{ data.lvl === 0 ? '—' : (data.lvl != null ? data.lvl : '—') }}
      </span>
    </template>
    <template #trailing>
      <span v-if="data.concentration" class="sli-badge sli-conc" title="Концентрация">К</span>
      <span v-if="data.ritual" class="sli-badge sli-ritual" title="Ритуал">Р</span>
    </template>
  </ObjectListItem>
</template>

<script setup>
import { computed } from 'vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import { useSchemaSuggests } from '@/features/handbook/objects/lib/useSchemaSuggests'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const { suggestItems } = useSchemaSuggests(() => props.type)

const schoolMap = computed(() => Object.fromEntries(suggestItems('schoolId').map(s => [s.id, s.value])))

const data = computed(() => props.item.data || {})

const school = computed(() => schoolMap.value[data.value.schoolId] || '')

const subtitle = computed(() => {
  const parts = [school.value, data.value.time, data.value.range].filter(Boolean)
  return parts.join(' · ')
})
</script>

<style scoped>
.sli-lvl {
  flex-shrink: 0;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--accent-soft);
  line-height: 1;
  min-width: 20px;
  text-align: center;
}
.sli-lvl-zero { color: var(--accent); }

.sli-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 5px;
  border-radius: 4px;
}

.sli-conc {
  background: color-mix(in srgb, var(--accent-soft) 15%, transparent);
  color: var(--accent-soft);
}

.sli-ritual {
  background: color-mix(in srgb, var(--success) 13%, transparent);
  color: var(--success);
}

@media (max-width: 520px) {
  .sli-type-icon { display: none; }
}
</style>
