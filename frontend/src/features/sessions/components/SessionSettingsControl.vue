<template>
  <button
    ref="trigger"
    type="button"
    class="session-settings-trigger"
    :class="{ 'session-settings-trigger--active': open }"
    title="Настройки сессии"
    aria-label="Настройки сессии"
    :aria-expanded="open"
    @click="open = !open"
  ><Settings :size="17" /></button>

  <BasePopover v-model:open="open" :anchor="trigger" :min-width="310" placement="bottom-end" transition-preset="action-menu">
    <div class="session-settings-menu">
      <header>
        <strong>Настройки сессии</strong>
        <small>Сохраняются в этом браузере</small>
      </header>
      <label class="session-settings-option">
        <span><strong>Автоматически бросать HP существ</strong><small>При добавлении из справочника бросать формулу отдельно для каждого существа</small></span>
        <input type="checkbox" :checked="autoRollNpcHp" @change="$emit('update-setting', 'autoRollNpcHp', $event.target.checked)" />
        <i aria-hidden="true" />
      </label>
    </div>
  </BasePopover>
</template>

<script setup>
import { ref } from 'vue'
import { Settings } from '@lucide/vue'
import { BasePopover } from '@sylvieshare/share-ui'

defineProps({
  autoRollNpcHp: { type: Boolean, default: false },
})
defineEmits(['update-setting'])
const trigger = ref(null)
const open = ref(false)
</script>

<style scoped>
.session-settings-trigger { width: 31px; height: 31px; display: grid; place-items: center; padding: 0; border: 1px solid var(--border-strong); border-radius: 7px; background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); color: var(--text-2); cursor: pointer; transition: background .15s, border-color .15s, color .15s; }
.session-settings-trigger:hover, .session-settings-trigger--active { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--text-1); }
.session-settings-menu { display: flex; flex-direction: column; gap: 4px; padding: 6px; }
.session-settings-menu header { display: flex; flex-direction: column; gap: 2px; padding: 5px 7px 9px; border-bottom: 1px solid var(--border); }
.session-settings-menu header strong { color: var(--text-1); font-size: 13px; }
.session-settings-menu header small { color: var(--text-muted); font-size: 10px; }
.session-settings-option { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 34px; align-items: center; gap: 12px; padding: 10px 8px; border-radius: 8px; cursor: pointer; }
.session-settings-option:hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.session-settings-option > span { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.session-settings-option strong { color: var(--text-1); font-size: 11px; }
.session-settings-option small { color: var(--text-muted); font-size: 9px; line-height: 1.4; }
.session-settings-option input { position: absolute; opacity: 0; pointer-events: none; }
.session-settings-option i { position: relative; width: 32px; height: 18px; border: 1px solid var(--border-strong); border-radius: 10px; background: var(--surface-active); transition: background .15s, border-color .15s; }
.session-settings-option i::after { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--text-muted); content: ''; transition: transform .15s, background .15s; }
.session-settings-option input:checked + i { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 24%, var(--surface)); }
.session-settings-option input:checked + i::after { background: var(--accent); transform: translateX(14px); }
.session-settings-option input:focus-visible + i { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
