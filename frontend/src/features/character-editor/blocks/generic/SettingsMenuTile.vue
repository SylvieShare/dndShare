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
        <button class="sm-action" type="button" @click="openPrintView">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 9V2h9l3 3v4" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" rx="1" />
          </svg>
          <span>Получить PDF</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseTile from '@/shared/ui/BaseTile'
import ToggleSwitch from '@/shared/ui/ToggleSwitch'
import { svgColorFilter } from '@/shared/lib/svgColorFilter'

const props = defineProps(['block'])
const ctx = inject('charCtx', { canTogglePublic: false, publicVisible: false, saveStatus: 'idle', pendingSecondsLeft: 0 })
const open = ref(false)
const route = useRoute()
const router = useRouter()

const accent = computed(() => props.block?.content?.accent || 'var(--text-muted)')
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

function openPrintView() {
  open.value = false
  router.push({ name: 'CharacterPrint', params: { uuid: route.params.uuid } })
}
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
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-lg);
}
.sm-item { padding: 6px 8px; border-radius: 7px; }
.sm-item:hover { background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); }

.sm-action {
  width: 100%;
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.sm-action:hover { background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); color: var(--text-1); }
.sm-action svg { color: var(--text-muted); flex: 0 0 auto; }

.sm-save { display: flex; align-items: center; gap: 7px; padding: 6px 8px 10px; border-bottom: 1px solid var(--border); margin-bottom: 2px; }
.sm-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; transition: background-color 0.3s; }
.sm-save-label { font-size: 12px; white-space: nowrap; }
.sm-save.idle .sm-dot { background: var(--success); } .sm-save.idle .sm-save-label { color: var(--success); }
.sm-save.pending .sm-dot { background: var(--warning); } .sm-save.pending .sm-save-label { color: var(--warning); }
.sm-save.saving .sm-dot { background: var(--info); animation: sm-pulse 0.9s ease-in-out infinite; } .sm-save.saving .sm-save-label { color: var(--info); }
.sm-save.error .sm-dot { background: var(--danger); } .sm-save.error .sm-save-label { color: var(--danger); }
@keyframes sm-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.sm-fade-enter-active, .sm-fade-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.sm-fade-enter-from, .sm-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
