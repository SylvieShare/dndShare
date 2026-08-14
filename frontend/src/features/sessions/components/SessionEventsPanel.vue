<template>
  <div class="session-events-panel">
    <div class="sep-head">
      <span class="sep-title">СОБЫТИЯ</span>
      <span class="sep-live" :class="{ 'sep-live--error': store.pollError }" :title="store.pollError ? 'Нет связи с журналом' : 'Журнал синхронизирован'" />
      <button
        type="button"
        class="sep-collapse"
        :title="collapsed ? 'Развернуть события' : 'Свернуть события'"
        :aria-expanded="!collapsed"
        @click="toggleCollapsed"
      >{{ collapsed ? '⌄' : '⌃' }}</button>
    </div>

    <div class="sep-body" :class="{ 'sep-body--collapsed': collapsed }">
      <div class="sep-body-inner" :aria-hidden="collapsed" :inert="collapsed">
        <div v-if="store.loading" class="sep-empty">Загружаем хронику…</div>
        <div v-else-if="!store.events.length" class="sep-empty">Здесь появятся игровые события</div>
        <div v-else ref="listEl" class="sep-list">
          <article v-for="event in store.events" :key="event.id" class="sep-event" :class="`sep-event--${event.type}`">
            <div class="sep-marker">{{ eventIcon(event.type) }}</div>
            <div class="sep-content">
              <div class="sep-meta">
                <span class="sep-author">{{ actorName(event) }}</span>
                <time>{{ eventTime(event.createdAt) }}</time>
              </div>
              <div class="sep-event-title">{{ eventTitle(event) }}</div>

              <div v-if="event.type === 'dice_roll'" class="sep-roll">
                <template v-for="(part, index) in event.data?.result?.parts || []" :key="index">
                  <span v-if="index || part.sign === '-'" class="sep-sign">{{ part.sign }}</span>
                  <template v-if="part.kind === 'dice'">
                    <span
                      v-for="(value, rollIndex) in part.rolls"
                      :key="rollIndex"
                      class="sep-die-value"
                      :class="{ 'sep-die-value--dropped': part.dropped?.includes(rollIndex) }"
                    >{{ value }}</span>
                  </template>
                  <span v-else class="sep-flat">{{ part.value }}</span>
                </template>
                <strong class="sep-total">{{ event.data?.result?.total }}</strong>
              </div>

              <div v-else-if="event.type === 'spell_used'" class="sep-details">
                {{ spellDetails(event.data) }}
              </div>
              <div v-else-if="event.type === 'item_spent' || event.type === 'item_added'" class="sep-details">
                Осталось: {{ event.data?.remaining ?? '—' }}
              </div>
              <div v-else-if="event.type === 'resource_used'" class="sep-details">
                Осталось: {{ event.data?.remaining ?? '—' }} / {{ event.data?.total ?? '—' }}
              </div>
              <div v-else-if="event.type === 'rest_completed'" class="sep-details">
                {{ event.data?.kind === 'long' ? 'Длинный отдых' : 'Короткий отдых' }}
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { pvName } from '@/features/sessions/lib/participantView'

const store = useSessionEventsStore()
const emit = defineEmits(['collapsed'])
const { events } = storeToRefs(store)
const collapsed = ref(false)
const listEl = ref(null)

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  emit('collapsed', collapsed.value)
}

function actorName(event) {
  if (event.actorTemplateId && event.actorData) {
    return pvName({ templateId: event.actorTemplateId, data: event.actorData }) || event.authorLogin
  }
  return 'Мастер'
}

function eventIcon(type) {
  return {
    dice_roll: '◇',
    spell_used: '✦',
    rest_completed: '☾',
    item_spent: '−',
    item_added: '+',
    resource_used: '◌',
    session_status_changed: '◆',
    chapter_started: '→',
    encounter_started: '⚔',
    encounter_finished: '✓',
  }[type] || '·'
}

function eventTitle(event) {
  if (event.type === 'dice_roll') return event.title || 'Бросок'
  if (event.type === 'spell_used') return `Использовано: ${event.title}`
  if (event.type === 'item_spent') return `Потрачено: ${event.title}`
  if (event.type === 'item_added') return `Добавлено: ${event.title}`
  if (event.type === 'resource_used') return `Использовано: ${event.title}`
  return event.title || 'Событие'
}

function spellDetails(data) {
  const level = Number(data?.slotLevel)
  if (!level) return 'Заговор · без ячейки'
  return `Потрачена ячейка ${level} круга`
}

function eventTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

watch(() => events.value.length, async () => {
  const list = listEl.value
  const wasNearBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 64
  if (!wasNearBottom) return
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
})
</script>

<style scoped>
.session-events-panel { padding: 14px 12px; display: flex; flex-direction: column; min-height: 0; height: 100%; box-sizing: border-box; }
.sep-head { display: flex; align-items: center; gap: 8px; min-height: 22px; padding: 0 2px; }
.sep-title { color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; }
.sep-live { width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 7px color-mix(in srgb, var(--success) 65%, transparent); }
.sep-live--error { background: var(--danger); box-shadow: 0 0 7px color-mix(in srgb, var(--danger) 65%, transparent); }
.sep-collapse { margin-left: auto; width: 24px; height: 22px; padding: 0; border: 1px solid transparent; border-radius: 6px; background: none; color: var(--text-muted); font: inherit; font-size: 16px; cursor: pointer; }
.sep-collapse:hover { border-color: var(--border); color: var(--text-1); background: color-mix(in srgb, var(--accent) 8%, transparent); }
.sep-body { display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; flex: 1; padding-top: 8px; transition: grid-template-rows .2s ease, padding-top .2s ease; }
.sep-body--collapsed { grid-template-rows: 0fr; padding-top: 0; }
.sep-body-inner { min-height: 0; overflow: hidden; }
.sep-list { height: 100%; min-height: 120px; overflow-y: auto; overscroll-behavior: contain; padding-right: 3px; }
.sep-empty { color: var(--text-muted); font-size: 12px; line-height: 1.4; padding: 8px 2px; }
.sep-event { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 7px; padding: 9px 2px; border-top: 1px solid color-mix(in srgb, var(--text-on-accent) 7%, transparent); }
.sep-event:first-child { border-top: none; }
.sep-marker { width: 20px; height: 20px; display: grid; place-items: center; border-radius: 6px; background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent-soft); font-size: 12px; font-weight: 800; }
.sep-event--rest_completed .sep-marker { color: var(--warning); background: color-mix(in srgb, var(--warning) 12%, transparent); }
.sep-event--item_spent .sep-marker, .sep-event--resource_used .sep-marker { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); }
.sep-content { min-width: 0; }
.sep-meta { display: flex; align-items: baseline; gap: 6px; color: var(--text-muted); font-size: 9px; }
.sep-author { color: var(--text-2); font-size: 10px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sep-meta time { margin-left: auto; font-variant-numeric: tabular-nums; }
.sep-event-title { margin-top: 2px; color: var(--text-1); font-size: 12px; font-weight: 650; line-height: 1.3; overflow-wrap: anywhere; }
.sep-details { margin-top: 2px; color: var(--text-muted); font-size: 10px; line-height: 1.3; }
.sep-roll { display: flex; align-items: center; gap: 3px; margin-top: 5px; min-width: 0; }
.sep-die-value { min-width: 23px; height: 23px; padding: 0 4px; box-sizing: border-box; display: inline-grid; place-items: center; border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border)); border-radius: 6px; background: var(--surface-raised); color: var(--text-1); font-size: 11px; font-weight: 800; }
.sep-die-value--dropped { opacity: .42; text-decoration: line-through; }
.sep-sign, .sep-flat { color: var(--text-muted); font-size: 10px; }
.sep-total { margin-left: auto; color: var(--accent-soft); font-size: 16px; font-variant-numeric: tabular-nums; }
</style>
