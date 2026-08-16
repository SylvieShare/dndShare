<template>
  <div class="universal-relations">
    <div v-if="groups.length" class="universal-relations-groups">
      <section v-for="group in groups" :key="group.key">
        <h4>{{ group.label }}<span>{{ group.items.length }}</span></h4>
        <div v-for="entry in group.items" :key="entry.item.key" class="universal-relation-row">
          <img v-if="entry.item.image" :src="entry.item.image" alt="" />
          <span v-else class="universal-relation-avatar" :style="{ '--relation-color': entry.item.color || group.color }">{{ entry.item.title.slice(0, 1) }}</span>
          <span class="universal-relation-copy"><strong>{{ entry.item.title }}</strong><small>{{ entry.item.subtitle }}</small></span>
          <button type="button" title="Удалить связь" @click="remove(entry.relation)"><X :size="15" /></button>
          <input :value="entry.relation.note || ''" maxlength="500" placeholder="Заметка к связи…" @input="updateNote(entry.relation, $event.target.value)" />
        </div>
      </section>
    </div>
    <p v-else>Связей пока нет</p>
    <button type="button" class="universal-relations-add" @click="pickerOpen = true"><Plus :size="15" />Добавить связь</button>
    <UniversalRelationPickerModal v-if="pickerOpen" :items="availableItems" :excluded="excluded" @close="pickerOpen = false" @select="add" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Plus, X } from '@lucide/vue'
import UniversalRelationPickerModal from '@/features/sessions/components/UniversalRelationPickerModal.vue'
import { groupResolvedRelations, sessionEntityKey } from '@/features/sessions/lib/sessionEntityRelations'
const props = defineProps({ modelValue: { type: Array, default: () => [] }, items: { type: Array, default: () => [] }, sourceType: { type: String, required: true }, sourceId: { type: [Number, String], default: null } })
const emit = defineEmits(['update:modelValue'])
const pickerOpen = ref(false)
const sourceKey = computed(() => props.sourceId ? sessionEntityKey(props.sourceType, props.sourceId) : '')
const availableItems = computed(() => props.items.filter(item => item.key !== sourceKey.value))
const excluded = computed(() => props.modelValue)
const groups = computed(() => groupResolvedRelations(props.modelValue, props.items))
function add(item) { emit('update:modelValue', [...props.modelValue, { type: item.type, id: Number(item.id), note: null }]); pickerOpen.value = false }
function remove(relation) { emit('update:modelValue', props.modelValue.filter(item => sessionEntityKey(item.type, item.id) !== sessionEntityKey(relation.type, relation.id))) }
function updateNote(relation, value) { emit('update:modelValue', props.modelValue.map(item => sessionEntityKey(item.type, item.id) === sessionEntityKey(relation.type, relation.id) ? { ...item, note: value || null } : item)) }
</script>

<style scoped>
.universal-relations { display: flex; flex-direction: column; gap: 8px; }.universal-relations-groups { display: flex; flex-direction: column; gap: 10px; }.universal-relations section { display: flex; flex-direction: column; gap: 6px; }.universal-relations h4 { display: flex; justify-content: space-between; margin: 0 4px; color: var(--text-muted); font-size: 9px; text-transform: uppercase; letter-spacing: .08em; }.universal-relation-row { display: grid; grid-template-columns: 42px minmax(0,1fr) 32px; align-items: center; gap: 9px; padding: 8px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); }.universal-relation-row img,.universal-relation-avatar { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 8px; object-fit: cover; }.universal-relation-avatar { background: color-mix(in srgb, var(--relation-color) 18%, var(--surface)); color: var(--relation-color); font-weight: 800; }.universal-relation-copy { min-width: 0; display: flex; flex-direction: column; }.universal-relation-copy strong,.universal-relation-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.universal-relation-copy strong { color: var(--text-1); font-size: 12px; }.universal-relation-copy small { color: var(--text-muted); font-size: 10px; }.universal-relation-row button { width: 30px; height: 30px; display: grid; place-items: center; border: 0; border-radius: 7px; background: transparent; color: var(--text-muted); cursor: pointer; }.universal-relation-row button:hover { color: var(--danger); }.universal-relation-row input { grid-column: 1/-1; height: 32px; padding: 0 9px; border: 1px solid var(--border); border-radius: 7px; outline: 0; background: var(--surface); color: var(--text-1); font: inherit; font-size: 11px; }.universal-relations > p { margin: 0; padding: 9px 10px; border: 1px dashed var(--border); border-radius: 8px; color: var(--text-muted); font-size: 11px; }.universal-relations-add { align-self: flex-start; display: flex; align-items: center; gap: 6px; padding: 7px 9px; border: 1px solid color-mix(in srgb,var(--accent) 38%,var(--border)); border-radius: 8px; background: color-mix(in srgb,var(--accent) 8%,transparent); color: var(--accent-soft); cursor: pointer; font: inherit; font-size: 11px; font-weight: 650; }
</style>
