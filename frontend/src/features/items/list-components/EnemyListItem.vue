<template>
  <div class="enemy-item">
    <span v-if="cr != null" class="enemy-item-cr-num">{{ cr }}</span>

    <div class="enemy-item-main">
      <div class="enemy-item-name-row">
        <span class="enemy-item-name">{{ item.name }}</span>
        <span v-if="item.data?.identity?.named_npc" class="enemy-item-named">Именной</span>
      </div>
      <div class="enemy-item-sub">
        <template v-for="(part, i) in subtitle" :key="i">
          <span v-if="i > 0" class="enemy-sub-dot">·</span>
          <span class="enemy-sub-part">{{ part }}</span>
        </template>
      </div>
    </div>

    <div class="enemy-item-right">
      <span v-if="hp != null" class="enemy-item-hp">
        <svg class="enemy-hp-icon" viewBox="0 0 16 16" fill="none" width="11" height="11">
          <path d="M8 13C8 13 2.5 9.2 2.5 5.5C2.5 3.57 4.07 2 6 2C7.05 2 8 2.67 8 2.67C8 2.67 8.95 2 10 2C11.93 2 13.5 3.57 13.5 5.5C13.5 9.2 8 13 8 13Z" fill="currentColor"/>
        </svg>
        {{ hp }}
      </span>
      <svg class="enemy-item-chevron" viewBox="0 0 16 16" fill="none" width="14" height="14">
        <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const suggestStore = useSuggestStore()

function walkFields(fields, data) {
  const out = []
  for (const f of fields || []) {
    const v = data?.[f.key]
    out.push({ field: f, value: v })
    if (f.type === 'object' && v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...walkFields(f.fields, v))
    }
  }
  return out
}

function findFieldByKeyDeep(fields, key) {
  for (const f of fields || []) {
    if (f.key === key) return f
    if (f.type === 'object') {
      const nested = findFieldByKeyDeep(f.fields, key)
      if (nested) return nested
    }
  }
  return null
}

watch(
  () => [props.type, props.item?.data],
  () => {
    const fields = props.type?.fields || []
    const data = props.item?.data || {}
    const buckets = new Map()
    for (const { field, value } of walkFields(fields, data)) {
      if (field.type !== 'suggest' && field.type !== 'suggest_array') continue
      const sid = getSuggestId(field)
      if (sid == null) continue
      const arr = Array.isArray(value) ? value : [value]
      const ids = arr.filter(v => v != null && v !== '').map(Number).filter(n => Number.isFinite(n))
      if (!ids.length) continue
      const cur = buckets.get(sid) || new Set()
      ids.forEach(v => cur.add(v))
      buckets.set(sid, cur)
    }
    for (const [sid, ids] of buckets) suggestStore.ensureItems(sid, [...ids])
  },
  { immediate: true, deep: true },
)

function resolveField(key, val) {
  if (val == null || val === '') return null
  const field = findFieldByKeyDeep(props.type?.fields, key)
  if (!field) return String(val)
  if (field.type === 'suggest_array') {
    const sid = getSuggestId(field)
    const ids = Array.isArray(val) ? val : [val]
    if (sid == null) return ids.join(', ')
    return ids.map(id => suggestStore.items(sid)?.find(s => s.id === id)?.value ?? String(id)).join(', ') || null
  }
  if (field.type !== 'suggest') return String(val)
  const sid = getSuggestId(field)
  if (sid == null) return String(val)
  return suggestStore.items(sid)?.find(s => s.id === val)?.value ?? String(val)
}

const identity = computed(() => props.item.data?.identity || {})
const combat = computed(() => props.item.data?.combat || {})

const cr = computed(() => combat.value.cr)
const hp = computed(() => combat.value.hp)

const subtitle = computed(() => {
  const parts = [
    resolveField('creature_type', identity.value.creature_type),
    resolveField('size', identity.value.size),
    resolveField('alignment', identity.value.alignment),
  ]
  return parts.filter(Boolean)
})
</script>

<style scoped>
.enemy-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.enemy-item-cr-num {
  flex-shrink: 0;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: #b06070;
  line-height: 1;
  min-width: 24px;
  text-align: center;
}

.enemy-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.enemy-item-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.enemy-item-name {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.enemy-item-named {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #d8c070;
  background: rgba(216, 192, 112, 0.12);
  border: 1px solid rgba(216, 192, 112, 0.35);
  border-radius: 4px;
  padding: 1px 6px;
  line-height: 1.4;
}

.enemy-item-sub {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex-wrap: wrap;
}

.enemy-sub-dot {
  font-size: 10px;
  color: var(--text-muted);
}

.enemy-sub-part {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
}

.enemy-item-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.enemy-item-hp {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}

.enemy-hp-icon {
  color: #b05050;
  flex-shrink: 0;
}

.enemy-item-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
