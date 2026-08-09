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
      <div v-else-if="open && query.trim()" class="mss-empty">
        <template v-if="canCreate">
          <span>Ничего не найдено</span>
          <button class="mss-create" :disabled="creating" @mousedown.prevent="create">
            {{ creating ? 'Добавляем…' : `Добавить «${query.trim()}»` }}
          </button>
        </template>
        <span v-else>Ничего не найдено</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchPost } from '@/shared/api/http'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  options: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  limit: { type: Number, default: 0 },
  placeholder: { type: String, default: 'Поиск…' },
  suggestTypeId: { type: [Number, String], default: null },
  allowCreate: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle'])

const root = ref(null)
const input = ref(null)
const query = ref('')
const open = ref(false)
const creating = ref(false)

const selectedSet = computed(() => new Set(props.selected.map((v) => String(v))))
const selectedItems = computed(() => props.selected
  .map((id) => props.options.find((o) => String(o.id) === String(id)))
  .filter(Boolean))
const atLimit = computed(() => props.limit > 0 && props.selected.length >= props.limit)
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.options.filter((o) => !selectedSet.value.has(String(o.id)) && (!q || String(o.name).toLowerCase().includes(q)))
})
const canCreate = computed(() => {
  const value = query.value.trim()
  return props.allowCreate && props.suggestTypeId != null && !!value
    && !props.options.some((o) => String(o.name).trim().toLocaleLowerCase() === value.toLocaleLowerCase())
})

function pick(id) {
  emit('toggle', id)
  query.value = ''
  input.value?.focus()
}
function pickTop() { if (filtered.value.length) pick(filtered.value[0].id) }
function close() { open.value = false; query.value = '' }
function onDocPointer(e) { if (root.value && !root.value.contains(e.target)) close() }

async function create() {
  if (!canCreate.value || creating.value) return
  creating.value = true
  try {
    const item = await fetchPost('/suggest/' + props.suggestTypeId, { value: query.value.trim() })
    if (!item?.id) return
    useSuggestStore().addItem(props.suggestTypeId, item)
    emit('toggle', item.id)
    query.value = ''
    input.value?.focus()
  } finally {
    creating.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocPointer))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocPointer))
</script>

<style scoped>
.mss { display: flex; flex-direction: column; gap: 8px; }
.mss-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.mss-tag {
  display: inline-flex; align-items: center; gap: 8px;
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  border-radius: 999px; padding: 6px 8px 6px 14px;
}
.mss-tag-name { font-size: 13px; color: var(--text-1); font-weight: 500; }
.mss-x {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border: none; border-radius: 50%;
  background: color-mix(in srgb, var(--text-on-accent) 8%, transparent); color: var(--text-2); cursor: pointer;
}
.mss-x:hover { background: var(--danger); color: var(--text-on-accent); }
.mss-x svg { width: 12px; height: 12px; }

.mss-field { position: relative; max-width: 320px; }
.mss-input {
  width: 100%; box-sizing: border-box;
  background: var(--surface-raised); border: 1px solid var(--border-strong); border-radius: 9px;
  color: var(--text-1); font: inherit; font-size: 13px; padding: 8px 12px; outline: none;
}
.mss-input:focus { border-color: var(--accent); }
.mss-drop {
  position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; right: 0;
  max-height: 240px; overflow-y: auto;
  background: var(--surface); border: 1px solid var(--border); border-radius: 9px;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--scrim) 73%, transparent); padding: 4px;
}
.mss-opt {
  display: block; width: 100%; text-align: left;
  background: none; border: none; border-radius: 6px;
  color: var(--text-1); font: inherit; font-size: 13px; padding: 8px 10px; cursor: pointer;
}
.mss-opt:hover { background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }
.mss-empty {
  position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; right: 0;
  background: var(--surface); border: 1px solid var(--border); border-radius: 9px;
  color: var(--text-muted); font-size: 12px; padding: 10px 12px;
  display: flex; flex-direction: column; align-items: flex-start; gap: 7px;
}
.mss-create {
  border: 0; border-radius: 6px; background: color-mix(in srgb, var(--accent) 16%, var(--surface));
  color: var(--accent); font: inherit; font-size: 12px; font-weight: 600; padding: 6px 9px; cursor: pointer;
}
.mss-create:hover { background: color-mix(in srgb, var(--accent) 26%, var(--surface)); }
.mss-create:disabled { cursor: wait; opacity: 0.65; }
</style>
