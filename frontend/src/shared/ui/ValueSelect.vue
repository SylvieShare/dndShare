<template>
  <div class="vs" v-click-outside="close">
    <button class="vs-button" type="button" :class="{ empty: !selectedLabel }" @click="toggle">
      <span>{{ selectedLabel || placeholder }}</span>
      <span class="vs-arrow">▾</span>
    </button>
    <div v-if="open" class="vs-drop">
      <input
        v-if="showSearch"
        ref="search"
        class="vs-search"
        v-model="query"
        :placeholder="searchPlaceholder"
        @keydown.escape.stop="close"
      />
      <button
        v-for="option in filteredOptions"
        :key="option.value"
        class="vs-option"
        type="button"
        @mousedown.prevent="pick(option.value)"
      >
        {{ option.label }}
      </button>
      <div v-if="filteredOptions.length === 0" class="vs-empty">Ничего не найдено</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

const props = defineProps({
  modelValue: { default: null },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Выберите' },
  searchable: { type: Boolean, default: false },
  searchPlaceholder: { type: String, default: 'Поиск...' },
})
const emit = defineEmits(['update:modelValue'])

const search = ref(null)
const open = ref(false)
const query = ref('')

const normalizedOptions = computed(() => props.options.map(option => {
  if (option && typeof option === 'object') {
    return {
      value: option.value,
      label: option.label ?? option.value,
    }
  }
  return { value: option, label: option }
}))
const selectedLabel = computed(() => {
  const selected = normalizedOptions.value.find(option => String(option.value) === String(props.modelValue))
  return selected?.label || ''
})
const filteredOptions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return normalizedOptions.value
  return normalizedOptions.value.filter(option => String(option.label).toLowerCase().includes(q))
})
const showSearch = computed(() => props.searchable && normalizedOptions.value.length >= 10)

function toggle() {
  open.value = !open.value
  if (open.value && showSearch.value) nextTick(() => search.value?.focus())
}

function close() {
  open.value = false
  query.value = ''
}

function pick(value) {
  emit('update:modelValue', value)
  close()
}
</script>

<style scoped>
.vs {
  position: relative;
  min-width: 0;
}

.vs-button {
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--control-bg, var(--bg));
  border: 1px solid var(--input-border);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  padding: 0 10px;
  cursor: pointer;
  min-width: 0;
  transition: border-color 0.15s;
}

.vs-button:focus-visible { border-color: var(--input-focus); outline: none; }

.vs-button.empty {
  color: var(--text-muted);
}

.vs-button span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vs-arrow {
  color: var(--text-muted);
  font-size: 10px;
  flex-shrink: 0;
}

.vs-drop {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  min-width: 180px;
  max-height: 220px;
  overflow-y: auto;
  padding: 5px;
  background: var(--popup-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-lg);
  z-index: 250;
}

.vs-search {
  width: 100%;
  box-sizing: border-box;
  height: 34px;
  margin-bottom: 4px;
  background: var(--control-bg, var(--bg));
  border: 1px solid var(--input-border);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  outline: none;
  padding: 0 10px;
}

.vs-option {
  width: 100%;
  display: block;
  border: none;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  text-align: left;
  padding: 7px 8px;
  border-radius: var(--r-sm);
  cursor: pointer;
}

.vs-option:hover {
  color: var(--text-1);
  background: var(--surface-1);
}

.vs-empty {
  padding: 8px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}
</style>
