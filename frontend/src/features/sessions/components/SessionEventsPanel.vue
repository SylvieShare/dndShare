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
          <section v-for="timeGroup in timelineGroups" :key="timeGroup.key" class="sep-time-group">
            <time class="sep-time">{{ timeGroup.time }}</time>
            <div class="sep-time-content">
              <section v-for="actorGroup in timeGroup.actors" :key="actorGroup.key" class="sep-actor-group">
                <div class="sep-actor-head">{{ actorGroup.label }}</div>
                <div class="sep-actor-events">
                  <article v-for="event in actorGroup.events" :key="event.id" class="sep-event" :class="`sep-event--${event.type}`">
                    <div class="sep-marker">{{ eventIcon(event.type) }}</div>
                    <div class="sep-content">
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
                      <div v-else-if="event.type === 'entry_added' && Number(event.data?.count) > 1" class="sep-details">
                        Количество: {{ event.data.count }}
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
              </section>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { groupSessionEvents } from '@/features/sessions/lib/sessionEventView'

const store = useSessionEventsStore()
const emit = defineEmits(['collapsed'])
const { events } = storeToRefs(store)
const collapsed = ref(false)
const listEl = ref(null)
const timelineGroups = computed(() => groupSessionEvents(events.value))

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  emit('collapsed', collapsed.value)
}

function eventIcon(type) {
  return {
    dice_roll: '◇',
    spell_used: '✦',
    rest_completed: '☾',
    item_spent: '−',
    item_added: '+',
    entry_added: '+',
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
  if (event.type === 'entry_added') {
    const prefix = {
      potion: 'Добавлено зелье',
      spell: 'Добавлено заклинание',
      feature: 'Добавлена черта',
      ability: 'Добавлена способность',
    }[event.data?.kind] || (event.data?.category === 'weapon' ? 'Добавлено оружие' : 'Добавлен предмет')
    return `${prefix}: ${event.title}`
  }
  if (event.type === 'resource_used') return `Использовано: ${event.title}`
  return event.title || 'Событие'
}

function spellDetails(data) {
  const level = Number(data?.slotLevel)
  if (!level) return 'Заговор · без ячейки'
  return `Потрачена ячейка ${level} круга`
}

watch(() => events.value.length, async () => {
  const list = listEl.value
  const wasAtTop = !list || list.scrollTop < 8
  const previousHeight = list?.scrollHeight || 0
  await nextTick()
  if (!listEl.value) return
  if (wasAtTop) listEl.value.scrollTop = 0
  else listEl.value.scrollTop += listEl.value.scrollHeight - previousHeight
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
.sep-time-group { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 8px; padding: 6px 0 10px; border-top: 1px solid color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.sep-time-group:first-child { padding-top: 2px; border-top: none; }
.sep-time { padding-top: 1px; color: var(--text-muted); font-size: 9px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.sep-time-content { min-width: 0; }
.sep-actor-group + .sep-actor-group { margin-top: 9px; }
.sep-actor-head { color: var(--text-2); font-size: 10px; font-weight: 750; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sep-actor-events { position: relative; margin-top: 4px; margin-left: 3px; padding-left: 11px; border-left: 1px solid color-mix(in srgb, var(--accent) 34%, var(--border)); }
.sep-event { position: relative; display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 6px; padding: 4px 0 7px; }
.sep-event + .sep-event { padding-top: 7px; }
.sep-marker { position: relative; width: 18px; height: 18px; display: grid; place-items: center; border-radius: 5px; background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent-soft); font-size: 10px; font-weight: 800; }
.sep-marker::before { content: ''; position: absolute; top: 50%; left: -12px; width: 12px; height: 1px; background: color-mix(in srgb, var(--accent) 34%, var(--border)); }
.sep-event--rest_completed .sep-marker { color: var(--warning); background: color-mix(in srgb, var(--warning) 12%, transparent); }
.sep-event--item_spent .sep-marker, .sep-event--resource_used .sep-marker { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); }
.sep-content { min-width: 0; }
.sep-event-title { color: var(--text-1); font-size: 11px; font-weight: 650; line-height: 1.35; overflow-wrap: anywhere; }
.sep-details { margin-top: 2px; color: var(--text-muted); font-size: 10px; line-height: 1.3; }
.sep-roll { display: flex; align-items: center; gap: 3px; margin-top: 5px; min-width: 0; }
.sep-die-value { min-width: 23px; height: 23px; padding: 0 4px; box-sizing: border-box; display: inline-grid; place-items: center; border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border)); border-radius: 6px; background: var(--surface-raised); color: var(--text-1); font-size: 11px; font-weight: 800; }
.sep-die-value--dropped { opacity: .42; text-decoration: line-through; }
.sep-sign, .sep-flat { color: var(--text-muted); font-size: 10px; }
.sep-total { margin-left: auto; color: var(--accent-soft); font-size: 16px; font-variant-numeric: tabular-nums; }
</style>
