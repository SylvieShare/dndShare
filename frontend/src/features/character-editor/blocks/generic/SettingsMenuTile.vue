<template>
  <div class="sm-wrap" v-click-outside="() => (open = false)">
    <BaseTile class="sm-tile" :color="accent" strip interactive @click="open = !open">
      <div class="sm-title">Настройки</div>
      <div class="sm-body">
        <img v-if="iconSrc" class="sm-ic" :src="iconSrc" :style="iconStyle" alt="" aria-hidden="true" />
        <div class="sm-sub">меню</div>
      </div>
    </BaseTile>

    <transition name="sm-fade">
      <div v-if="open" class="sm-menu">
        <div class="sm-save" :class="ctx.saveStatus">
          <span class="sm-dot"></span>
          <span class="sm-save-label">{{ saveLabel }}</span>
        </div>
        <ToggleSwitch
          v-if="ctx.canTogglePublic"
          class="sm-item"
          :modelValue="ctx.publicVisible"
          label="Публичная ссылка"
          @update:modelValue="v => ctx.setPublic && ctx.setPublic(v)"
        />
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import BaseTile from '@/shared/ui/BaseTile'
import ToggleSwitch from '@/shared/ui/ToggleSwitch'
import { svgColorFilter } from '@/shared/lib/svgColorFilter'

const props = defineProps(['block'])
const ctx = inject('charCtx', { canTogglePublic: false, publicVisible: false, saveStatus: 'idle', pendingSecondsLeft: 0 })
const open = ref(false)

const accent = computed(() => props.block?.content?.accent || '#8a8f9e')
const iconSrc = computed(() => props.block?.content?.svg || null)
const iconStyle = computed(() => ({ filter: svgColorFilter(accent.value) }))

const saveLabel = computed(() => {
  switch (ctx.saveStatus) {
    case 'pending': return `Сохранение через ${ctx.pendingSecondsLeft}с`
    case 'saving': return 'Сохраняется...'
    case 'error': return 'Ошибка сохранения'
    default: return 'Сохранено'
  }
})
</script>

<style scoped>
.sm-wrap { position: relative; width: 100%; height: 100%; }

.sm-tile {
  width: 100%;
  min-height: 80px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  user-select: none;
}
.sm-title { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); line-height: 1; }
.sm-body { display: flex; align-items: center; gap: 8px; }
.sm-ic { width: 24px; height: 24px; flex-shrink: 0; opacity: 0.9; }
.sm-sub { font-size: 13px; font-weight: 600; color: var(--text-2); }

/* ── Dropdown ── */
.sm-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 60;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--popup-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-lg);
}
.sm-item { padding: 6px 8px; border-radius: 7px; }
.sm-item:hover { background: rgba(255, 255, 255, 0.04); }

.sm-save { display: flex; align-items: center; gap: 7px; padding: 6px 8px 10px; border-bottom: 1px solid var(--border); margin-bottom: 2px; }
.sm-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; transition: background-color 0.3s; }
.sm-save-label { font-size: 12px; white-space: nowrap; }
.sm-save.idle .sm-dot { background: var(--success); } .sm-save.idle .sm-save-label { color: var(--success); }
.sm-save.pending .sm-dot { background: var(--warning); } .sm-save.pending .sm-save-label { color: var(--warning); }
.sm-save.saving .sm-dot { background: #7a8aff; animation: sm-pulse 0.9s ease-in-out infinite; } .sm-save.saving .sm-save-label { color: #7a8aff; }
.sm-save.error .sm-dot { background: var(--danger); } .sm-save.error .sm-save-label { color: var(--danger); }
@keyframes sm-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.sm-fade-enter-active, .sm-fade-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.sm-fade-enter-from, .sm-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
