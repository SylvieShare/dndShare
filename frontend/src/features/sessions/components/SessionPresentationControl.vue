<template>
  <div v-if="isDm" class="presentation-control">
    <button ref="trigger" type="button" class="chapter-tool-btn chapter-tool-btn--presentation" :class="{ 'chapter-tool-btn--active': presentation.state.value.visible }" :title="presentation.activeLabel.value" :aria-expanded="open" @click="open = !open">
      <MonitorUp :size="18" /><span class="presentation-control-dot" :class="{ visible: presentation.state.value.visible }" />
    </button>
    <BasePopover v-model:open="open" :anchor="trigger" :min-width="330" placement="bottom-end" transition-preset="action-menu">
      <div class="presentation-menu">
        <header>
          <div><span>ЭКРАН ПОКАЗА</span><strong>{{ presentation.activeLabel.value }}</strong></div>
          <a :href="`/screen/${sessionUuid}`" target="_blank" rel="noopener" title="Открыть экран показа"><ExternalLink :size="15" /></a>
        </header>
        <div class="presentation-menu-actions">
          <button v-if="scene" type="button" class="primary" @click="runScene"><Play :size="15" />Запустить сцену</button>
          <button v-if="presentation.state.value.visible" type="button" @click="run(presentation.blackout)"><Moon :size="15" />Затемнить</button>
          <button v-else-if="presentation.state.value.mode !== 'idle'" type="button" @click="run(presentation.reveal)"><Sun :size="15" />Вернуть показ</button>
          <button type="button" @click="run(presentation.clear)"><Square :size="14" />Очистить</button>
        </div>
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
import { computed, ref } from 'vue'
import { Cast, ExternalLink, MonitorUp, Moon, Play, Square, Sun } from '@lucide/vue'
import { BasePopover } from '@sylvieshare/share-ui'
import { materialType } from '@/features/sessions/lib/sessionMaterials'

const props = defineProps({
  sessionUuid: { type: String, required: true }, isDm: { type: Boolean, default: false },
  presentation: { type: Object, required: true }, materials: { type: Object, required: true },
  chapterId: { type: [Number, String], default: null }, scene: { type: Object, default: null },
})
const trigger = ref(null)
const open = ref(false)
const effects = [
  { key: 'none', label: 'Без эффекта' }, { key: 'rain', label: 'Дождь' },
  { key: 'fog', label: 'Туман' }, { key: 'embers', label: 'Искры' },
  { key: 'snow', label: 'Снег' }, { key: 'storm', label: 'Гроза' },
]
const contextMaterials = computed(() => props.materials.availableFor(props.chapterId, props.scene?.id))
async function run(action, close = true) { await action().catch(() => {}); if (close) open.value = false }
function runScene() { run(() => props.presentation.startScene(props.scene)) }
function showMaterial(material) { run(() => props.presentation.showMaterial(material)) }
function relationLabel(material) {
  const count = (material.chapterLinks?.length || 0) + (material.sceneLinks?.length || 0)
  if (!count) return 'Вся сессия'
  return count === 1 ? '1 связь' : `${count} связей`
}
</script>

<style scoped>
.presentation-control { display: contents; }.chapter-tool-btn--presentation { position: relative; min-width: 34px; min-height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 7px; border: 1px solid var(--border-strong); border-radius: 7px; background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); color: var(--text-2); cursor: pointer; }.chapter-tool-btn--presentation:hover, .chapter-tool-btn--presentation.chapter-tool-btn--active { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--text-1); }.presentation-control-dot { position: absolute; top: 5px; right: 5px; width: 5px; height: 5px; border-radius: 50%; background: var(--text-muted); }.presentation-control-dot.visible { background: var(--success); box-shadow: 0 0 7px var(--success); }
.presentation-menu { display: flex; flex-direction: column; gap: 12px; padding: 4px; }.presentation-menu header { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 8px 9px 10px; border-bottom: 1px solid var(--border); }.presentation-menu header div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }.presentation-menu header span, .presentation-menu h3 { color: var(--text-muted); font-size: 8px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }.presentation-menu header strong { overflow: hidden; color: var(--text-1); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.presentation-menu header a { width: 30px; height: 30px; display: grid; flex: none; place-items: center; border: 1px solid var(--border); border-radius: 7px; color: var(--text-2); }
.presentation-menu-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }.presentation-menu button { min-height: 32px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface-raised); color: var(--text-2); cursor: pointer; font: inherit; font-size: 10px; }.presentation-menu button:hover { border-color: var(--accent); color: var(--text-1); }.presentation-menu button.primary { border-color: var(--accent); background: var(--accent); color: var(--text-on-accent); }
.presentation-menu section { display: flex; flex-direction: column; gap: 5px; }.presentation-menu h3 { margin: 0 5px 2px; }.presentation-menu .presentation-material { justify-content: flex-start; min-height: 44px; padding: 4px 7px; text-align: left; }.presentation-material-thumb { width: 44px; height: 34px; display: grid !important; flex: none !important; place-items: center; overflow: hidden; border-radius: 4px; background: var(--surface); color: var(--accent-soft); }.presentation-material-thumb img { width: 100%; height: 100%; object-fit: cover; }.presentation-material > span:not(.presentation-material-thumb) { min-width: 0; display: flex; flex: 1; flex-direction: column; }.presentation-material strong, .presentation-material small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.presentation-material strong { color: var(--text-1); font-size: 10px; }.presentation-material small { color: var(--text-muted); font-size: 8px; }.presentation-effects { display: flex; flex-wrap: wrap; gap: 4px; }.presentation-effects button { min-height: 27px; padding: 4px 8px; }.presentation-effects button.active { border-color: var(--accent); color: var(--accent-soft); }.presentation-menu-error { color: var(--danger); font-size: 9px; }
</style>
