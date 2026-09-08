<template>
  <div class="journal-graph-shell">
    <div class="journal-graph-tools">
      <JournalEventTypePicker v-if="editable" :disabled="blocked" :label="selected ? 'Продолжить отсюда' : 'Добавить событие'" @create="create" />
      <JournalEventTypePicker v-if="editable && selected" :disabled="blocked" label="Отдельное событие" quiet @create="type => create(type, true)" />
      <span class="journal-graph-direction"><ArrowUp :size="13" /> История растёт вверх</span>
      <button v-if="editable" type="button" :disabled="blocked || !graph.nodes.length" @click="autoLayout"><LayoutGrid :size="16" /> {{ arranging ? 'Раскладываем…' : 'Упорядочить' }}</button>
      <button type="button" :disabled="blocked" title="Показать весь раздел" aria-label="Показать весь раздел" @click="canvas?.fitContent()"><Scan :size="17" /></button>
    </div>
    <p v-if="error" class="journal-error" role="alert">{{ error }}</p>
    <div class="journal-graph-body">
      <div class="journal-graph-stage">
        <NarrativeGraphCanvas ref="canvas" :graph-key="`journal:${journal.uuid}:${sectionId}`" :nodes="graph.nodes" :edges="graph.edges"
          from-key="fromId" to-key="toId" :node-width="300" :node-height="148" :initial-top="40"
          :can-edit="editable" :locked="blocked" :multi-select="false" :min-zoom="0.05" :linking-from="linkingFrom" :layout-key="Boolean(selected)"
          empty-title="История начинается здесь" empty-description="Добавьте событие. Продолжения могут разветвляться и сходиться снова." :show-empty-action="false"
          @node-click="select" @start-link="startLink" @finish-link="event => connect(linkingFrom.id, event.id)" @edge-click="openEdge" @rewire-edge="rewire"
          @preview-positions="preview" @save-positions="savePositions" @interaction="setInteraction">
          <template #node="{ node }"><JournalGraphNode :event="node" :selected="selectedId === node.id" :items-by-id="itemsById" /></template>
        </NarrativeGraphCanvas>
        <div class="journal-graph-zoom"><button type="button" aria-label="Уменьшить масштаб" :disabled="blocked" @click="canvas?.zoomBy(1 / 1.15)"><Minus :size="16" /></button><button type="button" aria-label="Увеличить масштаб" :disabled="blocked" @click="canvas?.zoomBy(1.15)"><Plus :size="16" /></button></div>
      </div>
      <aside v-if="selected" class="journal-event-panel" aria-label="Выбранное событие">
        <header><span>{{ selected.sectionTitle }}</span><button type="button" :disabled="blocked" aria-label="Закрыть событие" @click="selectedId = ''"><X :size="18" /></button></header>
        <div class="journal-event-panel-scroll">
          <DndDiaryEventRow :key="selected.id" :event="selected" :editable="editable" :busy="busy" :allow-drag="false" compact
            :items-by-id="itemsById" :focus-title="focusEventId === selected.id" :save-event="saveEntry"
            @editing="value => setEditing(selected.id, value)" @remove="removingEvent = $event" />
          <JournalEventConnections :journal="journal" :event-id="selected.id" :editable="editable" :disabled="blocked"
            @navigate="event => select(event, true)" @connect="connect" @unlink="unlink" />
        </div>
      </aside>
    </div>
    <AppModalFrame v-if="edgeDraft" title="Связь событий" :z-index="3600" :dismissible="!busy" @close="edgeDraft = null">
      <FormTextInput v-model:value="edgeDraft.label" aria-label="Подпись связи" placeholder="Например: разведчики отправились в лес" :maxlength="240" :disabled="!editable || busy" />
      <p v-if="error" class="journal-error" role="alert">{{ error }}</p>
      <template #footer><RemoveButton v-if="editable" icon="trash" label="Удалить связь, сохранив события" :disabled="busy" @click="removeEdge" /><FormActionButtons v-if="editable" :loading="busy" @cancel="edgeDraft = null" @submit="saveEdge" /></template>
    </AppModalFrame>
    <ConfirmDialog v-if="removingEvent" title="Удалить событие?" :loading="busy" :z-index="3700"
      message="Событие и его связи будут удалены у всех участников. Остальные события сохранятся; ветви не соединяются автоматически."
      confirm-label="Удалить" @confirm="remove" @cancel="removingEvent = null" />
  </div>
</template>
<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ArrowUp, LayoutGrid, Scan, Minus, Plus, X } from '@lucide/vue'
import { AppModalFrame, FormTextInput, FormActionButtons, RemoveButton, ConfirmDialog } from '@sylvieshare/share-ui'
import NarrativeGraphCanvas from '@/features/narrative-graph/components/NarrativeGraphCanvas.vue'
import DndDiaryEventRow from '@/features/character-editor/blocks/dnd/components/DndDiaryEventRow.vue'
import { useItemReferenceMap } from '@/features/items/composables/useItemReferenceMap'
import { useJournalGraphEditor } from '../composables/useJournalGraphEditor'
import JournalEventTypePicker from './JournalEventTypePicker.vue'
import JournalGraphNode from './JournalGraphNode.vue'
import JournalEventConnections from './JournalEventConnections.vue'
const props = defineProps({ journal: Object, sectionId: String, editable: Boolean, busy: Boolean, updateGraph: Function, createEntry: Function, saveEntry: Function, removeEntry: Function })
const emit = defineEmits(['section', 'editing', 'dragging'])
const canvas = ref(null)
const { graph, entries, selectedId, selected, focusEventId, linkingFrom, edgeDraft, removingEvent, blocked, arranging, error,
  select, startLink, connect, unlink, openEdge, saveEdge, removeEdge, rewire, setInteraction, preview, savePositions, autoLayout, create, setEditing, remove } = useJournalGraphEditor(props, emit, canvas)
const itemIds = computed(() => entries.value.filter(event => event.sectionId === props.sectionId && event.type === 'battle').flatMap(event => event.combatants.filter(creature => creature.source === 'handbook').map(creature => creature.itemId)))
const { itemsById } = useItemReferenceMap(itemIds)
async function restoreOrFocusLatest() {
  await nextTick()
  await nextTick()
  if (canvas.value?.hasSavedView() || selected.value) return
  const latest = graph.value.nodes.at(-1)
  if (latest) canvas.value?.focusNode(latest)
}
onMounted(restoreOrFocusLatest)
watch(() => props.sectionId, restoreOrFocusLatest)
</script>
<style scoped src="./JournalGraphWorkspace.css"></style>
