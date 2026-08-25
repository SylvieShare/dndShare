<template>
  <div class="sm-wrap" v-click-outside="() => (open = false)">
    <BaseTile class="sm-tile" :color="accent" strip interactive @click="open = !open">
      <div class="sm-body">
        <img v-if="iconSrc" class="sm-ic" :src="iconSrc" :style="iconStyle" alt="" aria-hidden="true" />
        <div class="sm-sub">меню</div>
      </div>
    </BaseTile>

    <transition name="sm-fade">
      <div v-if="open" class="sm-menu">
        <div v-if="ctx.saveStatus === 'pending' || ctx.saveStatus === 'saving'" class="sm-save" :class="ctx.saveStatus">
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
        <button v-if="ctx.canEdit" class="sm-action" type="button" @click="openSources">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" />
          </svg>
          <span class="sm-action-copy"><b>Источники</b><small>{{ sourceSummary }}</small></span>
        </button>
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

    <ContentSourcesModal
      v-if="sourcesOpen"
      :source-version-id="ctx.sourceVersionId"
      :model-value="sourceDraft"
      @update:model-value="updateSources"
      @close="sourcesOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BaseTile } from '@sylvieshare/share-ui'
import { ToggleSwitch } from '@sylvieshare/share-ui'
import ContentSourcesModal from '@/features/character-editor/components/ContentSourcesModal.vue'
import { normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'
import { svgColorFilter } from '@/shared/lib/svgColorFilter'

const props = defineProps(['block'])
const ctx = inject('charCtx', { canEdit: false, canTogglePublic: false, publicVisible: false, saveStatus: 'idle', pendingSecondsLeft: 0 })
const open = ref(false)
const sourcesOpen = ref(false)
const sourceDraft = ref(normalizeContentSourceSettings(null))
const route = useRoute()
const router = useRouter()

const accent = computed(() => props.block?.content?.accent || 'var(--text-muted)')
const iconSrc = computed(() => props.block?.content?.svg || null)
const iconStyle = computed(() => ({ filter: svgColorFilter(accent.value) }))
const sourceSummary = computed(() => {
  const settings = normalizeContentSourceSettings(ctx.contentSources)
  if (settings.mode === 'all') return settings.allowLegacy ? 'Все источники + Legacy' : 'Все источники'
  return `${settings.ids.length} выбрано`
})

const saveLabel = computed(() => {
  switch (ctx.saveStatus) {
    case 'pending': return `Сохранение через ${ctx.pendingSecondsLeft}с`
    case 'saving': return 'Сохраняется...'
    default: return ''
  }
})

function openPrintView() {
  open.value = false
  router.push({ name: 'CharacterPrint', params: { uuid: route.params.uuid } })
}

function openSources() {
  sourceDraft.value = normalizeContentSourceSettings(ctx.contentSources)
  sourcesOpen.value = true
  open.value = false
}

function updateSources(value) {
  sourceDraft.value = normalizeContentSourceSettings(value)
  ctx.setContentSources?.(sourceDraft.value)
}
</script>

<style scoped>
.sm-wrap { position: relative; width: 100%; height: 100%; }

.sm-tile {
  width: 100%;
  min-height: 64px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 12px;
  user-select: none;
}
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
.sm-action-copy { display: flex; flex-direction: column; gap: 1px; }
.sm-action-copy b { font-size: 12px; font-weight: 600; }
.sm-action-copy small { color: var(--text-muted); font-size: 10px; }

.sm-save { display: flex; align-items: center; gap: 7px; padding: 6px 8px 10px; border-bottom: 1px solid var(--border); margin-bottom: 2px; }
.sm-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; transition: background-color 0.3s; }
.sm-save-label { font-size: 12px; white-space: nowrap; }
.sm-save.pending .sm-dot { background: var(--warning); } .sm-save.pending .sm-save-label { color: var(--warning); }
.sm-save.saving .sm-dot { background: var(--info); animation: sm-pulse 0.9s ease-in-out infinite; } .sm-save.saving .sm-save-label { color: var(--info); }
@keyframes sm-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.sm-fade-enter-active, .sm-fade-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.sm-fade-enter-from, .sm-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
