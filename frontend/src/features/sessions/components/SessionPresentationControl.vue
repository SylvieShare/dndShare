<template>
  <div v-if="isDm" class="presentation-control">
    <button
      ref="trigger"
      type="button"
      class="chapter-tool-btn chapter-tool-btn--presentation"
      :class="{ 'chapter-tool-btn--connected': hasConnectedScreens }"
      :title="triggerTitle"
      :aria-label="triggerTitle"
      :aria-expanded="open"
      @click="open = !open"
    >
      <MonitorUp :size="18" /><span class="presentation-control-dot" :class="{ connected: hasConnectedScreens }" />
    </button>
    <BasePopover v-model:open="open" :anchor="trigger" :min-width="330" placement="bottom-end" transition-preset="action-menu">
      <div class="presentation-menu">
        <header>
          <div><span>ЭКРАН ПОКАЗА</span><strong>{{ presentation.activeLabel.value }}</strong></div>
          <a :href="`/screen/${sessionUuid}`" target="_blank" rel="noopener" title="Открыть экран показа"><ExternalLink :size="15" /></a>
        </header>
        <div class="presentation-connection" :class="{ 'presentation-connection--online': hasConnectedScreens, 'presentation-connection--error': presentation.connectionsError.value }" role="status" aria-live="polite">
          <span class="presentation-connection-pulse" aria-hidden="true" />
          <span><strong>{{ connectionLabel }}</strong><small>{{ connectionDescription }}</small></span>
          <b v-if="hasConnectedScreens">{{ presentation.connectedScreens.value }}</b>
        </div>
        <div class="presentation-menu-actions">
          <button v-if="presentation.state.value.visible" type="button" @click="run(presentation.blackout)"><Moon :size="15" />Затемнить</button>
          <button v-else-if="presentation.state.value.mode !== 'idle'" type="button" @click="run(presentation.reveal)"><Sun :size="15" />Вернуть показ</button>
          <button type="button" @click="run(presentation.clear)"><Square :size="14" />Очистить</button>
        </div>
        <label class="presentation-music-toggle">
          <input
            type="checkbox"
            :checked="presentation.state.value.broadcastMusic"
            :disabled="presentation.saving.value"
            @change="toggleMusic"
          />
          <Volume2 :size="17" />
          <span><strong>Транслировать музыку</strong><small>Звук воспроизводится на экране показа</small></span>
        </label>
        <section v-if="contextMaterials.length">
          <h3>Материалы в контексте</h3>
          <button v-for="material in contextMaterials" :key="material.id" type="button" class="presentation-material" @click="showMaterial(material)">
            <span class="presentation-material-thumb">
              <img v-if="material.kind === 'image' || material.kind === 'map'" :src="material.assetUrl" alt="" />
              <component :is="materialType(material.kind).icon" v-else :size="17" />
            </span>
            <span><strong>{{ material.name }}</strong><small>{{ materialType(material.kind).label }} · {{ relationLabel(material) }}</small></span>
            <Cast :size="14" />
          </button>
        </section>
        <section>
          <h3>Эффект на экране игроков</h3>
          <div class="presentation-effects">
            <button v-for="effect in effects" :key="effect.key" type="button" :class="{ active: presentation.state.value.effect === effect.key }" @click="run(() => presentation.setEffect(effect.key), false)">{{ effect.label }}</button>
          </div>
        </section>
        <span v-if="presentation.error.value" class="presentation-menu-error">{{ presentation.error.value }}</span>
      </div>
    </BasePopover>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Cast, ExternalLink, MonitorUp, Moon, Square, Sun, Volume2 } from '@lucide/vue'
import { BasePopover } from '@sylvieshare/share-ui'
import { materialType } from '@/features/sessions/lib/sessionMaterials'

const props = defineProps({
  sessionUuid: { type: String, required: true }, isDm: { type: Boolean, default: false },
  presentation: { type: Object, required: true }, materials: { type: Object, required: true },
	scene: { type: Object, default: null },
})
const trigger = ref(null)
const open = ref(false)
const effects = [
  { key: 'none', label: 'Без эффекта' }, { key: 'rain', label: 'Дождь' },
  { key: 'fog', label: 'Туман' }, { key: 'embers', label: 'Искры' },
  { key: 'snow', label: 'Снег' }, { key: 'storm', label: 'Гроза' },
]
const contextMaterials = computed(() => props.materials.availableFor(props.scene?.id))
const hasConnectedScreens = computed(() => props.presentation.connectedScreens.value > 0)
const connectionLabel = computed(() => {
  const count = props.presentation.connectedScreens.value
  if (!count) return 'Нет подключённых экранов'
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo !== 11 && last === 1) return `Подключён ${count} экран`
  if ((lastTwo < 12 || lastTwo > 14) && last >= 2 && last <= 4) return `Подключено ${count} экрана`
  return `Подключено ${count} экранов`
})
const connectionDescription = computed(() => {
  if (props.presentation.connectionsError.value) return props.presentation.connectionsError.value
  return hasConnectedScreens.value
    ? 'Получают обновления в реальном времени'
    : 'Откройте экран показа в новой вкладке или на другом устройстве'
})
const triggerTitle = computed(() => `${props.presentation.activeLabel.value} · ${connectionLabel.value}`)
watch(open, value => { if (value) props.presentation.loadConnections() })
async function run(action, close = true) { await action().catch(() => {}); if (close) open.value = false }
function showMaterial(material) { run(() => props.presentation.showMaterial(material)) }
function toggleMusic(event) { run(() => props.presentation.setBroadcastMusic(event.target.checked), false) }
function relationLabel(material) {
  const count = (material.relations || []).filter(relation => relation.type === 'scene').length
  if (!count) return 'Вся сессия'
  return count === 1 ? '1 связь' : `${count} связей`
}
</script>

<style scoped>
.presentation-control { display: contents; }.chapter-tool-btn--presentation { position: relative; min-width: 34px; min-height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 7px; border: 1px solid var(--border-strong); border-radius: 7px; background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); color: var(--text-2); cursor: pointer; }.chapter-tool-btn--presentation:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--text-1); }.chapter-tool-btn--presentation.chapter-tool-btn--connected { border-color: color-mix(in srgb, var(--success) 68%, var(--border)); background: color-mix(in srgb, var(--success) 14%, transparent); color: var(--text-1); box-shadow: 0 0 0 1px color-mix(in srgb, var(--success) 10%, transparent), 0 0 16px color-mix(in srgb, var(--success) 13%, transparent); }.presentation-control-dot { position: absolute; top: 5px; right: 5px; width: 5px; height: 5px; border-radius: 50%; background: var(--text-muted); }.presentation-control-dot.connected { background: var(--success); box-shadow: 0 0 7px var(--success); }
.presentation-menu { display: flex; flex-direction: column; gap: 12px; padding: 4px; }.presentation-menu header { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 8px 9px 10px; border-bottom: 1px solid var(--border); }.presentation-menu header div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }.presentation-menu header span, .presentation-menu h3 { color: var(--text-muted); font-size: 8px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }.presentation-menu header strong { overflow: hidden; color: var(--text-1); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.presentation-menu header a { width: 30px; height: 30px; display: grid; flex: none; place-items: center; border: 1px solid var(--border); border-radius: 7px; color: var(--text-2); }
.presentation-connection { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; align-items: center; gap: 9px; margin: -3px 3px 0; padding: 8px 9px; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--text-on-accent) 3%, transparent); }.presentation-connection-pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); }.presentation-connection > span:not(.presentation-connection-pulse) { min-width: 0; display: flex; flex-direction: column; gap: 2px; }.presentation-connection strong { color: var(--text-2); font-size: 10px; }.presentation-connection small { color: var(--text-muted); font-size: 8px; line-height: 1.35; }.presentation-connection b { min-width: 22px; color: var(--success); font-size: 15px; text-align: right; }.presentation-connection--online { border-color: color-mix(in srgb, var(--success) 32%, var(--border)); background: color-mix(in srgb, var(--success) 7%, transparent); }.presentation-connection--online .presentation-connection-pulse { background: var(--success); box-shadow: 0 0 8px var(--success); animation: presentation-connection-pulse 2s ease-in-out infinite; }.presentation-connection--online strong { color: var(--text-1); }.presentation-connection--error:not(.presentation-connection--online) .presentation-connection-pulse { background: var(--warning); }
.presentation-menu-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }.presentation-menu button { min-height: 32px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface-raised); color: var(--text-2); cursor: pointer; font: inherit; font-size: 10px; }.presentation-menu button:hover { border-color: var(--accent); color: var(--text-1); }.presentation-menu button.primary { border-color: var(--accent); background: var(--accent); color: var(--text-on-accent); }
.presentation-music-toggle { display: grid; grid-template-columns: auto auto minmax(0, 1fr); align-items: center; gap: 8px; padding: 9px; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--accent) 5%, var(--surface-raised)); color: var(--text-2); cursor: pointer; }.presentation-music-toggle:hover { border-color: color-mix(in srgb, var(--accent) 60%, var(--border)); }.presentation-music-toggle input { width: 15px; height: 15px; margin: 0; accent-color: var(--accent); }.presentation-music-toggle > span { min-width: 0; display: flex; flex-direction: column; gap: 1px; }.presentation-music-toggle strong { color: var(--text-1); font-size: 10px; }.presentation-music-toggle small { color: var(--text-muted); font-size: 8px; }
.presentation-menu section { display: flex; flex-direction: column; gap: 5px; }.presentation-menu h3 { margin: 0 5px 2px; }.presentation-menu .presentation-material { justify-content: flex-start; min-height: 44px; padding: 4px 7px; text-align: left; }.presentation-material-thumb { width: 44px; height: 34px; display: grid !important; flex: none !important; place-items: center; overflow: hidden; border-radius: 4px; background: var(--surface); color: var(--accent-soft); }.presentation-material-thumb img { width: 100%; height: 100%; object-fit: cover; }.presentation-material > span:not(.presentation-material-thumb) { min-width: 0; display: flex; flex: 1; flex-direction: column; }.presentation-material strong, .presentation-material small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.presentation-material strong { color: var(--text-1); font-size: 10px; }.presentation-material small { color: var(--text-muted); font-size: 8px; }.presentation-effects { display: flex; flex-wrap: wrap; gap: 4px; }.presentation-effects button { min-height: 27px; padding: 4px 8px; }.presentation-effects button.active { border-color: var(--accent); color: var(--accent-soft); }.presentation-menu-error { color: var(--danger); font-size: 9px; }
@keyframes presentation-connection-pulse { 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .presentation-connection--online .presentation-connection-pulse { animation: none; } }
</style>
