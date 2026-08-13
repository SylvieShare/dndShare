<template>
  <ObjectListItem :item="item" name-center>
    <template v-if="item.iconImageUrl || item.svg || cr != null" #leading>
      <ItemIcon v-if="item.iconImageUrl || item.svg" :item="item" :fallback-to-type="false" />
      <span v-if="cr != null" class="enemy-item-cr-num">{{ cr }}</span>
    </template>
    <template v-if="item.data?.identity?.named_npc" #name-extras>
      <span class="enemy-item-named">Именной</span>
    </template>
    <template #subtitle>
      <span class="enemy-item-sub">
        <template v-for="(part, i) in subtitle" :key="i">
          <span v-if="i > 0" class="enemy-sub-dot">·</span>
          <span class="enemy-sub-part">{{ part }}</span>
        </template>
      </span>
    </template>
    <template v-if="hp != null" #trailing>
      <span class="enemy-item-hp">
        <svg class="enemy-hp-icon" viewBox="0 0 16 16" fill="none" width="11" height="11">
          <path d="M8 13C8 13 2.5 9.2 2.5 5.5C2.5 3.57 4.07 2 6 2C7.05 2 8 2.67 8 2.67C8 2.67 8.95 2 10 2C11.93 2 13.5 3.57 13.5 5.5C13.5 9.2 8 13 8 13Z" fill="currentColor"/>
        </svg>
        {{ hp }}
      </span>
    </template>
  </ObjectListItem>
</template>

<script setup>
import { computed, watch } from 'vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import { findField, getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
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
  const field = findField(props.type?.fields, key)
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
.enemy-item-cr-num {
  flex-shrink: 0;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--danger);
  line-height: 1;
  min-width: 24px;
  text-align: center;
}

.enemy-item-named {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-2);
  background: color-mix(in srgb, var(--text-2) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-2) 35%, transparent);
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

.enemy-item-hp {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}

.enemy-hp-icon {
  color: var(--danger);
  flex-shrink: 0;
}
</style>
