<template>
  <div class="sli">
    <SvgIcon
      v-if="type && type.svg"
      class="sli-icon"
      :svg="type.svg"
      :color="type.color"
    />
    <span v-else class="sli-icon-placeholder" aria-hidden="true"></span>

    <span
      class="sli-lvl"
      :class="{ 'sli-lvl-zero': data.lvl === 0 }"
      :title="data.lvl === 0 ? 'Заговор' : null"
    >
      {{ data.lvl === 0 ? 'З' : (data.lvl != null ? data.lvl : '—') }}
    </span>

    <div class="sli-main">
      <div class="sli-name-row">
        <span class="sli-name">{{ item.name }}</span>
        <span v-if="item.nameEn" class="sli-name-en">{{ nameEnFormatted }}</span>
        <span v-if="item.userId != null" class="sli-custom" title="Ваш объект">✦</span>
      </div>
      <div v-if="subtitle" class="sli-sub">{{ subtitle }}</div>
    </div>

    <div class="sli-right">
      <span v-if="data.concentration" class="sli-badge sli-conc" title="Концентрация">К</span>
      <span v-if="data.ritual" class="sli-badge sli-ritual" title="Ритуал">Р</span>
      <svg class="sli-chevron" viewBox="0 0 16 16" fill="none" width="14" height="14">
        <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SvgIcon from '@/shared/ui/SvgIcon'
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

const nameEnFormatted = computed(() =>
  (props.item.nameEn || '')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, ch => ch.toUpperCase())
)
</script>

<style scoped>
.sli {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.sli-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
}

.sli-icon-placeholder {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--border);
}

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

.sli-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sli-name-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.sli-name {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.sli-name-en {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
}

.sli-custom {
  color: var(--accent);
  font-size: 8px;
  flex-shrink: 0;
}

.sli-sub {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sli-right {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

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

.sli-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
