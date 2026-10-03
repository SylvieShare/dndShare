<template>
  <section class="session-journal" data-tutorial="session-journal" aria-label="Сессии и дневник">
    <LoadingState v-if="loading" label="Открываем дневник…" fill />
    <div v-else class="session-journal__body">
      <BaseTile class="session-journal__sessions">
        <header class="session-journal__sessions-heading">
          <h2>Сессии</h2>
          <AddButton v-if="isDm" label="Новая сессия" variant="icon" :disabled="locked" @click="editOccurrence()" />
        </header>
        <SessionJournalNavigation v-if="groups.length" :groups="groups" :selected-id="selectedId" :disabled="locked" @select="select" />
        <p v-else class="session-journal__hint">{{ isDm ? 'Запланируйте первую встречу.' : 'Сессий пока нет.' }}</p>
      </BaseTile>
      <BaseTile class="session-journal__content">
        <header v-if="selectedOccurrence" class="session-journal__meeting">
          <div class="session-journal__meeting-copy">
            <div class="session-journal__meta"><span>Сессия #{{ selectedOccurrence.number }}</span><span class="session-journal__status" :class="{ 'session-journal__status--next': ['Следующая', 'Сегодня'].includes(selectedStatus) }">{{ selectedStatus }}</span><time v-if="selectedOccurrence.date" :datetime="selectedOccurrence.date">{{ occurrenceDate(selectedOccurrence.date) }}</time></div>
            <h3>{{ selectedOccurrence.name }}</h3>
          </div>
          <div class="session-journal__meeting-actions">
            <BasePopover v-if="isDm && canManage && journal" v-model:open="settingsOpen" :anchor="settingsTrigger" :min-width="260">
              <ToggleSwitch :model-value="journal.playersCanEdit" :disabled="locked" label="Игроки могут редактировать дневник" @update:model-value="setPlayerEditing($event).catch(() => {})" />
            </BasePopover>
            <button v-if="isDm && canManage && journal" ref="settingsTrigger" type="button" class="session-journal__icon" aria-label="Доступ к дневнику" :aria-expanded="settingsOpen" @click="settingsOpen = !settingsOpen"><Settings2 :size="17" /></button>
            <RowActionMenu v-if="isDm" :disabled="locked">
              <template #trigger><button type="button" class="session-journal__icon" :disabled="locked" :aria-label="`Действия с сессией #${selectedOccurrence.number}`"><Ellipsis :size="20" /></button></template>
              <template #default="{ close }">
                <RowActionItem action="edit" @click="editOccurrence(selectedOccurrence); close()">Редактировать сессию</RowActionItem>
                <RowActionItem action="delete" @click="removingOccurrence = selectedOccurrence; close()">Удалить сессию</RowActionItem>
              </template>
            </RowActionMenu>
          </div>
        </header>
        <p v-if="editingId" class="session-journal__hint">Сохраните запись или отмените правку, чтобы переключить сессию.</p>
        <p v-else-if="journal && !canEdit" class="session-journal__hint">Только чтение · записи добавляет мастер</p>
        <p v-if="error" role="alert" class="session-journal__error">{{ error }} <button type="button" :disabled="locked" @click="reload">Повторить загрузку</button></p>
        <JournalTimeline v-if="selectedSection" :key="selectedSection.id" :session="selectedSection" :owner-mode="canEdit" :editable-section="false" compact
          :busy="busy" :editing-id="editingId" :focus-event-id="focusEventId" :save-event="updateEntry"
          @create-event="createEvent" @remove-event="removingEvent = $event" @editing="setEditing" @dragging="setDragging"
          @reorder-events="reorderEntries(selectedSection.id, $event).catch(() => {})" />
        <LoadingState v-else-if="busy" label="Открываем записи…" />
        <p v-else-if="selectedOccurrence" class="session-journal__hint">Записи этой сессии пока недоступны. Повторите загрузку.</p>
        <div v-else class="session-journal__empty">
          <Feather :size="28" /><strong>История ещё впереди</strong>
          <p>{{ isDm ? 'Создайте первую сессию, чтобы запланировать встречу и вести её дневник.' : 'Мастер пока не добавил сессии.' }}</p>
        </div>
      </BaseTile>
    </div>
    <SessionOccurrenceModal v-if="occurrenceDraft && isDm" :occurrence="occurrenceDraft" :busy="busy" :error="occurrenceError" @save="saveOccurrence" @close="occurrenceDraft = null; occurrenceError = ''" />
    <ConfirmDialog v-if="removingOccurrence && isDm" title="Удалить сессию?" :loading="busy" confirm-label="Удалить"
      :message="`Сессия #${removingOccurrence.number} «${removingOccurrence.name}» и все записи её дневника будут удалены.${occurrenceError ? '\n' + occurrenceError : ''}`"
      @confirm="removeOccurrence" @cancel="removingOccurrence = null; occurrenceError = ''" />
    <ConfirmDialog v-if="removingEvent" title="Удалить событие?" :loading="busy" confirm-label="Удалить"
      :message="`«${removingEvent.title || 'Без названия'}» будет удалено из дневника.${error ? '\n' + error : ''}`" @confirm="removeEvent" @cancel="removingEvent = null" />
  </section>
</template>
<script setup>
import { ref, toRef } from 'vue'
import { Ellipsis, Feather, Settings2 } from '@lucide/vue'
import { AddButton, BasePopover, BaseTile, ConfirmDialog, LoadingState, RowActionMenu, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import JournalTimeline from '@/features/journals/components/JournalTimeline.vue'
import SessionOccurrenceModal from './SessionOccurrenceModal.vue'
import SessionJournalNavigation from './SessionJournalNavigation.vue'
import { occurrenceDate } from '../lib/sessionOccurrences'
import { useSessionJournal } from '../composables/useSessionJournal'
const props = defineProps({ sessionUuid: { type: String, required: true }, isDm: Boolean, occurrenceId: { type: Number, default: null } })
const { journal, canEdit, canManage, loading, busy, locked, error, groups, selectedId, selectedSection, selectedOccurrence, selectedStatus,
  editingId, focusEventId, removingEvent, occurrenceDraft, removingOccurrence, occurrenceError,
  select, reload, editOccurrence, saveOccurrence, removeOccurrence, updateEntry, reorderEntries, setPlayerEditing,
  setDragging, setEditing, createEvent, removeEvent } = useSessionJournal(props.sessionUuid, toRef(props, 'occurrenceId'))
const settingsOpen = ref(false), settingsTrigger = ref(null)
</script>
<style scoped src="./styles/SessionJournalWorkspace.css"></style>
