<template>
  <div v-if="parts.length" class="spell-component-badge">
    <ActionButton class="spell-component-trigger" variant="quiet" icon-only :aria-label="label" aria-haspopup="dialog"
      :aria-expanded="open" :aria-controls="open ? popupId : undefined" @click.stop="toggle">
      <template #icon><span class="spell-component-letters" aria-hidden="true"><span v-for="part in parts" :key="part.key">{{ part.letter }}</span></span></template>
    </ActionButton>
    <BasePopover v-model:open="open" :anchor="anchor" :id="popupId" role="dialog" aria-label="Компоненты заклинания"
      placement="bottom-end" :min-width="layoutTokens['spell-component-popup-width']" :z-index="9500" transition-preset="action-menu">
      <div class="spell-component-details"><p v-for="part in parts" :key="part.key"><strong>{{ part.letter }}</strong><span>{{ part.label }}</span></p></div>
    </BasePopover>
  </div>
</template>
<script setup>
import { computed, ref, shallowRef, useId } from 'vue'
import { ActionButton, BasePopover } from '@sylvieshare/share-ui'
import { spellComponentDetails } from '@/shared/lib/spellPresentation'
import { layoutTokens } from '@/app/design-tokens'
const props = defineProps({ components: Object })
const parts = computed(() => spellComponentDetails(props.components))
const label = computed(() => 'Компоненты заклинания: ' + parts.value.map(part => part.letter).join(', '))
const open = ref(false), anchor = shallowRef(null), popupId = `spell-components-${useId()}`
function toggle(event) { anchor.value = event.currentTarget; open.value = !open.value }
</script>
<style scoped>
.spell-component-badge {display:flex;min-width:var(--layout-touch-min);justify-self:end;align-self:start}
.spell-component-trigger {--action-button-icon-size:var(--layout-touch-min);--surface-raised:transparent}
.spell-component-letters {display:flex;align-items:center;gap:var(--spacing-xs);padding:var(--spacing-xs) var(--spacing-compact);border-radius:var(--radius-small);background:color-mix(in srgb,var(--bg) 80%,transparent);white-space:nowrap;color:var(--text-1);font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-weight:600;transition:background var(--motion-feedback) ease}
.spell-component-trigger:hover .spell-component-letters,.spell-component-trigger:focus-visible .spell-component-letters {background:color-mix(in srgb,var(--bg) 92%,transparent)}
.spell-component-details {display:grid;gap:var(--spacing-medium);max-width:min(var(--layout-spell-component-popup-width),calc(100vw - var(--spacing-large)));padding:var(--spacing-large);color:var(--text-1);font-size:var(--type-group-size);line-height:var(--type-group-line-height)}
.spell-component-details p {display:flex;gap:var(--spacing-medium);margin:0;overflow-wrap:anywhere}
.spell-component-details strong {flex:none;color:var(--accent-soft)}
@media(prefers-reduced-motion:reduce){.spell-component-letters{transition:none}}
</style>
