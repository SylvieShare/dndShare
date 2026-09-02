<template>
  <SessionLibraryWorkspace variant="quests">
    <aside class="session-world-sidebar">
      <div class="session-world-sidebar-head"><div><span class="session-world-eyebrow">ЖУРНАЛ МАСТЕРА</span><strong>Задания</strong></div><button v-if="isDm" type="button" class="session-world-add" title="Новое задание" @click="openCreate"><Plus :size="16" /></button></div>
      <label class="session-world-search"><Search :size="14" /><input v-model="query" type="search" placeholder="Найти задание…" /><kbd v-if="showShortcutHints" class="session-world-list-navigation-hint">↑ ↓</kbd><span v-if="quests.length">{{ filtered.length }}</span></label>
      <div v-if="filtered.length" ref="listElement" class="quest-list">
        <button v-for="quest in filtered" :key="quest.id" type="button" :data-session-list-id="quest.id" :class="{ active: quest.id === Number(selectedQuestId) }" :style="{ '--quest-color': questStatus(quest.status).color }" @click="$emit('select-quest', quest.id)"><span class="quest-list-mark"><ScrollText :size="17" /></span><span><strong>{{ quest.name }}</strong><small>{{ questStatus(quest.status).label }} · {{ quest.relations?.length || 0 }} связей</small></span></button>
      </div>
      <div v-else-if="quests.length" class="session-world-list-empty">Ничего не найдено</div>
      <div v-else class="session-world-sidebar-empty"><ListTodo :size="28" /><strong>Соберите задания</strong><span>Цели кампании можно связать с местами, персонажами и материалами.</span><button v-if="isDm" type="button" @click="openCreate">Создать первое задание</button></div>
    </aside>
    <SessionEntityDetail
      v-if="selected"
      :title="selected.name"
      :eyebrow="status.label"
      :accent="status.color"
      :editable="isDm"
      :title-editable="isDm"
      :saving="world.saving.value"
      :back-label="backLabel"
      edit-aria-label="Редактировать задание"
      @edit="openEdit(selected)"
      @save-title="saveQuestField('name', $event)"
      @back="$emit('back')"
    >
      <template #visual><ScrollText :size="32" /></template>
      <template #meta><span>{{ selected.relations?.length || 0 }} связей</span></template>

      <section class="session-world-section">
        <div class="session-world-section-title"><span>Задание</span></div>
        <div v-if="visibleQuestFields.length" class="quest-detail-grid">
          <SessionEditableField
            v-for="field in visibleQuestFields"
            :key="field.key"
            :model-value="selected[field.key] || ''"
            :label="field.label"
            :icon="field.icon"
            :editable="isDm"
            :saving="world.saving.value"
            :rows="field.rows"
            :maxlength="5000"
            :placeholder="field.placeholder"
            :empty-text="field.emptyText"
            :wide="field.wide"
            @save="saveQuestField(field.key, $event)"
          />
        </div>
        <p v-else class="session-world-muted">Детали задания пока не добавлены.</p>
      </section>
      <section class="session-world-section"><div class="session-world-section-title"><span>Связи</span><small>{{ selected.relations?.length || 0 }}</small></div><UniversalRelationList :relations="selected.relations" :items="relationItems" @open="openRelated" /></section>
      <section class="session-world-section"><div class="session-world-section-title"><span>На холстах сценариев</span><small>{{ selected.scenarioUsages?.length || 0 }}</small></div><ScenarioUsageList :usages="selected.scenarioUsages" :scenes="world.scenes.value" @open="$emit('open-entity', { type: 'scene', id: $event })" /></section>
    </SessionEntityDetail>
    <main v-else class="session-world-detail session-world-detail--empty"><ListTodo :size="44" /><strong>{{ quests.length ? 'Выберите задание' : 'Здесь появится журнал заданий' }}</strong><span>Отслеживайте цели и держите связанные сущности рядом.</span></main>
    <QuestEditorModal v-if="editorOpen" :quest="editing" :relation-items="relationItems" :saving="world.saving.value" @close="close" @save="save" @delete="requestDelete" />
    <ConfirmDialog v-if="pendingDelete" title="Удалить задание?" :message="`«${pendingDelete.name}» будет удалено вместе со своими связями.`" confirm-label="Удалить" :loading="world.saving.value" @cancel="pendingDelete = null" @confirm="remove" />
  </SessionLibraryWorkspace>
</template>
<script setup>
import { computed, ref } from 'vue'
import { Gift, GitFork, KeyRound, ListTodo, NotebookPen, Plus, ScrollText, Search, Target } from '@lucide/vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import QuestEditorModal from '@/features/sessions/components/QuestEditorModal.vue'
import SessionEntityDetail from '@/features/sessions/components/SessionEntityDetail.vue'
import SessionEditableField from '@/features/sessions/components/SessionEditableField.vue'
import SessionLibraryWorkspace from '@/features/sessions/components/SessionLibraryWorkspace.vue'
import ScenarioUsageList from '@/features/sessions/components/ScenarioUsageList.vue'
import UniversalRelationList from '@/features/sessions/components/UniversalRelationList.vue'
import { questStatus } from '@/features/sessions/lib/sessionEntityRelations'
import { adjacentSessionListItemId, scrollSessionListItemIntoView } from '@/features/sessions/lib/sessionListNavigation'
const props = defineProps({ world: { type: Object, required: true }, selectedQuestId: { type: [Number,String], default: null }, isDm: { type: Boolean, default: false }, relationItems: { type: Array, default: () => [] }, showShortcutHints: { type: Boolean, default: false }, backLabel: { type: String, default: '' } })
const emit = defineEmits(['select-quest','open-entity','back'])
const query = ref(''); const editorOpen = ref(false); const editing = ref(null); const pendingDelete = ref(null); const listElement = ref(null)
const quests = computed(() => props.world.quests.value)
const selected = computed(() => props.world.questsById.value.get(Number(props.selectedQuestId)) || null)
const status = computed(() => questStatus(selected.value?.status))
const questFields = [
  { key: 'goal', label: 'Цель', icon: Target, rows: 4, wide: true, placeholder: 'Что нужно достичь?', emptyText: 'Цель пока не сформулирована.' },
  { key: 'condition', label: 'Условие', icon: KeyRound, rows: 4, placeholder: 'Что должно произойти или быть выполнено?', emptyText: 'Условие пока не задано.' },
  { key: 'reward', label: 'Награда', icon: Gift, rows: 4, placeholder: 'Что получат герои?', emptyText: 'Награда пока не указана.' },
  { key: 'consequences', label: 'Последствия', icon: GitFork, rows: 4, placeholder: 'Что изменится после успеха или провала?', emptyText: 'Последствия пока не описаны.' },
  { key: 'notes', label: 'Заметки', icon: NotebookPen, rows: 4, placeholder: 'Скрытые детали и напоминания мастеру', emptyText: 'Заметок пока нет.' },
]
const visibleQuestFields = computed(() => props.isDm ? questFields : questFields.filter(field => selected.value?.[field.key]))
const filtered = computed(() => { const needle=query.value.trim().toLocaleLowerCase('ru'); return quests.value.filter(item => !needle || [item.name,item.goal,item.condition,item.reward,item.consequences,item.notes].filter(Boolean).join(' ').toLocaleLowerCase('ru').includes(needle)) })
function openCreate(){ editing.value=null; editorOpen.value=true } function openEdit(item){ editing.value=item; editorOpen.value=true } function close(){ editorOpen.value=false; editing.value=null }
async function save(payload){ const previous=editing.value; try { const id=await props.world.saveQuest(previous,payload); close(); emit('select-quest',id||previous?.id) } catch {} }
function questPayload(quest, patch = {}) {
  return {
    name: quest.name, status: quest.status,
    goal: quest.goal || null, condition: quest.condition || null,
    reward: quest.reward || null, consequences: quest.consequences || null,
    notes: quest.notes || null,
    relations: (quest.relations || []).map(relation => ({ ...relation })),
    ...patch,
  }
}
async function saveQuestField(field, value) {
  const quest = selected.value
  if (!quest) return
  const normalized = field === 'name' ? value.trim() : (value.trim() || null)
  if (field === 'name' && !normalized) return
  try { await props.world.saveQuest(quest, questPayload(quest, { [field]: normalized })) } catch { /* error is rendered */ }
}
function openRelated(item) { emit('open-entity', item) }
function requestDelete(item){ editorOpen.value=false; pendingDelete.value=item }
async function remove(){ const item=pendingDelete.value; if(!item)return; try{await props.world.removeQuest(item.id);pendingDelete.value=null;emit('select-quest',quests.value[0]?.id||null)}catch{} }
function moveSelection(direction){ const id=adjacentSessionListItemId(filtered.value,props.selectedQuestId,direction);if(id==null)return;if(String(id)!==String(props.selectedQuestId))emit('select-quest',id);scrollSessionListItemIntoView(listElement.value,id) }
defineExpose({ moveSelection })
</script>
<style scoped>
.quest-list { min-height:0; flex:1; overflow:auto; display:flex; flex-direction:column; gap:4px; }.quest-list button { display:grid; grid-template-columns:40px minmax(0,1fr); align-items:center; gap:9px; padding:7px; border:0; border-radius:9px; background:transparent; color:var(--text-2); cursor:pointer; text-align:left; }.quest-list button:hover,.quest-list button.active { background:color-mix(in srgb,var(--quest-color) 13%,transparent); }.quest-list-mark { width:40px;height:40px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--quest-color) 45%,var(--border));border-radius:9px;background:color-mix(in srgb,var(--quest-color) 12%,var(--surface));color:var(--quest-color);}.quest-list button>span:last-child{min-width:0;display:flex;flex-direction:column;gap:2px}.quest-list strong,.quest-list small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.quest-list strong{color:var(--text-1);font-size:12px}.quest-list small{color:var(--text-muted);font-size:9px}.quest-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media(max-width:720px){.quest-detail-grid{grid-template-columns:1fr}.quest-detail-grid :deep(.session-editable-field--wide){grid-column:auto}}
</style>
