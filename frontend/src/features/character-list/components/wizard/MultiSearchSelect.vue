<template>
  <div ref="root" class="mss">
    <div v-if="selectedItems.length" class="mss-tags">
      <span v-for="it in selectedItems" :key="it.id" class="mss-tag">
        <span class="mss-tag-name">{{ it.name }}</span>
        <button class="mss-x" title="Убрать" @click="emit('toggle', it.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </span>
    </div>

    <div v-if="!atLimit" class="mss-field">
      <input
        ref="input"
        v-model="query"
        class="mss-input"
        :placeholder="placeholder"
        spellcheck="false"
        @focus="open = true"
        @keydown.enter.prevent="pickTop"
        @keydown.escape="close"
      />
      <div v-if="open && filtered.length" class="mss-drop">
        <button
          v-for="o in filtered"
          :key="o.id"
          class="mss-opt"
          @mousedown.prevent="pick(o.id)"
        >{{ o.name }}</button>
      </div>
      <div v-else-if="open && query.trim()" class="mss-empty">Ничего не найдено</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  options: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  limit: { type: Number, default: 0 },
  placeholder: { type: String, default: 'Поиск…' },
})
const emit = defineEmits(['toggle'])

const root = ref(null)
const input = ref(null)
const query = ref('')
const open = ref(false)

const selectedSet = computed(() => new Set(props.selected.map((v) => String(v))))
const selectedItems = computed(() => props.selected
  .map((id) => props.options.find((o) => String(o.id) === String(id)))
  .filter(Boolean))
const atLimit = computed(() => props.limit > 0 && props.selected.length >= props.limit)
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.options.filter((o) => !selectedSet.value.has(String(o.id)) && (!q || String(o.name).toLowerCase().includes(q)))
})

function pick(id) {
  emit('toggle', id)
  query.value = ''
  input.value?.focus()
}
function pickTop() { if (filtered.value.length) pick(filtered.value[0].id) }
function close() { open.value = false }
function onDocPointer(e) { if (root.value && !root.value.contains(e.target)) open.value = false }

onMounted(() => document.addEventListener('mousedown', onDocPointer))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocPointer))
</script>

<style scoped>
.mss { display: flex; flex-direction: column; gap: 8px; }
.mss-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.mss-tag {
  display: inline-flex; align-items: center; gap: 8px;
  background: color-mix(in srgb, var(--accent) 14%, var(--block-bg));
  border-radius: 999px; padding: 6px 8px 6px 14px;
}
.mss-tag-name { font-size: 13px; color: var(--text-1); font-weight: 500; }
.mss-x {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border: none; border-radius: 50%;
  background: color-mix(in srgb, #fff 8%, transparent); color: var(--text-2); cursor: pointer;
}
.mss-x:hover { background: var(--danger); color: #fff; }
.mss-x svg { width: 12px; height: 12px; }

.mss-field { position: relative; max-width: 320px; }
.mss-input {
  width: 100%; box-sizing: border-box;
  background: var(--bg); border: 1px solid var(--input-border); border-radius: 9px;
  color: var(--text-1); font: inherit; font-size: 13px; padding: 8px 12px; outline: none;
}
.mss-input:focus { border-color: var(--input-focus); }
.mss-drop {
  position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; right: 0;
  max-height: 240px; overflow-y: auto;
  background: var(--block-bg); border: 1px solid var(--border); border-radius: 9px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45); padding: 4px;
}
.mss-opt {
  display: block; width: 100%; text-align: left;
  background: none; border: none; border-radius: 6px;
  color: var(--text-1); font: inherit; font-size: 13px; padding: 8px 10px; cursor: pointer;
}
.mss-opt:hover { background: color-mix(in srgb, var(--accent) 16%, var(--block-bg)); }
.mss-empty {
  position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; right: 0;
  background: var(--block-bg); border: 1px solid var(--border); border-radius: 9px;
  color: var(--text-muted); font-size: 12px; padding: 10px 12px;
}
</style>
