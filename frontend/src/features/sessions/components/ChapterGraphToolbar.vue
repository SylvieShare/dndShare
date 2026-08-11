<template>
  <BaseTile class="chapter-toolbar">
    <div class="chapter-toolbar-main">
      <span class="chapter-toolbar-label">АРКА</span>
      <button ref="arcTrigger" type="button" class="chapter-arc-trigger" @click="arcOpen = !arcOpen">
        <span class="chapter-arc-number">{{ romanNumeral(selectedArc?.order) }}</span>
        <span class="chapter-arc-name">{{ selectedArc?.name || 'Выберите арку' }}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <BasePopover v-model:open="arcOpen" :anchor="arcTrigger" :min-width="300">
        <div class="chapter-arc-list">
          <div v-for="arc in arcs" :key="arc.id" class="chapter-arc-row" :class="{ active: arc.id === selectedArc?.id }">
            <button type="button" class="chapter-arc-pick" @click="pickArc(arc.id)">
              <span>{{ romanNumeral(arc.order) }}</span>
              <strong>{{ arc.name }}</strong>
              <small v-if="arc.id === currentArc?.id">текущая глава здесь</small>
            </button>
            <div class="chapter-arc-order-actions">
              <button type="button" title="Выше" :disabled="arc.order === 1" @click.stop="$emit('move-arc', arc.id, -1)">↑</button>
              <button type="button" title="Ниже" :disabled="arc.order === arcs.length" @click.stop="$emit('move-arc', arc.id, 1)">↓</button>
            </div>
          </div>
          <button type="button" class="chapter-arc-create" @click="arcOpen = false; $emit('create-arc')">+ Новая арка</button>
        </div>
      </BasePopover>

      <button type="button" class="chapter-tool-btn chapter-tool-btn--icon" title="Настройки арки" @click="$emit('edit-arc')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 12L4 11.5L11.5 4L10 2.5L2.5 10L2 12Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        </svg>
      </button>
      <button type="button" class="chapter-tool-btn chapter-tool-btn--icon chapter-tool-btn--danger" title="Удалить пустую арку" @click="$emit('delete-arc')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2.5 4h9M5.5 4V2.7c0-.4.3-.7.7-.7h1.6c.4 0 .7.3.7.7V4M4 4l.5 7.5c0 .4.3.7.7.7h3.6c.4 0 .7-.3.7-.7L10 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <span class="chapter-toolbar-rule" />
      <button type="button" class="chapter-tool-btn chapter-tool-btn--primary" @click="$emit('create-chapter')">+ Глава</button>
    </div>

    <div class="chapter-toolbar-view">
      <button type="button" class="chapter-tool-btn" :disabled="!currentArc" @click="$emit('focus-current')">К текущей главе</button>
      <div class="chapter-zoom">
        <button type="button" aria-label="Уменьшить" @click="$emit('zoom', 0.84)">−</button>
        <span>{{ Math.round(zoom * 100) }}%</span>
        <button type="button" aria-label="Увеличить" @click="$emit('zoom', 1.19)">+</button>
      </div>
    </div>
  </BaseTile>
</template>

<script setup>
import { ref } from 'vue'
import BasePopover from '@/shared/ui/BasePopover.vue'
import BaseTile from '@/shared/ui/BaseTile.vue'
import { romanNumeral } from '@/features/sessions/lib/chapterGraph'

defineProps({
  arcs: { type: Array, default: () => [] },
  selectedArc: { type: Object, default: null },
  currentArc: { type: Object, default: null },
  zoom: { type: Number, default: 1 },
})
const emit = defineEmits([
  'select-arc', 'create-arc', 'edit-arc', 'delete-arc', 'move-arc',
  'create-chapter', 'focus-current', 'zoom',
])
const arcTrigger = ref(null)
const arcOpen = ref(false)

function pickArc(id) {
  arcOpen.value = false
  emit('select-arc', id)
}
</script>

<style scoped>
.chapter-toolbar {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
  padding: 11px 14px;
}
.chapter-toolbar-main,
.chapter-toolbar-view { display: flex; align-items: center; gap: 7px; min-width: 0; }
.chapter-toolbar-view { margin-left: auto; }
.chapter-toolbar-label { color: var(--text-muted); font-size: 10px; font-weight: 800; letter-spacing: 0.1em; }
.chapter-toolbar-rule { width: 1px; height: 22px; margin: 0 3px; background: var(--border-strong); }

.chapter-arc-trigger,
.chapter-tool-btn,
.chapter-zoom {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  color: var(--text-2);
  font: inherit;
  font-size: 12px;
}
.chapter-arc-trigger { min-width: 230px; max-width: 330px; padding: 6px 9px; cursor: pointer; }
.chapter-arc-number { display: grid; min-width: 24px; height: 21px; place-items: center; border-radius: 5px; background: var(--accent); color: var(--text-on-accent); font-weight: 800; }
.chapter-arc-name { min-width: 0; flex: 1; overflow: hidden; color: var(--text-1); font-weight: 700; text-align: left; text-overflow: ellipsis; white-space: nowrap; }

.chapter-tool-btn { padding: 7px 10px; cursor: pointer; transition: background 0.15s, color 0.15s; }
.chapter-tool-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--text-on-accent) 9%, transparent); color: var(--text-1); }
.chapter-tool-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.chapter-tool-btn--icon { width: 31px; height: 31px; justify-content: center; padding: 0; }
.chapter-tool-btn--danger:hover { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 45%, transparent); }
.chapter-tool-btn--primary { border-color: color-mix(in srgb, var(--accent) 45%, transparent); background: color-mix(in srgb, var(--accent) 17%, transparent); color: var(--accent-soft); font-weight: 700; }

.chapter-zoom { gap: 0; overflow: hidden; }
.chapter-zoom button { width: 29px; height: 29px; border: 0; background: none; color: var(--text-2); cursor: pointer; }
.chapter-zoom button:hover { background: var(--surface-raised); color: var(--text-1); }
.chapter-zoom span { width: 43px; color: var(--text-muted); font-size: 10px; text-align: center; }

.chapter-arc-list { display: flex; flex-direction: column; gap: 3px; padding: 5px; }
.chapter-arc-row { display: flex; align-items: center; gap: 4px; border-radius: 7px; }
.chapter-arc-row.active { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.chapter-arc-pick { min-width: 0; flex: 1; display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: center; gap: 6px; padding: 8px; border: 0; background: none; color: var(--text-2); font: inherit; text-align: left; cursor: pointer; }
.chapter-arc-pick > span { color: var(--accent); font-weight: 800; }
.chapter-arc-pick strong { overflow: hidden; color: var(--text-1); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.chapter-arc-pick small { grid-column: 2; color: var(--text-muted); font-size: 9px; }
.chapter-arc-order-actions { display: flex; gap: 2px; padding-right: 4px; }
.chapter-arc-order-actions button { width: 24px; height: 24px; border: 0; border-radius: 5px; background: none; color: var(--text-muted); cursor: pointer; }
.chapter-arc-order-actions button:hover:not(:disabled) { background: var(--surface-raised); color: var(--text-1); }
.chapter-arc-order-actions button:disabled { opacity: 0.2; }
.chapter-arc-create { margin-top: 3px; padding: 9px; border: 1px dashed color-mix(in srgb, var(--accent) 42%, transparent); border-radius: 7px; background: none; color: var(--accent-soft); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }

@media (max-width: 760px) {
  .chapter-toolbar { align-items: stretch; flex-direction: column; }
  .chapter-toolbar-view { width: 100%; margin-left: 0; }
  .chapter-arc-trigger { min-width: 0; flex: 1; }
  .chapter-toolbar-label, .chapter-toolbar-rule, .chapter-tool-btn--danger { display: none; }
}
</style>
