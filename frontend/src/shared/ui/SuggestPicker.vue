<template>
  <div class="suggest-picker" ref="root" :class="{ 'sp-readonly': readonly }">
    <button
      v-if="!open"
      class="sp-trigger"
      :class="{ 'sp-empty': !label, 'sp-invalid': invalid }"
      type="button"
      :disabled="readonly"
      @click="openPicker"
    >
      <img v-if="selectedIconUrl" class="sp-icon" :src="selectedIconUrl" alt="" aria-hidden="true" />
      <span class="sp-label">{{ label || placeholder }}</span>
    </button>

    <template v-else>
      <input
        ref="input"
        class="sp-input"
        :class="{ 'sp-invalid': invalid }"
        :value="query"
        :placeholder="inputPlaceholder"
        spellcheck="false"
        @input="query = $event.target.value"
        @keydown.enter.prevent="confirmTop"
        @keydown.escape="close"
      />
      <SuggestDropdown
        :items="dropdownItems"
        :query="query"
        :type-id="resolvedTypeId"
        :exclude="filteredExclude"
        :can-add-new="!!suggestTypeId"
        @pick-item="pickItem"
        @added="item => suggestStore.addItem(resolvedTypeId, item)"
        @deleted="id => suggestStore.removeItem(resolvedTypeId, id)"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import SuggestDropdown from '@/shared/ui/SuggestDropdown'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  suggestTypeId: { type: [Number, String], default: null },
  items: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Поиск...' },
  valueKey: { type: String, default: 'value' },
  exclude: { type: Array, default: () => [] },
  filterPicked: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'pick'])

const suggestStore = useSuggestStore()
const root = ref(null)
const input = ref(null)
const open = ref(false)
const query = ref('')
let _onDown = null

const resolvedTypeId = computed(() => props.suggestTypeId || '__local__')
const sourceItems = computed(() => {
  if (props.suggestTypeId) return suggestStore.items(props.suggestTypeId) || []
  return props.items
})
const dropdownItems = computed(() => sourceItems.value.map(item => ({
  ...item,
  id: item.id ?? item[props.valueKey] ?? item.value,
  value: item.value ?? item.title ?? String(item[props.valueKey] ?? ''),
  iconUrl: item.iconUrl || item.icon_url || item.svg || item.icon || '',
})))
const selectedItem = computed(() => {
  const current = String(props.modelValue ?? '')
  return dropdownItems.value.find(item => String(item[props.valueKey] ?? item.value) === current) || null
})
const label = computed(() => selectedItem.value?.value || String(props.modelValue || ''))
const inputPlaceholder = computed(() => label.value || props.placeholder)
const selectedIconUrl = computed(() => selectedItem.value?.iconUrl || '')
const filteredExclude = computed(() => props.filterPicked ? props.exclude : [])
const firstFiltered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const available = filteredExclude.value.length
    ? dropdownItems.value.filter(item => !filteredExclude.value.includes(item.value))
    : dropdownItems.value
  if (!q) return available[0] || null
  return available.find(item => item.value.toLowerCase().includes(q)) || null
})

watch(() => props.suggestTypeId, (typeId) => {
  if (typeId) suggestStore.ensure(typeId)
}, { immediate: true })

watch(open, (v) => {
  if (v) query.value = ''
})

onMounted(() => {
  _onDown = e => {
    if (!root.value?.contains(e.target)) close()
  }
  document.addEventListener('mousedown', _onDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', _onDown)
})

function openPicker() {
  if (props.readonly) return
  open.value = true
  nextTick(() => input.value?.focus())
}

function close() {
  open.value = false
  query.value = ''
}

function confirmTop() {
  if (firstFiltered.value) pickItem(firstFiltered.value)
}

function pickItem(item) {
  const next = item[props.valueKey] ?? item.value
  emit('update:modelValue', next)
  emit('pick', item)
  close()
}
</script>

<style scoped>
.suggest-picker {
  position: relative;
  display: inline-flex;
  min-width: 120px;
}

.sp-trigger,
.sp-input {
  width: 100%;
  min-height: 28px;
  background: var(--input-bg);
  border: 1px dashed var(--border-strong);
  border-radius: 7px;
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  padding: 0 9px;
  outline: none;
}

.sp-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.sp-trigger:hover:not(:disabled) {
  border-color: var(--text-muted);
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.04);
}

.sp-trigger:disabled {
  cursor: default;
  background: transparent;
  border-color: transparent;
  padding-left: 0;
}

.sp-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-icon {
  width: 18px;
  height: 18px;
  display: block;
  flex-shrink: 0;
  object-fit: contain;
}

.sp-empty {
  color: var(--text-muted);
}

.sp-input:focus {
  border-color: var(--accent);
}

.sp-invalid {
  border-color: rgba(220, 80, 80, 0.5);
  box-shadow: 0 0 8px rgba(220, 80, 80, 0.14);
}

.sp-readonly {
  min-width: 0;
}
</style>
