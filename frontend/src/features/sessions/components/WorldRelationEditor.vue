<template>
  <div class="relation-editor">
    <div v-if="resolvedLinks.length" class="relation-editor-list">
      <div v-for="entry in resolvedLinks" :key="entry.link[linkKey]" class="relation-editor-row">
        <img v-if="entry.item.image" :src="entry.item.image" alt="" />
        <span v-else class="relation-editor-avatar" :style="{ '--relation-color': entry.item.color || '#7c5cff' }">
          {{ entry.item.initial || entry.item.title?.slice(0, 1) }}
        </span>
        <span class="relation-editor-copy"><strong>{{ entry.item.title }}</strong><small>{{ entry.item.subtitle }}</small></span>
        <button type="button" class="relation-editor-remove" title="Удалить связь" aria-label="Удалить связь" @click="remove(entry.link[linkKey])">
          <X :size="15" />
        </button>
        <input
          v-if="showNotes"
          :value="entry.link.note || ''"
          type="text"
          maxlength="500"
          class="relation-editor-note"
          placeholder="Заметка к связи…"
          @input="updateNote(entry.link[linkKey], $event.target.value)"
        />
      </div>
    </div>
    <p v-else class="relation-editor-empty">{{ emptyText }}</p>
    <button type="button" class="relation-editor-add" @click="pickerOpen = true"><Plus :size="15" />{{ addLabel }}</button>
    <WorldRelationPickerModal
      v-if="pickerOpen"
      :title="pickerTitle"
      :items="items"
      :excluded-ids="modelValue.map(link => link[linkKey])"
      :placeholder="searchPlaceholder"
      :empty-text="pickerEmptyText"
      @close="pickerOpen = false"
      @select="add"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Plus, X } from '@lucide/vue'
import WorldRelationPickerModal from '@/features/sessions/components/WorldRelationPickerModal.vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  items: { type: Array, default: () => [] },
  linkKey: { type: String, required: true },
  addLabel: { type: String, default: 'Добавить' },
  pickerTitle: { type: String, default: 'Добавить связь' },
  searchPlaceholder: { type: String, default: 'Найти…' },
  emptyText: { type: String, default: 'Связей пока нет' },
  pickerEmptyText: { type: String, default: 'Нет доступных вариантов' },
  showNotes: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue'])
const pickerOpen = ref(false)
const itemsById = computed(() => new Map(props.items.map(item => [Number(item.id), item])))
const resolvedLinks = computed(() => props.modelValue.map(link => ({ link, item: itemsById.value.get(Number(link[props.linkKey])) })).filter(entry => entry.item))

function add(id) {
  emit('update:modelValue', [...props.modelValue, { [props.linkKey]: Number(id), note: null }])
  pickerOpen.value = false
}
function remove(id) { emit('update:modelValue', props.modelValue.filter(link => Number(link[props.linkKey]) !== Number(id))) }
function updateNote(id, value) {
  emit('update:modelValue', props.modelValue.map(link => Number(link[props.linkKey]) === Number(id)
    ? { ...link, note: value || null }
    : link))
}
</script>

<style scoped>
.relation-editor { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.relation-editor-list { display: flex; flex-direction: column; gap: 7px; }
.relation-editor-row { display: grid; grid-template-columns: 42px minmax(0, 1fr) 32px; align-items: center; gap: 10px; padding: 8px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); }
.relation-editor-row > img, .relation-editor-avatar { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 8px; object-fit: cover; }
.relation-editor-avatar { background: color-mix(in srgb, var(--relation-color) 18%, var(--surface)); color: var(--relation-color); font-size: 15px; font-weight: 800; }
.relation-editor-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }.relation-editor-copy strong, .relation-editor-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.relation-editor-copy strong { color: var(--text-1); font-size: 13px; }.relation-editor-copy small { color: var(--text-muted); font-size: 10px; }
.relation-editor-remove { width: 30px; height: 30px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 7px; background: transparent; color: var(--text-muted); cursor: pointer; }.relation-editor-remove:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }
.relation-editor-note { grid-column: 1 / -1; min-width: 0; height: 32px; padding: 0 9px; border: 1px solid var(--border); border-radius: 7px; outline: 0; background: var(--surface); color: var(--text-1); font: inherit; font-size: 11px; }.relation-editor-note:focus { border-color: var(--accent); }
.relation-editor-empty { margin: 0; padding: 9px 10px; border: 1px dashed var(--border); border-radius: 8px; color: var(--text-muted); font-size: 11px; }
.relation-editor-add { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border)); border-radius: 8px; background: color-mix(in srgb, var(--accent) 8%, transparent); color: var(--accent-soft); cursor: pointer; font: inherit; font-size: 11px; font-weight: 650; }
.relation-editor-add:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
</style>
