<template>
  <div class="game-context" :class="{ 'game-context--compact': compact }" v-click-outside="close">
    <button
      class="game-context-trigger"
      :class="{ 'game-context-trigger--compact': compact }"
      type="button"
      :title="contextLabel"
      :aria-label="`Игровая система: ${contextLabel}`"
      :aria-expanded="open"
      @click="open = !open"
    >
      <BookMarked aria-hidden="true" />
      <span v-if="compact" class="game-context-trigger-version">{{ selectedVersion?.version || '—' }}</span>
      <span v-else class="game-context-trigger-current">
        <span class="game-context-trigger-system">{{ selectedSource?.name || 'Игровой контекст' }}</span>
        <span class="game-context-trigger-edition">{{ selectedVersion?.version || '—' }}</span>
      </span>
      <ChevronDown v-if="!compact" class="game-context-trigger-chevron" aria-hidden="true" />
    </button>

    <Transition name="game-context-popover">
      <div v-if="open" class="game-context-panel game-context-panel--popover" aria-label="Выбор игрового контекста">
        <div class="game-context-heading">
          <span>Игровой контекст</span>
          <LoaderCircle v-if="store.loading || store.saving" class="game-context-spinner" aria-label="Сохранение" />
          <Check v-else-if="store.ready" class="game-context-saved" aria-label="Выбор сохранён" />
        </div>

        <label class="game-context-field">
          <span>Система</span>
          <ValueSelect
            :model-value="selectedSource?.id"
            :options="sourceOptions"
            placeholder="Выберите систему"
            aria-label="Игровая система"
            :disabled="store.loading || store.saving"
            @update:model-value="selectSource"
          />
        </label>

        <label class="game-context-field game-context-field--edition">
          <span>Редакция</span>
          <ValueSelect
            :model-value="selectedVersion?.id"
            :options="versionOptions"
            placeholder="Выберите редакцию"
            aria-label="Редакция правил"
            :disabled="!selectedSource || store.loading || store.saving"
            @update:model-value="selectVersion"
          />
        </label>

        <p v-if="store.error" class="game-context-error" role="status">{{ store.error }}</p>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { BookMarked, Check, ChevronDown, LoaderCircle } from '@lucide/vue'
import { ValueSelect } from '@sylvieshare/share-ui'
import { useGameContextStore } from '@/stores/gameContext'

defineProps({ compact: { type: Boolean, default: false } })

const store = useGameContextStore()
const open = ref(false)
const selectedSource = computed(() => store.selectedSource)
const selectedVersion = computed(() => store.selectedVersion)
const contextLabel = computed(() => selectedSource.value && selectedVersion.value
  ? `${selectedSource.value.name} · ${selectedVersion.value.version}`
  : 'загрузка')
const sourceOptions = computed(() => store.sources.map(source => ({
  value: source.id,
  label: source.name,
})))
const versionOptions = computed(() => (selectedSource.value?.versions || []).map(version => ({
  value: version.id,
  label: version.version,
})))

function close() {
  open.value = false
}

function selectSource(sourceID) {
  store.selectSource(sourceID).catch(() => null)
}

function selectVersion(sourceVersionID) {
  store.selectVersion(sourceVersionID).catch(() => null)
}

onMounted(() => store.ensure().catch(() => null))
</script>

<style scoped>
.game-context {
  position: relative;
  width: 100%;
}

.game-context-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-raised) 82%, transparent);
}

.game-context-panel--popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 180;
  width: 100%;
  border-color: var(--border-strong);
  background: var(--popover-bg);
  box-shadow: var(--shadow-lg);
}

.game-context--compact .game-context-panel--popover {
  top: 0;
  left: calc(100% + 10px);
  width: 230px;
}

.game-context-heading {
  display: flex;
  align-items: center;
  min-height: 16px;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.game-context-heading svg {
  width: 13px;
  height: 13px;
  margin-left: auto;
}

.game-context-spinner {
  color: var(--accent);
  animation: game-context-spin .8s linear infinite;
}

.game-context-saved { color: var(--success); }

.game-context-field {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  color: var(--text-2);
  font-size: 10px;
}

.game-context-field--edition > span { color: var(--text-muted); }

.game-context-field :deep(.vs-button) {
  min-height: 31px;
  padding: 5px 8px;
  font-size: 12px;
}

.game-context-field :deep(.vs-drop) {
  z-index: 190;
  min-width: 100%;
}

.game-context-trigger {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 42px;
  padding: 0 8px;
  overflow: hidden;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
}

.game-context-trigger:hover,
.game-context-trigger[aria-expanded='true'] {
  background: var(--surface-raised);
  color: var(--accent);
}

.game-context-trigger svg { width: 20px; height: 20px; }

.game-context-trigger--compact {
  display: grid;
  width: 42px;
  padding: 0;
  place-items: center;
}

.game-context-trigger-current {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  flex: 1;
  text-align: left;
}

.game-context-trigger-system {
  min-width: 0;
  overflow: hidden;
  color: var(--text-1);
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-context-trigger-edition {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 550;
  flex-shrink: 0;
}

.game-context-trigger-chevron {
  width: 14px !important;
  height: 14px !important;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform .16s ease;
}

.game-context-trigger[aria-expanded='true'] .game-context-trigger-chevron { transform: rotate(180deg); }

.game-context-trigger-version {
  position: absolute;
  right: 1px;
  bottom: 2px;
  max-width: 28px;
  padding: 1px 3px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--surface) 68%, transparent);
  color: var(--text-muted);
  font-size: 7px;
  font-weight: 650;
  line-height: 1;
  text-overflow: ellipsis;
}

.game-context-error {
  margin: 0;
  color: var(--danger);
  font-size: 10px;
}

.game-context-popover-enter-active,
.game-context-popover-leave-active {
  transition: opacity .14s ease, transform .16s ease;
  transform-origin: top left;
}

.game-context-popover-enter-from,
.game-context-popover-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(.985);
}

@keyframes game-context-spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .game-context--compact { width: 34px; flex-shrink: 0; }
  .game-context-trigger--compact { width: 34px; height: 34px; }
  .game-context-trigger svg { width: 18px; height: 18px; }
  .game-context-panel--popover {
    top: calc(100% + 8px);
    left: -60px;
    width: min(230px, calc(100vw - 16px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .game-context-spinner { animation-duration: 1.8s; }
  .game-context-trigger-chevron,
  .game-context-popover-enter-active,
  .game-context-popover-leave-active { transition: none; }
}
</style>
