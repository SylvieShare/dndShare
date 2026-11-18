<template>
  <div v-if="items.length || showAddAction" class="dsov" :class="{ 'dsov--icons-only': iconsOnly, 'dsov--header': header, 'dsov--wrap': wrap }" :style="iconsOnly ? { '--status-icon-size': `${iconSize}px` } : header ? { '--status-header-icon-size': `${headerIconSize}px` } : null">
    <div ref="row" class="dsov-row" :class="{ 'dsov-row--scrollable': rowOverflows === true, 'dsov-row--fits': rowOverflows === false }" :data-sheet-horizontal-scroll="wrap ? undefined : ''">
      <RowActionMenu
        v-for="item in items"
        :key="item.id"
        :title="`Действия: ${item.value}`"
        follow-anchor
        :trigger-attrs="{style:{maxWidth:'100%'}}"
      >
        <template #trigger="{ open }">
          <button
            class="dsov-effect action-menu-source"
            :class="{ 'action-menu-source--open': open }"
            :data-polarity="item.polarity === 'positive' ? 'positive' : item.polarity === 'negative' ? 'negative' : 'neutral'"
            type="button"
            :aria-label="iconsOnly || header ? item.value : undefined"
            :aria-description="[statusPolarity(item.polarity).label, item.duration ? `Длительность: ${item.duration}` : '', item.level > 1 ? `Уровень ${item.level}` : ''].filter(Boolean).join(' · ')"
            @click="$emit('hide-tooltip')"
            @mouseenter="$emit('show-tooltip', $event, item)"
            @mouseleave="$emit('hide-tooltip')"
            @focus="$emit('show-tooltip', $event, item)"
            @blur="$emit('hide-tooltip')"
          >
            <span class="dsov-icon">
              <ItemIcon
                v-if="statusIconItem(item, failedIcons.has(item.id))"
                class="dsov-item-icon"
                :item="statusIconItem(item, failedIcons.has(item.id))"
                @error.capture="failedIcons.add(item.id)"
                :fallback-to-type="false"
                :size="header ? headerIconSize : iconSize"
              />
              <BatteryLow v-else-if="item.kind === 'exhaustion'" :size="header ? headerIconSize : 38" :stroke-width="1.7" aria-hidden="true" />
              <Sparkles v-else-if="item.kind === 'inspiration'" :size="header ? headerIconSize : 40" :stroke-width="1.7" aria-hidden="true" />
              <Sparkles v-else-if="iconsOnly || header" :size="header ? headerIconSize : iconSize - 4" aria-hidden="true" />
              <span v-else class="dsov-monogram" aria-hidden="true">{{ monogram(item.value) }}</span>
            </span>

            <span v-if="!iconsOnly" class="dsov-copy">
              <span class="dsov-heading">
                <span class="dsov-name" :title="item.value">{{ item.value }}</span>
                <span v-if="item.level > 1" class="dsov-level" aria-hidden="true">x{{ item.level }}</span>
              </span>
              <span v-if="item.duration" class="dsov-duration" :title="`Длительность: ${item.duration}`">
                <Hourglass :size="12" aria-hidden="true" />{{ item.duration }}
              </span>
              <span v-if="!header && item.thesis" class="dsov-thesis">{{ item.thesis }}</span>
            </span>
          </button>
        </template>

        <template #default="{ close }">
          <StatusMechanicsMenu v-if="editable && item.kind === 'states' && item.item" :uid="item.id" :effect="item.item" :context="context" />
          <CharacterMenuActions :view="item.item ? () => select(item, close, 'view') : undefined" view-label="Посмотреть"
            :edit="editable && item.kind === 'states' ? () => select(item, close, 'edit-duration') : undefined" edit-label="Изменить длительность"
            :remove="editable ? () => select(item, close, 'remove') : undefined" remove-label="Убрать" />
          <RowActionItem
            v-if="editable && item.adjustableLevel && (!item.maxLevel || item.level < item.maxLevel)"
            :icon="Plus"
            @click="select(item, close, 'increase-level')"
          >
            Повысить уровень
          </RowActionItem>
          <RowActionItem
            v-if="editable && item.adjustableLevel && item.level > 1"
            :icon="Minus"
            @click="select(item, close, 'decrease-level')"
          >
            Понизить уровень
          </RowActionItem>
        </template>
      </RowActionMenu>

      <button v-if="showAddAction" class="dsov-add" type="button" :aria-label="header ? 'Добавить состояние' : undefined" :disabled="!editable" @click.stop="$emit('add')">
        <Plus :size="15" :stroke-width="1.8" aria-hidden="true" />
        <span>Состояние</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import CharacterMenuActions from '@/features/character-editor/components/CharacterMenuActions.vue'
import StatusMechanicsMenu from './StatusMechanicsMenu.vue'
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { BatteryLow, Hourglass, Minus, Plus, Sparkles } from '@lucide/vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { statusIconItem } from '../../../lib/statusIcon'
import { statusPolarity } from '@/features/items/lib/statusEffectPresentation'
import { layoutTokens } from '@/app/design-tokens'
const failedIcons=reactive(new Set())

const props = defineProps({
  items: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  showAddAction: { type: Boolean, default: false },
  iconsOnly: { type: Boolean, default: false },
  iconSize: { type: Number, default: 64 },
  context: { type: Object, default: null },
  header: Boolean,
  wrap: Boolean,
})
const headerIconSize = layoutTokens['sheet-header-status-icon']
const emit = defineEmits(['add', 'view', 'remove', 'edit-duration', 'increase-level', 'decrease-level', 'show-tooltip', 'hide-tooltip'])
const row = ref(null), rowOverflows = ref(null)
let rowObserver, rowMeasureFrame
function measureOverflow() {
  rowOverflows.value = props.header && !props.wrap && row.value ? row.value.scrollWidth > row.value.clientWidth + 1 : null
}
function scheduleOverflowMeasure() {
  cancelAnimationFrame(rowMeasureFrame)
  rowMeasureFrame = requestAnimationFrame(measureOverflow)
}
function observeRow() {
  rowObserver?.disconnect()
  cancelAnimationFrame(rowMeasureFrame)
  if (!rowObserver || !props.header || props.wrap || !row.value) { rowOverflows.value = null; return }
  rowObserver.observe(row.value)
  for (const item of row.value.children) rowObserver.observe(item)
  measureOverflow()
}
onMounted(() => { rowObserver = new ResizeObserver(scheduleOverflowMeasure); observeRow() })
watch([row, () => props.header, () => props.wrap, () => props.items, () => props.showAddAction], observeRow, { flush: 'post' })
onBeforeUnmount(() => { rowObserver?.disconnect(); cancelAnimationFrame(rowMeasureFrame) })

function select(item, close, action) {
  close()
  emit(action, item)
}

function monogram(value) {
  return String(value || '?').trim().slice(0, 1).toUpperCase() || '?'
}
</script>

<style scoped>
.dsov.dsov--header {padding:0;gap:var(--spacing-small)}
.dsov--header .dsov-row {gap:var(--spacing-small);flex-wrap:nowrap;max-width:100%;box-sizing:border-box;padding-block:0;padding-inline:var(--status-scroll-inset-start,0px) var(--status-scroll-inset-end,0px);margin-block:0;overscroll-behavior-x:contain}
.dsov--header .dsov-row > * {flex:none}
.dsov--header .dsov-row--fits {overflow:visible}
.dsov--header .dsov-effect {width:auto;max-width:100%;flex:0 0 auto;grid-template-columns:var(--status-header-icon-size,var(--layout-sheet-header-status-icon)) minmax(0,1fr);gap:calc(var(--spacing-xs) / 2);min-height:var(--status-header-icon-size,var(--layout-sheet-header-status-icon));padding:0 calc(var(--spacing-large) + var(--spacing-xs)) 0 var(--spacing-medium);border-radius:var(--radius-tile)}
.dsov--header .dsov-icon {width:var(--status-header-icon-size,var(--layout-sheet-header-status-icon));height:var(--status-header-icon-size,var(--layout-sheet-header-status-icon));min-width:var(--status-header-icon-size,var(--layout-sheet-header-status-icon))}
.dsov--header .dsov-item-icon {width:var(--status-header-icon-size,var(--layout-sheet-header-status-icon));height:var(--status-header-icon-size,var(--layout-sheet-header-status-icon))}
.dsov--header .dsov-icon :deep(img), .dsov--header .dsov-icon :deep(svg) {width:100%;height:100%}
.dsov--header .dsov-copy {gap:calc(var(--spacing-xs) / 2)}
.dsov--header .dsov-name {font-size:var(--type-group-size);line-height:var(--type-group-line-height)}
.dsov--header .dsov-duration {font-size:var(--type-context-size);line-height:var(--type-context-line-height)}
.dsov--header .dsov-add {width:auto;height:var(--layout-touch-min);padding-inline:var(--spacing-small);font-size:var(--type-group-size);white-space:nowrap}
.dsov--header {flex-wrap:nowrap}
.dsov--header.dsov--wrap .dsov-row {flex:1;flex-wrap:wrap;align-items:flex-start;overflow:visible}
.dsov--wrap .dsov-name {white-space:normal;overflow-wrap:anywhere}
.dsov-add:disabled {opacity:.45;cursor:not-allowed}
.dsov { display: flex; min-width: 0; align-items: center; gap: 13px; padding: 0 0 15px 15px; }
.dsov-row {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  align-items: center;
  gap: 13px;
  overflow-x: auto;
  scrollbar-width: none;
}
.dsov-row::-webkit-scrollbar { display: none; }
.dsov-effect {
  --status-tone: var(--info);
  --status-background: color-mix(in srgb, var(--status-tone) 24%, var(--surface));
  --status-secondary: color-mix(in srgb, var(--text-1) 85%, var(--surface));
  --action-menu-source-background: transparent;
  --status-paper: url('@/assets/ui/status-parchment.webp');
  position: relative;
  isolation: isolate;
  display: grid;
  width: 300px;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 0;
  flex: 0 0 300px;
  padding: 0 calc(var(--spacing-large) + var(--spacing-xs)) 0 var(--spacing-medium);
  border: 0;
  border-radius: var(--radius-row);
  background: transparent;
  color: var(--text-1);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.14s;
}
.dsov-effect[data-polarity="positive"] { --status-tone:var(--success); }
.dsov-effect[data-polarity="negative"] { --status-tone:var(--danger); }
.dsov-effect::before,
.dsov-effect::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}
.dsov-effect::before {
  background: var(--status-background);
  -webkit-mask: var(--status-paper) center / 100% 100% no-repeat;
  mask: var(--status-paper) center / 100% 100% no-repeat;
  transition: background-color 140ms ease;
}
.dsov-effect::after {
  background: var(--status-paper) center / 100% 100% no-repeat;
  mix-blend-mode: luminosity;
  opacity: .24;
}
.dsov-effect.action-menu-source--open {
  --status-background: color-mix(in srgb, var(--status-tone) 32%, var(--surface));
  outline: none;
}
.dsov-effect:focus-visible {
  outline: 2px solid var(--accent-soft);
  outline-offset: 2px;
}
.dsov--header .dsov-effect:focus-visible {outline-offset:-2px}
.dsov-icon {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.dsov-item-icon { width: 64px; height: 64px; }
.dsov--icons-only { padding: 0; gap: 4px; }
.dsov--icons-only .dsov-row { flex: 1; gap: 4px; height: calc(var(--status-icon-size) + 4px); overflow-y: hidden; }
.dsov--icons-only .dsov-effect { width: var(--status-icon-size); height: var(--status-icon-size); flex-basis: var(--status-icon-size); grid-template-columns: var(--status-icon-size); padding: 0; }
.dsov--icons-only .dsov-icon, .dsov--icons-only .dsov-item-icon { width: var(--status-icon-size); height: var(--status-icon-size); }
.dsov-item-icon :deep(img),
.dsov-item-icon :deep(svg) { width: 100%; height: 100%; object-fit: cover; }
.dsov-monogram { font-size: 24px; font-weight: 800; }
.dsov-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}
.dsov-heading { display: flex; min-width: 0; align-items: baseline; gap: var(--spacing-xs); }
.dsov-duration { display: flex; align-items: center; gap: 4px; color: var(--status-secondary); font-size: 10px; line-height: 1.3; overflow-wrap: anywhere; }
.dsov-duration svg { flex-shrink: 0; }
.dsov-name { min-width: 0; overflow: hidden; font-size: 11px; font-weight: 750; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
.dsov-level {
  flex: none;
  color: var(--accent-soft);
  font-size: var(--type-context-size);
  font-weight: 700;
  line-height: var(--type-context-line-height);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.dsov-thesis {
  color: var(--status-secondary);
  font-size: 9px;
  line-height: 1.35;
  white-space: pre-line;
}
.dsov-add {
  display: inline-flex;
  width: 92px;
  height: 64px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex: 0 0 auto;
  padding: 0 9px;
  border: 1px dashed color-mix(in srgb, var(--text-muted) 58%, transparent);
  border-radius: 9px;
  background: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 10px;
  font-weight: 650;
  cursor: pointer;
}

@media (hover: hover) {
  .dsov-effect:hover { transform: translateY(-1px); }
  .dsov--header .dsov-effect:hover { transform: none; }
  .dsov-add:hover { border-color: var(--text-muted); color: var(--text-2); }
}
@media (prefers-reduced-motion: reduce) {
  .dsov-effect, .dsov-effect::before { transition: none; }
}
</style>
