<template>
  <button
    ref="anchor" type="button" class="hph-trigger" :aria-expanded="open" :aria-controls="popoverId"
    @pointerenter="onHover" @pointerleave="onLeave" @focus="show" @blur="scheduleClose" @click="show"
  >
    <span>Максимум хитов <Info :size="14" aria-hidden="true" /></span>
    <strong>{{ history.total }}</strong>
  </button>
  <BasePopover
    :id="popoverId" v-model:open="open" :anchor="anchor" :z-index="4100" :min-width="0"
    placement="right-start" transition-preset="action-menu" role="region" aria-label="История хитов"
  >
    <div class="hph-content" @pointerenter="cancelClose" @pointerleave="onLeave">
      <h3>История хитов</h3>
      <div class="hph-rows" tabindex="0" aria-label="Прирост хитов" @focus="cancelClose" @blur="scheduleClose">
        <div v-for="(row, index) in history.rows" :key="index" class="hph-row">
          <div><span>{{ row.label }}</span><small v-if="row.note">{{ row.note }}</small></div>
          <strong>{{ row.value > 0 ? '+' : '' }}{{ row.value }}</strong>
        </div>
      </div>
      <div class="hph-total"><span>Итого</span><strong>{{ history.total }}</strong></div>
      <p v-if="history.incomplete">Для части базы прирост по уровням не сохранён.</p>
    </div>
  </BasePopover>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { Info } from '@lucide/vue'
import { BasePopover } from '@sylvieshare/share-ui'
import { hpHistoryRows } from '../lib/hpHistory'

const props = defineProps({ hp: { type: Object, required: true } })
const history = computed(() => hpHistoryRows(props.hp))
const anchor = ref(null)
const open = ref(false)
const popoverId = useId()
let closeTimer
function cancelClose() { clearTimeout(closeTimer) }
function show() { cancelClose(); open.value = true }
function onHover(event) { if (event.pointerType !== 'touch') show() }
function onLeave(event) { if (event.pointerType !== 'touch') scheduleClose() }
function scheduleClose() {
  cancelClose()
  closeTimer = setTimeout(() => { open.value = false }, 180)
}
onBeforeUnmount(cancelClose)
</script>

<style scoped>
.hph-trigger { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 0; border: 0; background: transparent; color: var(--text-1); font: inherit; text-align: left; cursor: help; }
.hph-trigger > span { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; }
.hph-trigger svg { flex: none; color: var(--text-muted); }
.hph-trigger > strong { color: var(--success); font-size: 30px; line-height: 1; font-variant-numeric: tabular-nums; }
.hph-trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 5px; border-radius: var(--r-xs); }
.hph-content { width: min(340px, calc(100vw - 46px)); max-height: calc(100dvh - 46px); box-sizing: border-box; display: flex; flex-direction: column; padding: 10px; }
.hph-content h3 { margin: 0 0 10px; font: 700 23px var(--font-display); color: var(--text-1); }
.hph-rows { min-height: 0; overflow-y: auto; max-height: 340px; }
.hph-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 9px 0; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-2); }
.hph-row > div { min-width: 0; overflow-wrap: anywhere; }
.hph-row small { display: block; margin-top: 3px; color: var(--text-muted); font-size: 11px; }
.hph-row strong { flex: none; color: var(--text-1); font-variant-numeric: tabular-nums; }
.hph-total { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border-strong); color: var(--text-1); font-size: 13px; }
.hph-total strong { color: var(--success); font-size: 20px; font-variant-numeric: tabular-nums; }
.hph-content p { margin: 10px 0 0; color: var(--text-muted); font-size: 11px; line-height: 1.5; }
</style>
