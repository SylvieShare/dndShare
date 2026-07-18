<template>
  <div class="input-item">
    <template v-if="charCtx.ownerMode">
      <select
        class="ii-select"
        :value="currentId"
        @change="onPick($event.target.value)"
      >
        <option value="">{{ block.content.placeholder || '—' }}</option>
        <option v-for="it in items" :key="it.id" :value="it.id">{{ it.name }}</option>
      </select>
      <select
        v-if="childId && children.length"
        class="ii-select ii-child"
        :value="currentChildId"
        @change="onPickChild($event.target.value)"
      >
        <option value="">{{ block.content.child_placeholder || '—' }}</option>
        <option v-for="it in children" :key="it.id" :value="it.id">{{ it.name }}</option>
      </select>
    </template>
    <span v-else class="ii-name">{{ display || '—' }}</span>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })

const items = ref([])
const children = ref([])
const itemType = computed(() => Number(props.block.content?.item_type))
// optional sub-item field (e.g. subrace/subclass): linked via item.parent_id
const childId = computed(() => props.block.content?.child_id || '')
const childDisplay = computed(() => props.block.content?.child_display || 'paren')

function refId(v) {
  return v && typeof v === 'object' ? (v.id ?? '') : ''
}
function refName(v) {
  if (v && typeof v === 'object') return v.name ?? ''
  return typeof v === 'string' ? v : ''
}

// value is an item reference `{ id, name }`; tolerate a legacy plain string.
const currentId = computed(() => refId(props.value))
const currentChildId = computed(() => (childId.value ? refId(props.values?.[childId.value]) : ''))
const baseName = computed(() => refName(props.value))
const childName = computed(() => (childId.value ? refName(props.values?.[childId.value]) : ''))

const display = computed(() => {
  if (childDisplay.value === 'replace') return childName.value || baseName.value
  if (baseName.value && childName.value) return `${baseName.value} (${childName.value})`
  return baseName.value || childName.value
})

async function loadBaseItems() {
  if (!itemType.value) return
  const res = await fetchGet(`/items?typeId=${itemType.value}&limit=500`)
  items.value = (res?.items || []).filter((i) => i.parentId == null)
}
async function loadChildren(parentId) {
  children.value = (childId.value && parentId)
    ? ((await fetchGet(`/items/children?parentId=${parentId}`))?.items || []).filter((i) => i.typeId === itemType.value)
    : []
}

onMounted(async () => {
  await loadBaseItems()
  await loadChildren(currentId.value || null)
})

watch(currentId, (id) => { loadChildren(id || null) })

function onPick(id) {
  const it = items.value.find((x) => String(x.id) === String(id))
  emit('update:value', props.block.id, it ? { id: it.id, name: it.name } : null)
  if (childId.value) emit('update:value', childId.value, null)
}
function onPickChild(id) {
  if (!childId.value) return
  const it = children.value.find((x) => String(x.id) === String(id))
  emit('update:value', childId.value, it ? { id: it.id, name: it.name } : null)
}
</script>

<style scoped>
.input-item { min-width: 50px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.ii-select {
  min-width: 90px;
  max-width: 260px;
  font-size: 18px;
  background: transparent;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  color: var(--text-1);
  padding: 4px 8px;
  outline: none;
}
.ii-child { font-size: 15px; }
.ii-select:focus { border-color: var(--input-focus); }
.ii-name { font-size: 18px; color: var(--text-1); }
</style>
