<template>
  <div class="item-automation-meta">
    <button ref="trigger" type="button" class="item-automation-badge" :class="`item-automation-badge--${status.tone}`"
      :title="hint" :aria-expanded="open" aria-label="Поддержка механик" @click="open = !open">
      <component :is="statusIcon" :size="13" aria-hidden="true" />
      <span>Автоматизация: {{ status.label.toLocaleLowerCase('ru') }}</span>
    </button>
    <button v-if="item.requiresPlayerInteraction" type="button" class="item-automation-badge"
      :title="PLAYER_INTERACTION_HINT" :aria-expanded="open" @click="open = !open">
      <Users :size="13" aria-hidden="true" /><span>Другие игроки</span>
    </button>
    <BasePopover v-if="open" v-model:open="open" :anchor="trigger" :z-index="zIndex" :min-width="200" role="dialog" aria-label="Поддержка механик">
      <div class="item-automation-explanation">
        <strong>Автоматизация: {{ status.label.toLocaleLowerCase('ru') }}</strong>
        <p>{{ status.hint }}</p>
        <p v-if="item.requiresPlayerInteraction">{{ PLAYER_INTERACTION_HINT }}</p>
        <p v-if="item.automationNote" class="item-automation-note">{{ item.automationNote }}</p>
      </div>
    </BasePopover>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { BasePopover } from '@sylvieshare/share-ui'
import { CircleCheck, CircleDashed, CircleMinus, CircleOff, CircleDot, Users } from '@lucide/vue'
import { automationStatus, PLAYER_INTERACTION_HINT } from '../lib/itemAutomation'
const props = defineProps({ item: { type: Object, required: true }, zIndex: { type: Number, default: 5100 } })
const open = ref(false), trigger = ref(null)
const status = computed(() => automationStatus(props.item.automationStatus))
const statusIcon = computed(() => ({ full: CircleCheck, partial: CircleDot, none: CircleOff, not_applicable: CircleMinus })[status.value.value] || CircleDashed)
const hint = computed(() => [status.value.hint, props.item.automationNote].filter(Boolean).join('\n'))
watch(() => props.item.id, () => { open.value = false })
</script>
<style scoped>
.item-automation-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; margin-right: auto; }
.item-automation-badge { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 4px 7px; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--text-muted); font: inherit; font-size: 11px; letter-spacing: normal; text-align: left; cursor: pointer; }
.item-automation-badge svg { flex: none; }
.item-automation-badge--success { color: var(--success); }
.item-automation-badge--warning { color: var(--warning); }
.item-automation-badge:hover { background: var(--surface-raised); }
.item-automation-badge:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.item-automation-explanation { width: min(320px, calc(100vw - 56px)); padding: 12px; color: var(--text-2); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.item-automation-explanation strong { color: var(--text-1); }
.item-automation-explanation p { margin: 8px 0 0; }
.item-automation-note { border-top: 1px solid var(--border); padding-top: 8px; white-space: pre-wrap; }
</style>
