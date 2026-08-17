<template>
  <div class="session-events-panel">
    <header class="sep-head">
      <div class="sep-head-copy">
        <div class="sep-heading-line">
          <span class="sep-live" :class="{ 'sep-live--error': props.liveStatus === 'error' || store.syncError }" :title="props.liveStatus === 'connected' && !store.syncError ? 'Журнал синхронизирован' : 'Восстанавливаем связь с журналом'" />
          <span class="sep-title">ХРОНИКА</span>
        </div>
        <span class="sep-count">{{ resultCountLabel }}</span>
      </div>

      <button
        ref="filterTrigger"
        type="button"
        class="sep-filter-trigger"
        :class="{ 'sep-filter-trigger--active': filterOpen || activeFilterCount }"
        :aria-expanded="filterOpen"
        aria-label="Фильтры хроники"
        title="Фильтры хроники"
        @click="filterOpen = !filterOpen"
      >
        <svg viewBox="0 0 16 16" fill="none" width="15" height="15" aria-hidden="true">
          <path d="M2 3.5h12L9.5 8.7v3.5l-3 1.3V8.7L2 3.5Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>
        </svg>
        <span>Фильтры</span>
        <b v-if="activeFilterCount" class="sep-filter-count">{{ activeFilterCount }}</b>
      </button>
    </header>

    <div v-if="activeFilterChips.length" class="sep-active-filters" aria-label="Активные фильтры">
      <button
        v-for="chip in activeFilterChips"
        :key="chip.key"
        type="button"
        class="sep-active-filter"
        :title="`Убрать фильтр «${chip.label}»`"
        @click="chip.clear"
      >{{ chip.label }} <span aria-hidden="true">×</span></button>
      <button type="button" class="sep-reset-inline" @click="resetFilters">Сбросить</button>
    </div>

    <BasePopover v-model:open="filterOpen" :anchor="filterTrigger" placement="bottom-end" :min-width="310" transition-preset="action-menu">
      <div class="sep-filter-popover">
        <div class="sep-filter-popover-head">
          <div>
            <span>ФИЛЬТРЫ ХРОНИКИ</span>
            <small>{{ filteredEvents.length }} из {{ events.length }}</small>
          </div>
          <button v-if="activeFilterCount" type="button" @click="resetFilters">Сбросить</button>
        </div>

        <section class="sep-filter-section">
          <label>Автор события</label>
          <MultiToggle v-model="authorFilter" :options="authorOptions" neutral-value="all" block />
        </section>

        <section class="sep-filter-section">
          <label for="session-event-actor-filter">Кто действует</label>
          <FormSelect id="session-event-actor-filter" v-model:value="actorFilter">
            <option value="">Все субъекты</option>
            <option v-for="option in actorOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </FormSelect>
        </section>

        <section class="sep-filter-section">
          <label>Тип события</label>
          <div class="sep-category-grid">
            <button
              v-for="category in eventCategories"
              :key="category.value"
              type="button"
              :class="{ active: categoryFilters.includes(category.value) }"
              @click="toggleCategory(category.value)"
            ><span>{{ category.icon }}</span>{{ category.label }}</button>
          </div>
          <small class="sep-filter-hint">Ничего не выбрано — показываются все типы</small>
        </section>
      </div>
    </BasePopover>

    <div class="sep-body">
      <div class="sep-body-inner">
        <div v-if="store.loading" class="sep-empty">Загружаем хронику…</div>
        <div v-else-if="!store.events.length" class="sep-empty">Здесь появятся игровые события</div>
        <div v-else-if="!filteredEvents.length" class="sep-empty sep-empty--filtered">
          <span>По выбранным фильтрам событий нет</span>
          <button type="button" @click="resetFilters">Показать всю хронику</button>
        </div>
        <div v-else ref="listEl" class="sep-list">
          <section v-for="timeGroup in timelineGroups" :key="timeGroup.key" class="sep-time-group">
            <time class="sep-time">{{ timeGroup.time }}</time>
            <div class="sep-time-content">
              <section v-for="actorGroup in timeGroup.actors" :key="actorGroup.key" class="sep-actor-group">
                <div v-if="actorGroup.label" class="sep-actor-head">
                  <span>{{ actorGroup.label }}</span>
                  <small v-if="actorGroup.authorIsSessionOwner">ВЛАДЕЛЕЦ</small>
                </div>
                <div class="sep-actor-events">
                  <article v-for="event in actorGroup.events" :key="event.id" class="sep-event" :class="`sep-event--${event.type}`">
                    <div class="sep-marker">{{ eventIcon(event.type) }}</div>
                    <div class="sep-content">
                      <div class="sep-event-heading" :class="{ 'sep-event-heading--roll': event.type === 'dice_roll' }">
                        <div class="sep-event-title">{{ event.action }}</div>
                        <span v-if="event.type === 'dice_roll'" class="sep-event-divider" aria-hidden="true" />
                        <strong v-if="event.type === 'dice_roll'" class="sep-total">{{ event.data?.result?.total }}</strong>
                      </div>

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
import { BasePopover, FormSelect, MultiToggle } from '@sylvieshare/share-ui'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { groupSessionEvents } from '@/features/sessions/lib/sessionEventView'
import {
  filterSessionEvents,
  SESSION_EVENT_CATEGORIES,
  sessionEventActorOptions,
} from '@/features/sessions/lib/sessionEventFilters'

const props = defineProps({
  liveStatus: { type: String, default: 'idle' },
})

const store = useSessionEventsStore()
const { events } = storeToRefs(store)
const listEl = ref(null)
const filterOpen = ref(false)
const filterTrigger = ref(null)
const authorFilter = ref('all')
const actorFilter = ref('')
const categoryFilters = ref([])
const eventCategories = SESSION_EVENT_CATEGORIES
const authorOptions = [
  { value: 'all', label: 'Все' },
  { value: 'owner', label: 'Владелец' },
  { value: 'players', label: 'Игроки' },
]

const actorOptions = computed(() => sessionEventActorOptions(events.value))
const filteredEvents = computed(() => filterSessionEvents(events.value, {
  author: authorFilter.value,
  actor: actorFilter.value,
  categories: categoryFilters.value,
}))
const timelineGroups = computed(() => groupSessionEvents(filteredEvents.value))
const activeFilterCount = computed(() =>
  (authorFilter.value === 'all' ? 0 : 1) +
  (actorFilter.value ? 1 : 0) +
  categoryFilters.value.length
)
const resultCountLabel = computed(() => activeFilterCount.value
  ? `${filteredEvents.value.length} из ${events.value.length}`
  : `${events.value.length} событий`
)
const activeFilterChips = computed(() => {
  const chips = []
  if (authorFilter.value !== 'all') {
    chips.push({
      key: 'author',
      label: authorOptions.find(option => option.value === authorFilter.value)?.label || 'Автор',
      clear: () => { authorFilter.value = 'all' },
    })
  }
  if (actorFilter.value) {
    chips.push({
      key: 'actor',
      label: actorOptions.value.find(option => option.value === actorFilter.value)?.label || 'Субъект',
      clear: () => { actorFilter.value = '' },
    })
  }
  for (const value of categoryFilters.value) {
    const category = eventCategories.find(option => option.value === value)
    if (category) chips.push({
      key: `category:${value}`,
      label: category.label,
      clear: () => toggleCategory(value),
    })
  }
  return chips
})

function toggleCategory(value) {
  categoryFilters.value = categoryFilters.value.includes(value)
    ? categoryFilters.value.filter(entry => entry !== value)
    : [...categoryFilters.value, value]
}

function resetFilters() {
  authorFilter.value = 'all'
  actorFilter.value = ''
  categoryFilters.value = []
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
    chapter_started: '→',
    encounter_started: '⚔',
    encounter_finished: '✓',
  }[type] || '·'
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

watch([authorFilter, actorFilter, categoryFilters], async () => {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = 0
}, { deep: true })
</script>

<style scoped>
.session-events-panel { padding: 12px; display: flex; flex-direction: column; min-height: 0; height: 100%; box-sizing: border-box; }
.sep-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 39px; padding: 0 2px 9px; border-bottom: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, var(--border)); }
.sep-head-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.sep-heading-line { display: flex; align-items: center; gap: 7px; }
.sep-title { color: var(--text-1); font-family: var(--font-display); font-size: 12px; font-weight: 750; letter-spacing: 0.11em; }
.sep-count { color: var(--text-muted); font-size: 9px; font-variant-numeric: tabular-nums; }
.sep-live { width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 7px color-mix(in srgb, var(--success) 65%, transparent); }
.sep-live--error { background: var(--danger); box-shadow: 0 0 7px color-mix(in srgb, var(--danger) 65%, transparent); }
.sep-filter-trigger { position: relative; display: inline-flex; align-items: center; gap: 5px; min-height: 29px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--surface-raised) 76%, transparent); color: var(--text-muted); font: inherit; font-size: 10px; font-weight: 700; cursor: pointer; transition: color .12s, border-color .12s, background .12s; }
.sep-filter-trigger:hover, .sep-filter-trigger--active { border-color: color-mix(in srgb, var(--accent) 58%, var(--border)); background: color-mix(in srgb, var(--accent) 10%, var(--surface-raised)); color: var(--accent-soft); }
.sep-filter-count { min-width: 16px; height: 16px; padding: 0 4px; display: inline-grid; place-items: center; border-radius: 8px; background: var(--accent); color: var(--text-on-accent); box-sizing: border-box; font-size: 9px; font-variant-numeric: tabular-nums; }
.sep-active-filters { display: flex; align-items: center; gap: 4px; overflow-x: auto; padding: 7px 1px 0; scrollbar-width: none; }
.sep-active-filters::-webkit-scrollbar { display: none; }
.sep-active-filter, .sep-reset-inline { flex: 0 0 auto; border: 0; background: none; font: inherit; cursor: pointer; }
.sep-active-filter { padding: 3px 6px; border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border)); border-radius: 10px; background: color-mix(in srgb, var(--accent) 9%, transparent); color: var(--accent-soft); font-size: 9px; }
.sep-active-filter span { margin-left: 2px; color: var(--text-muted); }
.sep-reset-inline { padding: 3px 4px; color: var(--text-muted); font-size: 9px; }
.sep-reset-inline:hover { color: var(--text-1); }
.sep-filter-popover { display: flex; flex-direction: column; gap: 14px; width: 310px; max-width: calc(100vw - 24px); padding: 13px; box-sizing: border-box; }
.sep-filter-popover-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
.sep-filter-popover-head > div { display: flex; flex-direction: column; gap: 3px; }
.sep-filter-popover-head span { color: var(--text-1); font-size: 10px; font-weight: 800; letter-spacing: .09em; }
.sep-filter-popover-head small { color: var(--text-muted); font-size: 9px; font-variant-numeric: tabular-nums; }
.sep-filter-popover-head button { border: 0; background: none; color: var(--accent-soft); font: inherit; font-size: 10px; cursor: pointer; }
.sep-filter-section { display: flex; flex-direction: column; gap: 7px; }
.sep-filter-section > label { color: var(--text-muted); font-size: 9px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
.sep-category-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
.sep-category-grid button { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 7px 8px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface-raised); color: var(--text-2); font: inherit; font-size: 10px; text-align: left; cursor: pointer; transition: border-color .12s, background .12s, color .12s; }
.sep-category-grid button span { width: 14px; color: var(--text-muted); font-weight: 800; text-align: center; }
.sep-category-grid button:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); color: var(--text-1); }
.sep-category-grid button.active { border-color: color-mix(in srgb, var(--accent) 60%, var(--border)); background: color-mix(in srgb, var(--accent) 12%, var(--surface-raised)); color: var(--accent-soft); }
.sep-category-grid button.active span { color: var(--accent-soft); }
.sep-filter-hint { color: var(--text-muted); font-size: 9px; line-height: 1.3; }
.sep-body { display: grid; grid-template-rows: minmax(0, 1fr); min-height: 0; flex: 1; padding-top: 7px; }
.sep-body-inner { min-height: 0; overflow: hidden; }
.sep-list { height: 100%; min-height: 120px; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding-right: 3px; }
.sep-empty { color: var(--text-muted); font-size: 12px; line-height: 1.4; padding: 8px 2px; }
.sep-empty--filtered { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; }
.sep-empty--filtered button { padding: 0; border: 0; background: none; color: var(--accent-soft); font: inherit; font-size: 11px; cursor: pointer; }
.sep-time-group { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 8px; padding: 6px 0 10px; border-top: 1px solid color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.sep-time-group:first-child { padding-top: 2px; border-top: none; }
.sep-time { padding-top: 1px; color: var(--text-muted); font-size: 9px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.sep-time-content { min-width: 0; }
.sep-actor-group + .sep-actor-group { margin-top: 9px; }
.sep-actor-head { display: flex; align-items: center; gap: 6px; color: var(--text-2); font-size: 10px; font-weight: 750; line-height: 1.3; overflow-wrap: anywhere; white-space: normal; }
.sep-actor-head small { flex: none; padding: 1px 4px; border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border)); border-radius: 4px; color: var(--accent-soft); font-size: 7px; font-weight: 800; letter-spacing: .05em; }
.sep-actor-events { min-width: 0; }
.sep-actor-head + .sep-actor-events { margin-top: 5px; }
.sep-event { position: relative; display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 7px; min-width: 0; padding: 0 0 8px; }
.sep-event::after { content: ''; position: absolute; top: 18px; bottom: 0; left: 9px; z-index: 0; width: 1px; background: color-mix(in srgb, var(--accent) 38%, var(--border)); }
.sep-event:last-child::after { display: none; }
.sep-marker { position: relative; z-index: 1; width: 18px; height: 18px; display: grid; place-items: center; border: 1px solid color-mix(in srgb, currentColor 55%, transparent); border-radius: 5px; background: transparent; box-sizing: border-box; color: var(--accent-soft); font-size: 10px; font-weight: 800; }
.sep-event--rest_completed .sep-marker { color: var(--warning); }
.sep-event--item_spent .sep-marker, .sep-event--resource_used .sep-marker { color: var(--danger); }
.sep-content { min-width: 0; max-width: 100%; background: transparent; }
.sep-event-heading { min-width: 0; }
.sep-event-heading--roll { display: flex; align-items: center; gap: 6px; }
.sep-event-title { color: var(--text-1); font-size: 11px; font-weight: 650; line-height: 1.35; overflow-wrap: anywhere; }
.sep-event-heading--roll .sep-event-title { min-width: 0; }
.sep-event-divider { flex: 1 1 12px; min-width: 12px; height: 1px; background: color-mix(in srgb, var(--text-on-accent) 12%, var(--border)); }
.sep-total { flex: 0 0 auto; color: var(--accent-soft); font-size: 16px; font-variant-numeric: tabular-nums; }
.sep-details { margin-top: 2px; color: var(--text-muted); font-size: 10px; line-height: 1.3; overflow-wrap: anywhere; }
.sep-roll { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; max-width: 100%; margin-top: 5px; min-width: 0; }
.sep-die-value { min-width: 23px; height: 23px; padding: 0 4px; box-sizing: border-box; display: inline-grid; place-items: center; border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border)); border-radius: 6px; background: var(--surface-raised); color: var(--text-1); font-size: 11px; font-weight: 800; }
.sep-die-value--dropped { opacity: .42; text-decoration: line-through; }
.sep-sign, .sep-flat { color: var(--text-muted); font-size: 10px; }
</style>
