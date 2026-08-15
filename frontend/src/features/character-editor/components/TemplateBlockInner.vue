<template>
  <component :is="block.content?.tile ? BaseTile : 'div'" v-if="block.type === 'HORIZONTAL_LIST'" v-show="!childHidden" class="layout-horizontal" :class="{ 'layout-hr': block.content?.hr }" :style="[blockStyle, horizontalStyle]">
    <template v-if="!collapsed">
      <template v-for="(entry, vi) in visibleHorizontalChildren" :key="entry.index">
        <div v-if="block.content?.hr && vi > 0" class="layout-hr-sep"></div>
        <TemplateBlockInner
          :block="entry.child"
          :col-style="columnStyle(entry.column)"
          :values="values"
          :vars="vars"
          @update:value="emitValue"
          @update:var="emitVar"
        />
      </template>
    </template>
  </component>

  <component :is="block.content?.tile ? BaseTile : 'div'" v-else-if="block.type === 'VERTICAL_LIST'" v-show="!childHidden" class="layout-vertical" :style="[blockStyle, { gap: block.content?.gap }]">
    <SectionLabel v-if="block.title" :title="block.title" border>
      <template v-if="block.hide_button" #actions>
        <button class="tb-collapse-btn" :title="collapsed ? 'Развернуть' : 'Свернуть'" @click="collapsed = !collapsed">{{ collapsed ? '▸' : '▾' }}</button>
      </template>
    </SectionLabel>
    <template v-if="!collapsed">
      <TemplateBlockInner
        v-for="(child, i) in block.blocks"
        :key="i"
        :block="child"
        :values="values"
        :vars="vars"
        @update:value="emitValue"
        @update:var="emitVar"
      />
    </template>
  </component>

  <div v-else-if="block.type === 'SCROLL_X'" v-show="!childHidden" class="layout-scroll-x" :style="blockStyle">
    <TemplateBlockInner
      v-for="(child, i) in block.blocks"
      :key="i"
      :block="child"
      :values="values"
      :vars="vars"
      @update:value="emitValue"
      @update:var="emitVar"
    />
  </div>

  <div v-else-if="block.type === 'TABLE'" v-show="!childHidden" class="layout-table" :style="[blockStyle, { gap: block.content?.gap, gridTemplateColumns: `repeat(${block.content?.columns ?? 2}, minmax(0, 1fr))` }]">
    <TemplateBlockInner
      v-for="(child, i) in block.blocks"
      :key="i"
      :block="child"
      :values="values"
      :vars="vars"
      @update:value="emitValue"
      @update:var="emitVar"
    />
  </div>

  <component
    :is="leafComponent"
    v-else-if="leafComponent"
    v-show="!childHidden"
    :style="blockStyle"
    v-bind="leafProps"
    @update:value="emitValue"
    @update:var="emitVar"
  />

  <!-- Sidebar tabs and panels: position:fixed on mobile, display:none on desktop.
       Rendered as sibling roots — no DOM parent needed. -->
  <template v-if="block.type === 'HORIZONTAL_LIST' && !collapsed && !childHidden">
    <template v-for="entry in leftBarChildren" :key="'left-bar-' + entry.index">
      <button
        class="left-bar-tab"
        type="button"
        :style="{ top: leftBarTop(entry.leftBarIndex) }"
        @click="openLeftBar(entry.index)"
        @pointerdown="startLeftBarDrag($event, entry.index)"
      >
        {{ entry.column.left_bar?.title || 'Раздел' }}
      </button>
      <div
        v-if="openLeftBarIndex === entry.index"
        class="left-bar-backdrop"
        @click="closeLeftBar"
      ></div>
      <aside
        class="left-bar-panel"
        :class="{ open: openLeftBarIndex === entry.index }"
        @pointerdown="startPanelDrag"
      >
        <div class="left-bar-panel-head">
          <span>{{ entry.column.left_bar?.title || 'Раздел' }}</span>
        </div>
        <TemplateBlockInner
          :block="entry.child"
          :values="values"
          :vars="vars"
          @update:value="emitValue"
          @update:var="emitVar"
        />
      </aside>
    </template>

    <template v-for="entry in rightBarChildren" :key="'right-bar-' + entry.index">
      <button
        class="right-bar-tab"
        type="button"
        :style="{ top: rightBarTop(entry.rightBarIndex) }"
        @click="openRightBar(entry.index)"
        @pointerdown="startRightBarDrag($event, entry.index)"
      >
        {{ entry.column.right_bar?.title || 'Раздел' }}
      </button>
      <div
        v-if="openRightBarIndex === entry.index"
        class="right-bar-backdrop"
        @click="closeRightBar"
      ></div>
      <aside
        class="right-bar-panel"
        :class="{ open: openRightBarIndex === entry.index }"
        @pointerdown="startRightPanelDrag"
      >
        <div class="right-bar-panel-head">
          <span>{{ entry.column.right_bar?.title || 'Раздел' }}</span>
        </div>
        <TemplateBlockInner
          :block="entry.child"
          :values="values"
          :vars="vars"
          @update:value="emitValue"
          @update:var="emitVar"
        />
      </aside>
    </template>
  </template>
</template>

<script>
// Module-level sidebar registry — shared across all TemplateBlockInner instances
// so sidebar tabs from different HORIZONTAL_LISTs stack correctly in fixed position.
let barNextId = 1
const leftBarRegistry = []
const leftBarSubscribers = new Set()
const rightBarRegistry = []
const rightBarSubscribers = new Set()

function notifyBarSubscribers(subscribers) {
  for (const fn of subscribers) fn()
}
function setBarRegistryEntry(registry, subscribers, id, count) {
  const idx = registry.findIndex(e => e.id === id)
  if (count <= 0) {
    if (idx >= 0) registry.splice(idx, 1)
  } else if (idx >= 0) {
    registry[idx].count = count
  } else {
    registry.push({ id, count })
  }
  notifyBarSubscribers(subscribers)
}
function removeBarRegistryEntry(registry, subscribers, id) {
  const idx = registry.findIndex(e => e.id === id)
  if (idx >= 0) registry.splice(idx, 1)
  notifyBarSubscribers(subscribers)
}
function getBarStartIndex(registry, id) {
  let start = 0
  for (const entry of registry) {
    if (entry.id === id) return start
    start += entry.count
  }
  return start
}

export default { name: 'TemplateBlockInner' }
</script>

<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import { SectionLabel } from '@sylvieshare/share-ui'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { BLOCK_REGISTRY } from '@/features/character-editor/blocks/blockRegistry'

const props = defineProps(['block', 'values', 'vars', 'colStyle'])
const emit = defineEmits(['update:value', 'update:var'])
const charCtx = inject('charCtx', { ownerMode: false })

// ─── Reactive state ────────────────────────────────────────────────────────
const openLeftBarIndex  = ref(null)
const openRightBarIndex = ref(null)
const leftBarStartIndex  = ref(0)
const rightBarStartIndex = ref(0)
const sideBarBaseTop = ref(150)
const childHidden = ref(false)
const collapsed   = ref(false)

// Non-reactive per-instance handles
const barRegistryId = barNextId++
let dragStartX = null, draggingLeftBarIndex = null, draggingRightBarIndex = null
let panelDragStartX = null, rightPanelDragStartX = null
let sideBarFrame = null, sideBarResizeObserver = null
let leftBarSubscriber = null, rightBarSubscriber = null

provide('setBlockHidden', value => { childHidden.value = value })

function emitValue(idOrPatch, value) {
  if (
    arguments.length === 1 &&
    idOrPatch &&
    typeof idOrPatch === 'object' &&
    Object.prototype.hasOwnProperty.call(idOrPatch, 'id')
  ) {
    emit('update:value', idOrPatch)
    return
  }
  emit('update:value', { id: idOrPatch, value })
}

function emitVar(patch) {
  emit('update:var', patch)
}

// ─── Layout helpers ────────────────────────────────────────────────────────
function columnConfig(i) {
  return props.block.content?.columns?.[i] || {}
}
function placementConfig(child, i) {
  return { ...columnConfig(i), ...(child.props || {}) }
}
function columnStyle(column) {
  const columnsFill = props.block.type === 'HORIZONTAL_LIST' && props.block.content?.columns_fill
  const width = column?.width
  return {
    width,
    height:     column?.height,
    maxWidth:   column?.['max-width'],
    minWidth:   column?.['min-width'] ?? 0,
    maxHeight:  column?.['max-height'],
    minHeight:  column?.['min-height'],
    flexGrow:   column?.grow ?? (columnsFill ? 1 : undefined),
    flexShrink: column?.shrink,
    flexBasis:  column?.basis ?? (columnsFill && !width ? 0 : undefined),
    alignSelf:  column?.['align-self'],
  }
}
function leftBarTop(i)  { return `${sideBarBaseTop.value + (leftBarStartIndex.value  + i) * 108}px` }
function rightBarTop(i) { return `${sideBarBaseTop.value + (rightBarStartIndex.value + i) * 108}px` }

// ─── Computeds ─────────────────────────────────────────────────────────────
const blockStyle = computed(() => {
  const p = props.block.props || {}
  const customStyle = p.style
  const own = {
    width:      p.width,
    height:     p.height,
    maxWidth:   p['max-width'],
    minWidth:   p['min-width'],
    maxHeight:  p['max-height'],
    minHeight:  p['min-height'],
    flexGrow:   p.grow,
    flexShrink: p.shrink,
    flexBasis:  p.basis,
    alignSelf:  p['align-self'],
  }
  return [props.colStyle, own, customStyle].filter(Boolean)
})

const visibleHorizontalChildren = computed(() =>
  (props.block.blocks || [])
    .map((child, index) => ({ child, index, column: placementConfig(child, index) }))
    .filter(e => !e.column?.left_bar && !e.column?.right_bar)
)

const leftBarChildren = computed(() => {
  let i = 0
  return (props.block.blocks || [])
    .map((child, index) => ({ child, index, column: placementConfig(child, index) }))
    .filter(e => e.column?.left_bar)
    .map(e => ({ ...e, leftBarIndex: i++ }))
})

const rightBarChildren = computed(() => {
  let i = 0
  return (props.block.blocks || [])
    .map((child, index) => ({ child, index, column: placementConfig(child, index) }))
    .filter(e => e.column?.right_bar)
    .map(e => ({ ...e, rightBarIndex: i++ }))
})

const horizontalStyle = computed(() => ({
  gap:            props.block.content?.gap,
  justifyContent: props.block.content?.justifyContent ?? props.block.content?.['justify-content'],
  alignItems:     props.block.content?.alignItems     ?? props.block.content?.['align-items'],
  width:          props.block.content?.fill ? '100%'  : props.block.content?.width,
}))

const leafComponent = computed(() => BLOCK_REGISTRY[props.block.type]?.component || null)

const statValue = computed(() => {
  const stored = props.values?.[props.block.id]
  const skillCount = props.block.content?.list?.length ?? 0
  return { value: 10, save_up: false, skills_up: Array(skillCount).fill(0), ...stored }
})

const leafProps = computed(() => {
  const reg = BLOCK_REGISTRY[props.block.type]
  if (!reg) return {}
  const p = { block: props.block }
  if (!reg.noValue) {
    p.value = reg.noValuePreset
      ? props.values?.[props.block.id]
      : (props.block.type === 'DND_CHAR_STAT_10'
          ? statValue.value
          : (props.values?.[props.block.id] ?? props.block.preset))
  }
  if (reg.passValues)     { p.values = props.values; p.vars = props.vars }
  else if (reg.passValuesOnly) { p.values = props.values }
  return p
})

// ─── Bar registry ──────────────────────────────────────────────────────────
function updateBarRegistries() {
  setBarRegistryEntry(leftBarRegistry,  leftBarSubscribers,  barRegistryId, leftBarChildren.value.length)
  setBarRegistryEntry(rightBarRegistry, rightBarSubscribers, barRegistryId, rightBarChildren.value.length)
}
watch(leftBarChildren,  updateBarRegistries)
watch(rightBarChildren, updateBarRegistries)

// ─── Sidebar position ──────────────────────────────────────────────────────
function updateSideBarBaseTop() {
  const toolbar = document.querySelector('.toolbar')
  sideBarBaseTop.value = Math.max(86, Math.round((toolbar?.getBoundingClientRect().bottom ?? 0) + 54))
}
function scheduleSideBarBaseTopUpdate() {
  if (sideBarFrame) return
  sideBarFrame = requestAnimationFrame(() => { sideBarFrame = null; updateSideBarBaseTop() })
}
function observeToolbarForSideBars() {
  sideBarResizeObserver?.disconnect()
  const toolbar = document.querySelector('.toolbar')
  if (!toolbar || typeof ResizeObserver === 'undefined') return
  sideBarResizeObserver = new ResizeObserver(scheduleSideBarBaseTopUpdate)
  sideBarResizeObserver.observe(toolbar)
}

// ─── Open/close ────────────────────────────────────────────────────────────
function openLeftBar(index)  { openLeftBarIndex.value  = index }
function closeLeftBar()      { openLeftBarIndex.value  = null  }
function openRightBar(index) { openRightBarIndex.value = index }
function closeRightBar()     { openRightBarIndex.value = null  }

// ─── Drag ──────────────────────────────────────────────────────────────────
function onLeftBarDrag(e) {
  if (dragStartX == null) return
  if (e.clientX - dragStartX > 28) openLeftBar(draggingLeftBarIndex)
}
function stopLeftBarDrag() {
  dragStartX = null; draggingLeftBarIndex = null
  window.removeEventListener('pointermove', onLeftBarDrag)
  window.removeEventListener('pointerup',   stopLeftBarDrag)
}
function startLeftBarDrag(e, index) {
  dragStartX = e.clientX; draggingLeftBarIndex = index
  window.addEventListener('pointermove', onLeftBarDrag)
  window.addEventListener('pointerup',   stopLeftBarDrag)
}

function onRightBarDrag(e) {
  if (dragStartX == null) return
  if (dragStartX - e.clientX > 28) openRightBar(draggingRightBarIndex)
}
function stopRightBarDrag() {
  dragStartX = null; draggingRightBarIndex = null
  window.removeEventListener('pointermove', onRightBarDrag)
  window.removeEventListener('pointerup',   stopRightBarDrag)
}
function startRightBarDrag(e, index) {
  dragStartX = e.clientX; draggingRightBarIndex = index
  window.addEventListener('pointermove', onRightBarDrag)
  window.addEventListener('pointerup',   stopRightBarDrag)
}

function onPanelDrag(e) {
  if (panelDragStartX == null) return
  if (panelDragStartX - e.clientX > 42) closeLeftBar()
}
function stopPanelDrag() {
  panelDragStartX = null
  window.removeEventListener('pointermove', onPanelDrag)
  window.removeEventListener('pointerup',   stopPanelDrag)
}
function startPanelDrag(e) {
  panelDragStartX = e.clientX
  window.addEventListener('pointermove', onPanelDrag)
  window.addEventListener('pointerup',   stopPanelDrag)
}

function onRightPanelDrag(e) {
  if (rightPanelDragStartX == null) return
  if (e.clientX - rightPanelDragStartX > 42) closeRightBar()
}
function stopRightPanelDrag() {
  rightPanelDragStartX = null
  window.removeEventListener('pointermove', onRightPanelDrag)
  window.removeEventListener('pointerup',   stopRightPanelDrag)
}
function startRightPanelDrag(e) {
  rightPanelDragStartX = e.clientX
  window.addEventListener('pointermove', onRightPanelDrag)
  window.addEventListener('pointerup',   stopRightPanelDrag)
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(() => {
  leftBarSubscriber  = () => { leftBarStartIndex.value  = getBarStartIndex(leftBarRegistry,  barRegistryId) }
  rightBarSubscriber = () => { rightBarStartIndex.value = getBarStartIndex(rightBarRegistry, barRegistryId) }
  leftBarSubscribers.add(leftBarSubscriber)
  rightBarSubscribers.add(rightBarSubscriber)
  updateBarRegistries()

  window.addEventListener('scroll', scheduleSideBarBaseTopUpdate, { passive: true })
  window.addEventListener('resize', scheduleSideBarBaseTopUpdate)
  nextTick(() => {
    updateSideBarBaseTop()
    observeToolbarForSideBars()
    requestAnimationFrame(scheduleSideBarBaseTopUpdate)
  })
})

onBeforeUnmount(() => {
  stopLeftBarDrag(); stopPanelDrag()
  stopRightBarDrag(); stopRightPanelDrag()
  leftBarSubscribers.delete(leftBarSubscriber)
  rightBarSubscribers.delete(rightBarSubscriber)
  removeBarRegistryEntry(leftBarRegistry,  leftBarSubscribers,  barRegistryId)
  removeBarRegistryEntry(rightBarRegistry, rightBarSubscribers, barRegistryId)
  window.removeEventListener('scroll', scheduleSideBarBaseTopUpdate)
  window.removeEventListener('resize', scheduleSideBarBaseTopUpdate)
  sideBarResizeObserver?.disconnect()
  if (sideBarFrame) cancelAnimationFrame(sideBarFrame)
})
</script>

<style scoped src="./styles/TemplateBlockInner.css"></style>
