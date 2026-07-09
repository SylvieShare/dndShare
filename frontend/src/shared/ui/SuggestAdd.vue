<template>
  <div class="suggest-add" ref="root">
    <button
      v-if="!open"
      class="sa-trigger"
      :class="{ 'sa-trigger-text': !!title }"
      type="button"
      @click="openPicker"
    >
      <span class="sa-plus"><span class="sa-plus-h"></span><span class="sa-plus-v"></span></span>
      <span v-if="title" class="sa-title">{{ title }}</span>
    </button>

    <template v-else-if="!isMobile">
      <input
        ref="input"
        class="sa-input"
        :value="query"
        :placeholder="placeholder"
        @input="query = $event.target.value"
        @keydown.enter.prevent="confirmTop"
        @keydown.escape="close"
      />
      <SuggestDropdown
        :items="items"
        :query="query"
        :type-id="suggestTypeId"
        :exclude="filteredExclude"
        @pick="pick"
        @added="item => suggestStore.addItem(suggestTypeId, item)"
        @deleted="id => suggestStore.removeItem(suggestTypeId, id)"
      />
    </template>
  </div>

  <Teleport v-if="isMobile && open" to="body">
    <div class="sa-panel-backdrop" @click="close" @touchstart.passive="close"></div>
    <div class="sa-panel" ref="panel" @click.stop @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
      <div class="sa-panel-head">
        <span class="sa-panel-title">{{ title || 'Выбор' }}</span>
        <button class="sa-panel-create-btn" @click="createOpen = true">
          <span class="sa-plus"><span class="sa-plus-h"></span><span class="sa-plus-v"></span></span>
        </button>
        <button class="sa-panel-close-btn" @click="close">×</button>
      </div>
      <div v-if="items.length > 20" class="sa-panel-search">
        <input
          class="sa-panel-input"
          :value="query"
          :placeholder="placeholder"
          @input="query = $event.target.value"
          @keydown.escape="close"
        />
      </div>
      <div class="sa-panel-list">
        <div
          v-for="item in panelFiltered"
          :key="item.id"
          class="sa-panel-item"
          :style="item.color ? { '--c': item.color } : {}"
          @click="pick(item.value)"
        >
          <span v-if="item.color" class="sa-panel-dot"></span>
          <span class="sa-panel-item-text">{{ item.value }}</span>
          <span v-if="item.userId != null" class="sa-panel-custom-mark" title="Ваш вариант">✦</span>
          <button
            v-if="item.userId != null"
            class="sa-panel-delete"
            @click.stop="deletePanelItem(item)"
          >×</button>
        </div>
        <div v-if="panelFiltered.length === 0" class="sa-panel-empty">
          Ничего не найдено
        </div>
      </div>
    </div>
  </Teleport>

  <SuggestEditModal
    v-if="createOpen"
    :type-id="suggestTypeId"
    :initial-name="query.trim()"
    @close="createOpen = false"
    @created="onCreated"
  />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import SuggestDropdown from '@/shared/ui/SuggestDropdown'
import SuggestEditModal from '@/shared/ui/SuggestEditModal'
import { fetchDelete } from '@/shared/api/http'
import { useSwipeToClose } from '@/shared/lib/useSwipeToClose'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  suggestTypeId: { type: [Number, String], required: true },
  title: { type: String, default: '' },
  placeholder: { type: String, default: 'Поиск...' },
  exclude: { type: Array, default: () => [] },
  filterPicked: { type: Boolean, default: true },
})
const emit = defineEmits(['pick'])

const root = ref(null)
const panel = ref(null)
const input = ref(null)
const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeToClose(panel, () => close())
const open = ref(false)
const createOpen = ref(false)
const query = ref('')
const isMobile = ref(false)
let _onDown = null
let _mqCleanup = null

const suggestStore = computed(() => useSuggestStore())
const items = computed(() => useSuggestStore().items(props.suggestTypeId) || [])
const filteredExclude = computed(() => props.filterPicked ? props.exclude : [])

const panelAvailable = computed(() => {
  if (!filteredExclude.value.length) return items.value
  const excluded = filteredExclude.value.map(String)
  return items.value.filter(it => !excluded.includes(String(it.value)))
})
const panelFiltered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return panelAvailable.value
  return panelAvailable.value.filter(it => it.value.toLowerCase().includes(q))
})

onMounted(() => {
  const mq = window.matchMedia('(max-width: 640px)')
  isMobile.value = mq.matches
  const handler = e => { isMobile.value = e.matches }
  mq.addEventListener('change', handler)
  _mqCleanup = () => mq.removeEventListener('change', handler)

  _onDown = e => {
    if (isMobile.value) return
    if (!root.value?.contains(e.target)) close()
  }
  document.addEventListener('mousedown', _onDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', _onDown)
  _mqCleanup?.()
})

function openPicker() {
  open.value = true
  query.value = ''
  useSuggestStore().ensure(props.suggestTypeId)
  if (!isMobile.value) {
    nextTick(() => input.value?.focus())
  } else {
    nextTick(() => animatePanelIn())
  }
}

function animatePanelIn() {
  const el = panel.value
  if (!el) return
  el.style.transform = 'translateX(100%)'
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)'
      el.style.transform = 'translateX(0)'
      setTimeout(() => {
        if (el) { el.style.transition = ''; el.style.transform = '' }
      }, 290)
    })
  })
}

function close() {
  open.value = false
  query.value = ''
}

function confirmTop() {
  const q = query.value.trim().toLowerCase()
  const available = props.filterPicked
    ? items.value.filter(item => !props.exclude.includes(item.value))
    : items.value
  const match = q
    ? available.find(item => item.value.toLowerCase().includes(q))
    : available[0]
  if (match) pick(match.value)
}

function pick(value) {
  emit('pick', value)
  close()
}

function onCreated(item) {
  useSuggestStore().addItem(props.suggestTypeId, item)
  emit('pick', item.value)
  close()
}

function deletePanelItem(item) {
  fetchDelete('/suggest/' + props.suggestTypeId + '/' + item.id)
    .then(() => useSuggestStore().removeItem(props.suggestTypeId, item.id))
}
</script>

<style scoped>
.suggest-add {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.sa-trigger {
  min-width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px dashed #3a3a46;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0;
  font: inherit;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.sa-trigger-text {
  width: auto;
  min-width: 0;
  height: 26px;
  border-radius: 7px;
  padding: 0 10px;
}

@media (hover: hover) {
  .sa-trigger:hover {
    border-color: var(--text-muted);
    color: var(--text-2);
    background: rgba(255, 255, 255, 0.04);
  }
}

.sa-plus {
  position: relative;
  width: 10px;
  height: 10px;
  display: block;
  flex-shrink: 0;
}

.sa-plus-h,
.sa-plus-v {
  position: absolute;
  background: currentColor;
  border-radius: 1px;
}

.sa-plus-h {
  width: 10px;
  height: 2px;
  top: 4px;
  left: 0;
}

.sa-plus-v {
  width: 2px;
  height: 10px;
  top: 0;
  left: 4px;
}

.sa-title {
  font-size: 12px;
  line-height: 1;
}

.sa-input {
  width: 180px;
  height: 28px;
  background: #18181c;
  border: 1px dashed rgba(140, 140, 154, 0.48);
  border-radius: 7px;
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  padding: 0 9px;
  outline: none;
}

.sa-input:focus {
  border-color: rgba(126, 118, 255, 0.7);
}

/* ── Mobile panel ── */
.sa-panel-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3490;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.sa-panel {
  position: fixed;
  right: 0;
  bottom: 0;
  z-index: 3500;
  display: flex;
  flex-direction: column;
  width: 300px;
  max-width: 90vw;
  max-height: 75vh;
  background: #1a1a22;
  border-top: 1px solid #2e2e3c;
  border-left: 1px solid #2e2e3c;
  border-radius: 16px 0 0 0;
  box-shadow: -8px -4px 32px rgba(0, 0, 0, 0.5);
}

.sa-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 12px 12px;
  border-bottom: 1px solid #2a2a36;
  flex-shrink: 0;
}

.sa-panel-title {
  flex: 1;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.09em;
}

.sa-panel-create-btn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px dashed #3a3a46;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s;
}

@media (hover: hover) { .sa-panel-create-btn:hover { border-color: var(--text-muted); color: var(--text-2); } }

.sa-panel-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: color 0.12s, background 0.12s;
}

@media (hover: hover) { .sa-panel-close-btn:hover { color: var(--danger); background: rgba(224, 85, 85, 0.1); } }

.sa-panel-search {
  padding: 0 14px 10px;
  border-bottom: 1px solid #2a2a30;
  flex-shrink: 0;
}

.sa-panel-input {
  width: 100%;
  height: 36px;
  background: #18181c;
  border: 1px solid rgba(140, 140, 154, 0.35);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 15px;
  padding: 0 12px;
  outline: none;
  box-sizing: border-box;
}

.sa-panel-input:focus {
  border-color: rgba(126, 118, 255, 0.7);
}

.sa-panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0 20px;
}

.sa-panel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.12s;
}

.sa-panel-item:active {
  background: rgba(255, 255, 255, 0.06);
}

.sa-panel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c, var(--text-muted));
  flex-shrink: 0;
}

.sa-panel-item-text {
  flex: 1;
  color: var(--text-2);
  font-size: 15px;
  min-width: 0;
}

.sa-panel-custom-mark {
  color: #7a6aaa;
  font-size: 9px;
  flex-shrink: 0;
}

.sa-panel-delete {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 4px;
  transition: color 0.12s;
}

.sa-panel-delete:active {
  color: var(--danger);
}

.sa-panel-empty {
  padding: 16px 14px;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
