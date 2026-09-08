<template>
  <div class="diary-combatants">
    <div v-for="creature in displayed" :key="creature.id" class="diary-combatant">
      <JournalInlineForm v-if="active(creature)" label="Участник боя" :busy="busy" :error="error" @save="save" @cancel="$emit('cancel')">
        <DndDiaryCombatantFields v-model:value="editor.value" />
        <template #actions><RemoveButton v-if="!editor.isNew" icon="trash" label="Удалить участника" :disabled="busy" @click="$emit('save', { combatants: combatants.filter(row => row.id !== creature.id) })" /></template>
      </JournalInlineForm>
      <template v-else>
        <span class="diary-combatant-count">×{{ creature.count }}</span>
        <div class="diary-combatant-copy"><strong>{{ creature.source === 'handbook' ? creature.itemName || `Существо #${creature.itemId || '—'}` : creature.name || 'Без названия' }}</strong>
          <span class="diary-combatant-stats"><span v-if="creature.ac != null"><Shield :size="13" /> {{ creature.ac }}</span><span v-if="creature.hp != null"><Heart :size="13" /> {{ creature.hp }}</span></span>
          <p v-if="creature.desc">{{ creature.desc }}</p>
        </div>
        <JournalEditButton v-if="editable" :disabled="busy || Boolean(editor)" label="Редактировать участника" @click="$emit('edit', 'combatants', creature)" />
      </template>
    </div>
    <button v-if="editable && !editor" class="diary-inline-add" type="button" :disabled="busy" @click="$emit('edit', 'combatants', defaultCombatant(), true)"><Plus :size="15" /> Участник</button>
    <p v-if="!displayed.length && !editable" class="diary-empty-copy">Участники пока не добавлены.</p>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { Heart, Shield, Plus } from '@lucide/vue'
import JournalEditButton from '@/features/journals/components/JournalEditButton.vue'
import { RemoveButton } from '@sylvieshare/share-ui'
import JournalInlineForm from '@/features/journals/components/JournalInlineForm.vue'
import DndDiaryCombatantFields from './DndDiaryCombatantFields.vue'
import { defaultCombatant } from '../lib/diaryEntry'
const props = defineProps({ combatants: { type: Array, default: () => [] }, editable: Boolean, busy: Boolean, editor: Object, error: String })
const emit = defineEmits(['edit', 'save', 'cancel'])
const displayed = computed(() => props.editor?.kind === 'combatants' && props.editor.isNew ? [...props.combatants, props.editor.value] : props.combatants)
const active = row => props.editor?.kind === 'combatants' && props.editor.value.id === row.id
function save() {
  const value = { ...props.editor.value }
  emit('save', { combatants: props.editor.isNew ? [...props.combatants, value] : props.combatants.map(row => row.id === value.id ? value : row) })
}
</script>
<style scoped>
.diary-combatants { display: flex; flex-direction: column; min-width: 0; }
.diary-combatant { display: flex; align-items: flex-start; gap: 18px; padding: 18px 0; border-top: 1px solid var(--border); }
.diary-combatant :deep(.journal-inline-form) { width: 100%; padding: 0; }
.diary-combatant-count { display: grid; place-items: center; flex: none; min-width: 48px; min-height: 44px; border-radius: 10px; color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, transparent); font: 700 24px var(--font-display); }
.diary-combatant-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 8px; }
.diary-combatant-copy strong { color: var(--text-1); font-size: 15px; overflow-wrap: anywhere; }
.diary-combatant-stats, .diary-combatant-stats > span { display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 12px; }
.diary-combatant-stats { gap: 14px; }
.diary-combatant-copy p { margin: 0; color: var(--text-2); font-size: 13px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
