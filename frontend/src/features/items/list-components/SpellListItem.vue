<template>
  <ObjectListItem :item="item" :name-en="item.nameEn || ''" :custom="item.userId != null" :subtitle="subtitle">
    <template #leading>
      <ObjectTypeIcon :type="type" />
      <span
        class="sli-lvl"
        :class="{ 'sli-lvl-zero': data.lvl === 0 }"
        :title="data.lvl === 0 ? 'Заговор' : null"
      >
        {{ data.lvl === 0 ? 'З' : (data.lvl != null ? data.lvl : '—') }}
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
import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import ObjectTypeIcon from '@/features/items/list-components/ObjectTypeIcon'
import { findField, getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const suggestStore = useSuggestStore()

function suggestItems(fieldKey) {
  const sid = getSuggestId(findField(props.type?.fields, fieldKey))
  return sid != null ? suggestStore.items(sid) : []
}

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
  color: var(--color-attack);
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
  background: rgba(162,146,255,0.15);
  color: var(--color-attack);
}

.sli-ritual {
  background: rgba(90,175,114,0.13);
  color: #5aaf72;
}
</style>
