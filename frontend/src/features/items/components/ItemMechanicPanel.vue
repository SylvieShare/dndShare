<template>
  <BaseTile class="item-mechanic-panel" framed :color="presentation.color" :style="{ '--mechanic-tone': presentation.color }" @click.stop @pointerdown.stop>
    <component :is="collapse ? 'details' : 'div'" ref="disclosure" class="item-mechanic-disclosure" @toggle="syncDisclosure">
      <component :is="collapse ? 'summary' : 'div'" ref="heading" class="item-mechanic-heading" :aria-expanded="collapse ? expanded : undefined" @click="toggleDisclosure">
        <div class="item-mechanic-icon"><slot name="icon"><component :is="presentation.icon" :size="24" /></slot></div>
        <div class="item-mechanic-title"><span>{{ presentation.label }}</span><strong>{{ title }}</strong></div>
        <div v-if="$slots.summary" class="item-mechanic-summary" @click.stop @pointerdown.stop @keydown.enter.stop @keydown.space.stop><slot name="summary" /></div>
        <ChevronDown v-if="collapse" class="item-mechanic-chevron" :class="{ expanded }" :size="16" aria-hidden="true" />
      </component>
      <div v-if="subtitle || $slots.default || $slots.actions" class="item-mechanic-expanded">
        <p v-if="subtitle" class="item-mechanic-subtitle">{{ subtitle }}</p>
        <div v-if="$slots.default" class="item-mechanic-body"><slot /></div>
        <div v-if="$slots.actions" class="item-mechanic-actions"><slot name="actions" /></div>
      </div>
    </component>
  </BaseTile>
</template>
<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { ChevronDown } from '@lucide/vue'
import { itemMechanicKinds } from '@/features/items/lib/itemMechanicPresentation'
const props = defineProps({ kind: { type: String, default: 'rule', validator: value => value in itemMechanicKinds }, title: String, subtitle: String, collapsible: { type: Boolean, default: undefined } })
const collapseContext = inject('weaponMechanicCollapse', false)
const collapse = computed(() => props.collapsible ?? collapseContext)
const presentation = computed(() => itemMechanicKinds[props.kind] || itemMechanicKinds.rule)
const disclosure = ref(null)
const heading = ref(null)
const expanded = ref(false)
let animation = null
let previousOverflow = ''

function syncDisclosure() {
  if (!animation && collapse.value) expanded.value = disclosure.value.open
}

function toggleDisclosure(event) {
  if (!collapse.value || event.target.closest('button, a, input, select, textarea, [role="button"]')) return
  event.preventDefault()
  const element = disclosure.value
  const from = element.getBoundingClientRect().height
  if (!animation) previousOverflow = element.style.overflow
  animation?.cancel()
  animation = null
  const next = !expanded.value
  expanded.value = next
  // Keep native content visible until the closing transition has finished.
  element.open = true
  const to = next ? element.getBoundingClientRect().height : heading.value.getBoundingClientRect().height
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(from - to) < 1) {
    element.open = next
    element.style.overflow = previousOverflow
    return
  }
  element.style.overflow = 'hidden'
  animation = element.animate([{ height: `${from}px` }, { height: `${to}px` }], {
    duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'both',
  })
  const current = animation
  current.onfinish = () => {
    if (animation !== current) return
    element.open = next
    current.cancel()
    animation = null
    element.style.overflow = previousOverflow
  }
}

onBeforeUnmount(() => animation?.cancel())
</script>
<style scoped>
.item-mechanic-panel { padding: 12px; min-width: 0; cursor: default; }
.item-mechanic-heading { display: flex; align-items: center; gap: 10px; list-style: none; }
summary.item-mechanic-heading { cursor: pointer; }
summary.item-mechanic-heading::-webkit-details-marker { display: none; }
summary.item-mechanic-heading:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
.item-mechanic-icon { display: flex; align-items: center; justify-content: center; color: var(--mechanic-tone); }
.item-mechanic-title { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.item-mechanic-title > span { display: block; margin-bottom: 3px; color: var(--mechanic-tone); font-size: 10px; font-weight: 650; }
.item-mechanic-title strong { font-size: 13px; color: var(--text-1); }
.item-mechanic-summary { flex-shrink: 0; max-width: 65%; min-width: 0; }
.item-mechanic-summary :deep(.item-resource), .item-mechanic-summary :deep(.item-resource-pips) { justify-content: flex-end; }
.item-mechanic-chevron { flex-shrink: 0; color: var(--text-muted); transition: transform 220ms cubic-bezier(0.2, 0, 0, 1); }
.item-mechanic-chevron.expanded { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) {
  .item-mechanic-chevron { transition: none; }
}
.item-mechanic-expanded { display: grid; gap: 10px; padding-top: 10px; }
.item-mechanic-subtitle { margin: 0; font-size: 12px; line-height: 1.4; color: var(--text-2); }
.item-mechanic-body { display: grid; gap: 8px; min-width: 0; }
.item-mechanic-body :deep(.mechanic-theses) { margin: 0; }
.item-mechanic-actions { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 8px; border-top: 1px solid var(--border); }
</style>
