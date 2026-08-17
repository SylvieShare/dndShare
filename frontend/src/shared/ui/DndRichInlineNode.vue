<template>
  <button
    v-if="node.kind === 'dice'"
    type="button"
    class="rich-node rich-node--dice"
    :title="average == null ? `Бросить ${formula}` : `Бросить ${formula} · среднее ${average}`"
    @click="roll"
  >
    <span v-if="average != null" class="rich-node-average">{{ average }}</span>
    <span v-if="average != null" class="rich-node-divider" aria-hidden="true" />
    <template v-for="(part, index) in diceParts" :key="index">
      <span v-if="index" class="rich-node-sign">{{ part.sign }}</span>
      <span v-if="part.kind === 'dice'" class="rich-node-die">
        <span v-if="part.n > 1">{{ part.n }}×</span><SystemDie :sides="part.sides" :size="27" />
      </span>
      <span v-else>{{ part.value }}</span>
    </template>
    <span v-if="!diceParts.length">{{ node.label }}</span>
  </button>

  <button
    v-else-if="node.kind === 'item'"
    ref="anchorEl"
    type="button"
    class="rich-node rich-node--item"
    :title="item ? `Открыть ${item.name}` : node.label"
    @mouseenter="showItemTooltip"
    @mouseleave="tooltipOpen = false"
    @focus="showItemTooltip"
    @blur="tooltipOpen = false"
    @click="itemModalOpen = true"
  >
    <span aria-hidden="true">◫</span>{{ item?.name || node.label }}
  </button>

  <button
    v-else-if="node.kind === 'suggest'"
    ref="anchorEl"
    type="button"
    class="rich-node rich-node--suggest"
    :style="suggest?.color ? { '--rich-node-color': suggest.color } : null"
    :aria-expanded="suggestOpen"
    @click="suggestOpen = !suggestOpen"
  >
    <span aria-hidden="true">◆</span>{{ suggest?.value || node.label }}
  </button>

  <span v-else class="rich-node rich-node--unknown">{{ node.label }}</span>

  <ItemTooltip
    v-if="node.kind === 'item' && tooltipOpen && item"
    :title="item.name"
    :desc="itemDescription"
    :x="tooltipPosition.x"
    :top="tooltipPosition.top"
    :bottom="tooltipPosition.bottom"
    :max-desc="240"
  />

  <ItemViewModal
    v-if="node.kind === 'item' && itemModalOpen && item"
    :item="item"
    :item-id="item.id"
    :item-type-id="item.typeId"
    :actor-name="actorName"
    @close="itemModalOpen = false"
  />

  <BasePopover
    v-if="node.kind === 'suggest'"
    :open="suggestOpen"
    :anchor="anchorEl"
    :min-width="220"
    :z-index="4300"
    @update:open="suggestOpen = $event"
  >
    <div class="rich-suggest-popover">
      <strong>{{ suggest?.value || node.label }}</strong>
      <RichContent v-if="suggest?.desc" :html="suggest.desc" />
      <span v-else class="rich-suggest-empty">Описание не добавлено</span>
    </div>
  </BasePopover>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { BasePopover, RichContent } from '@sylvieshare/share-ui'
import { itemsApi } from '@/shared/api/itemsApi'
import { parseDiceExpression } from '@/shared/lib/dice'
import { useDiceStore } from '@/stores/dice'
import { useSuggestStore } from '@/stores/suggest'
import SystemDie from '@/shared/ui/SystemDie.vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'

const itemCache = new Map()
const props = defineProps({
  node: { type: Object, required: true },
  actorName: { type: String, default: '' },
})

const anchorEl = ref(null)
const item = ref(null)
const tooltipOpen = ref(false)
const itemModalOpen = ref(false)
const suggestOpen = ref(false)
const tooltipPosition = ref({ x: 0, top: null, bottom: null })
const suggestStore = useSuggestStore()
const diceStore = useDiceStore()

const formula = computed(() => String(props.node.payload?.formula || ''))
const average = computed(() => {
  const raw = props.node.payload?.average
  if (raw == null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
})
const diceParts = computed(() => parseDiceExpression(formula.value))
const suggest = computed(() => suggestStore.items(Number(props.node.payload?.typeId))
  ?.find(entry => Number(entry.id) === Number(props.node.payload?.id)) || null)
const itemDescription = computed(() => firstRichDescription(item.value?.data))

function firstRichDescription(value) {
  if (!value || typeof value !== 'object') return ''
  for (const key of ['description', 'desc', 'value', 'note']) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate
  }
  for (const candidate of Object.values(value)) {
    if (Array.isArray(candidate)) {
      for (const row of candidate) {
        const found = firstRichDescription(row)
        if (found) return found
      }
    } else if (candidate && typeof candidate === 'object') {
      const found = firstRichDescription(candidate)
      if (found) return found
    }
  }
  return ''
}

async function loadReference() {
  if (props.node.kind === 'item') {
    const id = Number(props.node.payload?.id)
    if (!Number.isFinite(id)) return
    if (itemCache.has(id)) {
      item.value = itemCache.get(id)
      return
    }
    const response = await itemsApi.byIds([id]).catch(() => null)
    item.value = response?.items?.[0] || null
    if (item.value) itemCache.set(id, item.value)
  }
  if (props.node.kind === 'suggest') {
    await suggestStore.ensureItems(Number(props.node.payload?.typeId), [Number(props.node.payload?.id)]).catch(() => {})
  }
}

function roll() {
  if (!diceParts.value.length) return
  diceStore.roll(props.node.payload?.label || props.node.label || formula.value, formula.value, {
    actor: props.actorName ? { name: props.actorName, charUuid: null } : undefined,
  })
}

function showItemTooltip() {
  const rect = anchorEl.value?.getBoundingClientRect()
  if (!rect) return
  const opensAbove = window.innerHeight - rect.bottom < 220 && rect.top > 220
  tooltipPosition.value = opensAbove
    ? { x: rect.left, top: null, bottom: window.innerHeight - rect.top + 6 }
    : { x: rect.left, top: rect.bottom + 6, bottom: null }
  tooltipOpen.value = true
}

watch(() => [props.node.kind, props.node.payload?.id, props.node.payload?.typeId], loadReference, { immediate: true })
</script>

<style scoped>
.rich-node {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  margin: 0 1px;
  padding: 1px 5px;
  border: 1px solid color-mix(in srgb, var(--rich-node-color, var(--accent)) 42%, var(--border));
  border-radius: 5px;
  background: color-mix(in srgb, var(--rich-node-color, var(--accent)) 10%, var(--surface-raised));
  color: var(--text-1);
  font: inherit;
  line-height: 1.35;
  vertical-align: baseline;
}

button.rich-node { cursor: pointer; transition: background .12s, border-color .12s, transform .08s; }
button.rich-node:hover { border-color: var(--rich-node-color, var(--accent)); background: color-mix(in srgb, var(--rich-node-color, var(--accent)) 17%, var(--surface-raised)); }
button.rich-node:active { transform: scale(.97); }
.rich-node--dice {
  gap: 5px;
  padding: 2px 7px;
  border-radius: 8px;
  color: var(--accent-soft);
  font-size: 1.05em;
  font-weight: 700;
  line-height: 1;
  vertical-align: middle;
}
.rich-node-die { display: inline-flex; align-items: center; gap: 1px; }
.rich-node-average { color: var(--text-1); font-size: 1.08em; font-weight: 800; }
.rich-node-divider { align-self: stretch; width: 1px; margin: 2px 1px; background: color-mix(in srgb, var(--accent) 38%, var(--border)); }
.rich-node-sign { color: var(--text-muted); }
.rich-node--unknown { color: var(--text-muted); }
.rich-suggest-popover { display: flex; flex-direction: column; gap: 6px; max-width: 340px; color: var(--text-2); font-size: 12px; }
.rich-suggest-popover strong { color: var(--text-1); font-size: 13px; }
.rich-suggest-empty { color: var(--text-muted); }
</style>
