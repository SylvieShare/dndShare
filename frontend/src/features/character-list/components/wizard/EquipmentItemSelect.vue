<template>
  <div ref="root" class="equipment-select" role="group" :aria-label="placeholder">
    <ItemReferenceRow
      v-if="selectedItem"
      :item="selectedItem"
      selected
      show-details
      :roomy-weapon="roomyWeapons"
      :roomy-armor="roomyArmor"
      @activate="toggle"
      @details="viewDetails"
    />
    <button v-else type="button" class="equipment-select-empty" @click="toggle">
      <Search :size="16" aria-hidden="true" />
      {{ placeholder }}
      <ChevronDown :size="16" aria-hidden="true" />
    </button>

    <div v-if="open" class="equipment-select-popover">
      <label class="equipment-select-search">
        <Search :size="14" aria-hidden="true" />
        <input ref="input" v-model="query" placeholder="Найти предмет…" @keydown.escape="close" />
      </label>
      <div class="equipment-select-options">
        <ItemReferenceRow
          v-for="item in filtered"
          :key="item.id"
          :item="item"
          :selected="String(item.id) === String(modelValue)"
          :show-chevron="false"
          show-details
          :roomy-weapon="roomyWeapons"
          :roomy-armor="roomyArmor"
          @activate="choose(item)"
          @details="viewDetails"
        />
        <span v-if="!filtered.length" class="equipment-select-none">Ничего не найдено</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown, Search } from '@lucide/vue'
import ItemReferenceRow from '@/features/items/components/ItemReferenceRow.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  modelValue: { type: [Number, String], default: '' },
  placeholder: { type: String, default: 'Выберите предмет' },
  roomyWeapons: { type: Boolean, default: false },
  roomyArmor: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'details'])
const root = ref(null)
const input = ref(null)
const open = ref(false)
const query = ref('')
const selectedItem = computed(() => props.items.find((item) => String(item.id) === String(props.modelValue)) || null)
const filtered = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('ru')
  return props.items.filter((item) => !needle || `${item.name} ${item.nameEn || ''}`.toLocaleLowerCase('ru').includes(needle))
})

function toggle() {
  open.value = !open.value
  if (open.value) nextTick(() => input.value?.focus())
}
function close() { open.value = false; query.value = '' }
function choose(item) { emit('update:modelValue', item.id); close() }
function viewDetails(item) { emit('details', item); close() }
function onDocumentPointer(event) { if (root.value && !root.value.contains(event.target)) close() }

onMounted(() => document.addEventListener('mousedown', onDocumentPointer))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentPointer))
</script>

<style scoped>
.equipment-select { position: relative; min-width: 0; }
.equipment-select-empty {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px; border: 1px dashed var(--border-strong); border-radius: var(--r-md);
  background: var(--surface); color: var(--text-2); font: inherit; font-size: 12px; cursor: pointer;
}
.equipment-select-empty:hover { border-color: var(--accent); color: var(--text-1); }
.equipment-select-popover {
  position: absolute; z-index: 40; top: calc(100% + 5px); left: 0; width: min(420px, calc(100vw - 48px));
  padding: 8px; border: 1px solid var(--border); border-radius: calc(var(--r-md) + 2px);
  background: var(--surface-raised); box-shadow: 0 14px 36px color-mix(in srgb, var(--scrim) 72%, transparent);
}
.equipment-select-search { display: flex; align-items: center; gap: 7px; margin-bottom: 7px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; color: var(--text-muted); background: var(--bg); }
.equipment-select-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text-1); font: inherit; font-size: 12px; }
.equipment-select-options { display: flex; flex-direction: column; gap: 5px; max-height: 320px; overflow-y: auto; }
.equipment-select-none { padding: 14px; color: var(--text-muted); font-size: 12px; text-align: center; }
</style>
