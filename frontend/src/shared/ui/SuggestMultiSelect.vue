<template>
  <Teleport to="body">
    <div class="sms-backdrop" @click="emit('close')" @touchstart.passive="emit('close')"></div>
    <div class="sms-panel" ref="panel" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
      <div class="sms-header">
        <span class="sms-title">{{ title }}</span>
        <button class="sms-add-btn" title="Добавить вариант" @click="createOpen = true">
          <span class="sms-plus"><span class="sms-plus-h"></span><span class="sms-plus-v"></span></span>
        </button>
        <button class="sms-close-btn" @click="emit('close')">×</button>
      </div>

      <div class="sms-list">
        <div
          v-for="item in items"
          :key="item.id"
          class="sms-item"
          :class="{ 'sms-item-on': activeIds.includes(item.id) }"
          :style="{ '--c': item.color || 'var(--text-muted)' }"
          @click="emit('toggle', item.id)"
        >
          <div class="sms-icon">
            <SvgIcon v-if="item.svg" class="sms-svg-img" :svg="item.svg" :color="item.color || '#888888'" filter />
            <span v-else class="sms-dot"></span>
          </div>
          <span class="sms-name">{{ item.value }}</span>
          <span class="sms-check">✓</span>
          <button
            v-if="item.desc"
            class="sms-info-btn"
            @click.stop="toggleTip($event, item)"
          ><span class="sms-info-btn-inner">?</span></button>
        </div>
        <div v-if="!items.length" class="sms-empty">Нет вариантов</div>
      </div>
    </div>

    <ItemTooltip
      v-if="tip.visible"
      :title="tip.title"
      :desc="tip.desc"
      :x="tip.x"
      :top="tip.top"
      :bottom="tip.bottom"
    />

    <SuggestEditModal
      v-if="createOpen"
      :type-id="suggestTypeId"
      @close="createOpen = false"
      @created="onCreated"
    />
  </Teleport>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import SuggestEditModal from '@/shared/ui/SuggestEditModal'
import SvgIcon from '@/shared/ui/SvgIcon'
import { useSwipeToClose } from '@/shared/lib/useSwipeToClose'

defineProps({
  suggestTypeId: { type: [Number, String], required: true },
  items: { type: Array, default: () => [] },
  activeIds: { type: Array, default: () => [] },
  title: { type: String, default: '' },
})
const emit = defineEmits(['toggle', 'close', 'created'])

const panel = ref(null)
const createOpen = ref(false)
const tip = ref({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })
const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeToClose(panel, () => emit('close'))

onMounted(() => {
  const el = panel.value
  if (!el) return
  el.style.transform = 'translateX(100%)'
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)'
      el.style.transform = 'translateX(0)'
      setTimeout(() => {
        if (el) { el.style.transition = ''; el.style.transform = '' }
      }, 260)
    })
  })
})

function showTip(event, item) {
  if (!item.desc) return
  const rect = event.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 160
  tip.value = {
    visible: true,
    title: item.value,
    desc: item.desc,
    x: Math.max(8, Math.min(rect.left - 380, window.innerWidth - 388)),
    top: above ? null : rect.bottom + 6,
    bottom: above ? window.innerHeight - rect.top + 6 : null,
  }
}

function hideTip() {
  tip.value.visible = false
}

function toggleTip(event, item) {
  if (tip.value.visible) { hideTip(); return }
  showTip(event, item)
}

function onCreated(item) {
  emit('created', item)
}
</script>

<style scoped>
.sms-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3490;
  background: color-mix(in srgb, var(--scrim) 65%, transparent);
  backdrop-filter: blur(4px);
}

.sms-panel {
  position: fixed;
  right: 0;
  bottom: 0;
  z-index: 3500;
  width: 300px;
  max-width: 90vw;
  max-height: 75vh;
  background: var(--popover-bg);
  border-top: 1px solid var(--border-strong);
  border-left: 1px solid var(--border-strong);
  border-radius: 16px 0 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}

.sms-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 12px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.sms-title {
  flex: 1;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--text-muted);
}

.sms-add-btn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px dashed var(--border-strong);
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

@media (hover: hover) { .sms-add-btn:hover { border-color: var(--text-muted); color: var(--text-2); } }

.sms-plus {
  position: relative;
  width: 10px;
  height: 10px;
  display: block;
}

.sms-plus-h,
.sms-plus-v {
  position: absolute;
  background: currentColor;
  border-radius: 1px;
}

.sms-plus-h { width: 10px; height: 2px; top: 4px; left: 0; }
.sms-plus-v { width: 2px; height: 10px; top: 0; left: 4px; }

.sms-close-btn {
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

@media (hover: hover) { .sms-close-btn:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); } }

.sms-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0 16px;
}

.sms-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}

@media (hover: hover) { .sms-item:hover { background: var(--surface-raised); } }
.sms-item-on { background: color-mix(in srgb, var(--surface-raised) 72%, transparent); }

.sms-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sms-svg-img {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.8;
  transition: opacity 0.12s;
}
@media (hover: hover) { .sms-item:hover .sms-svg-img { opacity: 1; } }
.sms-item-on .sms-svg-img { opacity: 1; }

.sms-dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c);
  opacity: 0.6;
  transition: opacity 0.12s;
}

.sms-item-on .sms-dot { opacity: 1; }

.sms-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-2);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.12s;
}

.sms-item-on .sms-name { color: var(--c); font-weight: 600; }

.sms-check {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--c);
  opacity: 0;
  transition: opacity 0.12s;
  line-height: 1;
}

.sms-item-on .sms-check { opacity: 1; }

.sms-info-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: color 0.12s, background 0.12s;
}

.sms-info-btn-inner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

@media (hover: hover) { .sms-info-btn:hover { color: var(--text-2); background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); } }
.sms-item-on .sms-info-btn { color: color-mix(in srgb, var(--c) 50%, var(--text-muted)); }

.sms-empty {
  padding: 20px 14px;
  color: var(--text-muted);
  font-size: 13px;
}

</style>
