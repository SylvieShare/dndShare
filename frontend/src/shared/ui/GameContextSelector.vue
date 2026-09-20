<template>
  <div class="game-context" :class="{ 'game-context--compact': compact }">
    <button
      ref="trigger"
      class="game-context-trigger"
      type="button"
      :title="contextLabel"
      :aria-label="`Игровая система: ${contextLabel}`"
      :aria-expanded="open"
      :aria-controls="menuId"
      aria-haspopup="menu"
      @click="open = !open"
      @keydown.down.prevent="open = true"
      @keydown.up.prevent="open = true"
    >
      <GameContextEmblem :kind="current.emblem" />
      <span v-if="!compact" class="game-context-trigger-current">
        <span class="game-context-trigger-system">{{ current.name }}</span>
        <span class="game-context-trigger-edition">{{ current.detail }}</span>
      </span>
      <ChevronDown v-if="!compact" :size="14" class="game-context-trigger-chevron" aria-hidden="true" />
    </button>

    <BasePopover
      :id="menuId"
      v-model:open="open"
      :anchor="trigger"
      placement="bottom-start"
      :min-width="0"
      :offset="8"
      transition-preset="action-menu"
      role="menu"
      aria-label="Система и редакция"
    >
      <div ref="menu" class="game-context-menu" :aria-busy="store.loading || store.saving" @keydown="onMenuKeydown">
        <div class="game-context-heading">
          <span>Система и редакция</span>
          <LoadingIndicator v-if="store.loading || store.saving" :label="store.saving ? 'Сохранение' : 'Загрузка'" :size="16" />
        </div>

        <div class="game-context-options" role="group" aria-label="Доступные системы и редакции">
          <ActionMenuItem
            v-for="option in options"
            :key="option.id"
            class="game-context-option"
            role="menuitemradio"
            :aria-checked="isSelected(option.id)"
            :disabled="store.loading || store.saving"
            @click="selectVersion(option.id)"
          >
            <template #icon><GameContextEmblem :kind="option.emblem" /></template>
            <span class="game-context-option-name">{{ option.name }}</span>
            <span class="game-context-option-detail">{{ option.detail }}</span>
            <template #suffix>
              <Check v-if="isSelected(option.id)" :size="17" class="game-context-check" aria-hidden="true" />
            </template>
          </ActionMenuItem>
        </div>

        <p v-if="store.loading && !options.length" class="game-context-message" role="status">Загружаем игровые системы…</p>
        <p v-else-if="store.ready && !options.length" class="game-context-message">Пока нет доступных редакций</p>
        <p v-if="store.error" class="game-context-error" role="alert">{{ store.error }}</p>
        <ActionMenuItem v-if="store.error && !store.ready" :icon="RotateCcw" :disabled="store.loading" @click="load">
          Попробовать снова
        </ActionMenuItem>
        <p v-if="options.length" class="game-context-hint">Правила, справочник и поиск</p>
      </div>
    </BasePopover>
  </div>
</template>

<script setup>
import { ActionMenuItem, BasePopover, LoadingIndicator } from '@sylvieshare/share-ui'
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { Check, ChevronDown, RotateCcw } from '@lucide/vue'
import { useGameContextStore } from '@/stores/gameContext'
import { gameContextOptions, gameContextPresentation } from '@/shared/lib/gameContextPresentation'
import GameContextEmblem from './GameContextEmblem.vue'

defineProps({ compact: { type: Boolean, default: false } })

const store = useGameContextStore()
const open = ref(false)
const trigger = ref(null)
const menu = ref(null)
const menuId = useId()
const current = computed(() => gameContextPresentation(store.selectedSource, store.selectedVersion))
const contextLabel = computed(() => `${current.value.name} · ${current.value.detail}`)
const options = computed(() => gameContextOptions(store.sources))
const isSelected = id => Number(id) === Number(store.sourceVersionId)

function focusSelected() {
  const selected = menu.value?.querySelector('[aria-checked="true"]:not(:disabled)')
  const first = menu.value?.querySelector('button:not(:disabled)')
  const target = selected || first
  target?.focus()
}

watch(open, async value => {
  if (value) {
    await nextTick()
    focusSelected()
  } else if (menu.value?.contains(document.activeElement)) {
    trigger.value?.focus()
  }
})

watch(() => store.loading, async loading => {
  if (!loading && open.value) {
    await nextTick()
    focusSelected()
  }
})

function onMenuKeydown(event) {
  if (event.key === 'Tab') {
    trigger.value?.focus()
    open.value = false
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const buttons = [...menu.value.querySelectorAll('button:not(:disabled)')]
  if (!buttons.length) return
  const index = buttons.indexOf(document.activeElement)
  const next = event.key === 'Home' ? 0
    : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
  buttons[next].focus()
}

async function selectVersion(sourceVersionID) {
  if (store.loading || store.saving) return
  try {
    await store.selectVersion(sourceVersionID)
    open.value = false
    trigger.value?.focus()
  } catch {
    // The store restores the previous selection and exposes the error in this menu.
    await nextTick()
    focusSelected()
  }
}

function load() {
  return store.ensure().catch(() => null)
}

onMounted(load)
</script>

<style scoped>
.game-context { width: 100%; }

.game-context-trigger {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 52px;
  padding: 5px 6px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: transparent;
  color: var(--text-2);
  text-align: left;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease;
}

.game-context-trigger:hover,
.game-context-trigger[aria-expanded='true'] {
  border-color: var(--border);
  background: var(--surface-raised);
}

.game-context-trigger:focus-visible,
.game-context-option:focus-visible {
  outline: 2px solid var(--accent-soft);
  outline-offset: -2px;
}

.game-context-trigger-current { display: grid; gap: 3px; min-width: 0; flex: 1; }
.game-context-trigger-system {
  overflow: hidden;
  color: var(--text-1);
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.game-context-trigger-edition {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.game-context-trigger-chevron { flex-shrink: 0; color: var(--text-muted); }
.game-context--compact .game-context-trigger { justify-content: center; padding: 5px 0; }

.game-context-menu {
  width: min(288px, calc(100vw - 30px));
  max-height: min(440px, calc(100dvh - 32px));
  overflow-y: auto;
  overscroll-behavior: contain;
}

.game-context-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 20px;
  padding: 8px 10px 10px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.game-context-options { display: grid; gap: 4px; }
.game-context-option { min-height: 62px; gap: 12px; padding: 10px; }
.game-context-option :deep(.ram-item__icon) { width: 36px; height: 36px; flex-basis: 36px; }
.game-context-option[aria-checked='true'] {
  border-color: color-mix(in srgb, var(--accent) 32%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
.game-context-option-name { display: block; font-size: 14px; font-weight: 650; }
.game-context-option-detail { display: block; margin-top: 4px; color: var(--text-muted); font-size: 11px; font-weight: 450; }
.game-context-check { color: var(--accent-soft); }
.game-context-message, .game-context-error { margin: 8px 10px; font-size: 12px; line-height: 1.5; }
.game-context-message { color: var(--text-muted); }
.game-context-error { color: var(--danger); }
.game-context-hint { margin: 8px 10px 2px; padding: 10px 0 4px; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 10px; }

@media (max-width: 640px) {
  .game-context--compact { width: 36px; flex-shrink: 0; }
  .game-context--compact .game-context-trigger { min-height: 36px; padding: 0; }
  .game-context-trigger :deep(.game-context-emblem) { width: 32px; height: 32px; flex-basis: 32px; }
  .game-context-trigger :deep(.game-context-glyph) { width: 24px; height: 24px; }
}

@media (prefers-reduced-motion: reduce) {
  .game-context-trigger { transition: none; }
}
</style>
