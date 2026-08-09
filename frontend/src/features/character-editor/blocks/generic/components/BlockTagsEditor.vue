<template>
  <EditorPanel compact>
    <EditorSection v-for="sec in sections" :key="sec.title" :title="sec.title">
      <template v-if="sec.custom" #actions>
        <RemoveButton label="Удалить раздел" @click="$emit('remove-section', sec.title)" />
      </template>
      <div class="bte-body">
        <span v-for="(tag, i) in sec.tags" :key="i" class="sheet-tag-chip">
          {{ tag }}
          <button class="sheet-tag-remove" @click="$emit('remove-tag', sec.title, i)">×</button>
        </span>
        <SuggestAdd
          :suggest-type-id="sec.suggest_id"
          :exclude="sec.tags"
          filter-picked
          @pick="val => $emit('add-tag', sec.title, val)"
        />
      </div>
    </EditorSection>

    <div v-if="customTags" class="bte-add-section">
      <AddButton v-if="!adding" @click="startAdding">Раздел</AddButton>
      <form v-else class="bte-add-row" @submit.prevent="confirmSection">
        <input
          ref="sectionInput"
          v-model="newTitle"
          class="bte-section-input"
          :class="{ 'bte-section-input--error': titleExists }"
          placeholder="Название раздела…"
          @keydown.escape.stop="adding = false"
          @blur="onBlur"
        />
        <button class="bte-section-ok" type="submit" :disabled="!newTitle.trim() || titleExists">ОК</button>
      </form>
    </div>
  </EditorPanel>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import AddButton from '@/shared/ui/AddButton'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import EditorSection from '@/features/character-editor/components/EditorSection'
import RemoveButton from '@/shared/ui/RemoveButton'
import SuggestAdd from '@/shared/ui/SuggestAdd'

const props = defineProps({
  sections: { type: Array, default: () => [] },
  customTags: { type: Boolean, default: false },
})
const emit = defineEmits(['add-tag', 'remove-tag', 'add-section', 'remove-section'])

const adding = ref(false)
const newTitle = ref('')
const sectionInput = ref(null)

const titles = computed(() => new Set(props.sections.map(s => s.title)))
const titleExists = computed(() => {
  const t = newTitle.value.trim()
  return t.length > 0 && titles.value.has(t)
})

function startAdding() {
  adding.value = true
  newTitle.value = ''
  nextTick(() => sectionInput.value?.focus())
}

function confirmSection() {
  const title = newTitle.value.trim()
  if (!title || titles.value.has(title)) return
  emit('add-section', title)
  adding.value = false
  newTitle.value = ''
}

function onBlur() {
  setTimeout(() => { adding.value = false }, 150)
}
</script>

<style scoped>
.bte-body {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 7px;
  align-items: center;
}

.bte-add-section {
  margin-top: 2px;
}

.bte-add-row {
  display: flex;
  gap: 6px;
  align-items: stretch;
}

.bte-section-input {
  flex: 1;
  min-width: 0;
  background: var(--control-bg, var(--bg));
  border: 1px solid var(--input-border);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  padding: 7px 10px;
  outline: none;
  transition: border-color 0.12s;
}
.bte-section-input::placeholder { color: var(--text-muted); }
.bte-section-input:focus { border-color: var(--input-focus); }
.bte-section-input--error { border-color: var(--danger); }

.bte-section-ok {
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 0 14px;
  cursor: pointer;
  transition: background 0.12s, opacity 0.12s;
}
.bte-section-ok:hover { background: color-mix(in srgb, var(--accent) 30%, var(--surface-2)); }
.bte-section-ok:disabled { opacity: 0.4; cursor: default; }
</style>
