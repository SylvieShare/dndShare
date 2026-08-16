<template>
  <SessionLibraryWorkspace variant="quests">
    <aside class="session-world-sidebar">
      <div class="session-world-sidebar-head"><div><span class="session-world-eyebrow">ЖУРНАЛ МАСТЕРА</span><strong>Задания</strong></div><button v-if="isDm" type="button" class="session-world-add" title="Новое задание" @click="openCreate"><Plus :size="16" /></button></div>
      <label class="session-world-search"><Search :size="14" /><input v-model="query" type="search" placeholder="Найти задание…" /><span v-if="quests.length">{{ filtered.length }}</span></label>
      <div v-if="filtered.length" class="quest-list">
        <button v-for="quest in filtered" :key="quest.id" type="button" :class="{ active: quest.id === Number(selectedQuestId) }" :style="{ '--quest-color': questStatus(quest.status).color }" @click="$emit('select-quest', quest.id)"><span class="quest-list-mark"><ScrollText :size="17" /></span><span><strong>{{ quest.name }}</strong><small>{{ questStatus(quest.status).label }} · {{ quest.relations?.length || 0 }} связей</small></span></button>
      </div>
      <div v-else-if="quests.length" class="session-world-list-empty">Ничего не найдено</div>
      <div v-else class="session-world-sidebar-empty"><ListTodo :size="28" /><strong>Соберите задания</strong><span>Цели кампании можно связать с местами, персонажами и материалами.</span><button v-if="isDm" type="button" @click="openCreate">Создать первое задание</button></div>
    </aside>
    <main v-if="selected" class="session-world-detail quest-detail">
      <div class="quest-detail-head" :style="{ '--quest-color': status.color }"><span class="quest-detail-icon"><ScrollText :size="24" /></span><div><span>{{ status.label }}</span><h2>{{ selected.name }}</h2></div><button v-if="isDm" type="button" class="session-world-edit-action" @click="openEdit(selected)"><Pencil :size="15" />Редактировать</button></div>
      <div class="session-world-detail-scroll">
        <section class="session-world-section session-world-description"><div class="session-world-section-title"><span>Описание</span></div><p v-if="selected.description">{{ selected.description }}</p><button v-else-if="isDm" type="button" class="session-world-inline-empty" @click="openEdit(selected)">Добавить цель, условия и награду</button><p v-else class="session-world-muted">Описание пока не добавлено.</p></section>
        <section class="session-world-section"><div class="session-world-section-title"><span>Связи</span><small>{{ selected.relations?.length || 0 }}</small></div><UniversalRelationList :relations="selected.relations" :items="relationItems" @open="$emit('open-entity', $event)" /></section>
      </div>
    </main>
    <main v-else class="session-world-detail session-world-detail--empty"><ListTodo :size="44" /><strong>{{ quests.length ? 'Выберите задание' : 'Здесь появится журнал заданий' }}</strong><span>Отслеживайте цели и держите связанные сущности рядом.</span></main>
    <QuestEditorModal v-if="editorOpen" :quest="editing" :relation-items="relationItems" :saving="world.saving.value" @close="close" @save="save" @delete="requestDelete" />
    <ConfirmDialog v-if="pendingDelete" title="Удалить задание?" :message="`«${pendingDelete.name}» будет удалено вместе со своими связями.`" confirm-label="Удалить" :loading="world.saving.value" @cancel="pendingDelete = null" @confirm="remove" />
  </SessionLibraryWorkspace>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ListTodo, Pencil, Plus, ScrollText, Search } from '@lucide/vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import QuestEditorModal from '@/features/sessions/components/QuestEditorModal.vue'
import SessionLibraryWorkspace from '@/features/sessions/components/SessionLibraryWorkspace.vue'
import UniversalRelationList from '@/features/sessions/components/UniversalRelationList.vue'
import { questStatus } from '@/features/sessions/lib/sessionEntityRelations'
const props = defineProps({ world: { type: Object, required: true }, selectedQuestId: { type: [Number,String], default: null }, isDm: { type: Boolean, default: false }, relationItems: { type: Array, default: () => [] } })
const emit = defineEmits(['select-quest','open-entity'])
const query = ref(''); const editorOpen = ref(false); const editing = ref(null); const pendingDelete = ref(null)
const quests = computed(() => props.world.quests.value)
const selected = computed(() => props.world.questsById.value.get(Number(props.selectedQuestId)) || null)
const status = computed(() => questStatus(selected.value?.status))
const filtered = computed(() => { const needle=query.value.trim().toLocaleLowerCase('ru'); return quests.value.filter(item => !needle || `${item.name} ${item.description||''}`.toLocaleLowerCase('ru').includes(needle)) })
function openCreate(){ editing.value=null; editorOpen.value=true } function openEdit(item){ editing.value=item; editorOpen.value=true } function close(){ editorOpen.value=false; editing.value=null }
async function save(payload){ const previous=editing.value; try { const id=await props.world.saveQuest(previous,payload); close(); emit('select-quest',id||previous?.id) } catch {} }
function requestDelete(item){ editorOpen.value=false; pendingDelete.value=item }
async function remove(){ const item=pendingDelete.value; if(!item)return; try{await props.world.removeQuest(item.id);pendingDelete.value=null;emit('select-quest',quests.value[0]?.id||null)}catch{} }
</script>
<style scoped>
.quest-list { min-height:0; flex:1; overflow:auto; display:flex; flex-direction:column; gap:4px; }.quest-list button { display:grid; grid-template-columns:40px minmax(0,1fr); align-items:center; gap:9px; padding:7px; border:0; border-radius:9px; background:transparent; color:var(--text-2); cursor:pointer; text-align:left; }.quest-list button:hover,.quest-list button.active { background:color-mix(in srgb,var(--quest-color) 13%,transparent); }.quest-list-mark { width:40px;height:40px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--quest-color) 45%,var(--border));border-radius:9px;background:color-mix(in srgb,var(--quest-color) 12%,var(--surface));color:var(--quest-color);}.quest-list button>span:last-child{min-width:0;display:flex;flex-direction:column;gap:2px}.quest-list strong,.quest-list small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.quest-list strong{color:var(--text-1);font-size:12px}.quest-list small{color:var(--text-muted);font-size:9px}.quest-detail-head{display:flex;align-items:center;gap:14px;padding:26px 30px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,color-mix(in srgb,var(--quest-color) 12%,transparent),transparent 58%)}.quest-detail-icon{width:58px;height:58px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--quest-color) 48%,var(--border));border-radius:16px;background:color-mix(in srgb,var(--quest-color) 14%,var(--surface));color:var(--quest-color)}.quest-detail-head>div{min-width:0;flex:1}.quest-detail-head>div>span{color:var(--quest-color);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em}.quest-detail-head h2{margin:3px 0 0;color:var(--text-1);font-size:24px}
</style>
