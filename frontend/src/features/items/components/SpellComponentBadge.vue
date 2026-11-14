<template>
  <div v-if="parts.length" class="spell-component-badge">
    <ActionButton class="spell-component-trigger" variant="secondary" :aria-label="label" aria-haspopup="dialog"
      :aria-expanded="open" :aria-controls="open ? popupId : undefined" @click.stop="toggle">
      <span class="spell-component-letters"><span v-for="part in parts" :key="part.key">{{ part.letter }}</span></span>
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
.spell-component-trigger {flex:1;--action-button-min-height:var(--layout-touch-min)}
.spell-component-letters {display:flex;align-items:center;gap:var(--spacing-compact);white-space:nowrap;color:var(--text-1)}
.spell-component-details {display:grid;gap:var(--spacing-medium);max-width:min(var(--layout-spell-component-popup-width),calc(100vw - var(--spacing-large)));padding:var(--spacing-large);color:var(--text-1);font-size:var(--type-group-size);line-height:var(--type-group-line-height)}
.spell-component-details p {display:flex;gap:var(--spacing-medium);margin:0;overflow-wrap:anywhere}
.spell-component-details strong {flex:none;color:var(--accent-soft)}
</style>
