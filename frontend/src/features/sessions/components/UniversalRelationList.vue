<template>
  <div class="entity-relations">
    <header class="entity-relations-heading">
      <strong>Связи <small>{{ relations.length }}</small></strong>
      <AddButton v-if="editable" variant="icon" label="Добавить связь" :disabled="saving" @click="pickerOpen = true" />
    </header>
    <div v-if="groups.length" class="entity-relation-list">
      <section v-for="group in groups" :key="group.key">
        <h3>{{ group.label }}<span>{{ group.items.length }}</span></h3>
        <article v-for="entry in group.items" :key="entry.item.key" class="entity-relation-card">
          <button type="button" class="entity-relation-open" :disabled="forceOpen" @click="$emit('open', entry.item)">
            <img v-if="entry.item.image" :src="entry.item.image" alt="" />
            <span v-else class="entity-relation-avatar" :style="{ '--relation-color': entry.item.color || group.color }">{{ entry.item.title.slice(0, 1) }}</span>
            <span><strong>{{ entry.item.title }}</strong><small>{{ entry.item.subtitle }}</small></span>
          </button>
          <RemoveButton v-if="editable" class="entity-relation-remove" icon="trash" :label="`Удалить связь с «${entry.item.title}»`" :disabled="saving" @click="remove(entry.relation)" />
          <SessionEditableField
            v-if="editable || entry.relation.note"
            :model-value="entry.relation.note || ''"
            label="Заметка к связи"
            :editable="editable"
            :force-open="forceOpen"
            :saving="saving"
            :multiline="false"
            :maxlength="500"
            empty-text="Без заметки"
            :persist="value => updateNote(entry.relation, value)"
            @update:model-value="updateNote(entry.relation, $event)"
          />
        </article>
      </section>
    </div>
    <p v-else class="session-world-muted">Связей пока нет.</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <UniversalRelationPickerModal v-if="pickerOpen && editable" :items="availableItems" :excluded="relations" @close="pickerOpen = false" @select="add" />
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { AddButton, RemoveButton } from '@sylvieshare/share-ui'
import SessionEditableField from './SessionEditableField.vue'
import UniversalRelationPickerModal from './UniversalRelationPickerModal.vue'
import { groupResolvedRelations, sessionEntityKey } from '@/features/sessions/lib/sessionEntityRelations'
const props = defineProps({
  relations: { type: Array, default: () => [] },
  items: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  forceOpen: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  sourceType: { type: String, default: '' },
  sourceId: { type: [Number, String], default: null },
  persist: { type: Function, default: null },
})
const emit = defineEmits(['open', 'update:relations'])
const pickerOpen = ref(false)
const error = ref('')
const availableItems = computed(() => props.items.filter(item => item.key !== sessionEntityKey(props.sourceType, props.sourceId)))
const groups = computed(() => groupResolvedRelations(props.relations, props.items))
async function change(relations) {
  if (!props.editable || props.saving) return false
  error.value = ''
  if (props.persist) return await props.persist(relations)
  emit('update:relations', relations)
  return true
}
async function add(item) {
  try {
    if (!props.relations.some(relation => sessionEntityKey(relation.type, relation.id) === item.key)) {
      if (await change([...props.relations, { type: item.type, id: Number(item.id), note: null }]) === false) return
    }
    pickerOpen.value = false
  } catch (cause) { error.value = cause.message || 'Не удалось добавить связь'; pickerOpen.value = false }
}
async function remove(relation) {
  try { await change(props.relations.filter(item => sessionEntityKey(item.type, item.id) !== sessionEntityKey(relation.type, relation.id))) }
  catch (cause) { error.value = cause.message || 'Не удалось удалить связь' }
}
function updateNote(relation, value) {
  return change(props.relations.map(item => sessionEntityKey(item.type, item.id) === sessionEntityKey(relation.type, relation.id) ? { ...item, note: value || null } : item))
}
</script>
<style scoped>
.entity-relations { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.entity-relations-heading { display: flex; align-items: center; justify-content: flex-start; gap: 8px; }
.entity-relations-heading strong { color: var(--text-1); font-size: 12px; }
.entity-relations-heading small { margin-left: 6px; color: var(--text-muted); }
.entity-relation-list { display: flex; flex-direction: column; gap: 12px; }
.entity-relation-list section { width: 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 520px)); justify-content: start; gap: 8px 10px; }
.entity-relation-list h3 { grid-column: 1 / -1; display: flex; justify-content: space-between; margin: 0; color: var(--text-muted); font-size: 9px; text-transform: uppercase; letter-spacing: .08em; }
.entity-relation-card { max-width: 520px; position: relative; min-width: 0; border: 1px solid var(--border); border-radius: 10px; background: color-mix(in srgb,var(--surface-raised) 78%,transparent); }
.entity-relation-open { width: 100%; display: grid; grid-template-columns: 48px minmax(0,1fr); align-items: center; gap: 10px; padding: 8px 35px 8px 8px; border: 0; border-radius: 10px; background: transparent; color: var(--text-2); cursor: pointer; text-align: left; }
.entity-relation-open:disabled { cursor: default; }
.entity-relation-open:hover:not(:disabled) { background: var(--surface-raised); }
.entity-relation-remove { position: absolute; top: 6px; right: 6px; }
.entity-relation-list img,.entity-relation-avatar { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 8px; object-fit: cover; }
.entity-relation-avatar { background: color-mix(in srgb,var(--relation-color) 18%,var(--surface)); color: var(--relation-color); font-size: 16px; font-weight: 800; }
.entity-relation-open > span:last-child { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.entity-relation-open strong,.entity-relation-open small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entity-relation-open strong { color: var(--text-1); font-size: 12px; }
.entity-relation-open small { color: var(--text-muted); font-size: 10px; }
.entity-relation-card :deep(.session-editable-field) { border: 0; border-top: 1px solid var(--border); border-radius: 0 0 10px 10px; padding: 8px; }
</style>
