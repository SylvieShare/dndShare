<template>
  <div v-if="widgets.length" class="fw-list">
    <BaseTile
      v-for="widget in widgets"
      :key="widget.key"
      class="fw-card"
      :class="[`fw-card--${widget.tone}`, { 'fw-card--active': widget.active }]"
    >
      <div class="fw-head">
        <ItemIcon class="fw-icon" :item="widget.item" :size="42" :fallback-to-type="false" />
        <div class="fw-title">
          <strong>{{ widget.title }}</strong>
          <span v-if="widget.description">{{ widget.description }}</span>
        </div>
        <div v-if="widget.dice" class="fw-dice" :aria-label="widget.value">
          <DamageDice
            :parts="[{ count: widget.dice.count, diceSides: widget.dice.sides, diceLabel: widget.dice.label }]"
            default-color="var(--fw-tone)"
          />
        </div>
        <div v-else-if="widget.value" class="fw-value" :class="{ 'fw-value--compact': widget.value.length > 8 }">{{ widget.value }}</div>
      </div>

      <ul v-if="widget.details.length" class="fw-details" aria-label="Условия способности">
        <li v-for="detail in widget.details" :key="detail">{{ detail }}</li>
      </ul>

      <div v-if="widget.resource || widget.kind === 'toggle'" class="fw-footer">
        <span v-if="widget.resource" class="fw-resource">
          <small>Доступно</small>
          <b>{{ widget.resource.value }}/{{ widget.resource.total }}</b>
        </span>
        <button
          v-if="widget.kind === 'toggle'"
          type="button"
          class="fw-toggle"
          :class="{ 'fw-toggle--active': widget.active }"
          :disabled="!canToggle(widget)"
          @click="toggle(widget)"
        >
          <Flame :size="16" :stroke-width="2" />
          {{ widget.active ? widget.active_label : widget.inactive_label }}
        </button>
      </div>

      <div v-if="widget.notes.length" class="fw-notes">
        <div v-for="note in widget.notes" :key="`${note.entry_key}:${note.title}`" class="fw-note">
          <b>{{ note.title }}</b><span v-if="note.description">{{ note.description }}</span>
        </div>
      </div>
    </BaseTile>
  </div>
</template>

<script setup>
import { computed, inject, watch } from 'vue'
import { Flame } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import DamageDice from '@/features/character-editor/blocks/dnd/components/DamageDice.vue'
import { collectCharacterFeatureWidgets } from '@/features/character-editor/lib/characterFeatureWidgets'

const charCtx = inject('charCtx', { ownerMode: false, values: {} })
const setBlockHidden = inject('setBlockHidden', () => {})

const values = computed(() => charCtx.values?.value || charCtx.values || {})
const itemsById = computed(() => charCtx.characterResources?.itemsById?.value || charCtx.characterResources?.itemsById || new Map())
const resources = computed(() => charCtx.characterResources?.resources?.value || charCtx.characterResources?.resources || [])
const widgets = computed(() => collectCharacterFeatureWidgets(values.value, itemsById.value, resources.value))

watch(() => widgets.value.length, length => setBlockHidden(length === 0), { immediate: true })

function canToggle(widget) {
  if (!charCtx.ownerMode) return false
  if (widget.active) return true
  if (widget.resource?.unlimited) return true
  return !widget.resource || Number(widget.resource.total) <= 0 || Number(widget.resource.value) > 0
}

function toggle(widget) {
  if (!canToggle(widget) || typeof charCtx.updateValues !== 'function') return
  const activating = !widget.active
  let patch = {}
  if (activating && widget.resource?.key && Number(widget.resource.total) > 0) {
    patch = charCtx.characterResources?.setAvailable?.(widget.resource.key, Number(widget.resource.value) - 1) || {}
  }
  const currentRows = patch[widget.value_id] || values.value[widget.value_id] || []
  patch[widget.value_id] = currentRows.map(entry => String(entry.uid || entry.id || '') === widget.entry_key
    ? { ...entry, widget_states: { ...(entry.widget_states || {}), [widget.state_key]: activating } }
    : entry)
  charCtx.updateValues(patch)
  charCtx.logSessionEvent?.({
    type: 'feature_state',
    action: `${widget.title}: ${activating ? widget.active_label : 'выключено'}`,
  })
}
</script>

<style scoped>
.fw-list { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.fw-card { --fw-tone: var(--accent); box-sizing: border-box; width: 100%; padding: 13px; border-color: color-mix(in srgb, var(--fw-tone) 30%, var(--border)); background: linear-gradient(135deg, color-mix(in srgb, var(--fw-tone) 10%, var(--surface)), var(--surface) 62%); }
.fw-card--danger { --fw-tone: var(--danger); }
.fw-card--warning { --fw-tone: var(--warning); }
.fw-card--success { --fw-tone: var(--success); }
.fw-card--info { --fw-tone: var(--info); }
.fw-card--active { box-shadow: inset 3px 0 0 var(--fw-tone), 0 0 20px color-mix(in srgb, var(--fw-tone) 10%, transparent); }
.fw-head { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 10px; align-items: center; }
.fw-icon { color: var(--fw-tone); }
.fw-title { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.fw-title strong { color: var(--text-1); font-size: 13px; }
.fw-title span { color: var(--text-muted); font-size: 10px; line-height: 1.35; }
.fw-value { color: var(--fw-tone); font-size: 25px; font-weight: 850; letter-spacing: -.04em; }
.fw-dice { display: inline-flex; align-items: center; justify-content: flex-end; min-width: 58px; }
.fw-dice :deep(.dd-count) { font-size: 20px; }
.fw-value--compact { max-width: 92px; font-size: 15px; line-height: 1.1; text-align: right; }
.fw-details { display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0 0; padding: 0; list-style: none; }
.fw-details li { display: inline-flex; align-items: center; gap: 5px; padding: 4px 7px; border: 1px solid color-mix(in srgb, var(--fw-tone) 18%, transparent); border-radius: 999px; background: color-mix(in srgb, var(--fw-tone) 7%, transparent); color: var(--text-muted); font-size: 9px; line-height: 1.25; }
.fw-details li::before { width: 4px; height: 4px; border-radius: 50%; background: var(--fw-tone); content: ''; flex: 0 0 auto; }
.fw-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 11px; padding-top: 10px; border-top: 1px solid color-mix(in srgb, var(--fw-tone) 18%, var(--border)); }
.fw-resource { display: inline-flex; flex-direction: column; color: var(--text-muted); font-size: 10px; }
.fw-resource b { color: var(--text-1); font-size: 14px; }
.fw-toggle { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 6px 10px; border: 1px solid color-mix(in srgb, var(--fw-tone) 45%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--fw-tone) 11%, transparent); color: var(--fw-tone); cursor: pointer; font: inherit; font-size: 11px; font-weight: 750; }
.fw-toggle--active { background: var(--fw-tone); color: var(--text-on-accent); }
.fw-toggle:disabled { cursor: default; opacity: .45; }
.fw-notes { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.fw-note { display: flex; flex-direction: column; gap: 2px; padding: 7px 8px; border-radius: 7px; background: color-mix(in srgb, var(--fw-tone) 7%, transparent); font-size: 10px; }
.fw-note span { color: var(--text-muted); line-height: 1.35; }
</style>
